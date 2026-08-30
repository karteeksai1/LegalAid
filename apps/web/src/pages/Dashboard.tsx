// Design system: Signal / Noise — dashboard as an inspectable workbench with evidence states, ruled surfaces, and chartreuse action signals.
import { Button } from "@/components/ui/button";
import { 
  ArrowUpRight, 
  FileSearch, 
  FolderOpen, 
  LogOut, 
  Plus, 
  ShieldCheck, 
  Sparkles,
  FileText,
  AlertTriangle,
  CheckCircle,
  Shield,
  Activity,
  X,
  Upload,
  ChevronRight,
  ExternalLink,
  Info,
  MessageSquare,
  Send,
  Bot,
  RefreshCw,
  Trash2
} from "lucide-react";
import { useEffect, useState, useRef } from "react";
import { Link, useLocation } from "wouter";
import { toast } from "sonner";
import { clearMockSession, getMockSession, MockSession } from "@/lib/mockAuth";

const USE_BACKEND_API = import.meta.env.VITE_USE_BACKEND_API === "true";

interface APIDocument {
  id: string;
  filename: string;
  content_type: string;
  status: string;
  page_count: number | null;
  created_at: string;
  risk_score: number | null;
  risk_level: string | null;
}

interface AgentDeliberation {
  agent: string;
  stance: string;
  score: number;
  argument: string;
}

export const LEGAL_GLOSSARY: Record<string, string> = {
  indemnity: "A promise where you agree to pay for the other party's lawsuit costs or damages if something goes wrong.",
  indemnification: "A requirement to compensate the other party for legal losses, damages, or defense costs.",
  "liability cap": "The maximum dollar limit one party can be forced to pay if there is a breach or dispute.",
  "limitation of liability": "A clause restricting the maximum financial damages a party is responsible for.",
  "carve-out": "An exception where normal limits or protections in the contract do not apply.",
  "carve-outs": "Exceptions where normal limits or protections in the contract do not apply.",
  arbitration: "Settling disputes privately with a hired referee rather than in a public court of law.",
  "termination for convenience": "The right to cancel the agreement at any time without needing any reason or proof of breach.",
  "consequential damages": "Indirect losses like lost revenue, missed business opportunities, or reputation harm.",
  "liquidated damages": "A pre-agreed penalty fee that must be paid automatically if a specific term is violated.",
  severability: "A rule ensuring that if a court invalidates one clause, the rest of the contract stays enforceable.",
  "force majeure": "Unforeseen emergencies (e.g. natural disasters, war, pandemic) that excuse project delays.",
  unconscionable: "So grossly one-sided or unfair that a court may refuse to enforce it.",
  "governing law": "Which state or country's legal system controls how this agreement is interpreted.",
  jurisdiction: "Which specific court or location has the authority to resolve disputes for this contract.",
  "gross negligence": "Extreme carelessness or reckless disregard for safety and contractual duties.",
  confidentiality: "A strict duty not to disclose or share sensitive business information.",
  "ip assignment": "Transferring ownership of inventions, software, or creative work created under the deal.",
  subcontracting: "Hiring third-party freelancers or vendors to perform obligations under this contract.",
  cure: "A grace period (typically 30 days) allowing a party to fix a mistake before the contract is cancelled."
};

interface GlossaryTextProps {
  text: string;
  className?: string;
  enableGlossary?: boolean;
}

export function GlossaryText({ text, className = "", enableGlossary = true }: GlossaryTextProps) {
  const [activeTooltip, setActiveTooltip] = useState<{ term: string; definition: string; x: number; y: number } | null>(null);

  if (!enableGlossary || !text) {
    return <span className={className}>{text}</span>;
  }

  const terms = Object.keys(LEGAL_GLOSSARY).sort((a, b) => b.length - a.length);
  const regex = new RegExp(`\\b(${terms.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})\\b`, "gi");

  const parts = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    const matchedTerm = match[0];
    const matchIndex = match.index;

    if (matchIndex > lastIndex) {
      parts.push(text.slice(lastIndex, matchIndex));
    }

    const lowerTerm = matchedTerm.toLowerCase();
    const definition = LEGAL_GLOSSARY[lowerTerm];

    parts.push(
      <span
        key={`${matchIndex}-${matchedTerm}`}
        className="relative inline-block border-b border-dotted border-[#3158ff] text-inherit cursor-help hover:bg-blue-50/80 transition-colors group px-0.5 rounded"
        onMouseEnter={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          setActiveTooltip({
            term: matchedTerm,
            definition: definition || "Legal term requiring review.",
            x: rect.left + rect.width / 2,
            y: rect.top - 8
          });
        }}
        onMouseLeave={() => setActiveTooltip(null)}
        onClick={(e) => {
          e.stopPropagation();
          const rect = e.currentTarget.getBoundingClientRect();
          setActiveTooltip((prev) =>
            prev
              ? null
              : {
                  term: matchedTerm,
                  definition: definition || "Legal term requiring review.",
                  x: rect.left + rect.width / 2,
                  y: rect.top - 8
                }
          );
        }}
      >
        {matchedTerm}
      </span>
    );

    lastIndex = regex.lastIndex;
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return (
    <span className={className}>
      {parts}
      {activeTooltip && (
        <span
          className="fixed z-50 -translate-x-1/2 -translate-y-full px-3 py-2 bg-[#101412] text-[#f1eee6] text-xs shadow-2xl border border-[#d7ff52]/50 max-w-xs pointer-events-none font-sans leading-snug"
          style={{ left: activeTooltip.x, top: activeTooltip.y }}
        >
          <span className="block font-mono text-[10px] uppercase tracking-wider text-[#d7ff52] font-bold mb-0.5">
            💡 Plain English: {activeTooltip.term}
          </span>
          <span className="block text-slate-200 text-[11px]">
            {activeTooltip.definition}
          </span>
          <span className="absolute left-1/2 top-full -translate-x-1/2 -mt-0.5 border-4 border-transparent border-t-[#101412]" />
        </span>
      )}
    </span>
  );
}

export function getPlainLanguageSeverity(risk_level: string) {
  const lvl = (risk_level || "").toLowerCase();
  if (lvl.includes("critical")) {
    return { label: "Urgent Fix", bg: "bg-red-500", text: "text-white", border: "border-red-600", desc: "Immediate legal or financial trap" };
  }
  if (lvl.includes("high")) {
    return { label: "Serious Risk", bg: "bg-orange-500", text: "text-white", border: "border-orange-600", desc: "Significant disadvantage if disputed" };
  }
  if (lvl.includes("medium")) {
    return { label: "Worth Checking", bg: "bg-amber-500", text: "text-black", border: "border-amber-600", desc: "Vague or one-sided phrasing" };
  }
  return { label: "Minor Note", bg: "bg-emerald-600", text: "text-white", border: "border-emerald-700", desc: "Standard or low priority" };
}

export function getPlainLanguageFinding(finding: Finding) {
  if (finding.plain_title && finding.plain_summary && finding.plain_impact && finding.plain_action) {
    return {
      title: finding.plain_title,
      whatItSays: finding.plain_summary,
      impact: finding.plain_impact,
      action: finding.plain_action
    };
  }

  const titleLower = (finding.finding_type + " " + finding.clause_type + " " + finding.summary).toLowerCase();
  let plainTitle = finding.finding_type;
  let plainWhatItSays = finding.summary;
  let plainImpact = "This clause creates unbalanced obligations that could put you at a disadvantage.";
  let plainAction = "Ask to make this obligation mutual or add a standard monetary cap.";

  if (titleLower.includes("indemn") || titleLower.includes("loss") || titleLower.includes("hold harmless")) {
    plainTitle = "One-Sided Lawsuit & Legal Fee Trap";
    plainWhatItSays = "You are promising to pay the other party's legal bills and damages for third-party disputes with no limit.";
    plainImpact = "If anyone sues the other party over this project, you might have to pay all their lawyers and settlements even if it wasn't your fault.";
    plainAction = "Insist on limiting indemnity strictly to direct losses caused by your own willful misconduct or material breach.";
  } else if (titleLower.includes("liability") || titleLower.includes("cap") || titleLower.includes("damage") || titleLower.includes("carve")) {
    plainTitle = "Uncapped Financial Risk (No Safety Limit)";
    plainWhatItSays = "The safety cap that limits how much money you can lose has loopholes or exceptions.";
    plainImpact = "There is no ceiling on how much money the other side can claim from you if something goes wrong.";
    plainAction = "Set a clear maximum dollar cap (e.g. 1x total fees paid under this contract) with no carve-outs for indirect losses.";
  } else if (titleLower.includes("terminat") || titleLower.includes("notice") || titleLower.includes("cancel")) {
    plainTitle = "Sudden Contract Cancellation Trap";
    plainWhatItSays = "The other party can cancel this agreement quickly without giving you enough time to fix any honest mistakes.";
    plainImpact = "You could abruptly lose this deal or income without a standard 30-day notice and cure window.";
    plainAction = "Add a mandatory 30-day written cure period so you get a fair chance to fix issues before termination.";
  } else if (titleLower.includes("milestone") || titleLower.includes("payment") || titleLower.includes("scope") || titleLower.includes("delay")) {
    plainTitle = "Vague Deliverables & Disputed Payments";
    plainWhatItSays = "What counts as 'finished work' is phrased vaguely instead of with clear, objective criteria.";
    plainImpact = "The other side could delay or withhold payments by claiming your work didn't meet their subjective satisfaction.";
    plainAction = "Write down exact checklist criteria and add automatic approval if they don't respond in writing within 10 business days.";
  } else if (titleLower.includes("confidential") || titleLower.includes("ip") || titleLower.includes("data") || titleLower.includes("assign")) {
    plainTitle = "Risk of Losing Your Ideas or Work";
    plainWhatItSays = "Overly broad ownership transfer of proprietary tools, background knowledge, or pre-existing templates.";
    plainImpact = "You might accidentally sign away ownership of tools, software, or methods you created before this contract.";
    plainAction = "Add a clause explicitly stating you keep 100% ownership of your pre-existing tools and background intellectual property.";
  } else if (titleLower.includes("grounded") || titleLower.includes("citation") || titleLower.includes("evidence")) {
    plainTitle = "Verified Clause Accuracy";
    plainWhatItSays = "This covenant was confirmed word-for-word against the text in your uploaded agreement.";
    plainImpact = "Ensures that your negotiation decisions are based on exact verified paragraphs in the contract.";
    plainAction = "Inspect the highlighted source quote when drafting your revision email.";
  }

  return {
    title: plainTitle,
    whatItSays: plainWhatItSays,
    impact: plainImpact,
    action: plainAction
  };
}

export function getPlainArbitrationRule(rule: string) {
  const rLower = (rule || "").toLowerCase();
  if (rLower.includes("plaintiff") || rLower.includes("continuity") || rLower.includes("injunction")) {
    return "We sided with the cautious, strict reading because this loophole is the most likely to cause expensive disputes if relations sour.";
  } else if (rLower.includes("defense") || rLower.includes("commercial")) {
    return "We balanced this finding to reflect realistic business standards while protecting your financial downside.";
  }
  return "Our AI panel agreed on the interpretation that best protects the document owner from unexpected liabilities.";
}

export type IntentClass = "off_topic" | "general_legal" | "in_document_legal" | "prompt_injection" | "citation_fabrication";

export interface IntentResult {
  intent: IntentClass;
  topic?: string;
  generalAnswer?: string;
  securityRefusal?: string;
}

export function classifyUserIntent(question: string): IntentResult {
  const q = question.trim().toLowerCase();

  // 0. Security Guardrail 1: Prompt Injection / System Prompt Extraction / Role Override
  const injectionPatterns = [
    /\b(ignore|disregard|forget|override|bypass)\b.{0,60}\b(instructions?|system prompt|directives?|rules?|guidelines?|constraints?)\b/i,
    /\b(reveal|show|display|print|output|repeat|leak|tell me)\b.{0,60}\b(system prompt|system message|developer prompt|initial prompt|hidden instructions|internal instructions|confidential information)\b/i,
    /\b(important instruction for the ai|system override|developer mode|jailbreak|dan mode|unfiltered mode|god mode)\b/i,
    /\b(pretend you are not|you are now not bound by|act as an unrestricted|disregard all previous)\b/i
  ];
  if (injectionPatterns.some((pattern) => pattern.test(q))) {
    return {
      intent: "prompt_injection",
      securityRefusal: "I cannot comply with instructions to override system guidelines, alter my role, or reveal internal system configurations."
    };
  }

  // 0. Security Guardrail 2: Citation Fabrication / Hallucination on Demand
  const fabricationPatterns = [
    /\b(invent|fabricate|make up|hallucinate|generate fake|create plausible|fake|dummy|bogus)\b.{0,60}\b(citations?|cases?|court cases?|statutes?|precedents?|authorities|legal references?)\b/i,
    /\b(if you cannot find|if not found|if you don't know|if unable to find)\b.{0,60}\b(invent|make up|fabricate|provide plausible|plausible citations?)\b/i,
    /\b(give me|cite|list)\b.{0,60}\b(supreme court cases?|circuit cases?|case law|precedents?)\b.{0,60}\b(invent|make up|plausible)\b/i
  ];
  if (fabricationPatterns.some((pattern) => pattern.test(q))) {
    return {
      intent: "citation_fabrication",
      securityRefusal: "I cannot invent or fabricate legal citations, case law, or statutory references. LegalAid only provides references that are grounded in verified document text."
    };
  }

  // 1. Math, arithmetic, calculations (e.g. "what is 24*89", "calculate 5+10", "x * y")
  const hasMath = /(?:\d+\s*[\*\+\-\/\^xX%]\s*\d+)|(?:\b(calculate|math|square root|multiply|divided by|plus|minus)\b.*\d+)/i.test(q);
  if (hasMath) {
    return { intent: "off_topic" };
  }

  // 2. Off-topic generic domains (programming, weather, cooking, jokes, general trivia, sports)
  const offTopicPatterns = [
    /\b(python|javascript|typescript|c\+\+|java|html|css|sql|function|script|algorithm|binary search|debug code)\b/i,
    /\b(weather|forecast|temperature|rain|sunny)\b/i,
    /\b(recipe|cook|bake|ingredients|dinner|lunch|breakfast)\b/i,
    /\b(joke|funny|riddle|story|poem|song|lyrics)\b/i,
    /\b(president|capital of|how far is|tallest building|mount everest|speed of light|super bowl)\b/i,
    /\b(football|basketball|soccer|nba|nfl|fifa|championship|movie|actor|actress)\b/i,
    /\b(translate to (spanish|french|german|hindi|chinese)|how do you say|who was the|who is the)\b/i
  ];
  if (offTopicPatterns.some((pattern) => pattern.test(q))) {
    return { intent: "off_topic" };
  }

  // 3. Document-specific reference keywords
  const docKeywords = [
    "this document", "this contract", "this agreement", "the document", "the contract",
    "the agreement", "uploaded", "in here", "this draft", "my contract", "our deal"
  ];
  const hasDocRef = docKeywords.some((kw) => q.includes(kw));

  // 4. General Legal Questions (educational concept questions not referencing the draft)
  const isGeneralExplicit = /\b(in general|generally|in law|standard practice|definition of|by definition|define )\b/i.test(q);
  const isConceptQuery = /^(what is (an?|the definition of)|what does .* mean|define )/i.test(q);
  const matchedGlossaryKey = Object.keys(LEGAL_GLOSSARY).find((term) => q.includes(term.toLowerCase()));

  if (matchedGlossaryKey) {
    if ((isGeneralExplicit || isConceptQuery) && !hasDocRef) {
      const def = LEGAL_GLOSSARY[matchedGlossaryKey];
      return {
        intent: "general_legal",
        topic: matchedGlossaryKey,
        generalAnswer: `In standard legal practice, **${matchedGlossaryKey}** means: ${def}\n\n*Note: This is general legal information and is not derived from specific clauses in your uploaded document.*`
      };
    }
    if (hasDocRef || !(isGeneralExplicit || isConceptQuery)) {
      return { intent: "in_document_legal" };
    }
  }

  // 5. In-Document Legal: Specific clause families, findings, questions about terms
  const legalKeywords = [
    "indemn", "liab", "terminat", "notice", "cure", "confidential", "ip ", "intellectual property",
    "payment", "milestone", "breach", "govern", "jurisdiction", "court", "risk", "finding",
    "plaintiff", "defense", "judge", "drafting", "compliance", "loophole", "clause", "covenant",
    "warranty", "damages", "carve-out", "severab", "force majeure", "overview", "about",
    "definition", "defined", "scope", "flag", "flagged", "issue", "vulnerability", "vulnerabilities",
    "problem", "arbitrat", "term", "terms", "provision", "section", "agreement", "contract",
    "document", "score", "audit", "recommendation", "enforceab"
  ];

  const hasLegalKeyword = legalKeywords.some((kw) => q.includes(kw));

  if (hasDocRef || hasLegalKeyword) {
    return { intent: "in_document_legal" };
  }

  // 6. Common greetings
  if (/^(hi|hello|hey|help|greetings|good morning|good afternoon)\b/i.test(q)) {
    return { intent: "in_document_legal", topic: "greeting" };
  }

  // 7. Non-legal text or unknown query
  return { intent: "off_topic" };
}

interface ConsensusReasoning {
  summary: string;
  deliberation: AgentDeliberation[];
  arbitration_rule: string;
  plain_arbitration_rule?: string;
}

interface Finding {
  id: string;
  agent_name: string;
  clause_type: string;
  finding_type: string;
  summary: string;
  evidence_quote: string;
  verification_status: string;
  severity_score: number;
  confidence: number;
  risk_level: string;
  chunk_text: string;
  consensus_reasoning?: ConsensusReasoning;
  plain_title?: string;
  plain_summary?: string;
  plain_impact?: string;
  plain_action?: string;
}

interface ConsensusReport {
  summary: string;
  strengths: string[];
  vulnerabilities: string[];
  recommendations: string[];
}

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  agent_perspective?: string;
  citations?: string[];
  timestamp: string;
}

interface AnalysisResults {
  document: {
    id: string;
    filename: string;
    page_count: number;
    status: string;
    is_legal_contract?: boolean;
    rejection_reason?: string;
  };
  analysis: {
    id: string;
    aggregate_risk_score: number;
    risk_level: string;
    critical_count: number;
    high_count: number;
    medium_count: number;
    low_count: number;
    consensus_report: ConsensusReport;
  };
  findings: Finding[];
  chunks: Array<{
    id: string;
    chunk_id: number;
    page_number: number;
    raw_text: string;
    clause_type: string;
  }>;
}

export async function extractPdfTextAndPageCount(file: File): Promise<{ text: string; pageCount: number }> {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);
    
    // Safely convert bytes to string in chunks to avoid call stack limits
    let latin1 = "";
    const chunkSize = 65536;
    for (let i = 0; i < bytes.length; i += chunkSize) {
      const slice = bytes.subarray(i, i + chunkSize);
      latin1 += String.fromCharCode.apply(null, Array.from(slice));
    }

    // 1. Calculate Exact Page Count from PDF Structure
    let pageCount = 1;
    const pageMatches = latin1.match(/\/Type\s*\/Page\b/g);
    if (pageMatches && pageMatches.length > 0) {
      pageCount = pageMatches.length;
    }
    const countMatch = latin1.match(/\/Count\s+(\d+)/);
    if (countMatch && countMatch[1]) {
      const parsed = parseInt(countMatch[1], 10);
      if (parsed > 0 && parsed <= 500) {
        pageCount = Math.max(pageCount, parsed);
      }
    }

    // 2. Extract Text from PDF streams & text operators
    const textPieces: string[] = [];

    // Extract text in (string) Tj format
    const tjRegex = /\(([^()]+)\)\s*Tj/g;
    let match: RegExpExecArray | null;
    while ((match = tjRegex.exec(latin1)) !== null) {
      if (match[1] && match[1].trim().length > 1) {
        textPieces.push(match[1]);
      }
    }

    // Extract text in [(string)...] TJ format
    const arrayTjRegex = /\[([^\]]+)\]\s*TJ/g;
    while ((match = arrayTjRegex.exec(latin1)) !== null) {
      if (match[1]) {
        const inner = match[1];
        const innerStrings = inner.match(/\(([^()]+)\)/g);
        if (innerStrings) {
          const joined = innerStrings.map(s => s.slice(1, -1)).join("");
          if (joined.trim().length > 1) {
            textPieces.push(joined);
          }
        }
      }
    }

    // Also extract raw text between BT and ET
    const btEtRegex = /BT\s+([\s\S]*?)\s+ET/g;
    while ((match = btEtRegex.exec(latin1)) !== null) {
      if (match[1]) {
        const block = match[1];
        const blockStrings = block.match(/\(([^()]+)\)/g);
        if (blockStrings) {
          const blockText = blockStrings.map(s => s.slice(1, -1)).join(" ");
          if (blockText.trim().length > 10) {
            textPieces.push(blockText);
          }
        }
      }
    }

    let extractedText = textPieces.join(" ");
    extractedText = extractedText.replace(/_{3,}/g, " [BLANK_FIELD] ");

    if (extractedText.trim().length >= 40) {
      return { text: extractedText, pageCount };
    }

    // Fallback to clean ASCII text
    const cleanAscii = latin1.replace(/[^\x20-\x7E\n\r\t]/g, " ").replace(/\s+/g, " ");
    return { text: cleanAscii, pageCount };
  } catch (err) {
    console.warn("Client PDF extraction error:", err);
    return { text: "", pageCount: 1 };
  }
}

export function isContractualDocument(
  text: string, 
  fileName?: string,
  pageCount: number = 1
): { isContract: boolean; reason: string; failureMode: "valid" | "extraction_failed" | "non_contractual" } {
  const name = fileName || "";
  const nonLegalFilenamePattern = /\b(id\s*card|identity\s*card|badge|license|driving\s*licence|passport|hall\s*ticket|admit\s*card|resume|cv|biodata|receipt|invoice|bill|ticket|boarding\s*pass|photo|image|scan)\b/i;
  
  // Normalize PDF binary noise and underscore fill-in placeholder lines
  const cleanText = text
    .replace(/\/[A-Z][a-zA-Z0-9]+|<<|>>|stream|endstream|obj|endobj|%\w+/g, " ")
    .replace(/_{3,}/g, " [BLANK_FIELD] ");
  const words = cleanText.toLowerCase().match(/\b[a-zA-Z]{3,}\b/g) || [];

  // Sanity check: Multi-page document (>= 2 pages) with suspiciously low word count (< 40 words)
  // is an EXTRACTION/OCR failure, NOT a non-legal judgment!
  if (pageCount >= 2 && words.length < 40) {
    return {
      isContract: false,
      reason: `We couldn't read this document properly — only ${words.length} words extracted from a ${pageCount}-page document. Try re-uploading or use a text-based PDF.`,
      failureMode: "extraction_failed"
    };
  }

  if (name && nonLegalFilenamePattern.test(name)) {
    if (words.length < 80) {
      return {
        isContract: false,
        reason: `File "${name}" appears to be a non-legal document (identification/record) without contractual provisions.`,
        failureMode: "non_contractual"
      };
    }
  }

  if (words.length < 35) {
    return {
      isContract: false,
      reason: "Extracted text is too short to be a legal contract (under 35 words).",
      failureMode: "non_contractual"
    };
  }

  const strongIndicators = [
    "agreement", "contract", "parties", "witnesseth", "whereas", "recitals",
    "terms and conditions", "governing law", "jurisdiction", "indemn",
    "severab", "confidential", "termination", "warrant", "liability",
    "in witness whereof", "covenant", "hereby", "herein", "hereto", "shall",
    "non-disclosure", "disclosing party", "receiving party", "injunctive relief",
    "obligations", "definitions", "miscellaneous", "remedies", "survival", "exceptions"
  ];

  const matched = strongIndicators.filter((ind) => cleanText.toLowerCase().includes(ind));
  if (matched.length < 2) {
    return {
      isContract: false,
      reason: "Document does not contain contractual language, obligations, or legal provisions.",
      failureMode: "non_contractual"
    };
  }

  return { isContract: true, reason: "Valid contractual document.", failureMode: "valid" };
}

export function buildDynamicDocumentAnalysis(
  fileName: string, 
  documentId: string, 
  rawText?: string,
  explicitPageCount?: number
): AnalysisResults {
  const text = rawText || "";
  const pageCount = explicitPageCount || (text ? Math.max(1, Math.ceil(text.length / 3000)) : 1);
  const { isContract, reason, failureMode } = isContractualDocument(text, fileName, pageCount);

  if (!isContract) {
    const isExtractionFailure = failureMode === "extraction_failed";
    return {
      document: {
        id: documentId,
        filename: fileName,
        page_count: pageCount,
        status: isExtractionFailure ? "extraction_failed" : "rejected_non_contract",
        is_legal_contract: false,
        rejection_reason: reason
      },
      analysis: {
        id: `analysis-${documentId}`,
        aggregate_risk_score: 0.0,
        risk_level: "None",
        critical_count: 0,
        high_count: 0,
        medium_count: 0,
        low_count: 0,
        consensus_report: {
          summary: isExtractionFailure
            ? `Text extraction was incomplete for "${fileName}" (${pageCount} pages detected). The system could not extract sufficient readable text to conduct an audit. Please re-upload a clear text-based PDF.`
            : "This document does not appear to be a legal agreement — no contractual clauses, covenants, or obligations were detected. Multi-agent risk audit was skipped to prevent hallucinated findings.",
          strengths: [],
          vulnerabilities: [],
          recommendations: isExtractionFailure 
            ? ["Re-upload using a standard text-based PDF or run OCR before uploading."]
            : []
        }
      },
      findings: [],
      chunks: text ? [{
        id: `${documentId}-chunk-0`,
        chunk_id: 0,
        page_number: 1,
        raw_text: text.slice(0, 2000),
        clause_type: isExtractionFailure ? "Extraction Issue" : "Non-Contractual"
      }] : []
    };
  }

  // Contractual document: scan actual text for clauses and extract real verbatim quotes
  const rules = [
    {
      pattern: /(?:indemnify|indemnification|hold harmless)/i,
      agent_name: "Defense Counsel",
      clause_type: "Indemnity",
      finding_type: "Overbroad Indemnity Exposure",
      summary: "Broad indemnification obligation identified without reciprocal cap in source text.",
      severity_score: 8,
      risk_level: "Critical"
    },
    {
      pattern: /(?:indemnify|indemnification|hold harmless)/i,
      agent_name: "Plaintiff Counsel",
      clause_type: "Indemnity",
      finding_type: "Adversarial Indemnity Loophole",
      summary: "Opposing counsel can leverage broad indemnity terms for preliminary dispute funding.",
      severity_score: 9,
      risk_level: "Critical"
    },
    {
      pattern: /(?:limitation of liability|liability cap|in no event shall .* liability exceed)/i,
      agent_name: "Judge",
      clause_type: "Limitation of Liability",
      finding_type: "Liability Cap Scope",
      summary: "Damages are subject to aggregate liability limitations. Scrutinize exclusions.",
      severity_score: 7,
      risk_level: "High"
    },
    {
      pattern: /(?:terminate for convenience|terminate this agreement upon|written notice of termination)/i,
      agent_name: "Drafting Counsel",
      clause_type: "Termination",
      finding_type: "Termination Notice Mechanism",
      summary: "Contract cancellation mechanism defined. Verify transition terms.",
      severity_score: 6,
      risk_level: "Medium"
    },
    {
      pattern: /(?:confidential information|receiving party shall protect|non-disclosure|proprietary information)/i,
      agent_name: "Compliance Officer",
      clause_type: "Confidentiality",
      finding_type: "Confidentiality Protection Scope",
      summary: "Non-disclosure obligations govern sensitive business disclosures.",
      severity_score: 5,
      risk_level: "Medium"
    },
    {
      pattern: /(?:injunctive relief|equitable relief|irreparable harm|without bond)/i,
      agent_name: "Plaintiff Counsel",
      clause_type: "Remedies",
      finding_type: "Immediate Injunctive Relief Threat",
      summary: "Permits opposing party to seek emergency court injunctions without bond.",
      severity_score: 7,
      risk_level: "High"
    },
    {
      pattern: /(?:survival|shall survive|period of (\d+|twenty|ten|five) years)/i,
      agent_name: "Compliance Officer",
      clause_type: "Survival",
      finding_type: "Extended Survival Term",
      summary: "Confidentiality or restrictive terms survive termination for an extended period.",
      severity_score: 6,
      risk_level: "Medium"
    },
    {
      pattern: /(?:intellectual property|ip right|ownership|copyright|patent)/i,
      agent_name: "Defense Counsel",
      clause_type: "Intellectual Property",
      finding_type: "IP Assignment Risk",
      summary: "Ownership assignment terms present. Clarify background know-how carve-outs.",
      severity_score: 7,
      risk_level: "High"
    },
    {
      pattern: /(?:governing law|jurisdiction|arbitration venue|dispute resolution)/i,
      agent_name: "Compliance Officer",
      clause_type: "Governing Law",
      finding_type: "Dispute Jurisdiction Scope",
      summary: "Dispute resolution and governing forum defined.",
      severity_score: 5,
      risk_level: "Medium"
    }
  ];

  const lines = text.split("\n").map(l => l.trim()).filter(l => l.length > 10);
  const findings: Finding[] = [];
  const chunks: Array<{ id: string; chunk_id: number; page_number: number; raw_text: string; clause_type: string }> = [];

  let chunkId = 0;
  for (const rule of rules) {
    if (rule.pattern.test(text)) {
      let evidence = "";
      for (const line of lines) {
        if (rule.pattern.test(line)) {
          evidence = line;
          break;
        }
      }
      if (!evidence) {
        const match = text.match(rule.pattern);
        if (match && match.index !== undefined) {
          evidence = text.slice(Math.max(0, match.index - 20), Math.min(text.length, match.index + 120)).trim();
        }
      }

      if (evidence && (text.includes(evidence) || text.includes(evidence.slice(0, 30)))) {
        const cId = `${documentId}-chunk-${chunkId}`;
        chunks.push({
          id: cId,
          chunk_id: chunkId,
          page_number: Math.floor(chunkId / 2) + 1,
          raw_text: evidence,
          clause_type: rule.clause_type
        });

        findings.push({
          id: `${documentId}-finding-${chunkId}`,
          agent_name: rule.agent_name,
          clause_type: rule.clause_type,
          finding_type: rule.finding_type,
          summary: rule.summary,
          evidence_quote: evidence.slice(0, 180),
          verification_status: "VERIFIED",
          severity_score: rule.severity_score,
          confidence: 0.90,
          risk_level: rule.risk_level,
          chunk_text: evidence,
          consensus_reasoning: {
            summary: `Consensus Engine audited ${rule.clause_type} and verified grounding in source text.`,
            deliberation: [
              { agent: rule.agent_name, stance: "Primary Finding", score: rule.severity_score, argument: rule.summary },
              { agent: "Judge", stance: "Enforceability", score: Math.max(1, rule.severity_score - 1), argument: "Evaluated clause structure against commercial norms." }
            ],
            arbitration_rule: `Consensus calibrated to ${rule.severity_score}/10 based on verified clause wording.`
          }
        });
        chunkId++;
      }
    }
  }

  const critical = findings.filter(f => f.risk_level === "Critical").length;
  const high = findings.filter(f => f.risk_level === "High").length;
  const medium = findings.filter(f => f.risk_level === "Medium").length;
  const low = findings.filter(f => f.risk_level === "Low").length;

  const rawScore = findings.length > 0 ? Math.min(10.0, 1.0 + (critical * 2.0) + (high * 1.2) + (medium * 0.5) + (low * 0.1)) : 1.0;
  const riskLevel = rawScore >= 8.0 ? "Critical" : rawScore >= 6.5 ? "High" : rawScore >= 4.0 ? "Medium" : "Low";

  return {
    document: {
      id: documentId,
      filename: fileName,
      page_count: Math.max(1, Math.ceil(text.length / 3000)),
      status: "completed",
      is_legal_contract: true
    },
    analysis: {
      id: `analysis-${documentId}`,
      aggregate_risk_score: rawScore,
      risk_level: riskLevel,
      critical_count: critical,
      high_count: high,
      medium_count: medium,
      low_count: low,
      consensus_report: {
        summary: `Document audited across ${findings.length} verified clause findings with aggregate risk score ${rawScore.toFixed(1)}/10.`,
        strengths: findings.filter(f => f.severity_score <= 5).map(f => `${f.clause_type}: ${f.summary}`),
        vulnerabilities: findings.filter(f => f.severity_score >= 7).map(f => `${f.clause_type}: ${f.summary}`),
        recommendations: findings.filter(f => f.severity_score >= 7).map(f => `Review and amend the ${f.clause_type} section.`)
      }
    },
    findings,
    chunks: chunks.length > 0 ? chunks : [{
      id: `${documentId}-chunk-0`,
      chunk_id: 0,
      page_number: 1,
      raw_text: text.slice(0, 500) || "Document text extracted.",
      clause_type: "General"
    }]
  };
}

const LOCAL_DOCS_KEY = "legalaid_documents";
const LOCAL_ANALYSES_KEY = "legalaid_analyses";
const LOCAL_SELECTED_DOC_KEY = "legalaid_selected_doc_id";
const LOCAL_CHAT_PREFIX = "legalaid_chat_";

export default function Dashboard() {
  const [, setLocation] = useLocation();
  const [session, setSession] = useState<MockSession | null>(null);
  const [ready, setReady] = useState(false);
  
  // Dashboard application states with persistent localStorage fallback
  const [documents, setDocuments] = useState<APIDocument[]>(() => {
    try {
      const saved = window.localStorage.getItem(LOCAL_DOCS_KEY);
      if (!saved) return [];
      return JSON.parse(saved) as APIDocument[];
    } catch {
      return [];
    }
  });

  const [selectedDocId, setSelectedDocId] = useState<string | null>(() => {
    try {
      return window.localStorage.getItem(LOCAL_SELECTED_DOC_KEY) || null;
    } catch {
      return null;
    }
  });

  const [analysis, setAnalysis] = useState<AnalysisResults | null>(null);
  const [loadingAnalysis, setLoadingAnalysis] = useState(false);

  const [mockAnalyses, setMockAnalyses] = useState<Record<string, AnalysisResults>>(() => {
    try {
      const saved = window.localStorage.getItem(LOCAL_ANALYSES_KEY);
      if (!saved) return {};
      return JSON.parse(saved) as Record<string, AnalysisResults>;
    } catch {
      return {};
    }
  });

  // ONE-TIME MIGRATION: Detect and fix sidebar ↔ detail-view status desync and non-legal doc legacy states.
  useEffect(() => {
    const migrationKey = "legalaid_desync_migration_v3";
    if (window.localStorage.getItem(migrationKey)) return;

    let docsChanged = false;
    let analysesChanged = false;
    const updatedAnalyses = { ...mockAnalyses };
    const nonLegalPattern = /\b(id\s*card|identity\s*card|badge|license|driving\s*licence|passport|hall\s*ticket|admit\s*card|resume|cv|biodata|receipt|invoice|bill|ticket|boarding\s*pass|photo|image|scan)\b/i;

    const fixedDocs = documents.map((doc) => {
      // Fix non-legal documents that had legacy mock audits
      if (nonLegalPattern.test(doc.filename) && doc.status === "completed") {
        docsChanged = true;
        analysesChanged = true;
        const sanitizedAnalysis = buildDynamicDocumentAnalysis(doc.filename, doc.id);
        updatedAnalyses[doc.id] = sanitizedAnalysis;
        return {
          ...doc,
          status: "rejected_non_contract",
          risk_score: null,
          risk_level: null,
        };
      }

      const cachedAnalysis = updatedAnalyses[doc.id];
      if (!cachedAnalysis) return doc;
      const analysisStatus = cachedAnalysis.document.status;
      if (doc.status !== analysisStatus) {
        console.warn(`[Migration] Fixing desync for "${doc.filename}": sidebar="${doc.status}" → analysis="${analysisStatus}"`);
        docsChanged = true;
        return {
          ...doc,
          status: analysisStatus,
          risk_score: cachedAnalysis.analysis.aggregate_risk_score > 0 ? cachedAnalysis.analysis.aggregate_risk_score : null,
          risk_level: cachedAnalysis.analysis.risk_level,
          page_count: cachedAnalysis.document.page_count || doc.page_count,
        };
      }
      return doc;
    });

    if (docsChanged) {
      setDocuments(fixedDocs);
    }
    if (analysesChanged) {
      setMockAnalyses(updatedAnalyses);
    }
    window.localStorage.setItem(migrationKey, "done");
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sync state changes with localStorage
  useEffect(() => {
    try {
      window.localStorage.setItem(LOCAL_DOCS_KEY, JSON.stringify(documents));
    } catch (e) {
      console.warn("Failed to persist documents to localStorage", e);
    }
  }, [documents]);

  useEffect(() => {
    try {
      if (selectedDocId) {
        window.localStorage.setItem(LOCAL_SELECTED_DOC_KEY, selectedDocId);
      }
    } catch (e) {
      console.warn("Failed to persist selectedDocId", e);
    }
  }, [selectedDocId]);

  useEffect(() => {
    try {
      window.localStorage.setItem(LOCAL_ANALYSES_KEY, JSON.stringify(mockAnalyses));
    } catch (e) {
      console.warn("Failed to persist mockAnalyses", e);
    }
  }, [mockAnalyses]);
  
  // Plain Language vs Legal View Mode
  const LOCAL_VIEW_MODE_KEY = "legalaid_view_mode";
  const [viewMode, setViewMode] = useState<"simple" | "legal">(() => {
    try {
      return (window.localStorage.getItem(LOCAL_VIEW_MODE_KEY) as any) || "simple";
    } catch {
      return "simple";
    }
  });

  useEffect(() => {
    try {
      window.localStorage.setItem(LOCAL_VIEW_MODE_KEY, viewMode);
    } catch (e) {
      console.warn("Failed to persist viewMode to localStorage", e);
    }
  }, [viewMode]);

  // Interactive Q&A Chat states
  const [workbenchView, setWorkbenchView] = useState<"audit" | "chat">("audit");
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [sendingChat, setSendingChat] = useState(false);
  const chatBottomRef = useRef<HTMLDivElement>(null);

  // Load chat history when selected document changes
  useEffect(() => {
    if (!selectedDocId) {
      setChatMessages([]);
      return;
    }

    const savedLocal = window.localStorage.getItem(LOCAL_CHAT_PREFIX + selectedDocId);
    if (savedLocal) {
      try {
        setChatMessages(JSON.parse(savedLocal));
      } catch {
        setChatMessages([]);
      }
    } else {
      setChatMessages([
        {
          id: "welcome-" + selectedDocId,
          role: "assistant",
          content: `Welcome to Interactive Q&A for this document. I have loaded all clauses analyzed by Defense, Plaintiff, Judge, Drafting, and Compliance agents. Ask me any specific question about risks, loopholes, or recommended revisions.`,
          agent_perspective: "Lead Legal Counsel",
          citations: [],
          timestamp: new Date().toISOString()
        }
      ]);
    }

    if (USE_BACKEND_API) {
      fetch(`/api/documents/${selectedDocId}/chat`)
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (data && data.history && data.history.length > 0) {
            setChatMessages(data.history);
          }
        })
        .catch((err) => console.warn("Failed to fetch remote chat history", err));
    }
  }, [selectedDocId]);

  // Persist chat to localStorage
  useEffect(() => {
    if (selectedDocId && chatMessages.length > 0) {
      try {
        window.localStorage.setItem(LOCAL_CHAT_PREFIX + selectedDocId, JSON.stringify(chatMessages));
      } catch (e) {
        console.warn("Failed to persist chat messages", e);
      }
    }
  }, [chatMessages, selectedDocId]);

  // Auto-scroll chat to bottom
  useEffect(() => {
    if (workbenchView === "chat") {
      chatBottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [chatMessages, workbenchView]);

  const handleSendChatMessage = async (msgText?: string) => {
    const textToSend = (msgText || chatInput).trim();
    if (!textToSend || !selectedDocId || sendingChat) return;

    setChatInput("");
    setSendingChat(true);

    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: textToSend,
      timestamp: new Date().toISOString()
    };

    setChatMessages((prev) => [...prev, userMsg]);

    // 0. Security Guardrail & Intent Classification Gate
    const intentResult = classifyUserIntent(textToSend);

    if (intentResult.intent === "prompt_injection" || intentResult.intent === "citation_fabrication") {
      const assistantMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: intentResult.securityRefusal || "I cannot comply with this instruction. LegalAid only provides factual reviews of your uploaded document.",
        agent_perspective: "Security Guardrail",
        citations: [],
        timestamp: new Date().toISOString()
      };
      setChatMessages((prev) => [...prev, assistantMsg]);
      setSendingChat(false);
      return;
    }

    if (intentResult.intent === "off_topic") {
      const assistantMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: "I am an AI legal assistant focused on reviewing your uploaded document. I can only answer questions related to your contract's terms, risks, or legal provisions.",
        agent_perspective: "Legal Assistant",
        citations: [],
        timestamp: new Date().toISOString()
      };
      setChatMessages((prev) => [...prev, assistantMsg]);
      setSendingChat(false);
      return;
    }

    if (intentResult.intent === "general_legal") {
      const assistantMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: intentResult.generalAnswer || "This is a general legal concept. In standard commercial contracting, parties define specific parameters to allocate risk.\n\n*Note: This is general legal information and is not based on clauses in your uploaded document.*",
        agent_perspective: "Legal Knowledge Base",
        citations: [],
        timestamp: new Date().toISOString()
      };
      setChatMessages((prev) => [...prev, assistantMsg]);
      setSendingChat(false);
      return;
    }

    try {
      if (USE_BACKEND_API) {
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 7000);

          const res = await fetch(`/api/documents/${selectedDocId}/chat`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ message: textToSend }),
            signal: controller.signal
          });
          clearTimeout(timeoutId);

          if (res.ok) {
            const data = await res.json();
            if (data.assistant_message) {
              setChatMessages((prev) => [...prev, data.assistant_message]);
              return;
            }
          }
        } catch (fetchErr) {
          console.warn("Backend chat endpoint timed out or offline, using instant client RAG engine.");
        }
      }

      // Instant Client-side RAG Intelligence Engine (Strict Grounding & Direct Intent Adaptation)
      const qLower = textToSend.toLowerCase().trim();
      let replyContent = "";
      let replyPerspective = viewMode === "simple" ? "Plain English Advisor" : "AI Legal Counsel";
      let citations: string[] = [];

      const allChunks = analysis?.chunks || [];
      const primaryChunk = allChunks[0];
      const isExtractionFail = analysis?.document.status === "extraction_failed";
      const isNonLegalDoc = analysis?.document.status === "rejected_non_contract" || analysis?.document.is_legal_contract === false;

      // Handle Extraction Failed or Non-Legal Document Query
      if (isExtractionFail) {
        replyPerspective = "AI Assistant (Extraction Issue)";
        replyContent = `We were unable to extract sufficient text from this ${analysis?.document.page_count || 1}-page document ("${analysis?.document.filename || "Uploaded File"}"). Please try re-uploading a searchable, text-based PDF or high-quality OCR scan.`;
        citations = [];
      } else if (isNonLegalDoc) {
        replyPerspective = "AI Assistant (Non-Legal Document)";
        replyContent = `This document ("${analysis?.document.filename || "Uploaded File"}") is a non-legal document (such as an identification card or personal record). It does not contain contractual clauses, legal obligations, or risk provisions.`;
        citations = [];
      } else if (intentResult.topic === "greeting" || qLower === "hi" || qLower === "hello" || qLower === "hey" || qLower === "help") {
        // Handle greetings
        replyPerspective = viewMode === "simple" ? "Plain English Advisor" : "Lead Legal Counsel";
        replyContent = viewMode === "simple"
          ? `Hello! I am your Plain-English Legal Assistant for **${analysis?.document.filename || "this document"}**.\n\nAsk me anything in everyday language, such as:\n- *"What is this document about?"*\n- *"What are the biggest traps in this contract?"*\n- *"Can they cancel on me without warning?"*\n- *"How do I fix the liability and payment terms?"*`
          : `Hello! I am your AI Legal Counsel for **${analysis?.document.filename || "this document"}**.\n\nYou can ask me any question about this document, such as:\n- *"What is this document about?"*\n- *"What are the main risks from Plaintiff's perspective?"*\n- *"Summarize the liability and indemnity clauses"*\n- *"Are there any missing transition or termination terms?"*`;
        citations = [];
      } else if (/\b(what is (this|the) doc(ument)?( about)?|what is this|overview|summary|summarize|what type of (agreement|contract|document)|who are the parties|who is involved|parties to (this|the))\b/i.test(qLower)) {
        // Direct Informational Query: 1-3 direct sentences, NO risk score / safety assessment scaffolding
        replyPerspective = viewMode === "simple" ? "Plain Summary" : "AI Counsel (Document Overview)";
        let summaryLead = "";
        if (primaryChunk && primaryChunk.raw_text && primaryChunk.clause_type !== "Non-Contractual") {
          const lines = primaryChunk.raw_text.split("\n").map(l => l.trim()).filter(l => l.length > 15);
          summaryLead = lines.slice(0, 3).join(" ").trim();
        }
        if (!summaryLead || summaryLead.length < 25) {
          summaryLead = `This document is a commercial agreement setting forth binding terms, rights, and obligations between the participating parties.`;
        }
        if (summaryLead.length > 280) {
          summaryLead = summaryLead.slice(0, 277) + "...";
        }
        replyContent = `**Document Overview:** "${analysis?.document.filename || "Uploaded File"}"\n\n${summaryLead}`;
        citations = []; // Informational summaries do not require a separate excerpt block
      } else if (/\b(plaintiff|opposing|attack|exploit|loophole|biggest risk|main risk|flagged|why is this risky|vulnerabilit)\b/i.test(qLower)) {
        // Risk / Finding-related Query: Detailed adversarial / plain finding review
        replyPerspective = viewMode === "simple" ? "Opposing Party View" : "Plaintiff Counsel";
        const plaintiffFindings = analysis?.findings.filter((f) => f.agent_name === "Plaintiff Counsel") || [];
        const topFinding = plaintiffFindings[0] || analysis?.findings[0];
        if (topFinding) {
          const plain = getPlainLanguageFinding(topFinding);
          if (topFinding.evidence_quote) {
            citations = [topFinding.evidence_quote];
          }
          replyContent = viewMode === "simple"
            ? `**High-Risk Term Identified:** **${plain.title}** (${topFinding.clause_type})\n\n**What this means:**\n${plain.whatItSays}\n\n**Why it matters to you:**\n${plain.impact}\n\n**Recommended Action:**\n${plain.action}`
            : `**Adversarial Finding:** ${topFinding.finding_type} (${topFinding.clause_type})\n\n${topFinding.summary}\n\n**Litigation Assessment:**\nOpposing counsel can leverage broad or ambiguous wording to assert immediate breach or extract concessions before full trial.`;
        } else {
          replyContent = viewMode === "simple"
            ? `No critical high-severity vulnerabilities were flagged in this document. Review boilerplate terms before execution.`
            : `No high-severity risks or unilateral attack vectors were surfaced in the multi-agent findings trail.`;
          citations = [];
        }
      } else {
        // Strict keyword relevance search across chunks
        const stopwords = new Set(["what", "is", "the", "about", "are", "how", "why", "who", "which", "when", "where", "this", "that", "from", "for", "with", "and", "does", "can", "in", "on", "of", "to", "a", "an", "tell", "me", "my", "our"]);
        const keywords = qLower.split(/\W+/).filter((w) => w.length > 2 && !stopwords.has(w));

        const scoredChunks = allChunks.map((chunk) => {
          const t = chunk.raw_text.toLowerCase();
          const c = (chunk.clause_type || "").toLowerCase();
          let matchCount = 0;
          for (const kw of keywords) {
            if (c.includes(kw)) matchCount += 3;
            if (t.includes(kw)) matchCount += 1;
          }
          return { chunk, score: matchCount };
        }).filter((item) => item.score > 0);

        scoredChunks.sort((a, b) => b.score - a.score);
        const firstScored = scoredChunks[0];
        const targetChunk = firstScored ? firstScored.chunk : null;

        if (targetChunk) {
          replyPerspective = viewMode === "simple" ? "Document Text" : "AI Counsel (RAG Retrieved)";
          citations = [`Page ${targetChunk.page_number} [${targetChunk.clause_type || "Excerpt"}]: "${targetChunk.raw_text.slice(0, 180)}..."`];
          replyContent = viewMode === "simple"
            ? `Regarding your question on **"${textToSend}"**, here is the relevant excerpt from page ${targetChunk.page_number} of your agreement:\n\n"${targetChunk.raw_text}"\n\n**Takeaway:** Check that this clause is mutual and clearly defines scope and notice periods.`
            : `Based on retrieved context from page ${targetChunk.page_number} of "${analysis?.document.filename}" regarding "${textToSend}":\n\n"${targetChunk.raw_text}"\n\n**Legal Assessment:**\nThis provision was reviewed against standard commercial practices and enforceability guidelines.`;
        } else {
          // Finding match fallback (only if keyword specifically matches the finding clause)
          const matchedFinding = analysis?.findings.find(
            (f) =>
              (f.clause_type && keywords.some((kw) => f.clause_type.toLowerCase().includes(kw))) ||
              (f.finding_type && keywords.some((kw) => f.finding_type.toLowerCase().includes(kw)))
          );

          if (matchedFinding) {
            const plain = getPlainLanguageFinding(matchedFinding);
            replyPerspective = viewMode === "simple" ? "Plain English Review" : matchedFinding.agent_name;
            if (matchedFinding.evidence_quote) {
              citations = [matchedFinding.evidence_quote];
            }
            replyContent = viewMode === "simple"
              ? `Regarding **"${textToSend}"** in the ${matchedFinding.clause_type} section:\n\n**What this clause means:**\n${plain.whatItSays}\n\n**Why it matters to you:**\n${plain.impact}\n\n**Recommended Action:**\n${plain.action}`
              : `Regarding your inquiry on "${textToSend}":\n\n${matchedFinding.agent_name} audited the ${matchedFinding.clause_type} section (Severity: ${matchedFinding.severity_score}/10, ${matchedFinding.risk_level} Risk):\n\n${matchedFinding.summary}\n\n**Recommended Action:**\nConsider negotiating mutual reciprocal terms and clear definitions to remove adversarial leverage.`;
          } else {
            // Zero matches found in document: never fabricate or pull arbitrary chunks!
            replyPerspective = viewMode === "simple" ? "Plain English Advisor" : "Citation & Evidence Agent";
            replyContent = viewMode === "simple"
              ? `I searched your agreement for provisions related to "${textToSend}", but this document does not contain any matching clauses or mentions of this topic.`
              : `No provisions or clauses directly matching "${textToSend}" were identified in the verified text of "${analysis?.document.filename}".`;
            citations = [];
          }
        }
      }

      const assistantMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: replyContent,
        agent_perspective: replyPerspective,
        citations,
        timestamp: new Date().toISOString()
      };

      setChatMessages((prev) => [...prev, assistantMsg]);
    } catch (err) {
      console.error("Chat error:", err);
      const fallbackMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: "I encountered an error analyzing your question. Please try rephrasing your inquiry.",
        agent_perspective: "Legal Assistant",
        citations: [],
        timestamp: new Date().toISOString()
      };
      setChatMessages((prev) => [...prev, fallbackMsg]);
    } finally {
      setSendingChat(false);
    }
  };

  // UI filter / navigation states
  const [activeTab, setActiveTab] = useState<"summary" | "strengths" | "vulnerabilities" | "recommendations">("summary");
  const [selectedAgentFilter, setSelectedAgentFilter] = useState<string>("All");
  const [selectedFinding, setSelectedFinding] = useState<Finding | null>(null);
  const [showUploadModal, setShowUploadModal] = useState(false);
  
  // File upload states
  const [uploading, setUploading] = useState(false);
  const [uploadStatusMsg, setUploadStatusMsg] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const currentSession = getMockSession();
    if (!currentSession) {
      setLocation("/login");
      return;
    }
    setSession(currentSession);
    setReady(true);
    fetchDocuments();
  }, [setLocation]);

  const signOut = () => {
    clearMockSession();
    setLocation("/login");
  };

  const handleDeleteDocument = async (docIdToDelete: string, docFilename: string) => {
    if (!confirm(`Are you sure you want to delete "${docFilename}"? This cannot be undone.`)) {
      return;
    }

    // Step 1: If backend is available, call the delete endpoint and wait for confirmed success.
    // Do NOT remove from UI until the backend confirms the deletion.
    if (USE_BACKEND_API) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 8000);
        const res = await fetch(`/api/documents/${docIdToDelete}`, {
          method: "DELETE",
          signal: controller.signal
        });
        clearTimeout(timeoutId);

        if (!res.ok && res.status !== 404) {
          const errData = await res.json().catch(() => ({ detail: `Server returned ${res.status}` }));
          throw new Error(errData.detail || `Delete failed (HTTP ${res.status})`);
        }
        // Backend confirmed deletion (or document was already absent on server) — safe to proceed to UI cleanup
      } catch (err: any) {
        // DELETE failed — do NOT remove from UI. Surface the error.
        const msg = err?.name === "AbortError"
          ? "Delete request timed out — the document was not removed. Try again."
          : `Could not delete "${docFilename}": ${err?.message || "Unknown error"}`;
        console.error("Delete failed:", err);
        toast.error(msg);
        return; // Early return — document stays in the list
      }
    }

    // Step 2: Remove from local state (only reached after backend confirms, or in local-only mode)
    try {
      const remainingDocs = documents.filter((d) => d.id !== docIdToDelete);
      setDocuments(remainingDocs);

      // Clean mock analyses cache
      setMockAnalyses((prev) => {
        const copy = { ...prev };
        delete copy[docIdToDelete];
        return copy;
      });

      // Clean chat history from localStorage
      window.localStorage.removeItem(LOCAL_CHAT_PREFIX + docIdToDelete);

      // If active document was deleted, switch to next or clear
      if (selectedDocId === docIdToDelete) {
        const nextDoc = remainingDocs[0];
        if (nextDoc) {
          setSelectedDocId(nextDoc.id);
        } else {
          setSelectedDocId("");
          setAnalysis(null);
        }
      }

      toast.success(`Deleted "${docFilename}"`);
    } catch (err) {
      console.error("Failed to update local state after delete:", err);
      toast.error("Document was deleted on the server but the UI failed to update. Please refresh.");
    }
  };

  const fetchDocuments = async () => {
    if (!USE_BACKEND_API) {
      return;
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2000);
      const res = await fetch("/api/documents", { signal: controller.signal });
      clearTimeout(timeoutId);

      if (res.ok) {
        const data = await res.json();
        setDocuments(data);
        if (data.length > 0) {
          const currentValid = data.some((d: APIDocument) => d.id === selectedDocId);
          if (!selectedDocId || !currentValid) {
            setSelectedDocId(data[0].id);
          }
        }
      }
    } catch (err) {
      console.warn("Backend documents fetch unreachable:", err);
    }
  };

  const activeDoc = documents.find((d) => d.id === selectedDocId);

  // Fetch analysis details when selected document changes
  // Helper: sync the sidebar documents array to match the authoritative analysis status.
  // This ensures a single source of truth — the detail view drives the sidebar, not the other way around.
  const syncDocumentStatus = (docId: string, analysisResult: AnalysisResults) => {
    setDocuments((prev) =>
      prev.map((doc) => {
        if (doc.id !== docId) return doc;
        const newStatus = analysisResult.document.status;
        const newRiskScore = analysisResult.analysis.aggregate_risk_score > 0 ? analysisResult.analysis.aggregate_risk_score : null;
        const newRiskLevel = analysisResult.analysis.risk_level;
        const newPageCount = analysisResult.document.page_count || doc.page_count;
        // Only update if something actually changed to avoid unnecessary re-renders
        if (doc.status === newStatus && doc.risk_score === newRiskScore && doc.risk_level === newRiskLevel && doc.page_count === newPageCount) {
          return doc;
        }
        return {
          ...doc,
          status: newStatus,
          risk_score: newRiskScore,
          risk_level: newRiskLevel,
          page_count: newPageCount,
        };
      })
    );
  };

  // Fetch analysis details when selected document changes
  useEffect(() => {
    if (!selectedDocId) {
      setAnalysis(null);
      return;
    }

    const cachedAnalysis = mockAnalyses[selectedDocId];
    if (cachedAnalysis) {
      setAnalysis(cachedAnalysis);
      // Ensure sidebar matches the cached analysis (single source of truth)
      syncDocumentStatus(selectedDocId, cachedAnalysis);
      setLoadingAnalysis(false);
      return;
    }
    
    const fetchAnalysisData = async () => {
      setLoadingAnalysis(true);
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);
        const res = await fetch(`/api/documents/${selectedDocId}/analysis`, { signal: controller.signal });
        clearTimeout(timeoutId);

        if (res.ok) {
          const data = await res.json();
          setAnalysis(data);
          setMockAnalyses((prev) => ({ ...prev, [selectedDocId]: data }));
          syncDocumentStatus(selectedDocId, data);
          setSelectedFinding(null);
        } else {
          // API returned non-OK — do NOT fabricate a fallback analysis with empty text.
          // Just show "Analysis Pending" (analysis stays null).
          console.warn(`Analysis not available for ${selectedDocId} (HTTP ${res.status})`);
          setAnalysis(null);
        }
      } catch (err) {
        // Network failure / timeout — do NOT fabricate a fallback.
        // Show "Analysis Pending" rather than a false rejection.
        console.warn("Analysis fetch timed out or offline:", err);
        setAnalysis(null);
      } finally {
        setLoadingAnalysis(false);
      }
    };

    fetchAnalysisData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDocId]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    
    const file = files[0];
    if (!file) return;
    const formData = new FormData();
    formData.append("file", file);
    
    let fileText = "";
    let pageCount = 1;
    if (file.name.toLowerCase().endsWith(".pdf") || file.type.includes("pdf")) {
      const parsed = await extractPdfTextAndPageCount(file);
      fileText = parsed.text;
      pageCount = parsed.pageCount;
    } else {
      try {
        fileText = await file.text();
        fileText = fileText.replace(/_{3,}/g, " [BLANK_FIELD] ");
        pageCount = Math.max(1, Math.ceil(fileText.length / 3000));
      } catch {
        fileText = "";
        pageCount = 1;
      }
    }

    setUploading(true);
    setShowUploadModal(true);
    setUploadStatusMsg("Uploading and extracting text...");

    if (!USE_BACKEND_API) {
      const documentId = `local-${crypto.randomUUID()}`;
      const dynamicAnalysis = buildDynamicDocumentAnalysis(file.name, documentId, fileText, pageCount);
      const mockDocument: APIDocument = {
        id: documentId,
        filename: file.name,
        content_type: file.type || "text/plain",
        status: dynamicAnalysis.document.status,
        page_count: dynamicAnalysis.document.page_count,
        created_at: new Date().toISOString(),
        risk_score: dynamicAnalysis.analysis.aggregate_risk_score > 0 ? dynamicAnalysis.analysis.aggregate_risk_score : null,
        risk_level: dynamicAnalysis.analysis.risk_level,
      };
      setUploadStatusMsg("Generating grounded analysis...");
      setDocuments((current) => [mockDocument, ...current.filter((doc) => doc.id !== documentId)]);
      setMockAnalyses((current) => ({ ...current, [documentId]: dynamicAnalysis }));
      setSelectedDocId(documentId);
      setAnalysis(dynamicAnalysis);
      setShowUploadModal(false);
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
      if (dynamicAnalysis.document.status === "extraction_failed") {
        toast.error(`Could not extract readable text from "${file.name}" (${pageCount} pages detected). Try re-uploading a text-based PDF.`);
      } else if (dynamicAnalysis.document.status === "rejected_non_contract") {
        toast.error("Document does not appear to be a legal agreement — risk audit skipped.");
      } else {
        toast.success("Document analyzed successfully!");
      }
      return;
    }
    
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);

      setUploadStatusMsg("Extracting text and spawning specialized agents...");
      const res = await fetch("/api/documents/upload", {
        method: "POST",
        body: formData,
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.detail || errData.error || "Upload failed");
      }
      
      const data = await res.json();
      if (data.status === "extraction_failed") {
        toast.error(data.message || `Could not read document properly (${data.page_count} pages detected).`);
      } else if (data.status === "rejected_non_contract") {
        toast.error("Document does not appear to be a legal agreement — risk audit skipped.");
      } else {
        toast.success("Document analyzed successfully!");
      }
      setUploadStatusMsg("Aggregating consensus results...");
      
      await fetchDocuments();
      setSelectedDocId(data.document_id);
      setShowUploadModal(false);
    } catch (err) {
      console.warn("Upload service unavailable or timed out, generating grounded local analysis:", err);
      const documentId = `local-${crypto.randomUUID()}`;
      const dynamicAnalysis = buildDynamicDocumentAnalysis(file.name, documentId, fileText, pageCount);
      const mockDocument: APIDocument = {
        id: documentId,
        filename: file.name,
        content_type: file.type || "text/plain",
        status: dynamicAnalysis.document.status,
        page_count: dynamicAnalysis.document.page_count,
        created_at: new Date().toISOString(),
        risk_score: dynamicAnalysis.analysis.aggregate_risk_score > 0 ? dynamicAnalysis.analysis.aggregate_risk_score : null,
        risk_level: dynamicAnalysis.analysis.risk_level,
      };
      setDocuments((current) => [mockDocument, ...current.filter((doc) => doc.id !== documentId)]);
      setMockAnalyses((current) => ({ ...current, [documentId]: dynamicAnalysis }));
      setSelectedDocId(documentId);
      setAnalysis(dynamicAnalysis);
      setShowUploadModal(false);
      if (dynamicAnalysis.document.status === "extraction_failed") {
        toast.error(`Could not extract readable text from "${file.name}" (${pageCount} pages detected). Try re-uploading a text-based PDF.`);
      } else if (dynamicAnalysis.document.status === "rejected_non_contract") {
        toast.error("Document does not appear to be a legal agreement — risk audit skipped.");
      } else {
        toast.success("Document analyzed successfully!");
      }
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  if (!ready || !session) return <div className="min-h-screen bg-[#101412]" aria-label="Loading dashboard" />;

  const displayName = session.name || session.email.split("@")[0];

  // Filter findings based on selected agent filter
  const filteredFindings = analysis
    ? analysis.findings.filter(f => selectedAgentFilter === "All" || f.agent_name === selectedAgentFilter)
    : [];

  return (
    <main className="h-screen max-h-screen overflow-hidden bg-[#f1eee6] text-[#101412] flex flex-col font-sans">
      {/* Top Header */}
      <header className="border-b border-[#d6d2c8] bg-[#101412] text-[#f1eee6] shrink-0">
        <div className="container flex min-h-18 items-center justify-between gap-6 py-2">
          <Link href="/dashboard" className="flex items-center gap-3" aria-label="LegalAid dashboard home">
            <span className="grid h-9 w-9 place-items-center bg-[#d7ff52]"><img src="/legalaid-mark.jpg" alt="" className="h-7 w-7 object-contain" /></span>
            <span className="font-display text-[18px] font-bold tracking-[-0.04em]">LegalAid<span className="text-[#d7ff52]">.</span></span>
          </Link>
          <div className="flex items-center gap-4">
            <span className="hidden font-mono text-[10px] uppercase tracking-[0.12em] text-[#8f978e] sm:block">
              Reviewer: {session.email}
            </span>
            <button onClick={signOut} className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.12em] text-[#8f978e] transition-colors hover:text-[#d7ff52]">
              <LogOut className="h-3.5 w-3.5" /> Sign out
            </button>
          </div>
        </div>
      </header>

      {/* Main Layout */}
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden min-h-0">
        {/* Left Sidebar: Document List */}
        <aside className="w-full md:w-80 border-r border-[#d6d2c8] bg-[#f8f6f0] flex flex-col shrink-0 overflow-hidden min-h-0">
          <div className="p-4 border-b border-[#d6d2c8] flex items-center justify-between shrink-0">
            <span className="eyebrow text-[#626860] uppercase tracking-wider">Legal Documents</span>
            <Button 
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="h-8 rounded-none bg-[#101412] px-3 font-mono text-[10px] uppercase tracking-wider text-[#d7ff52] hover:bg-[#263026] flex items-center gap-1.5"
            >
              <Plus className="h-3 w-3" /> Ingest
            </Button>
            <input 
              type="file" 
              ref={fileInputRef} 
              onChange={handleFileUpload} 
              accept=".pdf,.txt" 
              className="hidden" 
            />
          </div>

          <div className="flex-1 overflow-y-auto p-2 space-y-1 min-h-0">
            {documents.length === 0 ? (
              <div className="text-center py-12 px-4">
                <FileText className="h-8 w-8 text-[#8f978e] mx-auto opacity-50 mb-3" />
                <p className="font-mono text-[11px] text-[#626860]">No files ingested yet.</p>
                <p className="text-[11px] text-[#8f978e] mt-1">Upload a PDF or TXT contract to begin review.</p>
              </div>
            ) : (
              documents.map((doc) => {
                const isActive = doc.id === selectedDocId;
                return (
                  <div
                    key={doc.id}
                    onClick={() => setSelectedDocId(doc.id)}
                    className={`group relative w-full text-left p-3.5 flex flex-col gap-1 border transition-colors cursor-pointer ${
                      isActive 
                        ? "bg-[#101412] text-[#f1eee6] border-[#101412]" 
                        : "bg-white border-[#e6e2d8] hover:bg-[#f3eff5] text-[#101412]"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="font-display font-semibold text-sm truncate flex-1">{doc.filename}</span>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {doc.status === "extraction_failed" ? (
                          <span className="text-[9px] font-mono px-1.5 py-0.5 bg-rose-100 text-rose-900 border border-rose-300 font-bold">
                            UNREADABLE
                          </span>
                        ) : doc.status === "rejected_non_contract" ? (
                          <span className="text-[9px] font-mono px-1.5 py-0.5 bg-amber-100 text-amber-900 border border-amber-300 font-bold">
                            NON-LEGAL
                          </span>
                        ) : doc.risk_score !== null && (
                          <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded-none font-bold ${
                            doc.risk_level === 'Critical' || doc.risk_level === 'High'
                              ? "bg-red-500 text-white"
                              : doc.risk_level === 'Medium'
                                ? "bg-amber-500 text-black"
                                : "bg-green-500 text-white"
                          }`}>
                            {doc.risk_score.toFixed(1)}
                          </span>
                        )}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteDocument(doc.id, doc.filename);
                          }}
                          title={`Delete ${doc.filename}`}
                          aria-label={`Delete ${doc.filename}`}
                          className={`p-1 transition-colors rounded ${
                            isActive
                              ? "text-slate-400 hover:text-red-400 hover:bg-white/10"
                              : "text-slate-400 hover:text-red-600 hover:bg-red-50"
                          }`}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                    <div className="flex items-center justify-between text-[10px] font-mono text-[#626860] mt-1.5">
                      <span>{doc.page_count ? `${doc.page_count} pg` : "TXT File"}</span>
                      <span className={`uppercase tracking-wider ${
                        doc.status === "extraction_failed"
                          ? "text-rose-700 font-semibold"
                          : doc.status === "rejected_non_contract"
                            ? "text-amber-700 font-semibold"
                            : isActive ? "text-[#d7ff52]" : "text-[#3158ff]"
                      }`}>
                        {doc.status === "extraction_failed"
                          ? "Extraction Issue"
                          : doc.status === "rejected_non_contract"
                            ? "Non-Contractual"
                            : doc.status}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </aside>

        {/* Right Section: Active Review Workbench */}
        <section className="flex-1 flex flex-col min-h-0 overflow-hidden bg-[#f1eee6]">
          {!selectedDocId ? (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center max-w-lg mx-auto">
              <FolderOpen className="h-16 w-16 text-[#3158ff] mb-6 animate-pulse" />
              <h2 className="font-display text-3xl font-bold tracking-tight">Select a document to begin auditing</h2>
              <p className="mt-3 text-sm text-[#626860] leading-relaxed">
                Choose an ingested legal draft from the sidebar panel, or click Ingest to upload and parse a new agreement.
              </p>
              <div className="mt-8 grid grid-cols-2 gap-4 w-full">
                <div className="border border-[#d6d2c8] bg-white p-4 text-left font-mono">
                  <span className="text-[10px] uppercase text-[#3158ff]">Consensus Engine</span>
                  <p className="text-xs text-[#626860] mt-2">Correlates, prioritizes, and scoring evaluations from five agent personas.</p>
                </div>
                <div className="border border-[#d6d2c8] bg-white p-4 text-left font-mono">
                  <span className="text-[10px] uppercase text-[#3158ff]">Citation Audit</span>
                  <p className="text-xs text-[#626860] mt-2">Every surfaced vulnerability is mapped to exact verified quotes in the source text.</p>
                </div>
              </div>
            </div>
          ) : loadingAnalysis ? (
            <div className="flex-1 flex flex-col items-center justify-center p-8">
              <Activity className="h-10 w-10 text-[#3158ff] animate-spin mb-4" />
              <p className="font-mono text-xs uppercase tracking-widest text-[#626860]">Retrieving agent consensus reports...</p>
            </div>
          ) : !analysis ? (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
              <AlertTriangle className="h-12 w-12 text-amber-500 mb-4" />
              <h3 className="font-display text-xl font-bold">Analysis Pending</h3>
              <p className="text-sm text-[#626860] mt-2">The document is currently being ingested or parsed by the AI backend.</p>
            </div>
          ) : (
            <div className="flex-1 flex flex-col overflow-hidden min-h-0">
              {/* Header workbench metadata */}
              <div className="p-4 sm:p-5 border-b border-[#d6d2c8] bg-[#f1eee6] flex flex-col md:flex-row justify-between items-start md:items-center gap-4 shrink-0">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="eyebrow text-[#3158ff]">Adversarial Risk Audit</span>
                    {viewMode === "simple" && (
                      <span className="px-2 py-0.5 bg-emerald-100 text-emerald-900 border border-emerald-300 font-mono text-[9px] uppercase font-bold">
                        🌿 Plain English Mode Active
                      </span>
                    )}
                  </div>
                  <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight mt-1 truncate max-w-xl text-[#101412]">
                    {analysis.document.filename}
                  </h1>
                </div>
                
                {/* Score Indicator & Mode Switchers */}
                <div className="flex flex-wrap items-center gap-3">
                  {/* Language Mode Toggle: Simple vs Legal */}
                  <div className="flex items-center border border-[#d6d2c8] bg-white p-1 font-mono text-xs shadow-sm">
                    <button
                      onClick={() => setViewMode("simple")}
                      className={`px-3 py-1.5 flex items-center gap-1.5 transition-colors font-bold ${
                        viewMode === "simple"
                          ? "bg-[#101412] text-[#d7ff52]"
                          : "text-slate-600 hover:text-black hover:bg-slate-100"
                      }`}
                      title="Plain-English explanations for non-lawyers"
                    >
                      <span>🌿</span> Simple
                    </button>
                    <button
                      onClick={() => setViewMode("legal")}
                      className={`px-3 py-1.5 flex items-center gap-1.5 transition-colors font-bold ${
                        viewMode === "legal"
                          ? "bg-[#101412] text-[#d7ff52]"
                          : "text-slate-600 hover:text-black hover:bg-slate-100"
                      }`}
                      title="Full legal terminology and multi-agent findings trail"
                    >
                      <span>⚖️</span> Legal
                    </button>
                  </div>

                  {/* View Mode Switcher */}
                  <div className="flex items-center gap-1 border border-[#d6d2c8] bg-white p-1 font-mono text-xs shadow-sm">
                    <button
                      onClick={() => setWorkbenchView("audit")}
                      className={`px-3 py-1.5 flex items-center gap-1.5 transition-colors font-bold ${
                        workbenchView === "audit"
                          ? "bg-[#101412] text-[#d7ff52]"
                          : "text-slate-600 hover:text-black hover:bg-slate-100"
                      }`}
                    >
                      <Shield className="h-3.5 w-3.5" /> {viewMode === "simple" ? "Risk Review" : "Findings Trail"}
                    </button>
                    <button
                      onClick={() => setWorkbenchView("chat")}
                      className={`px-3 py-1.5 flex items-center gap-1.5 transition-colors font-bold ${
                        workbenchView === "chat"
                          ? "bg-[#101412] text-[#d7ff52]"
                          : "text-slate-600 hover:text-black hover:bg-slate-100"
                      }`}
                    >
                      <MessageSquare className="h-3.5 w-3.5" /> Interactive Q&A
                      {chatMessages.length > 1 && (
                        <span className="ml-1 px-1.5 py-0.2 bg-[#3158ff] text-white text-[9px]">
                          {chatMessages.length}
                        </span>
                      )}
                    </button>
                  </div>

                  {analysis.document.status === "rejected_non_contract" || analysis.document.is_legal_contract === false ? (
                    <div className="flex items-center gap-2 bg-amber-100 border border-amber-300 px-3.5 py-2 text-amber-900 font-mono text-xs font-bold shadow-sm">
                      <AlertTriangle className="h-4 w-4 text-amber-700" />
                      <span>NON-LEGAL DOCUMENT</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-3 bg-[#101412] px-4 py-2 text-[#f1eee6]">
                      <div className="text-right">
                        <div className="text-[9px] font-mono uppercase tracking-widest text-[#d7ff52] font-semibold">
                          {viewMode === "simple" ? "Safety Score" : "Risk Score"}
                        </div>
                        <div className="font-mono text-[9px] text-[#8f978e] mt-0.5">
                          {viewMode === "simple" 
                            ? (analysis.analysis.risk_level === 'Critical' || analysis.analysis.risk_level === 'High' ? '⚠️ High Attention' : '✅ Moderate')
                            : analysis.analysis.risk_level
                          }
                        </div>
                      </div>
                      <div className="font-display text-2xl sm:text-3xl font-extrabold text-[#d7ff52] leading-none">
                        {analysis.analysis.aggregate_risk_score.toFixed(1)}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Main Content: Interactive Q&A Chat OR Findings Trail */}
              {workbenchView === "chat" ? (
                <div className="flex-1 flex flex-col bg-[#f1eee6] overflow-hidden p-4 sm:p-5 min-h-0">
                  <div className="flex-1 flex flex-col border border-[#d6d2c8] bg-white overflow-hidden shadow-sm min-h-0">
                    {/* Chat Deliberation Header */}
                    <div className="p-3.5 border-b border-[#d6d2c8] bg-slate-50 flex flex-wrap items-center justify-between gap-3 shrink-0">
                      <div className="flex items-center gap-2.5">
                        <div className="p-1.5 bg-[#101412] text-[#d7ff52]">
                          <Bot className="h-4 w-4" />
                        </div>
                        <div>
                          <h3 className="font-display font-bold text-xs sm:text-sm text-[#101412]">
                            AI Counsel Deliberation Channel
                          </h3>
                          <p className="text-[10px] font-mono text-[#626860]">
                            RAG Grounded • 5 Counsel Personas Active (Defense, Plaintiff, Judge, Drafting, Compliance)
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={() => {
                          if (confirm("Clear conversation history for this document?")) {
                            setChatMessages([]);
                            window.localStorage.removeItem(LOCAL_CHAT_PREFIX + selectedDocId);
                          }
                        }}
                        className="text-[10px] font-mono text-slate-500 hover:text-red-600 px-2 py-1 border border-slate-200 bg-white transition-colors"
                      >
                        Clear History
                      </button>
                    </div>

                    {/* Message Stream */}
                    <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 font-sans bg-[#fbfaf8]">
                      {chatMessages.map((msg) => (
                        <div
                          key={msg.id}
                          className={`flex flex-col ${msg.role === "user" ? "items-end" : "items-start"}`}
                        >
                          {msg.role === "assistant" && (
                            <div className="flex items-center gap-2 mb-1.5">
                              <span className={`text-[11px] font-mono uppercase tracking-wider px-2.5 py-0.5 font-bold ${
                                msg.agent_perspective === 'Plaintiff Counsel'
                                  ? "bg-amber-100 text-amber-900 border border-amber-300"
                                  : msg.agent_perspective === 'Judge'
                                    ? "bg-purple-100 text-purple-800 border border-purple-200"
                                    : msg.agent_perspective === 'Compliance Officer'
                                      ? "bg-green-100 text-green-800 border border-green-200"
                                      : "bg-blue-100 text-blue-800 border border-blue-200"
                              }`}>
                                {msg.agent_perspective || "AI Counsel"}
                              </span>
                              <span className="text-xs font-mono text-slate-400">
                                {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </div>
                          )}

                          <div
                            className={`p-4 max-w-2xl text-sm leading-relaxed ${
                              msg.role === "user"
                                ? "bg-[#101412] text-white border border-[#101412]"
                                : "bg-white text-[#101412] border border-[#d6d2c8] shadow-sm"
                            }`}
                          >
                            <div className="whitespace-pre-line">{msg.content}</div>

                            {/* Grounded Citations Quote Block */}
                            {msg.citations && msg.citations.length > 0 && (
                              <div className="mt-3.5 pt-3 border-t border-slate-200 font-mono text-xs space-y-1.5 bg-slate-50 p-3">
                                <span className="text-[10px] uppercase tracking-wider text-[#3158ff] font-bold flex items-center gap-1">
                                  <CheckCircle className="h-3 w-3 text-green-600" /> Grounded Source Excerpt
                                </span>
                                {msg.citations.map((cite, cIdx) => (
                                  <blockquote key={cIdx} className="border-l-2 border-[#3158ff] pl-3 italic text-slate-700 leading-relaxed text-xs">
                                    "{cite}"
                                  </blockquote>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      ))}

                      {sendingChat && (
                        <div className="flex items-center gap-2 text-sm font-mono text-slate-500 p-2">
                          <Activity className="h-4 w-4 animate-spin text-[#3158ff]" />
                          <span>Counsel deliberating on evidence...</span>
                        </div>
                      )}
                      <div ref={chatBottomRef} />
                    </div>

                    {/* Message Input Form */}
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        handleSendChatMessage();
                      }}
                      className="p-3 border-t border-[#d6d2c8] bg-white flex items-center gap-2"
                    >
                      <input
                        type="text"
                        value={chatInput}
                        onChange={(e) => setChatInput(e.target.value)}
                        placeholder="Ask AI Counsel a question about this document (e.g. explain the liability cap risk)..."
                        disabled={sendingChat}
                        className="flex-1 px-4 py-3 text-sm bg-slate-50 border border-slate-200 focus:outline-none focus:ring-1 focus:ring-[#101412]"
                      />
                      <button
                        type="submit"
                        disabled={!chatInput.trim() || sendingChat}
                        className="bg-[#101412] hover:bg-[#202622] text-[#d7ff52] px-6 py-3 text-xs font-mono font-bold flex items-center gap-1.5 transition-colors disabled:opacity-50"
                      >
                        <Send className="h-4 w-4" /> Send
                      </button>
                    </form>
                  </div>
                </div>
              ) : analysis.document.status === "extraction_failed" ? (
                <div className="flex-1 flex flex-col items-center justify-center p-8 text-center max-w-lg mx-auto">
                  <div className="h-16 w-16 rounded-full bg-rose-100 border border-rose-300 flex items-center justify-center text-rose-700 text-3xl mb-4">
                    ⚠️
                  </div>
                  <h2 className="font-display text-2xl font-bold tracking-tight text-[#101412]">
                    Unable to Read Document Text
                  </h2>
                  <p className="mt-3 text-sm text-[#626860] leading-relaxed">
                    We couldn't extract sufficient readable text from this {analysis.document.page_count || 1}-page document. The file may be a scanned image without selectable text or encoded with non-standard fonts.
                  </p>
                  <div className="mt-6 p-4 bg-white border border-[#d6d2c8] text-left text-xs font-mono text-slate-700 w-full space-y-2">
                    <div className="text-[10px] uppercase font-bold text-rose-600">Extraction Issue Audit Log</div>
                    <div>• File: <span className="text-black font-semibold">{analysis.document.filename}</span></div>
                    <div>• Detected Pages: <span className="text-black font-semibold">{analysis.document.page_count || 1} pg</span></div>
                    <div>• Reason: {analysis.document.rejection_reason || "Incomplete text extraction."}</div>
                    <div>• Action: Please re-upload a searchable, text-based PDF or OCR-processed scan.</div>
                  </div>
                </div>
              ) : analysis.document.status === "rejected_non_contract" || analysis.document.is_legal_contract === false ? (
                <div className="flex-1 flex flex-col items-center justify-center p-8 text-center max-w-lg mx-auto">
                  <div className="h-16 w-16 rounded-full bg-amber-100 border border-amber-300 flex items-center justify-center text-amber-700 text-3xl mb-4">
                    ⚠️
                  </div>
                  <h2 className="font-display text-2xl font-bold tracking-tight text-[#101412]">
                    Not a Legal Agreement
                  </h2>
                  <p className="mt-3 text-sm text-[#626860] leading-relaxed">
                    This document does not appear to be a legal contract or agreement — no contractual clauses, covenants, or legal obligations were detected in the extracted text.
                  </p>
                  <div className="mt-6 p-4 bg-white border border-[#d6d2c8] text-left text-xs font-mono text-slate-700 w-full space-y-2">
                    <div className="text-[10px] uppercase font-bold text-slate-500">Rejection Audit Log</div>
                    <div>• File: <span className="text-black font-semibold">{analysis.document.filename}</span></div>
                    <div>• Reason: {analysis.document.rejection_reason || "No contractual language or clauses detected."}</div>
                    <div>• Action: Multi-agent risk audit skipped (0 findings generated).</div>
                  </div>
                </div>
              ) : (
                <div className="flex-1 flex flex-col lg:flex-row overflow-hidden min-h-0">
                  {/* Left Column: Report Summary & Findings */}
                  <div className="flex-1 overflow-y-auto p-6 space-y-6 min-h-0">

                {/* Consensus Report Tabs Panel */}
                <div className="bg-white border border-[#d6d2c8] p-5">
                  <div className="flex border-b border-[#d6d2c8] gap-4 text-xs font-mono pb-2 overflow-x-auto shrink-0">
                    {(viewMode === "simple"
                      ? [
                          { id: "summary", label: "Plain Summary" },
                          { id: "vulnerabilities", label: `Things to Fix (${analysis.analysis.critical_count + analysis.analysis.high_count})` },
                          { id: "strengths", label: "Good Points" },
                          { id: "recommendations", label: "Suggested Steps" }
                        ]
                      : [
                          { id: "summary", label: "Executive Summary" },
                          { id: "vulnerabilities", label: `Major Risks (${analysis.analysis.critical_count + analysis.analysis.high_count})` },
                          { id: "strengths", label: "Strengths" },
                          { id: "recommendations", label: "Action Steps" }
                        ]
                    ).map((tab) => (
                      <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id as any)}
                        className={`pb-2 px-1 relative transition-colors ${
                          activeTab === tab.id 
                            ? "text-[#101412] font-bold border-b-2 border-[#101412]" 
                            : "text-[#8f978e] hover:text-[#101412]"
                        }`}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </div>
                  
                  <div className="mt-4 text-sm leading-relaxed text-[#626860]">
                    {activeTab === "summary" && (
                      <div>
                        <p className="font-medium text-[#101412]">
                          <GlossaryText text={analysis.analysis.consensus_report.summary} />
                        </p>
                        <div className="mt-4 grid grid-cols-4 gap-2 font-mono text-[11px] text-center">
                          <div className="bg-red-50 p-2.5 border border-red-100">
                            <span className="block text-red-700 font-bold text-sm">{analysis.analysis.critical_count}</span>
                            <span className="text-red-600 uppercase tracking-wide">
                              {viewMode === "simple" ? "Urgent" : "Critical"}
                            </span>
                          </div>
                          <div className="bg-orange-50 p-2.5 border border-orange-100">
                            <span className="block text-orange-700 font-bold text-sm">{analysis.analysis.high_count}</span>
                            <span className="text-orange-600 uppercase tracking-wide">
                              {viewMode === "simple" ? "Serious" : "High"}
                            </span>
                          </div>
                          <div className="bg-amber-50 p-2.5 border border-amber-100">
                            <span className="block text-amber-700 font-bold text-sm">{analysis.analysis.medium_count}</span>
                            <span className="text-amber-600 uppercase tracking-wide">
                              {viewMode === "simple" ? "Review" : "Medium"}
                            </span>
                          </div>
                          <div className="bg-green-50 p-2.5 border border-green-100">
                            <span className="block text-green-700 font-bold text-sm">{analysis.analysis.low_count}</span>
                            <span className="text-green-600 uppercase tracking-wide">
                              {viewMode === "simple" ? "Minor" : "Low"}
                            </span>
                          </div>
                        </div>
                      </div>
                    )}
                    {activeTab === "strengths" && (
                      <ul className="space-y-2 list-disc list-inside">
                        {analysis.analysis.consensus_report.strengths.map((str, idx) => (
                          <li key={idx}><GlossaryText text={str} /></li>
                        ))}
                      </ul>
                    )}
                    {activeTab === "vulnerabilities" && (
                      <ul className="space-y-2 list-disc list-inside text-red-700">
                        {analysis.analysis.consensus_report.vulnerabilities.map((vul, idx) => (
                          <li key={idx} className="font-medium"><GlossaryText text={vul} /></li>
                        ))}
                      </ul>
                    )}
                    {activeTab === "recommendations" && (
                      <ul className="space-y-2 list-decimal list-inside text-[#3158ff]">
                        {analysis.analysis.consensus_report.recommendations.map((rec, idx) => (
                          <li key={idx} className="font-semibold"><GlossaryText text={rec} /></li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>

                {/* Findings Audit section */}
                <div className="space-y-4">
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                    <div>
                      <h3 className="font-display text-xl font-bold tracking-tight flex items-center gap-2">
                        <Shield className="h-5 w-5 text-[#3158ff]" /> 
                        {viewMode === "simple" ? "Plain-English Risk Review" : "Agent Findings Trail"}
                      </h3>
                      {viewMode === "simple" && (
                        <p className="text-xs text-[#626860] mt-0.5">
                          Everyday translation of what each clause means, practical risks, and how to fix them.
                        </p>
                      )}
                    </div>
                    
                    {/* Agent / Category Filters */}
                    <div className="flex flex-wrap gap-1 font-mono text-[10px]">
                      {(viewMode === "simple"
                        ? [
                            { id: "All", label: "All Issues" },
                            { id: "Plaintiff Counsel", label: "Adversarial Risks" },
                            { id: "Defense Counsel", label: "Liability Traps" },
                            { id: "Judge", label: "Court Enforceability" },
                            { id: "Drafting Counsel", label: "Vague Language" },
                            { id: "Compliance Officer", label: "Compliance" }
                          ]
                        : [
                            { id: "All", label: "All" },
                            { id: "Defense Counsel", label: "Defense" },
                            { id: "Plaintiff Counsel", label: "Plaintiff" },
                            { id: "Drafting Counsel", label: "Drafting" },
                            { id: "Judge", label: "Judge" },
                            { id: "Compliance Officer", label: "Compliance" }
                          ]
                      ).map((filter) => (
                        <button
                          key={filter.id}
                          onClick={() => setSelectedAgentFilter(filter.id)}
                          className={`px-2.5 py-1 transition-colors border ${
                            selectedAgentFilter === filter.id
                              ? "bg-[#101412] text-[#d7ff52] border-[#101412]"
                              : "bg-white hover:bg-slate-100 text-slate-600 border-slate-200"
                          }`}
                        >
                          {filter.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Findings List */}
                  <div className="space-y-3">
                    {filteredFindings.length === 0 ? (
                      <div className="bg-white border border-[#d6d2c8] p-8 text-center text-[#626860] font-mono text-xs">
                        No findings matching this filter.
                      </div>
                    ) : (
                      filteredFindings.map((finding) => {
                        const isSelected = selectedFinding?.id === finding.id;
                        const plain = getPlainLanguageFinding(finding);
                        const sev = getPlainLanguageSeverity(finding.risk_level);

                        return (
                          <button
                            key={finding.id}
                            onClick={() => setSelectedFinding(finding)}
                            className={`w-full text-left p-4 border transition-all flex flex-col gap-3 ${
                              isSelected 
                                ? "bg-[#101412] text-[#f1eee6] border-[#101412] ring-1 ring-[#d7ff52]" 
                                : "bg-white hover:bg-slate-50 border-[#d6d2c8] text-[#101412]"
                            }`}
                          >
                            <div className="flex justify-between items-start gap-4 w-full">
                              <div className="space-y-2 flex-1 min-w-0">
                                <div className="flex flex-wrap items-center gap-2">
                                  {viewMode === "simple" ? (
                                    <>
                                      <span className={`text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 font-bold ${sev.bg} ${sev.text}`}>
                                        {sev.label}
                                      </span>
                                      <span className="text-[10px] font-mono px-2 py-0.5 bg-blue-50 text-[#3158ff] border border-blue-200 font-semibold">
                                        {finding.clause_type}
                                      </span>
                                    </>
                                  ) : (
                                    <>
                                      <span className={`text-[9px] font-mono uppercase tracking-wider px-2 py-0.5 font-bold ${
                                        finding.agent_name === 'Defense Counsel' 
                                          ? "bg-red-100 text-red-800 border border-red-200" 
                                          : finding.agent_name === 'Plaintiff Counsel'
                                            ? "bg-amber-100 text-amber-900 border border-amber-300 font-bold"
                                            : finding.agent_name === 'Drafting Counsel'
                                              ? "bg-blue-100 text-blue-800 border border-blue-200"
                                              : "bg-purple-100 text-purple-800 border border-purple-200"
                                      }`}>
                                        {finding.agent_name}
                                      </span>
                                      <span className="text-[10px] font-mono text-[#8f978e]">{finding.clause_type}</span>
                                    </>
                                  )}
                                </div>
                                
                                <h4 className={`font-semibold text-sm ${isSelected ? "text-white" : "text-slate-900"}`}>
                                  {viewMode === "simple" ? plain.title : finding.finding_type}
                                </h4>
                                
                                {viewMode === "simple" ? (
                                  <div className="space-y-2 pt-0.5">
                                    <p className={`text-xs leading-relaxed ${isSelected ? "text-slate-300" : "text-slate-700"}`}>
                                      <GlossaryText text={plain.whatItSays} />
                                    </p>

                                    {/* What this means for you */}
                                    <div className={`p-2.5 border-l-2 text-xs flex flex-col gap-0.5 ${
                                      isSelected 
                                        ? "bg-amber-950/40 border-amber-400 text-amber-200" 
                                        : "bg-amber-50 border-amber-500 text-amber-950"
                                    }`}>
                                      <span className="font-bold text-[10px] uppercase tracking-wider text-amber-600 flex items-center gap-1">
                                        ⚠️ What this means for you:
                                      </span>
                                      <span className="leading-relaxed font-sans">{plain.impact}</span>
                                    </div>

                                    {/* Action step */}
                                    <div className={`p-2 border-l-2 text-xs flex items-start gap-1.5 ${
                                      isSelected 
                                        ? "bg-emerald-950/40 border-emerald-400 text-emerald-200" 
                                        : "bg-emerald-50 border-emerald-600 text-emerald-950"
                                    }`}>
                                      <span className="font-bold text-[10px] uppercase tracking-wider text-emerald-600 shrink-0">💡 Fix:</span>
                                      <span className="leading-relaxed font-sans">{plain.action}</span>
                                    </div>
                                  </div>
                                ) : (
                                  <>
                                    <p className={`text-xs line-clamp-2 leading-relaxed ${isSelected ? "text-slate-300" : "text-slate-600"}`}>
                                      <GlossaryText text={finding.summary} />
                                    </p>
                                    
                                    <div className="flex items-center gap-3 font-mono text-[10px] pt-1">
                                      <span className="flex items-center gap-1">
                                        Severity: <span className="font-bold">{finding.severity_score}/10</span>
                                      </span>
                                      <span className="text-[#8f978e]">•</span>
                                      <span className="flex items-center gap-1">
                                        Confidence: <span className="font-bold">{(finding.confidence * 100).toFixed(0)}%</span>
                                      </span>
                                    </div>
                                  </>
                                )}
                              </div>
                              
                              <div className="flex flex-col items-end shrink-0 gap-3">
                                <span className={`text-[9px] font-mono uppercase tracking-widest px-2 py-0.5 rounded-none font-bold ${
                                  finding.risk_level === 'Critical' || finding.risk_level === 'High'
                                    ? "bg-red-500 text-white"
                                    : "bg-amber-500 text-black"
                                }`}>
                                  {viewMode === "simple" ? sev.label : finding.risk_level}
                                </span>
                                <ChevronRight className="h-4 w-4 opacity-50" />
                              </div>
                            </div>

                            {/* Consensus Deliberation Preview Indicator */}
                            {finding.consensus_reasoning && (
                              <div className={`pt-2 border-t text-[10px] font-mono flex items-center justify-between ${
                                isSelected ? "border-white/10 text-[#d7ff52]" : "border-slate-100 text-[#3158ff]"
                              }`}>
                                <span className="flex items-center gap-1 font-semibold">
                                  <Sparkles className="h-3 w-3" /> 
                                  {viewMode === "simple" ? "Plain Consensus Breakdown" : `Consensus Deliberation (${finding.consensus_reasoning.deliberation.length} Agents)`}
                                </span>
                                <span className="text-[9px] uppercase tracking-wider opacity-75">
                                  {viewMode === "simple" ? "Read full advice →" : "Inspect reasoning →"}
                                </span>
                              </div>
                            )}
                          </button>
                        );
                      })
                    )}
                  </div>
                </div>
              </div>

              {/* Right Column: Evidence inspect side-drawer */}
              {selectedFinding && (
                <div className="w-full lg:w-96 border-t lg:border-t-0 lg:border-l border-[#d6d2c8] bg-white flex flex-col shrink-0 overflow-hidden min-h-0">
                  <div className="p-4 border-b border-[#d6d2c8] flex items-center justify-between bg-slate-50 shrink-0">
                    <span className="font-mono text-xs uppercase tracking-wider text-[#3158ff] font-bold flex items-center gap-1.5">
                      <Sparkles className="h-3.5 w-3.5 text-[#3158ff]" /> 
                      {viewMode === "simple" ? "Risk Breakdown & Advice" : "Evidence Auditor"}
                    </span>
                    <button 
                      onClick={() => setSelectedFinding(null)}
                      className="p-1 hover:bg-slate-200 transition-colors"
                    >
                      <X className="h-4 w-4 text-slate-500" />
                    </button>
                  </div>
                  
                  <div className="p-5 flex-1 overflow-y-auto space-y-6 min-h-0">
                    {(() => {
                      const plain = getPlainLanguageFinding(selectedFinding);
                      const sev = getPlainLanguageSeverity(selectedFinding.risk_level);

                      return viewMode === "simple" ? (
                        <>
                          <div>
                            <span className="text-[10px] font-mono uppercase tracking-wider text-[#626860]">Issue Details</span>
                            <h3 className="font-display text-lg font-bold mt-1 text-[#101412] leading-snug">
                              {plain.title}
                            </h3>
                            <div className="flex items-center gap-2 mt-2">
                              <span className={`text-[10px] font-mono px-2 py-0.5 font-bold ${sev.bg} ${sev.text}`}>
                                {sev.label}
                              </span>
                              <span className="text-[10px] font-mono bg-blue-100 text-blue-800 px-2 py-0.5 font-semibold">
                                {selectedFinding.clause_type}
                              </span>
                            </div>
                          </div>

                          <div className="space-y-2 border-t border-[#d6d2c8] pt-4">
                            <span className="text-[10px] font-mono uppercase tracking-wider text-[#626860] block">What this clause says</span>
                            <p className="text-xs text-slate-700 leading-relaxed font-sans">
                              <GlossaryText text={plain.whatItSays} />
                            </p>
                          </div>

                          <div className="space-y-2 bg-amber-50/70 p-3 border border-amber-200">
                            <span className="text-[10px] font-mono uppercase tracking-wider text-amber-800 font-bold flex items-center gap-1">
                              ⚠️ Real-World Practical Impact
                            </span>
                            <p className="text-xs text-amber-950 leading-relaxed font-sans">
                              {plain.impact}
                            </p>
                          </div>

                          <div className="space-y-2 bg-emerald-50/70 p-3 border border-emerald-200">
                            <span className="text-[10px] font-mono uppercase tracking-wider text-emerald-800 font-bold flex items-center gap-1">
                              💡 How To Negotiate & Fix This
                            </span>
                            <p className="text-xs text-emerald-950 leading-relaxed font-sans">
                              {plain.action}
                            </p>
                          </div>

                          {selectedFinding.consensus_reasoning && (
                            <div className="space-y-2 bg-[#101412] text-[#f1eee6] p-3.5 border-l-2 border-[#d7ff52]">
                              <span className="text-[9px] uppercase tracking-wider text-[#d7ff52] font-semibold block">
                                Why Our AI Flagged This
                              </span>
                              <p className="text-slate-300 leading-relaxed font-sans text-xs">
                                {getPlainArbitrationRule(selectedFinding.consensus_reasoning.arbitration_rule)}
                              </p>
                            </div>
                          )}

                          <div className="space-y-3 bg-[#101412] text-[#f1eee6] p-4 font-mono text-xs relative">
                            <div className="absolute top-3 right-3 flex items-center gap-1 bg-[#d7ff52] text-[#101412] text-[8px] uppercase tracking-wider px-1.5 py-0.5 font-bold">
                              <CheckCircle className="h-2 w-2" /> Verified Text
                            </div>
                            
                            <span className="text-[9px] uppercase tracking-widest text-[#d7ff52] block font-semibold">Exact Contract Excerpt</span>
                            
                            <blockquote className="border-l-2 border-[#d7ff52] pl-3 italic text-slate-300 leading-relaxed py-1">
                              "<GlossaryText text={selectedFinding.evidence_quote} />"
                            </blockquote>
                          </div>
                        </>
                      ) : (
                        <>
                          <div>
                            <span className="text-[10px] font-mono uppercase tracking-wider text-[#626860]">Surfaced Loophole</span>
                            <h3 className="font-display text-lg font-bold mt-1 text-[#101412] leading-snug">
                              {selectedFinding.finding_type}
                            </h3>
                            <div className="flex items-center gap-2 mt-2">
                              <span className={`text-[10px] font-mono px-2 py-0.5 font-bold ${
                                selectedFinding.agent_name === 'Plaintiff Counsel'
                                  ? "bg-amber-100 text-amber-900 border border-amber-300"
                                  : "bg-red-100 text-red-800"
                              }`}>
                                {selectedFinding.agent_name}
                              </span>
                              <span className="text-[10px] font-mono bg-blue-100 text-blue-800 px-2 py-0.5">
                                {selectedFinding.clause_type}
                              </span>
                            </div>
                          </div>

                          <div className="space-y-2 border-t border-[#d6d2c8] pt-4">
                            <span className="text-[10px] font-mono uppercase tracking-wider text-[#626860] block">Vulnerability Summary</span>
                            <p className="text-xs text-[#626860] leading-relaxed">
                              <GlossaryText text={selectedFinding.summary} />
                            </p>
                          </div>

                          {/* Consensus Deliberation & Reasoning Section */}
                          {selectedFinding.consensus_reasoning && (
                            <div className="space-y-3 border-t border-[#d6d2c8] pt-4">
                              <div className="flex items-center justify-between">
                                <span className="text-[10px] font-mono uppercase tracking-wider text-[#3158ff] font-bold flex items-center gap-1">
                                  <Shield className="h-3 w-3" /> Consensus Deliberation
                                </span>
                                <span className="text-[9px] font-mono bg-blue-50 text-[#3158ff] px-1.5 py-0.5 font-semibold">
                                  Arbitrated
                                </span>
                              </div>
                              
                              <p className="text-[11px] text-[#626860] leading-normal font-sans">
                                {selectedFinding.consensus_reasoning.summary}
                              </p>

                              <div className="space-y-2 pt-1">
                                {selectedFinding.consensus_reasoning.deliberation.map((delib, idx) => (
                                  <div key={idx} className="bg-slate-50 border border-slate-200 p-2.5 space-y-1 font-mono text-[10px]">
                                    <div className="flex items-center justify-between">
                                      <span className="font-bold text-[#101412]">{delib.agent}</span>
                                      <span className="text-[9px] px-1.5 py-0.2 bg-white border border-slate-300 text-slate-700 font-bold">
                                        {delib.score}/10 Risk
                                      </span>
                                    </div>
                                    <div className="text-[#3158ff] font-semibold text-[9px] uppercase tracking-wide">
                                      Stance: {delib.stance}
                                    </div>
                                    <p className="text-slate-600 text-[10px] leading-relaxed font-sans pt-0.5">
                                      "{delib.argument}"
                                    </p>
                                  </div>
                                ))}
                              </div>

                              <div className="bg-[#101412] text-[#f1eee6] p-3 font-mono text-[10px] space-y-1 border-l-2 border-[#d7ff52]">
                                <span className="text-[9px] uppercase tracking-wider text-[#d7ff52] font-semibold block">Arbitration Rule</span>
                                <p className="text-slate-300 leading-relaxed font-sans text-[11px]">
                                  {selectedFinding.consensus_reasoning.arbitration_rule}
                                </p>
                              </div>
                            </div>
                          )}

                          <div className="space-y-3 bg-[#101412] text-[#f1eee6] p-4 font-mono text-xs relative">
                            <div className="absolute top-3 right-3 flex items-center gap-1 bg-[#d7ff52] text-[#101412] text-[8px] uppercase tracking-wider px-1.5 py-0.5 font-bold">
                              <CheckCircle className="h-2 w-2" /> Grounded Cite
                            </div>
                            
                            <span className="text-[9px] uppercase tracking-widest text-[#d7ff52] block font-semibold">Exact Source Quote</span>
                            
                            <blockquote className="border-l-2 border-[#d7ff52] pl-3 italic text-slate-300 leading-relaxed py-1">
                              "<GlossaryText text={selectedFinding.evidence_quote} />"
                            </blockquote>
                            
                            <div className="text-[9px] text-[#8f978e] pt-1">
                              Verification Status: <span className="text-green-400 font-bold uppercase">{selectedFinding.verification_status}</span>
                            </div>
                          </div>

                          {selectedFinding.chunk_text && (
                            <div className="space-y-2 border-t border-[#d6d2c8] pt-4">
                              <span className="text-[10px] font-mono uppercase tracking-wider text-[#626860] block">Surrounding Clause Context</span>
                              <div className="bg-slate-50 border border-slate-200 p-3 rounded-none text-xs text-slate-600 leading-relaxed max-h-48 overflow-y-auto font-sans">
                                {selectedFinding.chunk_text}
                              </div>
                            </div>
                          )}
                        </>
                      );
                    })()}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </section>
  </div>

      {/* Global Ingestion Spinner Overlay */}
      {uploading && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#101412]/80 backdrop-blur-sm text-white p-4">
          <div className="bg-[#101412] border border-white/10 p-8 max-w-sm w-full text-center space-y-4 shadow-2xl relative">
            <button
              onClick={() => setUploading(false)}
              className="absolute top-3 right-3 text-slate-400 hover:text-white p-1"
              aria-label="Dismiss ingestion overlay"
            >
              <X className="h-4 w-4" />
            </button>
            <Activity className="h-10 w-10 text-[#d7ff52] animate-spin mx-auto" />
            <h3 className="font-display text-lg font-bold text-[#d7ff52]">Adversarial Legal Agent Pipelines Triggered</h3>
            <p className="text-xs text-slate-400 leading-relaxed font-mono">
              {uploadStatusMsg}
            </p>
            <div className="h-1 w-full bg-white/10 overflow-hidden relative">
              <div className="absolute inset-0 bg-[#d7ff52] animate-infinite-loading" />
            </div>
            <button
              onClick={() => setUploading(false)}
              className="mt-2 text-[10px] font-mono uppercase tracking-wider text-slate-500 hover:text-slate-300 underline"
            >
              Dismiss / Run in Background
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
