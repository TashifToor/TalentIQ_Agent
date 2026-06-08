"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Eye, EyeOff, Brain, ArrowRight, Mail, Lock, Users, Briefcase } from "lucide-react";

export default function HRLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) { setError("Please fill in all fields."); return; }
    setError(""); setLoading(true);
    try {
      localStorage.setItem("talentiq_role", "hr");
      router.push("/hr/dashboard");
    } catch (err: any) {
      setError("Invalid recruiter credentials.");
    } finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen bg-[#0b0f19] text-slate-200 flex overflow-hidden">
      <div className="hidden lg:flex flex-col justify-between w-[45%] bg-slate-950/40 p-12 border-r border-slate-900 relative">
        <div className="absolute bottom-[-10%] left-[-10%] w-[400px] h-[400px] bg-indigo-500/10 rounded-full blur-[120px]" />
        <div className="flex items-center gap-3 relative z-10">
          <Brain size={24} className="text-blue-400" />
          <span className="text-xl font-bold text-white tracking-wide">TalentIQ Suite</span>
        </div>
        <div className="space-y-4 relative z-10">
          <div className="w-12 h-12 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
            <Users className="text-blue-400" size={22} />
          </div>
          <h2 className="text-3xl font-bold text-white tracking-tight">Recruiter Dashboard Gateway</h2>
          <p className="text-slate-400 text-sm max-w-xs">Monitor job postings, review automated vector scores, and evaluate high-volume candidate lists efficiently.</p>
        </div>
        <div className="text-xs text-slate-600 font-mono">v2.0 · Enterprise Recruitment Controls</div>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center p-8">
        <div className="w-full max-w-md bg-slate-950/20 border border-slate-900 rounded-2xl p-8 backdrop-blur-md shadow-2xl">
          <div className="mb-8">
            <h2 className="text-2xl font-bold text-white tracking-tight">Recruiter Portal Sign In</h2>
            <p className="text-slate-400 mt-1 text-xs">Enter your organizational credentials to proceed</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Enterprise Email</label>
              <div className="relative">
                <Mail size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-600" />
                <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="hr@company.com" className="w-full rounded-xl pl-10 pr-4 py-3 text-xs bg-slate-950/60 border border-slate-800 focus:border-blue-500/50 text-white focus:outline-none transition-all" />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Password</label>
              <div className="relative">
                <Lock size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-600" />
                <input type={show ? "text" : "password"} value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" className="w-full rounded-xl pl-10 pr-10 py-3 text-xs bg-slate-950/60 border border-slate-800 focus:border-blue-500/50 text-white focus:outline-none transition-all" />
                <button type="button" onClick={() => setShow(!show)} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-600 hover:text-blue-300 transition-colors">
                  {show ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>

            {error && <div className="bg-red-500/10 border border-red-500/25 rounded-xl px-3.5 py-2.5 text-xs text-red-400">{error}</div>}

            <button type="submit" className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-xs font-semibold bg-blue-500 hover:bg-blue-600 text-white shadow-lg shadow-blue-500/10 transition-all">
              <span>Access Hiring Matrix</span><ArrowRight size={14} />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}