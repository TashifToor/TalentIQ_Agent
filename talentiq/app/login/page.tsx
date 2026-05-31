"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Eye, EyeOff, Brain, ArrowRight, Mail, Lock, Sparkles, Zap } from "lucide-react";
import { apiLogin, getToken } from "@/lib/api";

const FEATURES = [
  { icon: "🧠", text: "LLaMA 3.3 70B powered screening" },
  { icon: "⚡", text: "Agentic RAG pipeline analysis" },
  { icon: "📊", text: "Real-time candidate scoring" },
  { icon: "🔍", text: "FAISS semantic CV search" },
];

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow]         = useState(false);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState("");
  const [mounted, setMounted]   = useState(false);

  useEffect(() => {
    setMounted(true);
    if (getToken()) router.replace("/dashboard");
  }, [router]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) { setError("Please fill in all fields."); return; }
    setError(""); setLoading(true);
    try {
      await apiLogin(email, password);
      router.push("/dashboard");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Login failed.");
    } finally { setLoading(false); }
  };

  if (!mounted) return null;

  return (
    <div className="min-h-screen bg-bg bg-grid flex overflow-hidden">
      {/* ── Left visual panel ── */}
      <div className="hidden lg:flex flex-col justify-between w-[44%] relative overflow-hidden p-12">
        {/* Orbs */}
        <div className="orb orb-1 w-[500px] h-[500px] top-[-100px] left-[-100px] animate-float" />
        <div className="orb orb-2 w-[350px] h-[350px] bottom-[100px] right-[-80px] animate-float-delay" />
        <div className="orb orb-3 w-[200px] h-[200px] top-[40%] left-[30%]" />

        {/* Logo */}
        <div className="relative z-10 animate-fade-in">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl glass-gold flex items-center justify-center animate-glow">
              <Brain size={20} className="text-g-400" />
            </div>
            <span className="text-xl font-bold text-white">TalentIQ</span>
            <span className="text-xs font-mono text-g-500/60 border border-g-500/20 px-1.5 py-0.5 rounded bg-g-500/5">v2.0</span>
          </div>
        </div>

        {/* Center content */}
        <div className="relative z-10 space-y-8">
          <div className="space-y-4">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full glass-gold text-xs font-mono text-g-400 animate-fade-up">
              <Sparkles size={12} />
              Agentic AI · LangGraph · FAISS
            </div>
            <h1 className="text-5xl font-bold leading-tight animate-fade-up d1">
              <span className="text-white">Hire Smarter</span>
              <br />
              <span className="text-gold-gradient">with AI</span>
            </h1>
            <p className="text-slate-400 text-lg leading-relaxed max-w-sm animate-fade-up d2">
              Automated CV screening, candidate scoring, and deep reasoning — powered by LLaMA 3.3 70B.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3 animate-fade-up d3">
            {FEATURES.map((f, i) => (
              <div key={i} className="flex items-center gap-2.5 glass rounded-xl px-3.5 py-2.5">
                <span className="text-lg">{f.icon}</span>
                <span className="text-xs text-slate-400">{f.text}</span>
              </div>
            ))}
          </div>

          {/* Floating stat cards */}
          <div className="flex gap-3 animate-fade-up d4">
            {[
              { label: "CVs Screened", value: "50K+" },
              { label: "Accuracy", value: "94.2%" },
              { label: "Time Saved", value: "12hrs" },
            ].map((s) => (
              <div key={s.label} className="flex-1 card rounded-xl px-3 py-2.5 text-center">
                <p className="text-lg font-bold glow-gold">{s.value}</p>
                <p className="text-[10px] text-slate-600 mt-0.5">{s.label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom marquee */}
        <div className="relative z-10 overflow-hidden animate-fade-in">
          <div className="flex gap-3 animate-marquee whitespace-nowrap">
            {[...Array(2)].flatMap(() =>
              ["Python", "FastAPI", "LangChain", "FAISS", "LangGraph", "LLaMA 3.3", "PostgreSQL", "RAG Pipeline", "NLP"].map((t, i) => (
                <span key={`${t}-${i}`} className="text-xs font-mono text-slate-700 border border-border px-3 py-1 rounded-full flex-shrink-0">
                  {t}
                </span>
              ))
            )}
          </div>
        </div>
      </div>

      {/* ── Right form panel ── */}
      <div className="flex-1 flex flex-col items-center justify-center p-8 relative">
        {/* Mobile logo */}
        <div className="lg:hidden flex items-center gap-2.5 mb-10">
          <div className="w-9 h-9 rounded-xl glass-gold flex items-center justify-center">
            <Brain size={17} className="text-g-400" />
          </div>
          <span className="text-lg font-bold text-white">TalentIQ</span>
        </div>

        <div className="w-full max-w-md page-in">
          <div className="mb-8">
            <h2 className="text-2xl font-bold text-white">Welcome back</h2>
            <p className="text-slate-500 mt-1 text-sm">Sign in to your TalentIQ account</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            {/* Email */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-400 uppercase tracking-wider">Email</label>
              <div className="relative">
                <Mail size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-600 pointer-events-none" />
                <input
                  type="email" value={email} onChange={e => setEmail(e.target.value)}
                  placeholder="you@company.com" autoComplete="email"
                  className="input-field w-full rounded-xl pl-10 pr-4 py-3 text-sm"
                />
              </div>
            </div>

            {/* Password */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-slate-400 uppercase tracking-wider">Password</label>
                <span className="text-xs text-g-500 hover:text-g-400 cursor-pointer transition-colors">Forgot?</span>
              </div>
              <div className="relative">
                <Lock size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-600 pointer-events-none" />
                <input
                  type={show ? "text" : "password"} value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••" autoComplete="current-password"
                  className="input-field w-full rounded-xl pl-10 pr-10 py-3 text-sm"
                />
                <button type="button" onClick={() => setShow(!show)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-600 hover:text-slate-400 transition-colors">
                  {show ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>

            {/* Error */}
            {error && (
              <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/25 rounded-xl px-3.5 py-2.5 animate-scale-in">
                <div className="w-1.5 h-1.5 rounded-full bg-red-400 flex-shrink-0" />
                <p className="text-xs text-red-400">{error}</p>
              </div>
            )}

            {/* Submit */}
            <button type="submit" disabled={loading}
              className="btn-gold w-full flex items-center justify-center gap-2.5 py-3 rounded-xl text-sm mt-2">
              {loading ? (
                <><span className="w-4 h-4 border-2 border-black/25 border-t-black rounded-full animate-spin" />Signing in...</>
              ) : (
                <><span>Sign In</span><ArrowRight size={15} /></>
              )}
            </button>
          </form>

          {/* Divider */}
          <div className="flex items-center gap-3 my-5">
            <div className="flex-1 h-px bg-border" />
            <span className="text-xs text-slate-700">or</span>
            <div className="flex-1 h-px bg-border" />
          </div>

          {/* Demo fill */}
          <button
            onClick={() => { setEmail("demo@talentiq.ai"); setPassword("demo1234"); }}
            className="btn-ghost w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm">
            <Zap size={14} />
            Fill Demo Credentials
          </button>

          <p className="text-center text-sm text-slate-600 mt-6">
            No account?{" "}
            <Link href="/signup" className="text-g-400 hover:text-g-300 font-medium transition-colors">
              Sign up free
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
