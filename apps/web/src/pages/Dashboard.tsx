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
  Info
} from "lucide-react";
import { useEffect, useState, useRef } from "react";
import { Link, useLocation } from "wouter";
import { toast } from "sonner";
import { clearMockSession, getMockSession, MockSession } from "@/lib/mockAuth";

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
}

interface ConsensusReport {
  summary: string;
  strengths: string[];
  vulnerabilities: string[];
  recommendations: string[];
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

export default function Dashboard() {
  const [, setLocation] = useLocation();
  const [session, setSession] = useState<MockSession | null>(null);
  const [ready, setReady] = useState(false);
  
  // Dashboard application states
  const [documents, setDocuments] = useState<APIDocument[]>([]);
  const [selectedDocId, setSelectedDocId] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<AnalysisResults | null>(null);
  const [loadingAnalysis, setLoadingAnalysis] = useState(false);
  
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
    try {
      const res = await fetch("/api/documents");
      if (res.ok) {
        const data = await res.json();
        setDocuments(data);
        // Automatically select the first document if available and none selected
        if (data.length > 0 && !selectedDocId) {
          setSelectedDocId(data[0].id);
        }
      }
    } catch (err) {
      console.error("Error fetching documents:", err);
    }
  };

  // Fetch analysis details when selected document changes
  useEffect(() => {
    if (!selectedDocId) {
      setAnalysis(null);
      return;
    }
    
    const fetchAnalysisData = async () => {
      setLoadingAnalysis(true);
      try {
        const res = await fetch(`/api/documents/${selectedDocId}/analysis`);
        if (res.ok) {
          const data = await res.json();
          setAnalysis(data);
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
  }, [selectedDocId]);

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
    } catch (err: any) {
      toast.error("Analysis failed", { description: err.message });
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
        <div className="container flex min-h-[72px] items-center justify-between gap-6 py-2">
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
                Choose an ingested legal draft from the sidebar panel, or click **Ingest** to upload and parse a new agreement.
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
            <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
              {/* Left Column: Report Summary & Findings */}
              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                {/* Header workbench metadata */}
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-[#d6d2c8] pb-6">
                  <div>
                    <span className="eyebrow text-[#3158ff]">Adversarial Risk Audit</span>
                    <h1 className="font-display text-3xl font-bold tracking-tight mt-1 truncate max-w-xl">
                      {analysis.document.filename}
                    </h1>
                  </div>
                  
                  {/* Score Indicator */}
                  <div className="flex items-center gap-4 bg-[#101412] p-4 text-[#f1eee6]">
                    <div className="text-right">
                      <div className="text-[10px] font-mono uppercase tracking-widest text-[#d7ff52] font-semibold">Risk Score</div>
                      <div className="font-mono text-[10px] text-[#8f978e] mt-0.5">{analysis.analysis.risk_level} profile</div>
                    </div>
                    <div className="font-display text-4xl font-extrabold text-[#d7ff52] leading-none">
                      {analysis.analysis.aggregate_risk_score.toFixed(1)}
                    </div>
                  </div>
                </div>

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
                      {["All", "Defense Counsel", "Drafting Counsel", "Judge", "Compliance Officer"].map((agent) => (
                        <button
                          key={agent}
                          onClick={() => setSelectedAgentFilter(agent)}
                          className={`px-2.5 py-1 transition-colors border ${
                            selectedAgentFilter === agent
                              ? "bg-[#101412] text-[#d7ff52] border-[#101412]"
                              : "bg-white hover:bg-slate-100 text-slate-600 border-slate-200"
                          }`}
                        >
                          {agent.split(" ")[0]}
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
                            className={`w-full text-left p-4 border transition-all flex justify-between items-start gap-4 ${
                              isSelected 
                                ? "bg-[#101412] text-[#f1eee6] border-[#101412] ring-1 ring-[#d7ff52]" 
                                : "bg-white hover:bg-slate-50 border-[#d6d2c8] text-[#101412]"
                            }`}
                          >
                            <div className="space-y-2 flex-1 min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className={`text-[9px] font-mono uppercase tracking-wider px-2 py-0.5 font-bold ${
                                  finding.agent_name === 'Defense Counsel' 
                                    ? "bg-red-100 text-red-800" 
                                    : finding.agent_name === 'Drafting Counsel'
                                      ? "bg-blue-100 text-blue-800"
                                      : "bg-purple-100 text-purple-800"
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
                        <span className="text-[10px] font-mono bg-red-100 text-red-800 px-2 py-0.5 font-bold">
                          {selectedFinding.risk_level} Risk
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
