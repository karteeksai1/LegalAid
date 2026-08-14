// Design system: Signal / Noise — asymmetrical editorial composition, tactile paper surfaces, forensic signal colors, inspectable motion.
import { Button } from "@/components/ui/button";
import { ArrowDownRight, ArrowUpRight, Check, ChevronRight, CircleDot, FileSearch, Fingerprint, Menu, ScanText, ShieldCheck, Sparkles, X } from "lucide-react";
import { useState } from "react";
import { useLocation } from "wouter";

/**
 * All content in this page are only for example, replace with your own feature implementation
 * When building pages, remember your instructions in Frontend Best Practices, Design Guide and Common Pitfalls
 */
export default function Home() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [, setLocation] = useLocation();
  const goTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
    setMenuOpen(false);
  };
  const openAuth = (path: "/login" | "/signup") => { setLocation(path); setMenuOpen(false); };

  return (
    <div className="min-h-screen overflow-hidden bg-[#f1eee6] text-[#101412]">
      <header className="fixed inset-x-0 top-0 z-50 border-b border-white/10 bg-[#101412]/90 text-[#f1eee6] backdrop-blur-xl">
        <div className="container flex h-[72px] items-center justify-between">
          <button onClick={() => goTo("top")} className="flex items-center gap-3" aria-label="LegalAid home">
            <span className="grid h-9 w-9 place-items-center bg-[#d7ff52] text-[#101412]"><img src="/manus-storage/legalaid-mark_b55dadd3.png" alt="" className="h-7 w-7 object-contain" /></span>
            <span className="font-display text-[18px] font-bold tracking-[-0.04em]">LegalAid<span className="text-[#d7ff52]">.</span></span>
          </button>
          <nav className="hidden items-center gap-8 md:flex" aria-label="Main navigation">
            <button onClick={() => goTo("method")} className="eyebrow text-[#a9afa7] transition-colors hover:text-[#d7ff52]">Method</button>
            <button onClick={() => goTo("signals")} className="eyebrow text-[#a9afa7] transition-colors hover:text-[#d7ff52]">Signals</button>
            <button onClick={() => goTo("pipeline")} className="eyebrow text-[#a9afa7] transition-colors hover:text-[#d7ff52]">Pipeline</button>
          </nav>
          <div className="hidden items-center gap-5 md:flex">
            <span className="eyebrow text-[#6f786f]">Framework / 0.1</span>
            <Button onClick={() => openAuth("/login")} className="h-10 rounded-none bg-[#d7ff52] px-5 font-mono text-xs font-medium uppercase tracking-[0.12em] text-[#101412] hover:bg-[#e4ff87]">Open workspace <ArrowUpRight className="ml-2 h-4 w-4" /></Button>
          </div>
          <button className="md:hidden" onClick={() => setMenuOpen(!menuOpen)} aria-label="Toggle menu">{menuOpen ? <X /> : <Menu />}</button>
        </div>
        {menuOpen && <div className="border-t border-white/10 bg-[#101412] px-6 py-5 md:hidden"><div className="flex flex-col gap-5"><button onClick={() => goTo("method")} className="eyebrow text-left text-[#d7ff52]">Method</button><button onClick={() => goTo("signals")} className="eyebrow text-left text-[#d7ff52]">Signals</button><button onClick={() => goTo("pipeline")} className="eyebrow text-left text-[#d7ff52]">Pipeline</button><Button onClick={() => openAuth("/login")} className="h-11 rounded-none bg-[#d7ff52] font-mono text-xs uppercase tracking-[0.12em] text-[#101412]">Open workspace</Button></div></div>}
      </header>

      <main id="top">
        <section className="relative min-h-[760px] overflow-hidden bg-[#101412] pt-[72px] text-[#f1eee6]">
          <div className="absolute inset-0 opacity-40" style={{ backgroundImage: "url('/manus-storage/legalaid-hero_4665a34b.png')", backgroundPosition: "center right", backgroundSize: "cover" }} />
          <div className="absolute inset-0 bg-[linear-gradient(90deg,#101412_0%,#101412e8_38%,#10141255_75%,#101412aa_100%)]" />
          <div className="container relative flex min-h-[688px] items-center pb-20 pt-20">
            <div className="max-w-[760px]">
              <div className="mb-8 flex items-center gap-3"><span className="h-2 w-2 signal-pulse rounded-full bg-[#d7ff52]" /><span className="eyebrow text-[#d7ff52]">Explainable review infrastructure</span></div>
              <h1 className="font-display max-w-[790px] text-[clamp(4rem,9vw,8.6rem)] font-bold leading-[0.86] tracking-[-0.09em]">Find the clause that <span className="text-[#d7ff52]">changes the deal.</span></h1>
              <div className="mt-10 grid max-w-[680px] grid-cols-1 gap-8 border-t border-white/20 pt-7 sm:grid-cols-[1fr_250px]">
                <p className="text-lg leading-7 text-[#c7cbc3]">LegalAid is an explainable multi-agent AI framework for adversarial legal document review and vulnerability analysis.</p>
                <div className="font-mono text-[11px] leading-5 text-[#7f887f]"><span className="text-[#d7ff52]">01 /</span> Surface exploitable clauses<br /><span className="text-[#d7ff52]">02 /</span> Ground every finding<br /><span className="text-[#d7ff52]">03 /</span> Show your working</div>
              </div>
              <div className="mt-11 flex flex-wrap items-center gap-5"><Button onClick={() => openAuth("/signup")} className="h-14 rounded-none bg-[#d7ff52] px-7 font-mono text-xs uppercase tracking-[0.12em] text-[#101412] hover:bg-[#e4ff87]">Stress-test a document <ArrowUpRight className="ml-3 h-4 w-4" /></Button><button onClick={() => goTo("method")} className="group flex items-center gap-3 font-mono text-xs uppercase tracking-[0.12em] text-[#c7cbc3] hover:text-[#d7ff52]">See the method <ArrowDownRight className="h-4 w-4 transition-transform group-hover:translate-y-1" /></button></div>
            </div>
          </div>
          <div className="absolute bottom-0 left-0 right-0 border-t border-white/10"><div className="container flex h-14 items-center justify-between"><span className="eyebrow text-[#6f786f]">Adversarial legal intelligence</span><span className="eyebrow text-[#6f786f]">Scroll to inspect ↓</span></div></div>
        </section>

        <section id="method" className="relative bg-[#f1eee6] py-24 sm:py-32">
          <div className="container grid gap-16 lg:grid-cols-[0.8fr_1.2fr] lg:gap-28">
            <div><span className="eyebrow text-[#3158ff]">The premise</span><h2 className="font-display mt-7 max-w-[470px] text-5xl font-bold leading-[0.95] tracking-[-0.07em] sm:text-7xl">Legal review should leave a trail.</h2><p className="mt-8 max-w-[390px] text-base leading-7 text-[#626860]">Most AI review tools give you an answer. LegalAid gives you the route taken to reach it — and marks the places where the route breaks.</p></div>
            <div className="relative paper-grid border border-[#d6d2c8] bg-[#f8f6f0] p-6 sm:p-10"><div className="absolute -left-3 top-12 h-6 w-6 border-l-2 border-t-2 border-[#3158ff]" /><div className="absolute -right-3 bottom-12 h-6 w-6 border-b-2 border-r-2 border-[#3158ff]" /><div className="mb-10 flex items-center justify-between border-b border-[#d6d2c8] pb-4"><span className="eyebrow text-[#626860]">Evidence trace / 0031</span><span className="font-mono text-xs text-[#3158ff]">VERIFIED</span></div><div className="space-y-6 font-mono text-xs leading-6"><div className="grid grid-cols-[64px_1fr] gap-4"><span className="text-[#a0a59d]">SOURCE</span><span className="text-[#39403b]">section_04 / indemnity / line_187</span></div><div className="ml-10 border-l-2 border-[#3158ff] pl-5 text-[#101412]">“The supplier shall indemnify the buyer for any and all losses…”</div><div className="grid grid-cols-[64px_1fr] gap-4"><span className="text-[#a0a59d]">FINDING</span><span className="text-[#101412]">Broad obligation. No reciprocal cap.</span></div><div className="flex items-center gap-3 border-t border-[#d6d2c8] pt-5"><span className="grid h-6 w-6 place-items-center rounded-full bg-[#d7ff52] text-[#101412]"><Check className="h-4 w-4" /></span><span className="text-[#3158ff]">Grounded in retrieved context</span></div></div></div>
          </div>
        </section>

        <section id="signals" className="bg-[#101412] py-24 text-[#f1eee6] sm:py-32"><div className="container"><div className="flex flex-col justify-between gap-8 border-b border-white/15 pb-10 sm:flex-row sm:items-end"><div><span className="eyebrow text-[#d7ff52]">What it surfaces</span><h2 className="font-display mt-6 max-w-[670px] text-5xl font-bold leading-[0.92] tracking-[-0.07em] sm:text-7xl">Risk is not a number. It is a set of receipts.</h2></div><p className="max-w-[300px] text-sm leading-6 text-[#8f978e]">Every specialist agent is constrained to retrieved document context. No evidence, no confident claim.</p></div><div className="mt-12 grid gap-px bg-white/15 md:grid-cols-2 lg:grid-cols-4">{[{icon: FileSearch, n:"01", title:"Exploit paths", desc:"Clauses that create leverage, ambiguity, or one-sided exposure."},{icon: ScanText, n:"02", title:"Draft weakness", desc:"Definitions, cross-references, and obligations that do not hold."},{icon: ShieldCheck, n:"03", title:"Compliance gaps", desc:"Missing protections and obligations that leave a process open."},{icon: Fingerprint, n:"04", title:"Citation integrity", desc:"Claims that cannot survive a return to the source text."}].map((item) => <article key={item.n} className="group min-h-[270px] bg-[#151a17] p-7 transition-colors hover:bg-[#1c241e]"><div className="flex items-start justify-between"><item.icon className="h-7 w-7 text-[#d7ff52]" strokeWidth={1.4} /><span className="font-mono text-xs text-[#626b61]">{item.n}</span></div><h3 className="font-display mt-20 text-2xl font-semibold tracking-[-0.04em]">{item.title}</h3><p className="mt-3 text-sm leading-6 text-[#8f978e]">{item.desc}</p></article>)}</div></div></section>

        <section id="pipeline" className="bg-[#e6e2d8] py-24 sm:py-32"><div className="container grid gap-16 lg:grid-cols-[0.7fr_1.3fr] lg:gap-28"><div><span className="eyebrow text-[#3158ff]">The pipeline</span><h2 className="font-display mt-6 text-5xl font-bold leading-[0.92] tracking-[-0.07em] sm:text-7xl">Seven passes.<br /><span className="text-[#3158ff]">One readable report.</span></h2><p className="mt-8 max-w-[360px] text-base leading-7 text-[#626860]">A document moves through a structured review loop built to expose uncertainty, not hide it.</p><button onClick={() => goTo("top")} className="mt-10 flex items-center gap-3 font-mono text-xs uppercase tracking-[0.12em] text-[#3158ff] hover:underline">Back to the top <ChevronRight className="h-4 w-4" /></button></div><div className="relative space-y-0 border-l border-[#a9afa7] pl-7 sm:pl-12">{[{n:"01",title:"Upload + validate",desc:"Accept the source and establish a trustworthy document boundary."},{n:"02",title:"Extract + chunk",desc:"Parse pages, clauses, parties, and tokens with stable metadata."},{n:"03",title:"Retrieve + dispatch",desc:"Search the corpus and route context to parallel specialist agents."},{n:"04",title:"Verify + converge",desc:"Reject unsupported findings, merge the surviving signals, and score the risk."},{n:"05",title:"Report + inspect",desc:"Return a readable report with source-grounded evidence at every turn."}].map((step, i) => <div key={step.n} className="relative border-b border-[#c5c0b6] py-7 first:pt-0 last:border-0"><span className="absolute -left-[42px] top-8 grid h-4 w-4 place-items-center rounded-full bg-[#3158ff] ring-4 ring-[#e6e2d8] sm:-left-[58px]"><span className="h-1.5 w-1.5 rounded-full bg-[#d7ff52]" /></span><div className="flex gap-6"><span className="font-mono text-xs text-[#3158ff]">{step.n}</span><div><h3 className="font-display text-2xl font-semibold tracking-[-0.04em]">{step.title}</h3><p className="mt-2 max-w-[450px] text-sm leading-6 text-[#626860]">{step.desc}</p></div></div></div>)}</div></div></section>

        <section className="bg-[#101412] py-24 text-[#f1eee6] sm:py-32"><div className="container grid items-end gap-12 lg:grid-cols-[1.3fr_0.7fr]"><div><div className="mb-7 flex items-center gap-3"><Sparkles className="h-5 w-5 text-[#d7ff52]" /><span className="eyebrow text-[#d7ff52]">Guardrails by default</span></div><h2 className="font-display max-w-[820px] text-5xl font-bold leading-[0.9] tracking-[-0.08em] sm:text-[6.5rem]">When evidence runs out, the system says so.</h2></div><p className="max-w-[300px] text-sm leading-6 text-[#8f978e]">Agents must cite retrieved text, keep document content out of system prompts, and return <span className="font-mono text-[#d7ff52]">VERIFICATION_UNAVAILABLE</span> when a claim cannot be grounded.</p></div></section>

        <section id="access" className="relative overflow-hidden bg-[#d7ff52] py-20 sm:py-28"><div className="absolute right-0 top-0 h-full w-1/3 opacity-20" style={{ backgroundImage: "url('/manus-storage/legalaid-evidence_11fc7503.png')", backgroundPosition: "center", backgroundSize: "cover", mixBlendMode: "multiply" }} /><div className="container relative flex flex-col justify-between gap-10 sm:flex-row sm:items-end"><div><span className="eyebrow text-[#3158ff]">Open the case file</span><h2 className="font-display mt-5 max-w-[780px] text-5xl font-bold leading-[0.9] tracking-[-0.08em] text-[#101412] sm:text-7xl">Make the document defend itself.</h2></div><Button onClick={() => openAuth("/signup")} className="h-14 shrink-0 rounded-none bg-[#101412] px-7 font-mono text-xs uppercase tracking-[0.12em] text-[#d7ff52] hover:bg-[#263026]">Request access <ArrowUpRight className="ml-3 h-4 w-4" /></Button></div></section>
      </main>
      <footer className="bg-[#101412] py-8 text-[#f1eee6]"><div className="container flex flex-col justify-between gap-4 sm:flex-row sm:items-center"><span className="font-display text-lg font-bold tracking-[-0.04em]">LegalAid<span className="text-[#d7ff52]">.</span></span><span className="font-mono text-[10px] uppercase tracking-[0.14em] text-[#626b61]">Explainable legal stress testing / 2026</span><span className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.14em] text-[#626b61]"><CircleDot className="h-3 w-3 text-[#d7ff52]" /> System legible</span></div></footer>
    </div>
  );
}
