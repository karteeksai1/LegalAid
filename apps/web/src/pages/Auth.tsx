// Design system: Signal / Noise — a black evidence workbench, green verification lines, restrained cobalt metadata, and inspectable forms.
import { Button } from "@/components/ui/button";
import { ArrowLeft, ArrowUpRight, Check, Eye, EyeOff, LockKeyhole, Mail, UserRound } from "lucide-react";
import { FormEvent, useState } from "react";
import { Link, useLocation } from "wouter";
import { toast } from "sonner";
import { createMockSession } from "@/lib/mockAuth";

type AuthMode = "login" | "signup";

export default function Auth({ mode }: { mode: AuthMode }) {
  const [, setLocation] = useLocation();
  const [showPassword, setShowPassword] = useState(false);
  const isSignup = mode === "signup";

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const email = String(formData.get("email") ?? "").trim();
    const name = String(formData.get("name") ?? "").trim() || email.split("@")[0] || "Reviewer";
    createMockSession({ email, name, mode });
    toast(isSignup ? "Workspace created." : "Welcome back.", { description: "Opening your review workspace…" });
    setTimeout(() => setLocation("/dashboard"), 250);
  };

  return (
    <main className="min-h-screen bg-[#101412] text-[#f1eee6]">
      <div className="relative min-h-screen overflow-hidden lg:grid lg:grid-cols-[minmax(420px,0.82fr)_1.18fr]">
        <div className="absolute inset-0 opacity-25 lg:hidden" style={{ backgroundImage: "url('/manus-storage/legalaid-lady-justice_c94d69fe.png')", backgroundPosition: "65% center", backgroundSize: "cover" }} />
        <section className="relative z-10 flex min-h-screen flex-col border-r border-white/10 bg-[#101412]/95 px-6 py-6 sm:px-10 lg:px-16">
          <div className="flex items-center justify-between">
            <Link href="/" className="flex items-center gap-3" aria-label="Back to LegalAid home">
              <span className="grid h-9 w-9 place-items-center bg-[#d7ff52]"><img src="/legalaid-mark.jpg" alt="" className="h-7 w-7 object-contain" /></span>
              <span className="font-display text-[18px] font-bold tracking-[-0.04em]">LegalAid<span className="text-[#d7ff52]">.</span></span>
            </Link>
            <span className="eyebrow hidden text-[#626b61] sm:block">Secure review infrastructure</span>
          </div>

          <div className="mx-auto flex w-full max-w-[420px] flex-1 flex-col justify-center py-16">
            <div className="mb-8"><span className="eyebrow text-[#d7ff52]">{isSignup ? "Create your workspace" : "Return to your workspace"}</span><h1 className="font-display mt-5 text-5xl font-bold leading-[0.92] tracking-[-0.07em] sm:text-6xl">{isSignup ? "Make the document defend itself." : "Pick up the evidence trail."}</h1><p className="mt-5 max-w-[360px] text-sm leading-6 text-[#8f978e]">{isSignup ? "Create an account to stress-test contracts with auditable, source-grounded review." : "Sign in to continue reviewing clauses, findings, and verified source context."}</p></div>
            <div className="mb-8 flex border-b border-white/15"><button onClick={() => setLocation("/login")} className={`eyebrow border-b-2 px-1 pb-4 pt-2 text-left transition-colors ${!isSignup ? "border-[#d7ff52] text-[#d7ff52]" : "border-transparent text-[#626b61] hover:text-[#f1eee6]"}`}>Log in</button><button onClick={() => setLocation("/signup")} className={`eyebrow ml-7 border-b-2 px-1 pb-4 pt-2 text-left transition-colors ${isSignup ? "border-[#d7ff52] text-[#d7ff52]" : "border-transparent text-[#626b61] hover:text-[#f1eee6]"}`}>Sign up</button></div>
            <form onSubmit={handleSubmit} className="space-y-5">
              {isSignup && <label className="block"><span className="eyebrow mb-2 block text-[#8f978e]">Full name</span><span className="relative block"><UserRound className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#626b61]" /><input required name="name" type="text" autoComplete="name" placeholder="Your name" className="h-13 w-full rounded-none border border-white/15 bg-white/[0.04] pl-11 pr-4 text-sm text-[#f1eee6] outline-none transition-colors placeholder:text-[#626b61] focus:border-[#d7ff52]" /></span></label>}
              <label className="block"><span className="eyebrow mb-2 block text-[#8f978e]">Email address</span><span className="relative block"><Mail className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#626b61]" /><input required name="email" type="email" autoComplete="email" placeholder="you@company.com" className="h-13 w-full rounded-none border border-white/15 bg-white/[0.04] pl-11 pr-4 text-sm text-[#f1eee6] outline-none transition-colors placeholder:text-[#626b61] focus:border-[#d7ff52]" /></span></label>
              <label className="block"><span className="eyebrow mb-2 block text-[#8f978e]">Password</span><span className="relative block"><LockKeyhole className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#626b61]" /><input required name="password" type={showPassword ? "text" : "password"} autoComplete={isSignup ? "new-password" : "current-password"} placeholder="••••••••••••" minLength={8} className="h-13 w-full rounded-none border border-white/15 bg-white/[0.04] pl-11 pr-12 text-sm tracking-[0.14em] text-[#f1eee6] outline-none transition-colors placeholder:text-[#626b61] focus:border-[#d7ff52]" /><button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-[#626b61] hover:text-[#d7ff52]" aria-label={showPassword ? "Hide password" : "Show password"}>{showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button></span></label>
              {isSignup && <label className="flex items-start gap-3 text-xs leading-5 text-[#8f978e]"><input required type="checkbox" className="mt-1 h-4 w-4 accent-[#d7ff52]" /><span>I agree to the LegalAid terms and understand that findings are review assistance, not legal advice.</span></label>}
              {!isSignup && <div className="flex justify-end"><button type="button" onClick={() => toast("Password reset flow coming next.")} className="font-mono text-[10px] uppercase tracking-[0.1em] text-[#d7ff52] hover:underline">Forgot password?</button></div>}
              <Button type="submit" className="h-13 w-full rounded-none bg-[#d7ff52] font-mono text-xs uppercase tracking-[0.12em] text-[#101412] hover:bg-[#e4ff87]">{isSignup ? "Create workspace" : "Enter workspace"}<ArrowUpRight className="ml-3 h-4 w-4" /></Button>
            </form>
            <div className="mt-8 flex items-center gap-3 border-t border-white/10 pt-6 text-xs text-[#626b61]"><Check className="h-4 w-4 text-[#d7ff52]" /><span>Evidence-first review. Human-readable by design.</span></div>
          </div>
          <Link href="/" className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.12em] text-[#626b61] transition-colors hover:text-[#d7ff52]"><ArrowLeft className="h-3.5 w-3.5" /> Back to LegalAid</Link>
        </section>

        <section className="relative hidden min-h-screen overflow-hidden lg:block"><div className="absolute inset-0 bg-[#101412]" /><div className="absolute inset-0 bg-cover bg-center opacity-95" style={{ backgroundImage: "url('/manus-storage/legalaid-lady-justice_c94d69fe.png')" }} /><div className="absolute inset-0 bg-[linear-gradient(90deg,#101412ee_0%,transparent_30%,#10141233_100%)]" /><div className="absolute inset-y-0 left-12 border-l border-[#d7ff52]/35" /><div className="absolute bottom-12 left-20 max-w-[360px]"><span className="eyebrow text-[#d7ff52]">Justice / inspected</span><p className="font-display mt-4 text-3xl font-semibold leading-[0.98] tracking-[-0.05em] text-[#f1eee6]">The strongest opinion is the one that can show its work.</p><div className="mt-7 flex items-center gap-3 font-mono text-[10px] uppercase tracking-[0.12em] text-[#8f978e]"><span className="h-2 w-2 rounded-full bg-[#d7ff52]" /> System legible / source grounded</div></div></section>
      </div>
    </main>
  );
}
