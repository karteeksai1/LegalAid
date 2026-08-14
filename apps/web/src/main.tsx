import React, { useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  AlertTriangle,
  ArrowDownToLine,
  ArrowUpRight,
  CheckCircle2,
  ClipboardCheck,
  FileSearch,
  Filter,
  Gavel,
  LayoutDashboard,
  ListChecks,
  LockKeyhole,
  Mail,
  Scale,
  Search,
  ShieldAlert,
  Upload,
} from "lucide-react";
import "./styles.css";

type Risk = "Critical" | "High" | "Medium" | "Low";
type View = "dashboard" | "upload" | "findings" | "reports";

type Finding = {
  clause: string;
  risk: Risk;
  agent: string;
  severity: number;
  confidence: string;
  evidence: string;
  page: number;
  recommendation: string;
};

const agents = [
  { name: "Defense Counsel", status: "Complete", icon: ShieldAlert, score: 91 },
  { name: "Drafting Counsel", status: "Complete", icon: FileSearch, score: 84 },
  { name: "Judge", status: "Reviewing", icon: Gavel, score: 67 },
  { name: "Compliance", status: "Complete", icon: ClipboardCheck, score: 78 },
  { name: "Citation Evidence", status: "Verifying", icon: CheckCircle2, score: 72 },
];

const indemnityFinding: Finding = {
  clause: "Indemnification",
  risk: "Critical",
  agent: "Defense Counsel",
  severity: 9.4,
  confidence: "92%",
  evidence: "The supplier shall indemnify the customer for all losses, whether direct, indirect, incidental, consequential, or punitive.",
  page: 12,
  recommendation: "Narrow indemnity to third-party claims and exclude punitive damages.",
};

const liabilityFinding: Finding = {
  clause: "Limitation of Liability",
  risk: "High",
  agent: "Judge",
  severity: 8.1,
  confidence: "86%",
  evidence: "Liability cap shall not apply to payment obligations, confidentiality, data misuse, or any breach deemed material.",
  page: 18,
  recommendation: "Define exclusions precisely and add a mutual aggregate cap.",
};

const terminationFinding: Finding = {
  clause: "Termination",
  risk: "Medium",
  agent: "Drafting Counsel",
  severity: 6.2,
  confidence: "81%",
  evidence: "Either party may terminate for convenience with ninety days written notice after the initial service period.",
  page: 22,
  recommendation: "Add transition assistance, refund mechanics, and survival language.",
};

const governingLawFinding: Finding = {
  clause: "Governing Law",
  risk: "Low",
  agent: "Compliance",
  severity: 3.8,
  confidence: "77%",
  evidence: "This agreement is governed by the laws of Delaware without regard to conflict of laws principles.",
  page: 29,
  recommendation: "Confirm venue and dispute forum align with governing law.",
};

const findings: Finding[] = [indemnityFinding, liabilityFinding, terminationFinding, governingLawFinding];

const heatmap = [
  { label: "Indemnity", level: "critical", finding: indemnityFinding },
  { label: "Liability", level: "high", finding: liabilityFinding },
  { label: "Data Use", level: "high", finding: liabilityFinding },
  { label: "Arbitration", level: "medium", finding: terminationFinding },
  { label: "Termination", level: "medium", finding: terminationFinding },
  { label: "IP Rights", level: "medium", finding: terminationFinding },
  { label: "Payment", level: "low", finding: governingLawFinding },
  { label: "Venue", level: "low", finding: governingLawFinding },
];

function LawLogo() {
  return (
    <div className="lawLogo" aria-hidden="true">
      <Scale size={22} />
    </div>
  );
}

function LoginPage({ onLogin }: { onLogin: (email: string) => void }) {
  const [email, setEmail] = useState("reviewer@legalaid.local");
  const [password, setPassword] = useState("password123");
  const [error, setError] = useState("");

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!email.includes("@") || password.length < 8) {
      setError("Use a valid email and a password with at least 8 characters.");
      return;
    }
    onLogin(email);
  }

  return (
    <main className="loginShell">
      <section className="loginProduct">
        <div className="brand loginBrand">
          <LawLogo />
          <span>LegalAid Review</span>
        </div>
        <div>
          <p className="eyebrow">Explainable legal AI</p>
          <h1>Stress-test contracts before they become disputes.</h1>
          <p>
            Review documents with opposing counsel, drafting counsel, judge, compliance,
            and citation evidence agents in one source-grounded workspace.
          </p>
        </div>
        <div className="loginStats">
          <span>5 legal agents</span>
          <span>Exact evidence quotes</span>
          <span>Consensus risk scoring</span>
        </div>
      </section>

      <section className="loginPanel" aria-label="Sign in">
        <form onSubmit={submit}>
          <p className="eyebrow">Secure workspace</p>
          <h2>Sign in</h2>
          <label>
            Email
            <span className="field">
              <Mail size={18} aria-hidden="true" />
              <input value={email} onChange={(event) => setEmail(event.target.value)} type="email" />
            </span>
          </label>
          <label>
            Password
            <span className="field">
              <LockKeyhole size={18} aria-hidden="true" />
              <input value={password} onChange={(event) => setPassword(event.target.value)} type="password" />
            </span>
          </label>
          {error ? <p className="formError">{error}</p> : null}
          <button className="primaryButton fullWidth" type="submit">
            Sign in to dashboard
          </button>
        </form>
      </section>
    </main>
  );
}

function App() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [userEmail, setUserEmail] = useState("");
  const [activeView, setActiveView] = useState<View>("dashboard");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [selectedRisk, setSelectedRisk] = useState<Risk | "All">("All");
  const [selectedFinding, setSelectedFinding] = useState<Finding>(indemnityFinding);
  const [uploadedFile, setUploadedFile] = useState("Master Services Agreement.pdf");
  const [toast, setToast] = useState("");

  const visibleFindings = useMemo(() => {
    if (selectedRisk === "All") {
      return findings;
    }
    return findings.filter((finding) => finding.risk === selectedRisk);
  }, [selectedRisk]);

  function openUpload() {
    setActiveView("upload");
    fileInputRef.current?.click();
  }

  function handleFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }
    setUploadedFile(file.name);
    setToast(`${file.name} added to review queue`);
  }

  function exportReport() {
    const payload = {
      document: uploadedFile,
      aggregateRisk: 82,
      findings,
      generatedAt: new Date().toISOString(),
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "legalaid-review-report.json";
    anchor.click();
    URL.revokeObjectURL(url);
    setActiveView("reports");
    setToast("Report exported");
  }

  if (!isLoggedIn) {
    return (
      <LoginPage
        onLogin={(email) => {
          setUserEmail(email);
          setIsLoggedIn(true);
          setToast("Signed in");
        }}
      />
    );
  }

  return (
    <main className="appShell">
      <input ref={fileInputRef} className="hiddenInput" type="file" accept=".pdf,.doc,.docx" onChange={handleFile} />
      <aside className="sidebar">
        <div className="brand">
          <LawLogo />
          <span>LegalAid Review</span>
        </div>
        <nav className="nav">
          {[
            { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
            { id: "upload", label: "Upload", icon: Upload },
            { id: "findings", label: "Findings", icon: ListChecks },
            { id: "reports", label: "Reports", icon: Scale },
          ].map((item) => {
            const Icon = item.icon;
            return (
              <button
                className={`navItem ${activeView === item.id ? "active" : ""}`}
                type="button"
                key={item.id}
                onClick={() => {
                  setActiveView(item.id as View);
                  if (item.id === "upload") {
                    fileInputRef.current?.click();
                  }
                }}
              >
                <Icon size={18} aria-hidden="true" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>
        <div className="sidebarStatus">
          <span className="statusDot" />
          <div>
            <strong>AI service ready</strong>
            <span>{userEmail}</span>
          </div>
        </div>
      </aside>

      <section className="workspace">
        <header className="topbar">
          <div>
            <p className="eyebrow">Contract stress test</p>
            <h1>{activeView === "upload" ? "Upload legal documents" : "Adversarial legal review"}</h1>
          </div>
          <div className="topbarActions">
            <button className="secondaryButton" type="button" onClick={() => setFiltersOpen((open) => !open)}>
              <Filter size={17} aria-hidden="true" />
              Filters
            </button>
            <button className="primaryButton" type="button" onClick={openUpload}>
              <Upload size={17} aria-hidden="true" />
              Upload document
            </button>
          </div>
        </header>

        {filtersOpen ? (
          <section className="filterBar" aria-label="Finding filters">
            <Search size={18} aria-hidden="true" />
            {(["All", "Critical", "High", "Medium", "Low"] as const).map((risk) => (
              <button
                className={`filterChip ${selectedRisk === risk ? "active" : ""}`}
                type="button"
                key={risk}
                onClick={() => setSelectedRisk(risk)}
              >
                {risk}
              </button>
            ))}
          </section>
        ) : null}

        <section className="heroBand">
          <div className="heroCopy">
            <span className="pill">{activeView === "upload" ? "Ready for intake" : "Multi-agent review in progress"}</span>
            <h2>{uploadedFile}</h2>
            <p>
              Five legal agents are reviewing source-grounded clauses for vulnerabilities,
              verification gaps, and litigation exposure.
            </p>
            <div className="documentMeta">
              <span>32 pages</span>
              <span>118 chunks indexed</span>
              <span>{visibleFindings.length} visible findings</span>
              <span>Last run 2 min ago</span>
            </div>
          </div>
          <button className="uploadPanel" type="button" onClick={openUpload}>
            <Upload size={24} aria-hidden="true" />
            <strong>Drop a contract here</strong>
            <span>PDF, DOCX, or scanned agreement</span>
            <span className="secondaryButton fakeButton">Choose file</span>
          </button>
        </section>

        <section className="metricsGrid">
          <button className="metricCard critical" type="button" onClick={() => setSelectedRisk("Critical")}>
            <span>Aggregate risk</span>
            <strong>82</strong>
            <p>Critical exposure detected</p>
          </button>
          <button className="metricCard" type="button" onClick={() => setToast("91% of findings include exact source evidence")}>
            <span>Verification rate</span>
            <strong>91%</strong>
            <p>Evidence-backed findings</p>
          </button>
          <button className="metricCard" type="button" onClick={() => setActiveView("findings")}>
            <span>Clause coverage</span>
            <strong>24</strong>
            <p>Legal sections classified</p>
          </button>
          <button className="metricCard" type="button" onClick={() => setToast("Agent consensus opened in evidence panel")}>
            <span>Agent consensus</span>
            <strong>4.2/5</strong>
            <p>High agreement across reviewers</p>
          </button>
        </section>

        <section className="contentGrid">
          <section className="panel wide">
            <div className="panelHeader">
              <div>
                <p className="eyebrow">Clause risk heatmap</p>
                <h3>Highest exposure areas</h3>
              </div>
              <button className="iconButton" type="button" aria-label="Open heatmap" onClick={() => setActiveView("findings")}>
                <ArrowUpRight size={18} aria-hidden="true" />
              </button>
            </div>
            <div className="heatmap">
              {heatmap.map((cell) => (
                <button
                  className={`heatCell ${cell.level} ${cell.finding.clause === selectedFinding.clause ? "selected" : ""}`}
                  type="button"
                  key={cell.label}
                  onClick={() => {
                    setSelectedFinding(cell.finding);
                    setActiveView("findings");
                  }}
                >
                  <span>{cell.label}</span>
                </button>
              ))}
            </div>
          </section>

          <section className="panel">
            <div className="panelHeader">
              <div>
                <p className="eyebrow">Agent status</p>
                <h3>Review team</h3>
              </div>
            </div>
            <div className="agentList">
              {agents.map((agent) => {
                const Icon = agent.icon;
                return (
                  <button className="agentRow" type="button" key={agent.name} onClick={() => setToast(`${agent.name}: ${agent.status}`)}>
                    <div className="agentIcon">
                      <Icon size={18} aria-hidden="true" />
                    </div>
                    <div>
                      <strong>{agent.name}</strong>
                      <span>{agent.status}</span>
                    </div>
                    <meter min="0" max="100" value={agent.score} aria-label={`${agent.name} progress`} />
                  </button>
                );
              })}
            </div>
          </section>

          <section className="panel findingsPanel">
            <div className="panelHeader">
              <div>
                <p className="eyebrow">Source-grounded findings</p>
                <h3>Vulnerability queue</h3>
              </div>
              <button className="secondaryButton compact" type="button" onClick={exportReport}>
                <ArrowDownToLine size={16} aria-hidden="true" />
                Export report
              </button>
            </div>
            <div className="findingsTable">
              <div className="tableHead">
                <span>Clause</span>
                <span>Risk</span>
                <span>Agent</span>
                <span>Severity</span>
                <span>Confidence</span>
              </div>
              {visibleFindings.map((finding) => (
                <button
                  className={`findingRow ${finding.clause === selectedFinding.clause ? "selected" : ""}`}
                  type="button"
                  key={`${finding.clause}-${finding.agent}`}
                  onClick={() => {
                    setSelectedFinding(finding);
                    setActiveView("findings");
                  }}
                >
                  <span>{finding.clause}</span>
                  <span className={`riskBadge ${finding.risk.toLowerCase()}`}>{finding.risk}</span>
                  <span>{finding.agent}</span>
                  <span>{finding.severity}</span>
                  <span>{finding.confidence}</span>
                </button>
              ))}
            </div>
          </section>

          <section className="panel evidencePanel">
            <div className="panelHeader">
              <div>
                <p className="eyebrow">Evidence drawer</p>
                <h3>{selectedFinding.clause}</h3>
              </div>
              <Scale size={20} aria-hidden="true" />
            </div>
            <div className="evidenceQuote">
              <AlertTriangle size={18} aria-hidden="true" />
              <p>{selectedFinding.evidence}</p>
            </div>
            <dl className="evidenceMeta">
              <div>
                <dt>Chunk</dt>
                <dd>document-42 / chunk-038</dd>
              </div>
              <div>
                <dt>Page</dt>
                <dd>{selectedFinding.page}</dd>
              </div>
              <div>
                <dt>Verification</dt>
                <dd>Exact match confirmed</dd>
              </div>
              <div>
                <dt>Recommendation</dt>
                <dd>{selectedFinding.recommendation}</dd>
              </div>
            </dl>
          </section>
        </section>
      </section>

      {toast ? (
        <button className="toast" type="button" onClick={() => setToast("")}>
          {toast}
        </button>
      ) : null}
    </main>
  );
}

createRoot(document.getElementById("root") as HTMLElement).render(<App />);
