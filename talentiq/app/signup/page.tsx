"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Eye, EyeOff, Brain, ArrowRight, Mail, Lock, User, CheckCircle } from "lucide-react";
import { apiSignup, apiLogin, getToken } from "@/lib/api";

function PasswordStrength({ password }: { password: string }) {
  const checks = [
    { label: "8+ characters",      ok: password.length >= 8 },
    { label: "Uppercase letter",   ok: /[A-Z]/.test(password) },
    { label: "Number",             ok: /[0-9]/.test(password) },
    { label: "Special character",  ok: /[^A-Za-z0-9]/.test(password) },
  ];
  const score = checks.filter(c => c.ok).length;
  const colors = ["", "bg-red-500", "bg-orange-500", "bg-g-500", "bg-green-500"];
  const labels = ["", "Weak", "Fair", "Good", "Strong"];
  const textCol = ["", "text-red-400", "text-orange-400", "text-g-400", "text-green-400"];
  if (!password) return null;
  return (
    <div className="space-y-2 animate-slide-up-soft">
      <div className="flex gap-1.5">
        {[1,2,3,4].map(i => (
          <div key={i} className={`flex-1 h-1 rounded-full transition-all duration-300 ${i <= score ? colors[score] : "bg-border"}`} />
        ))}
      </div>
      <div className="flex items-center justify-between">
        <p className={`text-[11px] font-medium ${textCol[score]}`}>{labels[score]}</p>
        <div className="flex gap-3">
          {checks.map((c, i) => (
            <span key={i} className={`text-[10px] transition-colors ${c.ok ? "text-green-400" : "text-slate-700"}`}>
              {c.label}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function SignupPage() {
  const router = useRouter();
  const [form, setForm]     = useState({ name:"", email:"", password:"" });
  const [show, setShow]     = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError]   = useState("");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    if (getToken()) router.replace("/dashboard");
  }, [router]);

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(p => ({ ...p, [k]: e.target.value }));

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.email || !form.password) { setError("All fields are required."); return; }
    if (form.password.length < 6) { setError("Password must be at least 6 characters."); return; }
    setError(""); setLoading(true);
    try {
      await apiSignup(form.name, form.email, form.password);
      await apiLogin(form.email, form.password);
      router.push("/dashboard");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Signup failed.");
    } finally { setLoading(false); }
  };

  if (!mounted) return null;

  const perks = [
    "AI-powered CV screening in seconds",
    "LLaMA 3.3 70B chain-of-thought analysis",
    "FAISS semantic candidate search",
    "Automated hiring verdict & shortlisting",
  ];

  return (
    <div className="min-h-screen bg-bg bg-grid flex items-center justify-center p-6 relative overflow-hidden">
      {/* Orbs */}
      <div className="orb orb-1 w-[600px] h-[400px] top-[-100px] right-[-100px] animate-float" />
      <div className="orb orb-2 w-[400px] h-[400px] bottom-[-100px] left-[-80px] animate-float-delay" />

      <div className="w-full max-w-lg page-in relative z-10">
        {/* Logo */}
        <div className="flex items-center gap-3 mb-8">
          <div className="w-10 h-10 rounded-xl glass-gold flex items-center justify-center animate-glow">
            <Brain size={19} className="text-g-400" />
          </div>
          <div>
            <span className="text-lg font-bold text-white">TalentIQ</span>
            <span className="text-xs font-mono text-g-500/50 ml-2">v2.0</span>
          </div>
        </div>

        {/* Perks strip */}
        <div className="grid grid-cols-2 gap-2 mb-6">
          {perks.map((p, i) => (
            <div key={i} className={`flex items-center gap-2 glass-gold rounded-xl px-3 py-2 animate-fade-up d${i+1}`}>
              <CheckCircle size={12} className="text-g-400 flex-shrink-0" />
              <span className="text-xs text-slate-400 leading-tight">{p}</span>
            </div>
          ))}
        </div>

        {/* Card */}
        <div className="card rounded-2xl p-7 spin-border">
          <h2 className="text-xl font-bold text-white mb-1">Create your account</h2>
          <p className="text-sm text-slate-500 mb-6">Free to start · No credit card needed</p>

          <form onSubmit={handleSignup} className="space-y-4">
            {/* Name */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-400 uppercase tracking-wider">Full name</label>
              <div className="relative">
                <User size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-600 pointer-events-none" />
                <input value={form.name} onChange={set("name")} placeholder="Your full name"
                  className="input-field w-full rounded-xl pl-10 pr-4 py-3 text-sm" />
              </div>
            </div>

            {/* Email */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-400 uppercase tracking-wider">Email</label>
              <div className="relative">
                <Mail size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-600 pointer-events-none" />
                <input type="email" value={form.email} onChange={set("email")} placeholder="you@company.com"
                  className="input-field w-full rounded-xl pl-10 pr-4 py-3 text-sm" />
              </div>
            </div>

            {/* Password */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-400 uppercase tracking-wider">Password</label>
              <div className="relative">
                <Lock size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-600 pointer-events-none" />
                <input type={show ? "text" : "password"} value={form.password} onChange={set("password")}
                  placeholder="Min. 6 characters"
                  className="input-field w-full rounded-xl pl-10 pr-10 py-3 text-sm" />
                <button type="button" onClick={() => setShow(!show)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-600 hover:text-slate-400 transition-colors">
                  {show ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
              <PasswordStrength password={form.password} />
            </div>

            {/* Error */}
            {error && (
              <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/25 rounded-xl px-3.5 py-2.5 animate-scale-in">
                <div className="w-1.5 h-1.5 rounded-full bg-red-400 flex-shrink-0" />
                <p className="text-xs text-red-400">{error}</p>
              </div>
            )}

            <button type="submit" disabled={loading}
              className="btn-gold w-full flex items-center justify-center gap-2.5 py-3 rounded-xl text-sm mt-2">
              {loading ? (
                <><span className="w-4 h-4 border-2 border-black/25 border-t-black rounded-full animate-spin" />Creating account...</>
              ) : (
                <><span>Create Account</span><ArrowRight size={15} /></>
              )}
            </button>
          </form>

          <p className="text-center text-sm text-slate-600 mt-5">
            Already have an account?{" "}
            <Link href="/login" className="text-g-400 hover:text-g-300 font-medium transition-colors">Sign in</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
