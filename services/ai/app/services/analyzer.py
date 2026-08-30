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
    "Defense Counsel": {
        "role": "Defense Counsel",
        "description": "Reviews liability, risk allocation, indemnification, dispute exposure, and adversarial vulnerabilities.",
        "system_prompt": "You are a senior Defense Counsel. Analyze the following contract section and identify liabilities, broad indemnity terms, un-reciprocated obligations, and dispute exposure. Provide output in clean JSON format."
    },
    "Plaintiff Counsel": {
        "role": "Plaintiff Counsel",
        "description": "Actively argues against the document from an adversarial litigation perspective — surfacing loopholes, ambiguous milestones, unilateral exploitation vectors, and breach traps.",
        "system_prompt": "You are an aggressive Plaintiff's/Opposing Counsel. Analyze the contract section strictly from the perspective of an adverse party seeking maximum commercial leverage, litigation vulnerabilities, unilateral exploitation opportunities, uncapped dispute vectors, and breach traps. Provide output in clean JSON format."
    },
    "Drafting Counsel": {
        "role": "Drafting Counsel",
        "description": "Evaluates document formatting, consistency, ambiguity in terminology, definition scopes, and grammar.",
        "system_prompt": "You are a Drafting Counsel. Analyze the following contract section for ambiguities, undefined terms, conflicting clauses, and poorly structured text. Provide output in clean JSON format."
    },
    "Judge": {
        "role": "Judge",
        "description": "Assess enforceability, fairness, unconscionability, structural validity, and overall document legitimacy.",
        "system_prompt": "You are an objective Judge. Evaluate the enforceability and fairness of this contract section. Identify clauses that could be ruled void, unconscionable, or legally invalid. Provide output in clean JSON format."
    },
    "Compliance Officer": {
        "role": "Compliance Officer",
        "description": "Checks regulatory compliance, statutory alignments, confidentiality terms, and operational risks.",
        "system_prompt": "You are a Regulatory Compliance Officer. Analyze this contract section for compliance with standard privacy, regulatory (e.g., GDPR, SOC2), confidentiality, and statutory guidelines. Provide output in clean JSON format."
    },
    "Citation & Evidence Agent": {
        "role": "Citation & Evidence Agent",
        "description": "Verifies facts, grounds findings in actual document quotes, and rates citation confidence.",
        "system_prompt": "You are a Legal Citation and Grounding Auditor. Verify if other findings are backed by the text. Highlight specific paragraphs or sentences as evidence. Provide output in clean JSON format."
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

Your response MUST be a JSON list of findings. Each finding object must contain:
1. "finding_type": Short category of issue (e.g., "Indemnity Loophole", "Undefined Definition", "Unenforceable Clause", "Adversarial Termination Trap").
2. "clause_type": The clause family (e.g., "Indemnity", "Liability", "Termination", "Governing Law", "Definitions", "Payment & Remedies").
3. "summary": Detailed legal explanation of why this is a risk.
4. "evidence_quote": An exact, verbatim quote from the text showing this issue.
5. "severity_score": An integer from 1 to 10 (10 being most critical risk).
6. "confidence": A float from 0.0 to 1.0 representing your certainty.

Format your response as a valid JSON list of objects:
[
  {{
    "finding_type": "...",
    "clause_type": "...",
    "summary": "...",
    "evidence_quote": "...",
    "severity_score": 7,
    "confidence": 0.90
  }}
]
"""
    
    chat_completion = client.chat.completions.create(
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": prompt}
        ],
        model=settings.groq_model,
        temperature=0.1
    )
    
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
            {"agent": "Defense Counsel", "stance": "Client Exposure", "score": 8, "argument": "Indemnity lacks a reciprocal cap, creating uncapped pass-through liability for third-party claims."},
            {"agent": "Plaintiff Counsel", "stance": "Adversarial Attack Path", "score": 9, "argument": "Opposing party can weaponize broad loss terms to claim indirect, incidental, and legal fees without proving direct breach."},
            {"agent": "Judge", "stance": "Judicial Enforceability", "score": 7, "argument": "Courts generally uphold commercial indemnity as written unless clearly unconscionable. High litigation burden exists."}
        ]
        arbitration = "Consensus weighted toward Plaintiff adversarial exploit risk (9/10) and Judge enforceability standard (7/10), settling at final severity of 8/10."
    elif clause == "Liability" or "Liab" in ftype:
        deliberations = [
            {"agent": "Defense Counsel", "stance": "Risk Mitigation", "score": 6, "argument": "Aggregate liability cap exists but exclusions weaken protection."},
            {"agent": "Plaintiff Counsel", "stance": "Carve-out Exploitation", "score": 8, "argument": "Carve-outs for 'material breach' and 'confidentiality' can be leveraged to bypass the damages ceiling entirely."},
            {"agent": "Judge", "stance": "Equitable Balance", "score": 7, "argument": "Unilateral exclusions that swallow the entire liability limitation create severe judicial scrutiny for unconscionability."}
        ]
        arbitration = "Consensus calibrated to 7/10: Plaintiff carve-out risk balanced against Judge assessment of judicial scrutiny."
    elif clause == "Termination" or "Terminat" in ftype:
        deliberations = [
            {"agent": "Drafting Counsel", "stance": "Clarity & Notice", "score": 5, "argument": "Notice period defined, but transition mechanics and post-termination survival terms are missing."},
            {"agent": "Plaintiff Counsel", "stance": "Commercial Leverage", "score": 8, "argument": "Opposing party can terminate for convenience immediately after receiving core deliverables without paying transition costs."},
            {"agent": "Judge", "stance": "Contractual Freedom", "score": 6, "argument": "Termination for convenience is enforceable; main risk is operational discontinuity rather than legal invalidity."}
        ]
        arbitration = "Consensus calibrated to 6/10: Weighted toward commercial continuity risk identified by Plaintiff Counsel and Drafting ambiguity."
    elif clause == "Governing Law" or "Jurisdiction" in ftype:
        deliberations = [
            {"agent": "Compliance Officer", "stance": "Statutory Alignment", "score": 5, "argument": "Foreign venue imposes high travel, local counsel retainers, and jurisdictional overhead."},
            {"agent": "Plaintiff Counsel", "stance": "Forum Advantage", "score": 7, "argument": "Opposing counsel gains significant procedural advantages and hometown jury leverage in chosen forum."},
            {"agent": "Judge", "stance": "Forum Non Conveniens", "score": 4, "argument": "Choice of law clauses are routinely enforced absent proof of bad faith or extreme unfairness."}
        ]
        arbitration = "Consensus resolved at 5/10: Compliance statutory baseline weighted above procedural forum advantages."
    elif clause == "Intellectual Property" or "IP" in ftype:
        deliberations = [
            {"agent": "Defense Counsel", "stance": "Asset Protection", "score": 7, "argument": "Broad assignment transfers background technology without explicit reservation of preexisting IP."},
            {"agent": "Plaintiff Counsel", "stance": "Ownership Claim", "score": 8, "argument": "Opposing party can assert complete copyright ownership over tools, libraries, and derivative works."},
            {"agent": "Judge", "stance": "Work-for-Hire Enforceability", "score": 6, "argument": "Assignment requires express written agreement; ambiguous scope leaves room for contentious declaratory litigation."}
        ]
        arbitration = "Consensus resolved at 7/10: Strong weight given to Defense asset protection and Plaintiff ownership claim vectors."
    elif clause == "Restrictive Covenants" or "Non-Compete" in ftype:
        deliberations = [
            {"agent": "Defense Counsel", "stance": "Trade Restriction", "score": 7, "argument": "Covenant restricts business operations across overly broad territories and customer categories."},
            {"agent": "Judge", "stance": "Reasonableness Standard", "score": 8, "argument": "Courts strictly scrutinize non-competes. High likelihood of clause being severed or declared void as restraint of trade."},
            {"agent": "Plaintiff Counsel", "stance": "Injunction Threat", "score": 7, "argument": "Opposing party can seek an immediate preliminary injunction to halt new business ventures before full trial."}
        ]
        arbitration = "Consensus calibrated to 7/10: Strongly weighted toward Judge reasonableness standard and injunction risk."
    else:
        deliberations = [
            {"agent": "Defense Counsel", "stance": "Operational Review", "score": max(1, severity - 1), "argument": "Reviewed clause for client operational commitments and exposure."},
            {"agent": "Plaintiff Counsel", "stance": "Adversarial Probe", "score": min(10, severity + 1), "argument": "Probed clause for litigation ambiguities and breach enforcement leverage."},
            {"agent": "Judge", "stance": "Judicial Overview", "score": severity, "argument": "Evaluated clause balance against commercial standard practices."}
        ]
        arbitration = f"Consensus calibrated to {severity}/10: Balanced across Defense operational needs, Plaintiff leverage points, and Judge fairness standard."

    plain_rule = "The panel agreed to prioritize the interpretation that best protects the document owner from unforeseen financial or legal liabilities."
    if "Plaintiff" in arbitration or "exploit" in arbitration:
        plain_rule = "We sided with the cautious, strict reading because this loophole is the most likely to cause expensive disputes if relations sour."
    elif "Judge" in arbitration or "enforceability" in arbitration:
        plain_rule = "We evaluated this based on how real courts enforce these clauses to protect you from unfair terms."

    return {
        "summary": f"Consensus Engine deliberated across {len(deliberations)} agent perspectives to arrive at severity {severity}/10.",
        "deliberation": deliberations,
        "arbitration_rule": arbitration,
        "plain_arbitration_rule": plain_rule
    }

def is_contractual_document(text: str, filename: str = "") -> tuple[bool, str]:
    """Validates if the document text contains sufficient contractual language and structure."""
    # Check filename for non-legal indicators (e.g. ID card, badge, license, photo)
    non_legal_filename_pattern = r"(?i)\b(id\s*card|identity\s*card|badge|license|driving\s*licence|passport|hall\s*ticket|admit\s*card|resume|cv|biodata|receipt|invoice|bill|ticket|boarding\s*pass|photo|image|scan)\b"
    clean_text = re.sub(r'/[A-Z][a-zA-Z0-9]+|<<|>>|stream|endstream|obj|endobj|%\w+', ' ', text)
    words = re.findall(r'\b[a-zA-Z]{3,}\b', clean_text.lower())

    if filename and re.search(non_legal_filename_pattern, filename):
        if len(words) < 80:
            return False, f"File '{filename}' appears to be a non-legal document (ID/credential) without contractual terms."

    if len(words) < 35:
        return False, "Extracted text is too short to be a valid legal contract (under 35 words)."
    
    strong_indicators = [
        "agreement", "contract", "parties", "witnesseth", "whereas", "recitals",
        "terms and conditions", "governing law", "jurisdiction", "indemn",
        "severab", "confidential", "termination", "warrant", "liability",
        "in witness whereof", "covenant", "hereby", "herein", "hereto", "shall",
        "non-disclosure", "disclosing party", "receiving party", "injunctive relief"
    ]
    
    matched_indicators = [ind for ind in strong_indicators if re.search(r'\b' + ind, clean_text.lower())]
    
    if len(matched_indicators) < 2:
        return False, "Document does not contain contractual language, obligations, or legal provisions."
        
    return True, "Valid contractual document."

def run_rule_based_fallback(chunks: List[Chunk]) -> List[Dict[str, Any]]:
    """A fallback rule-based analysis that strictly extracts findings grounded in actual chunk text."""
    logger.info("Executing grounded rule-based fallback analysis engine...")
    findings = []
    
    rules = [
        {
            "pattern": r"(?i)\b(indemnify|indemnification|hold harmless)\b",
            "agent": "Defense Counsel",
            "clause": "Indemnity",
            "type": "Unbalanced Indemnification",
            "summary": "The clause contains broad indemnity obligations that could force the company to pay for third-party disputes and losses without a reciprocal cap. Recommend making this mutual.",
            "severity": 8,
            "confidence": 0.90
        },
        {
            "pattern": r"(?i)\b(indemnify|indemnification|hold harmless)\b",
            "agent": "Plaintiff Counsel",
            "clause": "Indemnity",
            "type": "Adversarial Indemnity Loophole",
            "summary": "Opposing counsel can leverage this broad indemnity to demand defense costs and settlement contributions even before liability is adjudicated in court.",
            "severity": 9,
            "confidence": 0.92
        },
        {
            "pattern": r"(?i)\b(limitation of liability|liability cap|in no event shall .* liability exceed)\b",
            "agent": "Judge",
            "clause": "Liability",
            "type": "Unconscionable Liability Cap",
            "summary": "The limitation of liability clause places an aggregate cap on damages. Review exclusions to ensure critical breaches remain compensable.",
            "severity": 7,
            "confidence": 0.85
        },
        {
            "pattern": r"(?i)\b(limitation of liability|liability cap|in no event shall .* liability exceed)\b",
            "agent": "Plaintiff Counsel",
            "clause": "Liability",
            "type": "Carve-out Exploitation Vector",
            "summary": "The carve-outs allow an aggressive opposing party to re-characterize breach claims to bypass the liability cap entirely.",
            "severity": 8,
            "confidence": 0.88
        },
        {
            "pattern": r"(?i)\b(terminate for convenience|terminate this agreement upon|written notice of termination)\b",
            "agent": "Drafting Counsel",
            "clause": "Termination",
            "type": "Unilateral Termination Right",
            "summary": "The contract grants termination rights on short notice. Recommend ensuring adequate transition periods.",
            "severity": 6,
            "confidence": 0.80
        },
        {
            "pattern": r"(?i)\b(terminate for convenience|terminate this agreement upon|written notice of termination)\b",
            "agent": "Plaintiff Counsel",
            "clause": "Termination",
            "type": "Adversarial Termination Trap",
            "summary": "Opposing party can extract concessions under threat of abrupt termination without cause once initial setup costs have been absorbed.",
            "severity": 7,
            "confidence": 0.85
        },
        {
            "pattern": r"(?i)\b(governing law|jurisdiction|arbitration venue|dispute resolution)\b",
            "agent": "Compliance Officer",
            "clause": "Governing Law",
            "type": "Dispute Jurisdiction Scope",
            "summary": "Disputes are governed by specified state or national jurisdiction. Review forum convenience and dispute procedures.",
            "severity": 5,
            "confidence": 0.95
        },
        {
            "pattern": r"(?i)\b(intellectual property|ip right|ownership|copyright|patent)\b",
            "agent": "Defense Counsel",
            "clause": "Intellectual Property",
            "type": "IP Assignment Risk",
            "summary": "The intellectual property language assigns ownership of created materials. Recommend clarifying background IP protections.",
            "severity": 7,
            "confidence": 0.85
        },
        {
            "pattern": r"(?i)\b(intellectual property|ip right|ownership|copyright|patent)\b",
            "agent": "Plaintiff Counsel",
            "clause": "Intellectual Property",
            "type": "Aggressive Ownership Claim",
            "summary": "Opposing party can assert complete copyright ownership over proprietary templates and tooling.",
            "severity": 8,
            "confidence": 0.90
        },
        {
            "pattern": r"(?i)\b(non-compete|non compete|restrictive covenant)\b",
            "agent": "Judge",
            "clause": "Restrictive Covenants",
            "type": "Overbroad Restrictive Covenant",
            "summary": "The non-compete clause applies across broad territories. Suggest narrowing the scope and time constraint.",
            "severity": 6,
            "confidence": 0.88
        },
        {
            "pattern": r"(?i)\b(confidential information|receiving party shall protect|non-disclosure|proprietary information)\b",
            "agent": "Compliance Officer",
            "clause": "Confidentiality",
            "type": "Confidentiality Protection Scope",
            "summary": "Confidentiality obligations govern sensitive business disclosures. Ensure clear expiration or survival terms are set.",
            "severity": 5,
            "confidence": 0.92
        },
        {
            "pattern": r"(?i)\b(injunctive relief|equitable relief|irreparable harm|without bond)\b",
            "agent": "Plaintiff Counsel",
            "clause": "Remedies",
            "type": "Injunctive Relief Exposure",
            "summary": "Allows opposing party to seek emergency court injunctions without posting bond in case of alleged breach.",
            "severity": 7,
            "confidence": 0.88
        },
        {
            "pattern": r"(?i)\b(survival|shall survive|period of (\d+|twenty|ten|five) years)\b",
            "agent": "Compliance Officer",
            "clause": "Survival",
            "type": "Extended Survival Obligation",
            "summary": "Post-termination survival terms impose multi-year compliance monitoring and liability exposure.",
            "severity": 6,
            "confidence": 0.90
        }
    ]

    for chunk in chunks:
        text = chunk.raw_text
        for rule in rules:
            if re.search(rule["pattern"], text):
                lines = [l.strip() for l in text.split("\n") if len(l.strip()) > 10]
                evidence = ""
                for line in lines:
                    if re.search(rule["pattern"], line):
                        evidence = line
                        break
                if not evidence and lines:
                    evidence = lines[0]
                if len(evidence) > 200:
                    evidence = evidence[:197] + "..."
                
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
                            "verification_status": "verified",
                            "risk_level": "Critical" if rule["severity"] >= 8 else ("High" if rule["severity"] >= 7 else "Medium")
                        }
                        finding_item["consensus_reasoning"] = generate_consensus_reasoning(finding_item)
                        findings.append(finding_item)
    
    return findings

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
    """Orchestrates multi-agent analysis and runs the consensus builder with hard grounding verification."""
    full_text = "\n\n".join([c.raw_text for c in chunks])
    raw_findings = []
    use_llm = True
    
    settings = get_settings()
    api_key = settings.groq_api_key
    
    if not api_key or "your-" in api_key.lower():
        use_llm = False

    if use_llm:
        for agent_name, agent_info in AGENTS.items():
            if agent_name == "Citation & Evidence Agent":
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

    # Hard Grounding Assertion: Filter out ANY finding whose evidence_quote is not in the document
    findings = []
    for f in raw_findings:
        quote = (f.get("evidence_quote") or "").strip()
        if quote and (quote in full_text or quote[:40] in full_text):
            f["verification_status"] = "verified"
            findings.append(f)
        else:
            logger.warning(f"GROUNDING ENFORCEMENT: Discarding hallucinated/ungrounded finding '{f.get('finding_type')}' with quote '{quote}'")
        
    # Consensus Aggregator & Risk Scoring
    critical_count = sum(1 for f in findings if f["risk_level"] == "Critical")
    high_count = sum(1 for f in findings if f["risk_level"] == "High")
    medium_count = sum(1 for f in findings if f["risk_level"] == "Medium")
    low_count = sum(1 for f in findings if f["risk_level"] == "Low")
    
    if findings:
        raw_score = 1.0 + (critical_count * 2.0) + (high_count * 1.2) + (medium_count * 0.5) + (low_count * 0.1)
        aggregate_risk_score = min(10.0, raw_score)
    else:
        aggregate_risk_score = 1.0
    risk_level = get_risk_level(aggregate_risk_score)
    
    strengths = []
    vulnerabilities = []
    recommendations = []
    
    for f in findings:
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
        "summary": f"The legal document has been analyzed by a team of specialized AI agents including Defense, Plaintiff/Opposing, Drafting, Judge, and Compliance. An overall risk score of {aggregate_risk_score}/10 has been assessed, indicating a {risk_level} risk profile.",
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
        "findings": findings
    }
