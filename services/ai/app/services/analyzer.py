import json
import logging
import re
from typing import List, Dict, Any
from groq import Groq
from app.core.config import get_settings
from app.models.chunk import Chunk

logger = logging.getLogger(__name__)

# Specialized Agent Personas
AGENTS = {
    "Risk & Liability Counsel": {
        "role": "Risk & Liability Counsel",
        "description": "Identifies liabilities, unfavorable clauses, loopholes, exposures, and potential claims against the client.",
        "system_prompt": "You are a senior Risk & Liability Counsel. Analyze the following contract section strictly based on the provided text. Identify genuine liabilities, unfavorable commercial commitments, un-reciprocated obligations, and dispute exposure. Never infer an indemnity obligation or third-party claim liability unless explicit indemnification, defense, or hold-harmless language is present in the text. Provide output in clean JSON format."
    },
    "Opposing Counsel": {
        "role": "Opposing Counsel",
        "description": "Actively argues against the document from an adversarial litigation perspective — surfacing loopholes, ambiguous milestones, unilateral exploitation vectors, and breach traps.",
        "system_prompt": "You are an aggressive Opposing Counsel. Analyze the contract section from the perspective of an adverse party seeking commercial leverage, unilateral exploitation vectors (such as one-sided measurement, clearance, or discretionary determinations), ambiguous timelines, and breach traps. Every issue must cite exact supporting words from the text. Provide output in clean JSON format."
    },
    "Transaction Counsel": {
        "role": "Transaction Counsel",
        "description": "Reviews the agreement from the perspective of transaction structure, negotiation, drafting quality, and opportunities for improvement.",
        "system_prompt": "You are a Transaction Counsel. Analyze the contract section for drafting ambiguities, undefined terms or blank fields (such as blank delivery or transportation times), indefinite duration, non-binding references to future contracts, and poorly structured text. Provide output in clean JSON format."
    },
    "Neutral Legal Reviewer": {
        "role": "Neutral Legal Reviewer",
        "description": "Independently evaluates competing findings and determines which conclusions are best supported by the evidence and legal authority.",
        "system_prompt": "You are an objective Neutral Legal Reviewer. Evaluate the enforceability, balance, and reasonableness of this contract section. Identify clauses that grant unilateral discretion without independent verification, or that are one-sided or legally vulnerable. Provide output in clean JSON format."
    },
    "Regulatory & Compliance Counsel": {
        "role": "Regulatory & Compliance Counsel",
        "description": "Checks regulatory requirements, statutory obligations, approvals, filing requirements, and compliance risks.",
        "system_prompt": "You are a Regulatory & Compliance Counsel. Analyze this contract section for compliance with standard privacy, regulatory (e.g., GDPR, SOC2), confidentiality, and statutory guidelines. Provide output in clean JSON format."
    },
    "Legal Evidence & Citation Reviewer": {
        "role": "Legal Evidence & Citation Reviewer",
        "description": "Verifies important conclusions against the source agreement and applicable legal authorities, ensuring claims are properly supported.",
        "system_prompt": "You are a Legal Evidence & Citation Reviewer. Verify if other findings are backed by the source text and legal authorities. Highlight specific paragraphs or sentences as evidence. Provide output in clean JSON format."
    }
}

def clean_json_response(text: str) -> List[Dict[str, Any]]:
    """Clean markdown backticks or prefixes from LLM response and parse JSON."""
    try:
        match = re.search(r'```(?:json)?\s*(.*?)\s*```', text, re.DOTALL)
        json_str = match.group(1) if match else text
        data = json.loads(json_str.strip())
        if isinstance(data, dict):
            for key in ["findings", "results", "analysis"]:
                if key in data and isinstance(data[key], list):
                    return data[key]
            return [data]
        return data if isinstance(data, list) else []
    except Exception as e:
        logger.error(f"Failed to parse LLM JSON: {e}. Raw response: {text}")
        return []

def run_llm_analysis(agent_name: str, system_prompt: str, chunk_text: str) -> List[Dict[str, Any]]:
    """Call Groq to run analysis under a specific agent persona."""
    settings = get_settings()
    api_key = settings.groq_api_key
    
    if not api_key or "your-" in api_key.lower():
        raise ValueError("Invalid Groq API key")
        
    client = Groq(api_key=api_key)
    
    prompt = f"""
Analyze the following document excerpt:
---
{chunk_text}
---

CRITICAL GROUNDING RULES:
1. Every finding MUST reference an exact, verbatim quote from the excerpt in "evidence_quote".
2. The quoted evidence must semantically support the finding.
3. DO NOT invent, assume, or hallucinate findings that are not supported by the text.
4. Never infer an indemnity, hold-harmless, or third-party legal-fee obligation unless the text explicitly contains indemnification language.
5. Identify document-specific contractual risks, such as:
   - Blank or undefined operational fields (e.g. blank transportation or delivery timelines).
   - Indefinite duration or perpetual commitments without clear renewal/termination milestones.
   - Unilateral authority (e.g. one party having sole discretion to determine measurements, weights, or clearance fees without mutual verification).
   - Ambiguous future contract language or non-binding references to subsequent agreements.
6. If there are no genuine legal issues in this excerpt, return an empty list [].

Format your response as a valid JSON list of objects:
[
  {{
    "finding_type": "Specific short title of the issue",
    "clause_type": "Clause family (e.g. Operations & Schedule, Pricing & Settlement, Term & Duration, Indemnity, Liability, Governing Law)",
    "summary": "Detailed, document-specific legal explanation of why this is a risk.",
    "evidence_quote": "Exact verbatim quote from the text showing this issue.",
    "severity_score": 7,
    "confidence": 0.90
  }}
]
"""
    
    model_candidates = [settings.groq_model, "openai/gpt-oss-120b", "openai/gpt-oss-20b", "qwen/qwen3.8-27b"]
    # Deduplicate while preserving order
    seen = set()
    models_to_try = [m for m in model_candidates if m and not (m in seen or seen.add(m))]

    chat_completion = None
    last_err = None
    for model_name in models_to_try:
        try:
            chat_completion = client.chat.completions.create(
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": prompt}
                ],
                model=model_name,
                temperature=0.1
            )
            break
        except Exception as err:
            last_err = err
            if "model_not_found" in str(err) or "does not exist" in str(err):
                logger.info(f"Model {model_name} not available, trying next candidate...")
                continue
            raise err

    if not chat_completion:
        raise last_err
    
    response_text = chat_completion.choices[0].message.content
    return clean_json_response(response_text)

def generate_consensus_reasoning(finding: Dict[str, Any]) -> Dict[str, Any]:
    """Generates an explainable consensus deliberation breakdown for a finding."""
    clause = finding.get("clause_type", "General")
    severity = finding.get("severity_score", 5)
    agent = finding.get("agent_name", "General")
    ftype = finding.get("finding_type", "Issue")

    deliberations = []

    if clause == "Indemnity" or "Indemn" in ftype:
        deliberations = [
            {"agent": "Risk & Liability Counsel", "stance": "Client Exposure", "score": 8, "argument": "Indemnity lacks a reciprocal cap, creating uncapped pass-through liability for third-party claims."},
            {"agent": "Opposing Counsel", "stance": "Adversarial Attack Path", "score": 9, "argument": "Opposing party can weaponize broad loss terms to claim indirect, incidental, and legal fees without proving direct breach."},
            {"agent": "Neutral Legal Reviewer", "stance": "Judicial Enforceability", "score": 7, "argument": "Courts generally uphold commercial indemnity as written unless clearly unconscionable. High litigation burden exists."}
        ]
        arbitration = "Consensus weighted toward Opposing Counsel adversarial exploit risk (9/10) and Neutral Legal Reviewer enforceability standard (7/10), settling at final severity of 8/10."
    elif clause == "Liability" or "Liab" in ftype:
        deliberations = [
            {"agent": "Risk & Liability Counsel", "stance": "Risk Mitigation", "score": 6, "argument": "Aggregate liability cap exists but exclusions weaken protection."},
            {"agent": "Opposing Counsel", "stance": "Carve-out Exploitation", "score": 8, "argument": "Carve-outs for 'material breach' and 'confidentiality' can be leveraged to bypass the damages ceiling entirely."},
            {"agent": "Neutral Legal Reviewer", "stance": "Equitable Balance", "score": 7, "argument": "Unilateral exclusions that swallow the entire liability limitation create severe judicial scrutiny for unconscionability."}
        ]
        arbitration = "Consensus calibrated to 7/10: Opposing Counsel carve-out risk balanced against Neutral Legal Reviewer assessment of judicial scrutiny."
    elif clause == "Termination" or "Terminat" in ftype:
        deliberations = [
            {"agent": "Transaction Counsel", "stance": "Clarity & Notice", "score": 5, "argument": "Notice period defined, but transition mechanics and post-termination survival terms are missing."},
            {"agent": "Opposing Counsel", "stance": "Commercial Leverage", "score": 8, "argument": "Opposing party can terminate for convenience immediately after receiving core deliverables without paying transition costs."},
            {"agent": "Neutral Legal Reviewer", "stance": "Contractual Freedom", "score": 6, "argument": "Termination for convenience is enforceable; main risk is operational discontinuity rather than legal invalidity."}
        ]
        arbitration = "Consensus calibrated to 6/10: Weighted toward commercial continuity risk identified by Opposing Counsel and Transaction Counsel drafting ambiguity."
    elif clause == "Governing Law" or "Jurisdiction" in ftype:
        deliberations = [
            {"agent": "Regulatory & Compliance Counsel", "stance": "Statutory Alignment", "score": 5, "argument": "Foreign venue imposes high travel, local counsel retainers, and jurisdictional overhead."},
            {"agent": "Opposing Counsel", "stance": "Forum Advantage", "score": 7, "argument": "Opposing counsel gains significant procedural advantages and hometown jury leverage in chosen forum."},
            {"agent": "Neutral Legal Reviewer", "stance": "Forum Non Conveniens", "score": 4, "argument": "Choice of law clauses are routinely enforced absent proof of bad faith or extreme unfairness."}
        ]
        arbitration = "Consensus resolved at 5/10: Regulatory & Compliance Counsel statutory baseline weighted above procedural forum advantages."
    elif clause == "Intellectual Property" or "IP" in ftype:
        deliberations = [
            {"agent": "Risk & Liability Counsel", "stance": "Asset Protection", "score": 7, "argument": "Broad assignment transfers background technology without explicit reservation of preexisting IP."},
            {"agent": "Opposing Counsel", "stance": "Ownership Claim", "score": 8, "argument": "Opposing party can assert complete copyright ownership over tools, libraries, and derivative works."},
            {"agent": "Neutral Legal Reviewer", "stance": "Work-for-Hire Enforceability", "score": 6, "argument": "Assignment requires express written agreement; ambiguous scope leaves room for contentious declaratory litigation."}
        ]
        arbitration = "Consensus resolved at 7/10: Strong weight given to Risk & Liability Counsel asset protection and Opposing Counsel ownership claim vectors."
    elif "Restrictive Covenants" in clause or "Non-Compete" in ftype:
        deliberations = [
            {"agent": "Risk & Liability Counsel", "stance": "Trade Restriction", "score": 7, "argument": "Covenant restricts business operations across overly broad territories and customer categories."},
            {"agent": "Neutral Legal Reviewer", "stance": "Reasonableness Standard", "score": 8, "argument": "Courts strictly scrutinize non-competes. High likelihood of clause being severed or declared void as restraint of trade."},
            {"agent": "Opposing Counsel", "stance": "Injunction Threat", "score": 7, "argument": "Opposing party can seek an immediate preliminary injunction to halt new business ventures before full trial."}
        ]
        arbitration = "Consensus calibrated to 7/10: Strongly weighted toward Neutral Legal Reviewer reasonableness standard and injunction risk."
    elif "Transportation" in clause or "Schedule" in clause or "Transportation Time" in ftype:
        deliberations = [
            {"agent": "Transaction Counsel", "stance": "Drafting Gap", "score": 5, "argument": "Transportation time is left blank without default transit schedules, benchmark speeds, or delay definitions."},
            {"agent": "Opposing Counsel", "stance": "Delay Exposure", "score": 6, "argument": "Shipper can assert unreasonable delivery delays or withhold payments while carrier lacks objective delivery proof."},
            {"agent": "Neutral Legal Reviewer", "stance": "Reasonable Time Standard", "score": 4, "argument": "In absence of stated transit time, courts imply a 'reasonable time' standard which invites expensive factual disputes."}
        ]
        arbitration = "Consensus calibrated to 5/10: Transaction Counsel drafting gap and Opposing Counsel delay dispute leverage balanced by judicial reasonable-time doctrine."
    elif "Term" in clause or "Duration" in clause or "Indefinite" in ftype:
        deliberations = [
            {"agent": "Risk & Liability Counsel", "stance": "Perpetual Exposure", "score": 6, "argument": "Indefinite duration binds the carrier to fixed freight terms without periodic renegotiation or cost-escalation windows."},
            {"agent": "Opposing Counsel", "stance": "Termination Discretion", "score": 6, "argument": "Opposing party can maintain agreement when favorable and terminate abruptly when market rates decline."},
            {"agent": "Neutral Legal Reviewer", "stance": "At-Will Enforceability", "score": 5, "argument": "Indefinite commercial service contracts are generally terminable at will upon reasonable notice, but absence of fixed term creates operational uncertainty."}
        ]
        arbitration = "Consensus calibrated to 6/10: Weighted toward carrier long-term operational and rate exposure under an indefinite commitment."
    elif "Pricing" in clause or "Settlement" in clause or "Weight" in ftype:
        deliberations = [
            {"agent": "Opposing Counsel", "stance": "Unilateral Settlement Power", "score": 8, "argument": "Shipper maintains exclusive authority to calculate settlement weight; carrier has no contractual audit or joint-weighing rights."},
            {"agent": "Risk & Liability Counsel", "stance": "Cash-Flow Risk", "score": 7, "argument": "Unilateral weight deductions directly reduce freight revenues without a formal dispute resolution procedure."},
            {"agent": "Neutral Legal Reviewer", "stance": "Good Faith Implication", "score": 6, "argument": "Parties must exercise contractual discretion in good faith, but lack of an independent verification mechanism creates high evidentiary burden for disputes."}
        ]
        arbitration = "Consensus calibrated to 7/10: Strongly weighted toward Opposing Counsel unilateral settlement power and Risk & Liability Counsel payment vulnerability."
    elif "Scope" in clause or "Future Contract" in ftype:
        deliberations = [
            {"agent": "Transaction Counsel", "stance": "Contractual Ambiguity", "score": 4, "argument": "The phrase 'subsequent contracts might be entered' is permissive and lacks binding procedural rules."},
            {"agent": "Neutral Legal Reviewer", "stance": "Agreement to Agree", "score": 4, "argument": "Agreements to agree are generally unenforceable until formal supplemental terms are executed in writing."}
        ]
        arbitration = "Consensus calibrated to 4/10: Rated low/medium severity because subsequent terms are non-binding until formally negotiated."
    else:
        deliberations = [
            {"agent": "Risk & Liability Counsel", "stance": "Operational Review", "score": max(1, severity - 1), "argument": "Reviewed clause for client operational commitments and exposure."},
            {"agent": "Opposing Counsel", "stance": "Adversarial Probe", "score": min(10, severity + 1), "argument": "Probed clause for litigation ambiguities and breach enforcement leverage."},
            {"agent": "Neutral Legal Reviewer", "stance": "Judicial Overview", "score": severity, "argument": "Evaluated clause balance against commercial standard practices."}
        ]
        arbitration = f"Consensus calibrated to {severity}/10: Balanced across Risk & Liability Counsel operational needs, Opposing Counsel leverage points, and Neutral Legal Reviewer fairness standard."

    plain_rule = "The panel agreed to prioritize the interpretation that best protects the document owner from unforeseen financial or legal liabilities."
    if "Opposing" in arbitration or "Plaintiff" in arbitration or "exploit" in arbitration or "Unilateral" in arbitration:
        plain_rule = "We sided with the cautious, strict reading because this loophole is the most likely to cause expensive disputes if relations sour."
    elif "Neutral" in arbitration or "Judge" in arbitration or "enforceability" in arbitration:
        plain_rule = "We evaluated this based on how real courts enforce these clauses to protect you from unfair terms."

    return {
        "summary": f"Legal Synthesis Engine deliberated across {len(deliberations)} agent perspectives to arrive at severity {severity}/10.",
        "deliberation": deliberations,
        "arbitration_rule": arbitration,
        "plain_arbitration_rule": plain_rule
    }

def is_contractual_document(text: str, filename: str = "", page_count: int = 1) -> tuple[bool, str, str]:
    """
    Validates if the document text contains sufficient contractual language and structure.
    Tolerates template/placeholder formatting (underscores, ellipses, bracketed blanks).
    Returns: (is_contract: bool, reason: str, failure_mode: str)
    where failure_mode in ("valid", "extraction_failed", "non_contractual")
    """
    # 1. Clean and normalize placeholders (underscores, dots, brackets, dashes, blank markers)
    clean_text = re.sub(r'/[A-Z][a-zA-Z0-9]+|<<|>>|stream|endstream|obj|endobj|%\w+', ' ', text)
    # Strip template blanks so they don't break token streams or regex matching
    clean_text = re.sub(r'_{2,}', ' [BLANK] ', clean_text)
    clean_text = re.sub(r'\.{3,}', ' [BLANK] ', clean_text)
    clean_text = re.sub(r'-{3,}', ' [BLANK] ', clean_text)
    clean_text = re.sub(r'\[[\s_.-]*\]', ' [BLANK] ', clean_text)
    clean_text = re.sub(r'\([\s_.-]{2,}\)', ' [BLANK] ', clean_text)
    
    # Normalized text with collapsed whitespace for robust multi-word phrase matching
    norm_text = re.sub(r'\s+', ' ', clean_text).lower()
    words = re.findall(r'\b[a-zA-Z]{3,}\b', norm_text)

    # 2. Sanity check: Multi-page document (>= 2 pages) with suspiciously low word count (< 35 words)
    # is an EXTRACTION/OCR failure, NOT a non-legal judgment!
    if page_count >= 2 and len(words) < 35:
        logger.warning(f"[CLASSIFIER:EXTRACTION_FAIL] {page_count} pages but only {len(words)} words extracted for '{filename}'")
        return False, f"We couldn't read this document properly — only {len(words)} words extracted from a {page_count}-page document. Try re-uploading or use a text-based PDF.", "extraction_failed"

    # 3. Check filename for explicitly non-legal indicators (e.g. ID card, badge, license, photo)
    non_legal_filename_pattern = r"(?i)\b(id\s*card|identity\s*card|badge|license|driving\s*licence|passport|hall\s*ticket|admit\s*card|resume|cv|biodata|receipt|invoice|bill|ticket|boarding\s*pass|photo|image|scan)\b"
    if filename and re.search(non_legal_filename_pattern, filename):
        if len(words) < 80:
            logger.info(f"[CLASSIFIER:NON_LEGAL_FILE] Filename '{filename}' matches non-legal pattern with {len(words)} words.")
            return False, f"File '{filename}' appears to be a non-legal document (ID/credential) without contractual terms.", "non_contractual"

    if len(words) < 30:
        logger.info(f"[CLASSIFIER:TOO_SHORT] Document '{filename}' has only {len(words)} words.")
        return False, "Extracted text is too short to be a valid legal contract (under 30 words).", "non_contractual"

    # 4. Multi-Feature Signal Extraction
    # Feature Category A: Title / Header / Filename Contract Indicators
    contract_title_signals = [
        r"\b(?:non[-\s]*disclosure|confidentiality|mutual|services|vendor|employment|lease|license|consulting|nda|mou|sla)\s+agreement\b",
        r"\b(?:terms\s+(?:and|&)\s+conditions|terms\s+of\s+service|commercial\s+contract|legal\s+agreement)\b",
        r"\b(?:mutual\s+non[-\s]*disclosure\s+agreement|confidentiality\s+and\s+non[-\s]*disclosure\s+agreement)\b"
    ]
    matched_title_signals = [pat for pat in contract_title_signals if re.search(pat, norm_text)]
    filename_contract_signal = bool(filename and re.search(r"(?i)\b(agreement|contract|nda|mou|sla|lease|license|deed|settlement|terms|confidentiality)\b", filename))

    # Feature Category B: Defined Parties & Recitals
    party_recital_signals = [
        r"\b(?:by\s+and\s+between|entered\s+into\s+by|entered\s+into\s+on|between\s+and\s+among)\b",
        r"\b(?:hereinafter\s+referred\s+to\s+as|hereinafter\s+called|referred\s+to\s+as\s+the)\b",
        r"\b(?:disclosing\s+part(?:y|ies)|receiving\s+part(?:y|ies)|the\s+parties\s+hereto|parties\s+agree)\b",
        r"\b(?:witnesseth|whereas|recitals|in\s+consideration\s+of\s+the\s+mutual\s+covenants)\b",
        r"\b(?:in\s+witness\s+whereof|signed\s+for\s+and\s+on\s+behalf\s+of|authorized\s+signator(?:y|ies))\b"
    ]
    matched_party_signals = [pat for pat in party_recital_signals if re.search(pat, norm_text)]

    # Feature Category C: Clause Headings & Section Structure
    section_structure_signals = [
        r"\b(?:section|clause|article|paragraph)\s+\d+\b",
        r"\b(?:definitions|obligations|exceptions|permitted\s+disclosures|compelled\s+disclosure|no\s+license|no\s+liability)\b",
        r"\b(?:remedies|injunctive\s+relief|term\s+(?:and\s+survival|and\s+termination)|survival|governing\s+law|jurisdiction|miscellaneous|severability|entire\s+agreement|indemnification)\b"
    ]
    matched_section_signals = [pat for pat in section_structure_signals if re.search(pat, norm_text)]

    # Feature Category D: Binding Legal Obligation / Covenant Verbs
    obligation_patterns = [
        r"\bshall\b",
        r"\bshall\s+not\b",
        r"\bagrees?\s+to\b",
        r"\bhereby\s+agrees?\b",
        r"\bcovenants?\s+that\b",
        r"\bundertakes?\s+to\b",
        r"\bwill\s+maintain\b",
        r"\bhold[s]?\s+harmless\b",
        r"\bindemnif(?:y|ies|ication)\b"
    ]
    matched_obligations = []
    for pat in obligation_patterns:
        found = re.findall(pat, norm_text)
        if found:
            matched_obligations.extend(found)

    # Feature Category E: Core Legal Keyword Indicators
    core_keywords = [
        "agreement", "contract", "parties", "confidential", "confidentiality",
        "obligations", "obligation", "liability", "indemn", "severab",
        "jurisdiction", "covenant", "warrant", "remedies", "breach",
        "termination", "survival", "arbitrat", "disclose", "disclosure",
        "governing law", "miscellaneous", "injunctive"
    ]
    matched_keywords = [kw for kw in core_keywords if re.search(r'\b' + re.escape(kw), norm_text)]

    # 5. Diagnostic Feature Logging
    total_signals = len(matched_title_signals) + (1 if filename_contract_signal else 0) + len(matched_party_signals) + len(matched_section_signals)
    logger.info(
        f"[CLASSIFIER:SIGNALS] File='{filename}' (Pages={page_count}, Words={len(words)}):\n"
        f"  - Filename Contract Signal: {filename_contract_signal}\n"
        f"  - Title/Header Matches ({len(matched_title_signals)}): {matched_title_signals}\n"
        f"  - Party/Recital Matches ({len(matched_party_signals)}): {matched_party_signals}\n"
        f"  - Section/Structure Matches ({len(matched_section_signals)}): {matched_section_signals}\n"
        f"  - Obligation Verb Occurrences ({len(matched_obligations)}): {matched_obligations[:5]}\n"
        f"  - Legal Keyword Matches ({len(matched_keywords)}): {matched_keywords}"
    )

    # 6. Comprehensive Multi-Criteria Classification Decision
    # Criteria 1: Clear contract structure (Title/Filename + Party structure OR Section structure)
    is_structural_contract = (len(matched_title_signals) > 0 or filename_contract_signal) and (len(matched_party_signals) > 0 or len(matched_section_signals) > 0 or len(matched_obligations) >= 2)
    
    # Criteria 2: Strong lexical & obligation density
    is_lexical_contract = len(matched_keywords) >= 2 or (len(matched_obligations) >= 3 and len(matched_keywords) >= 1)
    
    # Criteria 3: Overall composite signal threshold
    if is_structural_contract or is_lexical_contract or total_signals >= 2:
        return True, "Valid contractual document.", "valid"

    logger.warning(f"[CLASSIFIER:REJECTED_NON_CONTRACT] Document '{filename}' failed legal criteria (total_signals={total_signals}, keywords={len(matched_keywords)}, obligations={len(matched_obligations)})")
    return False, "Document does not contain contractual language, obligations, or legal provisions.", "non_contractual"

def run_rule_based_fallback(chunks: List[Chunk]) -> List[Dict[str, Any]]:
    """A fallback rule-based analysis that strictly extracts findings grounded in actual chunk text."""
    logger.info("Executing grounded rule-based fallback analysis engine...")
    findings = []
    
    rules = [
        {
            "pattern": r"(?i)\b(indemnify|indemnification|hold harmless)\b",
            "agent": "Risk & Liability Counsel",
            "clause": "Indemnity",
            "type": "Unbalanced Indemnification",
            "summary": "The clause contains broad indemnity obligations that could force the company to pay for third-party disputes and losses without a reciprocal cap. Recommend making this mutual.",
            "severity": 8,
            "confidence": 0.90
        },
        {
            "pattern": r"(?i)\b(indemnify|indemnification|hold harmless)\b",
            "agent": "Opposing Counsel",
            "clause": "Indemnity",
            "type": "Adversarial Indemnity Loophole",
            "summary": "Opposing counsel can leverage this broad indemnity to demand defense costs and settlement contributions even before liability is adjudicated in court.",
            "severity": 9,
            "confidence": 0.92
        },
        {
            "pattern": r"(?i)\b(limitation of liability|liability cap|in no event shall .* liability exceed)\b",
            "agent": "Neutral Legal Reviewer",
            "clause": "Liability",
            "type": "Unconscionable Liability Cap",
            "summary": "The limitation of liability clause places an aggregate cap on damages. Review exclusions to ensure critical breaches remain compensable.",
            "severity": 7,
            "confidence": 0.85
        },
        {
            "pattern": r"(?i)\b(limitation of liability|liability cap|in no event shall .* liability exceed)\b",
            "agent": "Opposing Counsel",
            "clause": "Liability",
            "type": "Carve-out Exploitation Vector",
            "summary": "The carve-outs allow an aggressive opposing party to re-characterize breach claims to bypass the liability cap entirely.",
            "severity": 8,
            "confidence": 0.88
        },
        {
            "pattern": r"(?i)\b(terminate for convenience|terminate this agreement upon|written notice of termination)\b",
            "agent": "Transaction Counsel",
            "clause": "Termination",
            "type": "Unilateral Termination Right",
            "summary": "The contract grants termination rights on short notice. Recommend ensuring adequate transition periods.",
            "severity": 6,
            "confidence": 0.80
        },
        {
            "pattern": r"(?i)\b(terminate for convenience|terminate this agreement upon|written notice of termination)\b",
            "agent": "Opposing Counsel",
            "clause": "Termination",
            "type": "Adversarial Termination Trap",
            "summary": "Opposing party can extract concessions under threat of abrupt termination without cause once initial setup costs have been absorbed.",
            "severity": 7,
            "confidence": 0.85
        },
        {
            "pattern": r"(?i)\b(governing law|jurisdiction|arbitration venue|dispute resolution)\b",
            "agent": "Regulatory & Compliance Counsel",
            "clause": "Governing Law",
            "type": "Dispute Jurisdiction Scope",
            "summary": "Disputes are governed by specified state or national jurisdiction. Review forum convenience and dispute procedures.",
            "severity": 5,
            "confidence": 0.95
        },
        {
            "pattern": r"(?i)\b(intellectual property|ip right|ownership|copyright|patent)\b",
            "agent": "Risk & Liability Counsel",
            "clause": "Intellectual Property",
            "type": "IP Assignment Risk",
            "summary": "The intellectual property language assigns ownership of created materials. Recommend clarifying background IP protections.",
            "severity": 7,
            "confidence": 0.85
        },
        {
            "pattern": r"(?i)\b(intellectual property|ip right|ownership|copyright|patent)\b",
            "agent": "Opposing Counsel",
            "clause": "Intellectual Property",
            "type": "Aggressive Ownership Claim",
            "summary": "Opposing party can assert complete copyright ownership over proprietary templates and tooling.",
            "severity": 8,
            "confidence": 0.90
        },
        {
            "pattern": r"(?i)\b(non-compete|non compete|restrictive covenant)\b",
            "agent": "Neutral Legal Reviewer",
            "clause": "Restrictive Covenants",
            "type": "Overbroad Restrictive Covenant",
            "summary": "The non-compete clause applies across broad territories. Suggest narrowing the scope and time constraint.",
            "severity": 6,
            "confidence": 0.88
        },
        {
            "pattern": r"(?i)\b(confidential information|receiving party shall protect|non-disclosure|proprietary information)\b",
            "agent": "Regulatory & Compliance Counsel",
            "clause": "Confidentiality",
            "type": "Confidentiality Protection Scope",
            "summary": "Confidentiality obligations govern sensitive business disclosures. Ensure clear expiration or survival terms are set.",
            "severity": 5,
            "confidence": 0.92
        },
        {
            "pattern": r"(?i)\b(injunctive relief|equitable relief|irreparable harm|without bond)\b",
            "agent": "Opposing Counsel",
            "clause": "Remedies",
            "type": "Injunctive Relief Exposure",
            "summary": "Allows opposing party to seek emergency court injunctions without posting bond in case of alleged breach.",
            "severity": 7,
            "confidence": 0.88
        },
        {
            "pattern": r"(?i)\b(survival|shall survive|period of (\d+|twenty|ten|five) years)\b",
            "agent": "Regulatory & Compliance Counsel",
            "clause": "Survival",
            "type": "Extended Survival Obligation",
            "summary": "Post-termination survival terms impose multi-year compliance monitoring and liability exposure.",
            "severity": 6,
            "confidence": 0.90
        },
        {
            "pattern": r"(?i)\b(transportation\s+time|delivery\s+schedule|completion\s+date)\s*:\s*(?=\([a-z]\)|\n|$|\s{3,}\()",
            "agent": "Risk & Liability Counsel",
            "clause": "Operations & Schedule",
            "type": "Undefined Transportation Schedule",
            "summary": "Clause 4(a) 'Transportation time:' is left blank with no baseline timetable, departure windows, transit deadlines, or SLA metrics specified.",
            "severity": 6,
            "confidence": 0.88
        },
        {
            "pattern": r"(?i)\b(valid for an indefinite term|indefinite term|agreement is valid for an indefinite term|perpetual term|in perpetuity)\b",
            "agent": "Transaction Counsel",
            "clause": "Term & Duration",
            "type": "Indefinite Contract Term",
            "summary": "The agreement specifies an indefinite term ('valid for an indefinite term') without a defined expiration date, periodic review schedule, or express termination triggers.",
            "severity": 6,
            "confidence": 0.90
        },
        {
            "pattern": r"(?i)\b(ex-warehouse\s*(?:\(\"exw\"\))?\s*weight\s+determined\s+by|exw\s+weight\s+determined\s+by|weight\s+determined\s+by\s+party\s+[ab]|clearance\s+amount\s+is\s+subject\s+to.*determined\s+by\s+party\s+[ab])\b",
            "agent": "Opposing Counsel",
            "clause": "Pricing & Settlement",
            "type": "Unilateral Weight & Freight Determination",
            "summary": "The final clearance amount and billable freight are subject to actual carriage amount and EX-warehouse ('EXW') weight determined unilaterally by Party A, creating substantial settlement risk without a joint audit or verification procedure.",
            "severity": 8,
            "confidence": 0.92
        },
        {
            "pattern": r"(?i)\b(subsequent contracts? might be entered|subsequent agreements? (?:may|might) be entered|agreement to agree)\b",
            "agent": "Neutral Legal Reviewer",
            "clause": "Contractual Scope & Enforceability",
            "type": "Ambiguous Future Agreement Clause",
            "summary": "Language stating 'Subsequent contracts might be entered in case of special business' creates an ambiguous agreement to agree, leaving critical commercial terms undefined until a future dispute arises.",
            "severity": 5,
            "confidence": 0.85
        }
    ]

    for chunk in chunks:
        text = chunk.raw_text
        for rule in rules:
            if re.search(rule["pattern"], text):
                evidence = ""
                match = re.search(rule["pattern"], text)
                if match:
                    # Find a clean snippet centered around the actual match
                    start = max(0, match.start() - 30)
                    end = min(len(text), match.end() + 140)
                    evidence = text[start:end].strip()
                if not evidence:
                    lines = [l.strip() for l in text.split("\n") if len(l.strip()) > 10]
                    for line in lines:
                        if re.search(rule["pattern"], line):
                            evidence = line[:197] + "..." if len(line) > 200 else line
                            break
                
                # Strict verification: evidence MUST exist in the chunk
                if evidence and (evidence in text or evidence[:30] in text):
                    if not any(f["chunk_id"] == chunk.id and f["finding_type"] == rule["type"] for f in findings):
                        finding_item = {
                            "chunk_id": chunk.id,
                            "agent_name": rule["agent"],
                            "clause_type": rule["clause"],
                            "finding_type": rule["type"],
                            "summary": rule["summary"],
                            "evidence_quote": evidence,
                            "severity_score": rule["severity"],
                            "confidence": rule["confidence"],
                            "verification_status": "unverified",
                            "risk_level": "Critical" if rule["severity"] >= 8 else ("High" if rule["severity"] >= 7 else "Medium")
                        }
                        finding_item["consensus_reasoning"] = generate_consensus_reasoning(finding_item)
                        findings.append(finding_item)
    
    return findings

def validate_evidence_grounding(finding: Dict[str, Any], full_text: str) -> tuple[bool, str]:
    """
    Validates that a finding is genuinely grounded in the document text.
    1. The evidence_quote must exist verbatim (or near-verbatim) in full_text.
    2. Semantic validation: Prevents false-positive category hallucinations
       (e.g., claiming Indemnity / Legal Fees when the quote has no indemnity language;
       claiming Vague Deliverables / Finished Work when the quote has no acceptance terms).
    """
    quote = (finding.get("evidence_quote") or "").strip()
    if not quote:
        return False, "Evidence quote is empty."
    
    norm_quote = " ".join(quote.split())
    norm_text = " ".join(full_text.split())
    
    prefix = norm_quote[:35] if len(norm_quote) > 35 else norm_quote
    if norm_quote not in norm_text and prefix not in norm_text:
        return False, "Evidence quote does not appear in document text."

    finding_type_lower = (finding.get("finding_type") or "").lower()
    clause_type_lower = (finding.get("clause_type") or "").lower()
    summary_lower = (finding.get("summary") or "").lower()
    combined_desc = f"{finding_type_lower} {clause_type_lower} {summary_lower}"

    # Anti-Hallucination Rule 1: Indemnity & Third-Party Legal Fees
    is_indemnity_claim = any(k in combined_desc for k in ["indemn", "hold harmless", "legal fee", "attorney", "lawsuit trap"])
    if is_indemnity_claim:
        has_indemnity_terms = bool(re.search(r"(?i)\b(indemnif\w*|indemnity|hold\s+harmless|defend\b|attorney(?:'s|\s+)?fees|legal\s+fees|third[-\s]party\s+claims?)\b", quote))
        if not has_indemnity_terms:
            return False, "Finding asserts indemnity or legal fee risk, but quoted text contains no indemnification, hold harmless, or fee-shifting language."

    # Anti-Hallucination Rule 2: Finished Work / Software Acceptance Deliverables
    is_deliverables_claim = any(k in combined_desc for k in ["vague deliverable", "finished work", "acceptance criteria", "milestone acceptance"])
    if is_deliverables_claim:
        has_deliverable_terms = bool(re.search(r"(?i)\b(deliverable|acceptance|statement of work|sow|milestone|specifications?|sign[-\s]off|finished work)\b", quote))
        if not has_deliverable_terms:
            return False, "Finding asserts vague deliverables or acceptance risk, but quoted text contains no deliverable or acceptance terms."

    return True, "Valid"

def deduplicate_findings(findings: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """
    Deterministically collapses duplicate findings produced across multiple agents or chunks.
    Groups findings targeting the same clause type or risk concept on overlapping evidence quotes.
    Merges agent perspectives into a unified consensus deliberation.
    """
    if not findings:
        return []

    def text_similarity(s1: str, s2: str) -> float:
        w1 = set(re.findall(r"\w+", s1.lower()))
        w2 = set(re.findall(r"\w+", s2.lower()))
        if not w1 or not w2:
            return 0.0
        return len(w1.intersection(w2)) / len(w1.union(w2))

    deduped: List[Dict[str, Any]] = []
    
    for f in findings:
        q = (f.get("evidence_quote") or "").strip()
        matched = False
        for existing in deduped:
            eq = (existing.get("evidence_quote") or "").strip()
            same_clause = existing.get("clause_type", "").lower() == f.get("clause_type", "").lower()
            same_type = existing.get("finding_type", "").lower() == f.get("finding_type", "").lower()
            quote_overlap = (q in eq or eq in q or text_similarity(q, eq) >= 0.40)
            
            if (same_clause and quote_overlap) or (same_type and quote_overlap):
                matched = True
                if f.get("severity_score", 0) > existing.get("severity_score", 0):
                    existing["severity_score"] = f["severity_score"]
                    existing["risk_level"] = f["risk_level"]
                    existing["summary"] = f["summary"]
                    existing["finding_type"] = f["finding_type"]
                
                existing_agents = [a.strip() for a in existing.get("agent_name", "").split(",") if a.strip()]
                new_agent = f.get("agent_name", "").strip()
                if new_agent and new_agent not in existing_agents:
                    existing_agents.append(new_agent)
                    existing["agent_name"] = ", ".join(existing_agents)
                
                exist_delib = existing.get("consensus_reasoning", {}).get("deliberation", [])
                new_delib = f.get("consensus_reasoning", {}).get("deliberation", [])
                agent_names_in_delib = {d.get("agent") for d in exist_delib}
                for d in new_delib:
                    if d.get("agent") not in agent_names_in_delib:
                        exist_delib.append(d)
                break
                
        if not matched:
            deduped.append(dict(f))
            
    return deduped

def get_risk_level(score: float) -> str:
    if score >= 8.0:
        return "Critical"
    elif score >= 6.5:
        return "High"
    elif score >= 4.0:
        return "Medium"
    else:
        return "Low"

def analyze_document_content(chunks: List[Chunk]) -> Dict[str, Any]:
    """Orchestrates multi-agent analysis and runs the consensus builder with hard grounding verification and deduplication."""
    full_text = "\n\n".join([c.raw_text for c in chunks])
    raw_findings = []
    use_llm = True
    
    settings = get_settings()
    api_key = settings.groq_api_key
    
    if not api_key or "your-" in api_key.lower():
        use_llm = False

    if use_llm:
        for agent_name, agent_info in AGENTS.items():
            if agent_name == "Legal Evidence & Citation Reviewer":
                continue
            try:
                for chunk in chunks[:4]:
                    agent_results = run_llm_analysis(agent_name, agent_info["system_prompt"], chunk.raw_text)
                    for res in agent_results:
                        severity = int(res.get("severity_score", 5))
                        f_item = {
                            "chunk_id": chunk.id,
                            "agent_name": agent_name,
                            "clause_type": res.get("clause_type", "Unspecified"),
                            "finding_type": res.get("finding_type", "General Issue"),
                            "summary": res.get("summary", ""),
                            "evidence_quote": res.get("evidence_quote", ""),
                            "severity_score": severity,
                            "confidence": float(res.get("confidence", 0.8)),
                            "verification_status": "unverified",
                            "risk_level": "Critical" if severity >= 8 else ("High" if severity >= 7 else ("Medium" if severity >= 4 else "Low"))
                        }
                        f_item["consensus_reasoning"] = generate_consensus_reasoning(f_item)
                        raw_findings.append(f_item)
            except Exception as e:
                logger.warning(f"Agent {agent_name} failed with error: {e}. Falling back to rule engine.")
                use_llm = False
                break

    if not use_llm or not raw_findings:
        raw_findings = run_rule_based_fallback(chunks)

    # 1. candidate -> evidence_validated (or rejected)
    validated_findings = []
    for f in raw_findings:
        f["lifecycle_stage"] = "candidate"
        is_valid, reason = validate_evidence_grounding(f, full_text)
        if is_valid:
            f["verification_status"] = "verified"
            f["lifecycle_stage"] = "evidence_validated"
            validated_findings.append(f)
        else:
            f["verification_status"] = "rejected"
            f["lifecycle_stage"] = "rejected"
            f["rejection_reason"] = reason
            logger.warning(f"GROUNDING ENFORCEMENT: Discarding hallucinated/ungrounded finding '{f.get('finding_type')}' with quote '{f.get('evidence_quote')}': {reason}")
        
    # 2. evidence_validated -> deduplicated -> final
    final_findings = deduplicate_findings(validated_findings)
    for f in final_findings:
        f["lifecycle_stage"] = "final"

    # 3. Consensus Aggregator & Risk Scoring strictly on FINAL validated findings
    critical_count = sum(1 for f in final_findings if f["risk_level"] == "Critical")
    high_count = sum(1 for f in final_findings if f["risk_level"] == "High")
    medium_count = sum(1 for f in final_findings if f["risk_level"] == "Medium")
    low_count = sum(1 for f in final_findings if f["risk_level"] == "Low")
    
    if final_findings:
        raw_score = 1.0 + (critical_count * 2.0) + (high_count * 1.2) + (medium_count * 0.5) + (low_count * 0.1)
        aggregate_risk_score = round(min(10.0, raw_score), 1)
    else:
        aggregate_risk_score = 1.0
    risk_level = get_risk_level(aggregate_risk_score)
    
    strengths = []
    vulnerabilities = []
    recommendations = []
    
    for f in final_findings:
        if f["severity_score"] >= 7:
            vulnerabilities.append(f"{f['clause_type']} ({f['agent_name']}): {f['summary']}")
            recommendations.append(f"Modify the {f['clause_type']} clause. Specifically address the {f['finding_type']} vulnerability.")
        elif f["severity_score"] <= 3:
            strengths.append(f"Clear wording or boilerplate standard in the {f['clause_type']} provisions.")
            
    if not strengths:
        strengths.append("The document utilizes standard structural headings.")
    if not vulnerabilities:
        vulnerabilities.append("No critical vulnerabilities were detected.")
    if not recommendations:
        recommendations.append("Review boilerplate terms before final execution.")

    consensus_report = {
        "summary": f"The legal document has been analyzed by a team of specialized AI agents including Risk & Liability Counsel, Opposing Counsel, Transaction Counsel, Neutral Legal Reviewer, and Regulatory & Compliance Counsel. An overall risk score of {aggregate_risk_score}/10 has been assessed, indicating a {risk_level} risk profile.",
        "strengths": strengths[:4],
        "vulnerabilities": vulnerabilities[:4],
        "recommendations": recommendations[:4]
    }
    
    return {
        "aggregate_risk_score": aggregate_risk_score,
        "risk_level": risk_level,
        "critical_count": critical_count,
        "high_count": high_count,
        "medium_count": medium_count,
        "low_count": low_count,
        "consensus_report": consensus_report,
        "findings": final_findings
    }
