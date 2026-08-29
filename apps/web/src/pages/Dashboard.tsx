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
  RefreshCw
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

interface ConsensusReasoning {
  summary: string;
  deliberation: AgentDeliberation[];
  arbitration_rule: string;
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

function buildMockAnalysis(fileName: string, documentId: string): AnalysisResults {
  return {
    document: {
      id: documentId,
      filename: fileName,
      page_count: 12,
      status: "completed",
    },
    analysis: {
      id: `analysis-${documentId}`,
      aggregate_risk_score: 8.4,
      risk_level: "High",
      critical_count: 2,
      high_count: 2,
      medium_count: 2,
      low_count: 1,
      consensus_report: {
        summary:
          "The document shows meaningful litigation exposure in indemnity, liability carve-outs, and ambiguous termination obligations. The strongest risks are evidence-backed and should be tightened before execution.",
        strengths: [
          "Core commercial structure is readable and sectioned clearly.",
          "Governing law and dispute forum are identifiable.",
          "Confidentiality obligations are present and mostly mutual.",
        ],
        vulnerabilities: [
          "Indemnity language is broad enough to include indirect and punitive losses.",
          "Plaintiff Counsel identified weaponizable carve-outs bypassing liability limits.",
          "Termination rights lack transition assistance and survival clarity.",
        ],
        recommendations: [
          "Limit indemnity to third-party claims and verified direct losses.",
          "Add a mutual aggregate cap and narrow uncapped exclusions.",
          "Define survival, cure periods, and post-termination support.",
        ],
      },
    },
    findings: [
      {
        id: `${documentId}-finding-1`,
        agent_name: "Defense Counsel",
        clause_type: "Indemnification",
        finding_type: "Overbroad indemnity exposure",
        summary:
          "The indemnity obligation appears uncapped and extends to broad loss categories, creating a high-value adversarial attack path.",
        evidence_quote:
          "The supplier shall indemnify the customer for all losses, whether direct, indirect, incidental, consequential, or punitive.",
        verification_status: "VERIFIED",
        severity_score: 8,
        confidence: 0.92,
        risk_level: "Critical",
        chunk_text:
          "Indemnification. The supplier shall indemnify the customer for all losses, whether direct, indirect, incidental, consequential, or punitive, arising from or relating to the agreement.",
        consensus_reasoning: {
          summary: "Consensus Engine deliberated across 3 agent perspectives to calibrate final severity score to 8/10.",
          deliberation: [
            { agent: "Defense Counsel", stance: "Client Exposure", score: 8, argument: "Indemnity lacks reciprocal cap, exposing client to third-party claims." },
            { agent: "Plaintiff Counsel", stance: "Adversarial Attack Path", score: 9, argument: "Opposing party can weaponize broad loss terms to claim indirect, incidental, and legal fees without proving direct breach." },
            { agent: "Judge", stance: "Judicial Enforceability", score: 7, argument: "Courts generally uphold commercial indemnity as written unless clearly unconscionable. High litigation burden exists." }
          ],
          arbitration_rule: "Consensus weighted toward Plaintiff adversarial exploit risk (9/10) and Judge enforceability standard (7/10), settling at final severity of 8/10."
        }
      },
      {
        id: `${documentId}-finding-plaintiff-1`,
        agent_name: "Plaintiff Counsel",
        clause_type: "Indemnification",
        finding_type: "Adversarial Indemnity Loophole",
        summary:
          "Opposing counsel can leverage this broad indemnity to demand defense costs and settlement contributions even before liability is adjudicated in court.",
        evidence_quote:
          "The supplier shall indemnify the customer for all losses, whether direct, indirect, incidental, consequential, or punitive.",
        verification_status: "VERIFIED",
        severity_score: 9,
        confidence: 0.94,
        risk_level: "Critical",
        chunk_text:
          "Indemnification. The supplier shall indemnify the customer for all losses, whether direct, indirect, incidental, consequential, or punitive, arising from or relating to the agreement.",
        consensus_reasoning: {
          summary: "Consensus Engine verified Plaintiff Counsel litigation vector and aligned severity with adversarial leverage.",
          deliberation: [
            { agent: "Plaintiff Counsel", stance: "Maximum Leverage", score: 9, argument: "Uncapped indemnification allows immediate preliminary motions for defense funding." },
            { agent: "Judge", stance: "Enforceability Risk", score: 7, argument: "Clause is commercially harsh but enforceable under standard freedom of contract." },
            { agent: "Defense Counsel", stance: "Defensive Exposure", score: 8, argument: "Creates severe unhedged balance sheet vulnerability." }
          ],
          arbitration_rule: "Weighted toward Plaintiff adversarial attack path (9/10), requiring urgent renegotiation."
        }
      },
      {
        id: `${documentId}-finding-2`,
        agent_name: "Judge",
        clause_type: "Limitation of Liability",
        finding_type: "Liability cap diluted by exclusions",
        summary:
          "The limitation clause contains exceptions that could swallow the cap and create imbalance between the parties.",
        evidence_quote:
          "Liability cap shall not apply to payment obligations, confidentiality, data misuse, or any breach deemed material.",
        verification_status: "VERIFIED",
        severity_score: 7,
        confidence: 0.86,
        risk_level: "High",
        chunk_text:
          "Limitation of Liability. Liability cap shall not apply to payment obligations, confidentiality, data misuse, or any breach deemed material by the customer.",
        consensus_reasoning: {
          summary: "Consensus calibrated to 7/10 based on judicial scrutiny of unconscionable liability carve-outs.",
          deliberation: [
            { agent: "Judge", stance: "Equitable Balance", score: 7, argument: "Unilateral exclusions that swallow the entire liability limitation create severe judicial scrutiny." },
            { agent: "Plaintiff Counsel", stance: "Carve-out Exploitation", score: 8, argument: "Carve-outs for 'material breach' allow plaintiff to bypass the damages cap entirely." },
            { agent: "Defense Counsel", stance: "Risk Mitigation", score: 6, argument: "Aggregate liability cap exists but carve-outs dilute protection." }
          ],
          arbitration_rule: "Consensus calibrated to 7/10: Plaintiff carve-out risk balanced against Judge assessment of judicial scrutiny."
        }
      },
      {
        id: `${documentId}-finding-3`,
        agent_name: "Drafting Counsel",
        clause_type: "Termination",
        finding_type: "Missing transition mechanics",
        summary:
          "The termination section describes notice but does not define post-termination cooperation, data return, or service continuity.",
        evidence_quote:
          "Either party may terminate for convenience with ninety days written notice after the initial service period.",
        verification_status: "VERIFIED",
        severity_score: 6,
        confidence: 0.81,
        risk_level: "Medium",
        chunk_text:
          "Termination. Either party may terminate for convenience with ninety days written notice after the initial service period.",
        consensus_reasoning: {
          summary: "Consensus calibrated to 6/10: Weighted toward commercial continuity risk and drafting ambiguity.",
          deliberation: [
            { agent: "Drafting Counsel", stance: "Clarity & Notice", score: 5, argument: "Notice period defined, but transition mechanics and survival terms are missing." },
            { agent: "Plaintiff Counsel", stance: "Commercial Leverage", score: 7, argument: "Opposing party can terminate for convenience abruptly after setup costs are absorbed." },
            { agent: "Judge", stance: "Contractual Freedom", score: 6, argument: "Termination for convenience is enforceable; main risk is operational discontinuity." }
          ],
          arbitration_rule: "Weighted toward commercial continuity risk identified by Plaintiff Counsel and Drafting ambiguity."
        }
      },
    ],
    chunks: [
      {
        id: `${documentId}-chunk-1`,
        chunk_id: 1,
        page_number: 4,
        raw_text:
          "Indemnification. The supplier shall indemnify the customer for all losses, whether direct, indirect, incidental, consequential, or punitive.",
        clause_type: "Indemnification",
      },
      {
        id: `${documentId}-chunk-2`,
        chunk_id: 2,
        page_number: 7,
        raw_text:
          "Liability cap shall not apply to payment obligations, confidentiality, data misuse, or any breach deemed material.",
        clause_type: "Limitation of Liability",
      },
    ],
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
      return saved ? JSON.parse(saved) : [];
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
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

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

    try {
      if (USE_BACKEND_API) {
        const res = await fetch(`/api/documents/${selectedDocId}/chat`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: textToSend })
        });

        if (res.ok) {
          const data = await res.json();
          if (data.assistant_message) {
            setChatMessages((prev) => [...prev, data.assistant_message]);
            return;
          }
        }
      }

      // Local grounded fallback response
      const matchedFinding =
        analysis?.findings.find(
          (f) =>
            f.clause_type.toLowerCase().includes(textToSend.toLowerCase()) ||
            f.finding_type.toLowerCase().includes(textToSend.toLowerCase()) ||
            textToSend.toLowerCase().includes(f.clause_type.toLowerCase())
        ) || analysis?.findings[0];

      let replyContent = "";
      let replyPerspective = "Judge";
      let citations: string[] = [];

      if (matchedFinding) {
        replyPerspective = matchedFinding.agent_name;
        citations = [matchedFinding.evidence_quote];
        replyContent = `Regarding your inquiry on "${textToSend}":\n\n${matchedFinding.agent_name} flagged the ${matchedFinding.clause_type} section with a severity score of ${matchedFinding.severity_score}/10 (${matchedFinding.risk_level} risk).\n\nSummary of vulnerability:\n${matchedFinding.summary}\n\nRecommended Action:\nConsider negotiating mutual reciprocal caps and explicit carve-out boundaries before executing.`;
      } else {
        replyPerspective = "Citation & Evidence Agent";
        replyContent = `Regarding "${textToSend}": The document review pipeline cross-referenced all paragraphs against standard commercial law guidelines. All verified covenants are listed under the Agent Findings Trail with grounded evidence quotes.`;
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
      toast.error("Failed to process question. Please try again.");
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

  const fetchDocuments = async () => {
    if (!USE_BACKEND_API) {
      return;
    }

    try {
      const res = await fetch("/api/documents");
      if (res.ok) {
        const data = await res.json();
        setDocuments(data);
        // Automatically select the first document if available and none selected or invalid
        if (data.length > 0) {
          const currentValid = data.some((d: APIDocument) => d.id === selectedDocId);
          if (!selectedDocId || !currentValid) {
            setSelectedDocId(data[0].id);
          }
        }
      }
    } catch (err) {
      console.error("Error fetching documents:", err);
      toast.info("Running dashboard in local demo mode.", {
        description: "Start backend and AI services to use Groq, Pinecone, and Neon.",
      });
    }
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
      setLoadingAnalysis(false);
      return;
    }
    
    const fetchAnalysisData = async () => {
      setLoadingAnalysis(true);
      try {
        const res = await fetch(`/api/documents/${selectedDocId}/analysis`);
        if (res.ok) {
          const data = await res.json();
          setAnalysis(data);
          setMockAnalyses((prev) => ({ ...prev, [selectedDocId]: data }));
          setSelectedFinding(null); // Clear selected drawer
        } else {
          setAnalysis(null);
        }
      } catch (err) {
        console.error("Error fetching analysis:", err);
        setAnalysis(null);
      } finally {
        setLoadingAnalysis(false);
      }
    };

    fetchAnalysisData();
  }, [mockAnalyses, selectedDocId]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    
    const file = files[0];
    if (!file) return;
    const formData = new FormData();
    formData.append("file", file);
    
    setUploading(true);
    setShowUploadModal(true);
    setUploadStatusMsg("Uploading file to server...");

    if (!USE_BACKEND_API) {
      const documentId = `local-${crypto.randomUUID()}`;
      const mockDocument: APIDocument = {
        id: documentId,
        filename: file.name,
        content_type: file.type || "text/plain",
        status: "completed",
        page_count: file.type.includes("pdf") ? 12 : 1,
        created_at: new Date().toISOString(),
        risk_score: 8.2,
        risk_level: "High",
      };
      const mockAnalysis = buildMockAnalysis(file.name, documentId);
      setUploadStatusMsg("Generating local demo analysis...");
      setDocuments((current) => [mockDocument, ...current.filter((doc) => doc.id !== documentId)]);
      setMockAnalyses((current) => ({ ...current, [documentId]: mockAnalysis }));
      setSelectedDocId(documentId);
      setAnalysis(mockAnalysis);
      setShowUploadModal(false);
      setUploading(false);
      toast.success("Demo analysis generated locally.", {
        description: "Set VITE_USE_BACKEND_API=true when backend, Groq, Pinecone, and Neon are ready.",
      });
      return;
    }
    
    try {
      // Step 1: Upload and trigger ingestion pipeline
      setUploadStatusMsg("Extracting text and spawning specialized agents...");
      const res = await fetch("/api/documents/upload", {
        method: "POST",
        body: formData,
      });
      
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "Upload failed");
      }
      
      const data = await res.json();
      toast.success("Document analyzed successfully!");
      setUploadStatusMsg("Aggregating consensus results...");
      
      // Refresh documents list and set new active document
      await fetchDocuments();
      setSelectedDocId(data.document_id);
      setShowUploadModal(false);
    } catch (err) {
      const documentId = `local-${crypto.randomUUID()}`;
      const mockDocument: APIDocument = {
        id: documentId,
        filename: file.name,
        content_type: file.type || "text/plain",
        status: "completed",
        page_count: file.type.includes("pdf") ? 12 : 1,
        created_at: new Date().toISOString(),
        risk_score: 8.2,
        risk_level: "High",
      };
      const mockAnalysis = buildMockAnalysis(file.name, documentId);
      setDocuments((current) => [mockDocument, ...current.filter((doc) => doc.id !== documentId)]);
      setMockAnalyses((current) => ({ ...current, [documentId]: mockAnalysis }));
      setSelectedDocId(documentId);
      setAnalysis(mockAnalysis);
      setShowUploadModal(false);
      toast.success("Demo analysis generated locally.", {
        description: "Backend was unreachable, so the UI used mock results. Start backend/AI for live Groq analysis.",
      });
      console.error("Upload error:", err);
    } finally {
      setUploading(false);
    }
  };

  if (!ready || !session) return <div className="min-h-screen bg-[#101412]" aria-label="Loading dashboard" />;

  const displayName = session.name || session.email.split("@")[0];
  const activeDoc = documents.find(d => d.id === selectedDocId);

  // Filter findings based on selected agent filter
  const filteredFindings = analysis
    ? analysis.findings.filter(f => selectedAgentFilter === "All" || f.agent_name === selectedAgentFilter)
    : [];

  return (
    <main className="min-h-screen bg-[#f1eee6] text-[#101412] flex flex-col font-sans">
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
        <aside className="w-full md:w-80 border-r border-[#d6d2c8] bg-[#f8f6f0] flex flex-col shrink-0">
          <div className="p-4 border-b border-[#d6d2c8] flex items-center justify-between">
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

          <div className="flex-1 overflow-y-auto p-2 space-y-1">
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
                  <button
                    key={doc.id}
                    onClick={() => setSelectedDocId(doc.id)}
                    className={`w-full text-left p-3.5 flex flex-col gap-1 border transition-colors ${
                      isActive 
                        ? "bg-[#101412] text-[#f1eee6] border-[#101412]" 
                        : "bg-white border-[#e6e2d8] hover:bg-[#f3eff5] text-[#101412]"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="font-display font-semibold text-sm truncate">{doc.filename}</span>
                      {doc.risk_score !== null && (
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
                    </div>
                    <div className="flex items-center justify-between text-[10px] font-mono text-[#626860] mt-1.5">
                      <span>{doc.page_count ? `${doc.page_count} pg` : "TXT File"}</span>
                      <span className={`uppercase tracking-wider ${isActive ? "text-[#d7ff52]" : "text-[#3158ff]"}`}>
                        {doc.status}
                      </span>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </aside>

        {/* Right Section: Active Review Workbench */}
        <section className="flex-1 overflow-y-auto flex flex-col min-h-0 bg-[#f1eee6]">
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
            <div className="flex-1 flex flex-col overflow-hidden">
              {/* Header workbench metadata */}
              <div className="p-6 border-b border-[#d6d2c8] bg-[#f1eee6] flex flex-col md:flex-row justify-between items-start md:items-center gap-4 shrink-0">
                <div>
                  <span className="eyebrow text-[#3158ff]">Adversarial Risk Audit</span>
                  <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight mt-1 truncate max-w-xl text-[#101412]">
                    {analysis.document.filename}
                  </h1>
                </div>
                
                {/* Score Indicator & Mode Switcher */}
                <div className="flex flex-wrap items-center gap-3">
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
                      <Shield className="h-3.5 w-3.5" /> Findings Trail
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

                  <div className="flex items-center gap-3 bg-[#101412] px-4 py-2.5 text-[#f1eee6]">
                    <div className="text-right">
                      <div className="text-[9px] font-mono uppercase tracking-widest text-[#d7ff52] font-semibold">Risk Score</div>
                      <div className="font-mono text-[9px] text-[#8f978e] mt-0.5">{analysis.analysis.risk_level}</div>
                    </div>
                    <div className="font-display text-3xl font-extrabold text-[#d7ff52] leading-none">
                      {analysis.analysis.aggregate_risk_score.toFixed(1)}
                    </div>
                  </div>
                </div>
              </div>

              {/* Main Content: Interactive Q&A Chat OR Findings Trail */}
              {workbenchView === "chat" ? (
                <div className="flex-1 flex flex-col bg-white overflow-hidden p-6">
                  <div className="flex-1 flex flex-col border border-[#d6d2c8] bg-white overflow-hidden shadow-sm">
                    {/* Chat Deliberation Header */}
                    <div className="p-3.5 border-b border-[#d6d2c8] bg-slate-50 flex flex-wrap items-center justify-between gap-3">
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
                            <div className="flex items-center gap-2 mb-1">
                              <span className={`text-[9px] font-mono uppercase tracking-wider px-2 py-0.5 font-bold ${
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
                              <span className="text-[10px] font-mono text-slate-400">
                                {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </div>
                          )}

                          <div
                            className={`p-4 max-w-2xl text-xs leading-relaxed ${
                              msg.role === "user"
                                ? "bg-[#101412] text-white border border-[#101412]"
                                : "bg-white text-[#101412] border border-[#d6d2c8] shadow-sm"
                            }`}
                          >
                            <div className="whitespace-pre-line">{msg.content}</div>

                            {/* Grounded Citations Quote Block */}
                            {msg.citations && msg.citations.length > 0 && (
                              <div className="mt-3 pt-3 border-t border-slate-200 font-mono text-[10px] space-y-1.5 bg-slate-50 p-2.5">
                                <span className="text-[9px] uppercase tracking-wider text-[#3158ff] font-bold flex items-center gap-1">
                                  <CheckCircle className="h-2.5 w-2.5 text-green-600" /> Grounded Source Excerpt
                                </span>
                                {msg.citations.map((cite, cIdx) => (
                                  <blockquote key={cIdx} className="border-l-2 border-[#3158ff] pl-2.5 italic text-slate-600 leading-normal">
                                    "{cite}"
                                  </blockquote>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      ))}

                      {sendingChat && (
                        <div className="flex items-center gap-2 text-xs font-mono text-slate-500 p-2">
                          <Activity className="h-4 w-4 animate-spin text-[#3158ff]" />
                          <span>Counsel deliberating on evidence...</span>
                        </div>
                      )}
                      <div ref={chatBottomRef} />
                    </div>

                    {/* Prompt Suggestions */}
                    <div className="px-4 py-2.5 bg-slate-50 border-t border-[#d6d2c8] flex items-center gap-2 overflow-x-auto">
                      <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 shrink-0">Inquire:</span>
                      {[
                        "Why is the definition scope flagged?",
                        "What are the main risks from Plaintiff's perspective?",
                        "How can we balance the indemnity clause?",
                        "Is the termination notice enforceable in court?"
                      ].map((prompt, pIdx) => (
                        <button
                          key={pIdx}
                          onClick={() => handleSendChatMessage(prompt)}
                          disabled={sendingChat}
                          className="shrink-0 text-[10px] font-mono bg-white hover:bg-slate-200 text-slate-700 border border-slate-200 px-2.5 py-1 transition-colors"
                        >
                          {prompt}
                        </button>
                      ))}
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
                        className="flex-1 px-4 py-2.5 text-xs bg-slate-50 border border-slate-200 focus:outline-none focus:ring-1 focus:ring-[#101412]"
                      />
                      <button
                        type="submit"
                        disabled={!chatInput.trim() || sendingChat}
                        className="bg-[#101412] hover:bg-[#202622] text-[#d7ff52] px-5 py-2.5 text-xs font-mono font-bold flex items-center gap-1.5 transition-colors disabled:opacity-50"
                      >
                        <Send className="h-3.5 w-3.5" /> Send
                      </button>
                    </form>
                  </div>
                </div>
              ) : (
                <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
                  {/* Left Column: Report Summary & Findings */}
                  <div className="flex-1 overflow-y-auto p-6 space-y-6">

                {/* Consensus Report Tabs Panel */}
                <div className="bg-white border border-[#d6d2c8] p-5">
                  <div className="flex border-b border-[#d6d2c8] gap-4 text-xs font-mono pb-2 overflow-x-auto shrink-0">
                    {[
                      { id: "summary", label: "Executive Summary" },
                      { id: "vulnerabilities", label: `Major Risks (${analysis.analysis.critical_count + analysis.analysis.high_count})` },
                      { id: "strengths", label: "Strengths" },
                      { id: "recommendations", label: "Action Steps" }
                    ].map((tab) => (
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
                        <p className="font-medium text-[#101412]">{analysis.analysis.consensus_report.summary}</p>
                        <div className="mt-4 grid grid-cols-4 gap-2 font-mono text-[11px] text-center">
                          <div className="bg-red-50 p-2.5 border border-red-100">
                            <span className="block text-red-700 font-bold text-sm">{analysis.analysis.critical_count}</span>
                            <span className="text-red-600 uppercase tracking-wide">Critical</span>
                          </div>
                          <div className="bg-orange-50 p-2.5 border border-orange-100">
                            <span className="block text-orange-700 font-bold text-sm">{analysis.analysis.high_count}</span>
                            <span className="text-orange-600 uppercase tracking-wide">High</span>
                          </div>
                          <div className="bg-amber-50 p-2.5 border border-amber-100">
                            <span className="block text-amber-700 font-bold text-sm">{analysis.analysis.medium_count}</span>
                            <span className="text-amber-600 uppercase tracking-wide">Medium</span>
                          </div>
                          <div className="bg-green-50 p-2.5 border border-green-100">
                            <span className="block text-green-700 font-bold text-sm">{analysis.analysis.low_count}</span>
                            <span className="text-green-600 uppercase tracking-wide">Low</span>
                          </div>
                        </div>
                      </div>
                    )}
                    {activeTab === "strengths" && (
                      <ul className="space-y-2 list-disc list-inside">
                        {analysis.analysis.consensus_report.strengths.map((str, idx) => (
                          <li key={idx}>{str}</li>
                        ))}
                      </ul>
                    )}
                    {activeTab === "vulnerabilities" && (
                      <ul className="space-y-2 list-disc list-inside text-red-700">
                        {analysis.analysis.consensus_report.vulnerabilities.map((vul, idx) => (
                          <li key={idx} className="font-medium">{vul}</li>
                        ))}
                      </ul>
                    )}
                    {activeTab === "recommendations" && (
                      <ul className="space-y-2 list-decimal list-inside text-[#3158ff]">
                        {analysis.analysis.consensus_report.recommendations.map((rec, idx) => (
                          <li key={idx} className="font-semibold">{rec}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>

                {/* Findings Audit section */}
                <div className="space-y-4">
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                    <h3 className="font-display text-xl font-bold tracking-tight flex items-center gap-2">
                      <Shield className="h-5 w-5 text-[#3158ff]" /> Agent Findings Trail
                    </h3>
                    
                    {/* Agent Filters */}
                    <div className="flex flex-wrap gap-1 font-mono text-[10px]">
                      {["All", "Defense Counsel", "Plaintiff Counsel", "Drafting Counsel", "Judge", "Compliance Officer"].map((agent) => (
                        <button
                          key={agent}
                          onClick={() => setSelectedAgentFilter(agent)}
                          className={`px-2.5 py-1 transition-colors border ${
                            selectedAgentFilter === agent
                              ? "bg-[#101412] text-[#d7ff52] border-[#101412]"
                              : "bg-white hover:bg-slate-100 text-slate-600 border-slate-200"
                          }`}
                        >
                          {agent === "All" ? "All" : agent.replace(" Counsel", "").replace(" Officer", "")}
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
                                </div>
                                
                                <h4 className={`font-semibold text-sm ${isSelected ? "text-white" : "text-slate-900"}`}>
                                  {finding.finding_type}
                                </h4>
                                
                                <p className={`text-xs line-clamp-2 leading-relaxed ${isSelected ? "text-slate-300" : "text-slate-600"}`}>
                                  {finding.summary}
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
                              </div>
                              
                              <div className="flex flex-col items-end shrink-0 gap-3">
                                <span className={`text-[9px] font-mono uppercase tracking-widest px-2 py-0.5 rounded-none font-bold ${
                                  finding.risk_level === 'Critical' || finding.risk_level === 'High'
                                    ? "bg-red-500 text-white"
                                    : "bg-amber-500 text-black"
                                }`}>
                                  {finding.risk_level}
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
                                  <Sparkles className="h-3 w-3" /> Consensus Deliberation ({finding.consensus_reasoning.deliberation.length} Agents)
                                </span>
                                <span className="text-[9px] uppercase tracking-wider opacity-75">Inspect reasoning →</span>
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
                <div className="w-full lg:w-96 border-t lg:border-t-0 lg:border-l border-[#d6d2c8] bg-white flex flex-col shrink-0">
                  <div className="p-4 border-b border-[#d6d2c8] flex items-center justify-between bg-slate-50">
                    <span className="font-mono text-xs uppercase tracking-wider text-[#3158ff] font-bold flex items-center gap-1.5">
                      <Sparkles className="h-3.5 w-3.5 text-[#3158ff]" /> Evidence Auditor
                    </span>
                    <button 
                      onClick={() => setSelectedFinding(null)}
                      className="p-1 hover:bg-slate-200 transition-colors"
                    >
                      <X className="h-4 w-4 text-slate-500" />
                    </button>
                  </div>
                  
                  <div className="p-5 flex-1 overflow-y-auto space-y-6">
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
                        {selectedFinding.summary}
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
                        "{selectedFinding.evidence_quote}"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#101412]/80 backdrop-blur-sm text-white">
          <div className="bg-[#101412] border border-white/10 p-8 max-w-sm w-full text-center space-y-4">
            <Activity className="h-10 w-10 text-[#d7ff52] animate-spin mx-auto" />
            <h3 className="font-display text-lg font-bold text-[#d7ff52]">Adversarial Legal Agent Pipelines Triggered</h3>
            <p className="text-xs text-slate-400 leading-relaxed font-mono">
              {uploadStatusMsg}
            </p>
            <div className="h-1 w-full bg-white/10 overflow-hidden relative">
              <div className="absolute inset-0 bg-[#d7ff52] animate-infinite-loading" />
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
