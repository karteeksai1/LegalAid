// Design system: Signal / Noise — dashboard as an inspectable workbench with evidence states, ruled surfaces, and chartreuse action signals.
import { Button } from "@/components/ui/button";
import { ArrowUpRight, FileSearch, FolderOpen, LogOut, Plus, ShieldCheck, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { toast } from "sonner";
import { clearMockSession, getMockSession, MockSession } from "@/lib/mockAuth";

export default function Dashboard() {
  const [, setLocation] = useLocation();
  const [session, setSession] = useState<MockSession | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const currentSession = getMockSession();
    if (!currentSession) {
      setLocation("/login");
      return;
    }
    setSession(currentSession);
    setReady(true);
  }, [setLocation]);

  const signOut = () => {
    clearMockSession();
    setLocation("/login");
  };

  if (!ready || !session) return <div className="min-h-screen bg-[#101412]" aria-label="Loading dashboard" />;

  const displayName = session.name || session.email.split("@")[0];

  return (
    <main className="min-h-screen bg-[#f1eee6] text-[#101412]">
      <header className="border-b border-[#d6d2c8] bg-[#101412] text-[#f1eee6]">
        <div className="container flex min-h-[76px] items-center justify-between gap-6">
          <Link href="/dashboard" className="flex items-center gap-3" aria-label="LegalAid dashboard home">
            <span className="grid h-9 w-9 place-items-center bg-[#d7ff52]"><img src="/legalaid-mark.jpg" alt="" className="h-7 w-7 object-contain" /></span>
            <span className="font-display text-[18px] font-bold tracking-[-0.04em]">LegalAid<span className="text-[#d7ff52]">.</span></span>
          </Link>
          <div className="flex items-center gap-4"><span className="hidden font-mono text-[10px] uppercase tracking-[0.12em] text-[#626b61] sm:block">{session.email}</span><button onClick={signOut} className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.12em] text-[#8f978e] transition-colors hover:text-[#d7ff52]"><LogOut className="h-3.5 w-3.5" /> Sign out</button></div>
        </div>
      </header>

      <div className="container py-10 sm:py-14">
        <div className="flex flex-col justify-between gap-8 border-b border-[#d6d2c8] pb-10 lg:flex-row lg:items-end"><div><span className="eyebrow text-[#3158ff]">Review workspace / mock mode</span><h1 className="font-display mt-5 text-5xl font-bold leading-[0.92] tracking-[-0.07em] sm:text-7xl">Good to see you, <span className="text-[#3158ff]">{displayName}.</span></h1><p className="mt-5 max-w-[520px] text-base leading-7 text-[#626860]">Your evidence-first review workspace is ready. Upload a document to start surfacing what the draft is trying not to say.</p></div><Button onClick={() => toast("Document upload is the next integration.", { description: "This dashboard is currently running on mock authentication." })} className="h-14 rounded-none bg-[#101412] px-7 font-mono text-xs uppercase tracking-[0.12em] text-[#d7ff52] hover:bg-[#263026]"><Plus className="mr-3 h-4 w-4" /> New review</Button></div>

        <section className="mt-10 grid gap-5 lg:grid-cols-[1.3fr_0.7fr]">
          <div className="paper-grid border border-[#d6d2c8] bg-[#f8f6f0] p-7 sm:p-10"><div className="flex items-start justify-between"><div><span className="eyebrow text-[#626860]">Workspace status</span><h2 className="font-display mt-5 text-3xl font-semibold tracking-[-0.05em]">No active reviews yet.</h2><p className="mt-3 max-w-[400px] text-sm leading-6 text-[#626860]">Start with a contract, policy, or legal document. LegalAid will return a readable trail of findings and supporting context.</p></div><span className="grid h-11 w-11 place-items-center bg-[#d7ff52] text-[#101412]"><FolderOpen className="h-5 w-5" /></span></div><div className="mt-10 flex flex-wrap gap-5 border-t border-[#d6d2c8] pt-5 font-mono text-[10px] uppercase tracking-[0.1em] text-[#626860]"><span>OCR ready</span><span>Parallel agents ready</span><span>Evidence guardrails on</span></div></div>
          <div className="bg-[#101412] p-7 text-[#f1eee6] sm:p-8"><div className="flex items-start justify-between"><span className="eyebrow text-[#d7ff52]">System signal</span><ShieldCheck className="h-5 w-5 text-[#d7ff52]" /></div><div className="mt-14 font-display text-6xl font-bold tracking-[-0.08em] text-[#d7ff52]">0<span className="text-2xl text-[#8f978e]"> / 0</span></div><p className="mt-2 text-sm leading-6 text-[#8f978e]">documents reviewed</p><div className="mt-8 border-t border-white/10 pt-5 font-mono text-[10px] uppercase tracking-[0.1em] text-[#626b61]">No unsupported findings generated</div></div>
        </section>

        <section className="mt-14 border-t border-[#d6d2c8] pt-8"><div className="flex items-center gap-3"><Sparkles className="h-4 w-4 text-[#3158ff]" /><span className="eyebrow text-[#3158ff]">What happens next</span></div><div className="mt-7 grid gap-px bg-[#d6d2c8] md:grid-cols-3">{[{icon: FileSearch, title: "Upload a document", desc: "Bring a contract, agreement, or policy into the review loop."}, {icon: ShieldCheck, title: "Inspect the evidence", desc: "See every finding mapped back to retrieved source context."}, {icon: ArrowUpRight, title: "Export the report", desc: "Download a readable summary once the review is complete."}].map((item) => <article key={item.title} className="bg-[#f8f6f0] p-6"><item.icon className="h-5 w-5 text-[#3158ff]" /><h3 className="font-display mt-10 text-xl font-semibold tracking-[-0.04em]">{item.title}</h3><p className="mt-2 text-sm leading-6 text-[#626860]">{item.desc}</p></article>)}</div></section>
      </div>
    </main>
  );
}
