"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { signIn } from "next-auth/react";
import { Brain, ArrowRight, Mail, Lock, Building, Users, Shield, CheckCircle2 } from "lucide-react";

export default function HRSignupPage() {
  const router = useRouter();
  const [company, setCompany] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!company || !email || !password) { setError("Please fill in all fields."); return; }
    setError(""); setLoading(true);
    try {
      // API Call: role = "hr"
      router.push("/auth/login/hr");
    } catch (err: any) {
      setError(err.message || "Registration failed.");
    } finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen bg-[#0b0f19] text-slate-200 flex overflow-hidden">
      {/* Left Marketing Panel for Enterprise */}
      <div className="hidden lg:flex flex-col justify-between w-[45%] bg-slate-950/40 p-12 border-r border-slate-900 relative">
        <div className="absolute top-[-10%] left-[-10%] w-[400px] h-[400px] bg-blue-500/10 rounded-full blur-[120px]" />
        
        <div className="flex items-center gap-3 relative z-10">
          <Brain size={24} className="text-blue-400" />
          <span className="text-xl font-bold text-white tracking-wide">TalentIQ <span className="text-xs text-blue-500 font-mono">Enterprise</span></span>
        </div>

        <div className="space-y-6 relative z-10">
          <h1 className="text-4xl font-extrabold text-white leading-tight">
            Automate Your <br />
            <span className="bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent">Recruitment Pipeline</span>
          </h1>
          <p className="text-slate-400 text-sm max-w-sm">
            Deploy advanced LangGraph screening loops, manage deep-reasoning shortlists, and chat with your organization's internal HR knowledge base.
          </p>

          <div className="space-y-3 pt-4">
            {[
              "Bulk resume parsing & indexing (PDF/Docx)",
              "Custom weights for job description matching",
              "Multi-tenant data privacy & secure storage",
              "AI-generated technical interview blueprints"
            ].map((text, i) => (
              <div key={i} className="flex items-center gap-3 text-xs text-slate-400">
                <CheckCircle2 size={14} className="text-blue-400" />
                <span>{text}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="text-xs text-slate-600 font-mono">Secure Identity Provider · ISO 27001 Compliant Architecture</div>
      </div>

      {/* Right Form Panel */}
      <div className="flex-1 flex flex-col items-center justify-center p-8 relative">
        <div className="w-full max-w-md bg-slate-950/20 border border-slate-900 rounded-2xl p-8 backdrop-blur-md shadow-2xl">
          <div className="mb-8">
            <div className="lg:hidden flex items-center gap-2 mb-4">
              <Brain size={20} className="text-blue-400" />
              <span className="text-lg font-bold text-white">TalentIQ Enterprise</span>
            </div>
            <h2 className="text-2xl font-bold text-white tracking-tight">Create Recruiter Workspace</h2>
            <p className="text-slate-400 mt-1 text-xs">Register your company to scale automated shortlisting</p>
          </div>

          <form onSubmit={handleSignup} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Company / Organization</label>
              <div className="relative">
                <Building size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-600" />
                <input type="text" value={company} onChange={e => setCompany(e.target.value)} placeholder="e.g. Acme Corp" className="w-full rounded-xl pl-10 pr-4 py-3 text-xs bg-slate-950/60 border border-slate-800 focus:border-blue-500/50 text-white focus:outline-none transition-all" />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Work Email Address</label>
              <div className="relative">
                <Mail size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-600" />
                <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="recruiting@company.com" className="w-full rounded-xl pl-10 pr-4 py-3 text-xs bg-slate-950/60 border border-slate-800 focus:border-blue-500/50 text-white focus:outline-none transition-all" />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Password</label>
              <div className="relative">
                <Lock size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-600" />
                <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" className="w-full rounded-xl pl-10 pr-4 py-3 text-xs bg-slate-950/60 border border-slate-800 focus:border-blue-500/50 text-white focus:outline-none transition-all" />
              </div>
            </div>

            {error && <div className="bg-red-500/10 border border-red-500/25 rounded-xl px-3.5 py-2.5 text-xs text-red-400">{error}</div>}

            <button type="submit" disabled={loading} className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-xs font-semibold bg-blue-500 hover:bg-blue-600 text-white shadow-lg shadow-blue-500/10 transition-all">
              {loading ? "Provisioning..." : <><span className="font-bold">Deploy Workspace</span><ArrowRight size={14} /></>}
            </button>
          </form>
          <div className="relative my-6">
  <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-200 dark:border-slate-800"></div></div>
  <div className="relative flex justify-center text-[10px] uppercase font-mono"><span className="bg-white dark:bg-[#0b0f19] px-3 text-slate-400 dark:text-slate-500">Or Provision Workspace Via</span></div>
</div>

{/* Real Google Colored Button */}
<button 
  type="button"
  onClick={() => signIn("google", { callbackUrl: "/hr/billing-gate" })}
  className="w-full flex items-center justify-center gap-3 py-3 rounded-xl text-xs font-medium bg-white text-slate-700 border border-slate-200 hover:bg-slate-50 hover:border-slate-300 transition-all shadow-sm active:scale-[0.98]"
>
  {/* Official Google Vector Icon */}
  <svg className="w-4 h-4" viewBox="0 0 24 24">
    <path fill="#EA4335" d="M5.266 9.765A7.077 7.077 0 0112 4.909c1.69 0 3.218.6 4.418 1.582l3.51-3.51C17.742 1.055 15.014 0 12 0 7.345 0 3.31 2.682 1.341 6.6l3.925 3.165z" />
    <path fill="#4285F4" d="M23.736 12.25c0-.85-.077-1.664-.218-2.455H12v4.643h6.582a5.626 5.626 0 01-2.441 3.689v3.064h3.945c2.309-2.127 3.65-5.259 3.65-8.94z" />
    <path fill="#FBBC05" d="M5.266 14.235L1.341 17.4C3.31 21.318 7.345 24 12 24c3.055 0 5.623-1.014 7.495-2.755l-3.945-3.064c-1.096.736-2.5 1.173-3.55 1.173-2.836 0-5.245-1.914-6.104-4.486l-3.925 3.165z" />
    <path fill="#34A853" d="M5.895 14.235A7.036 7.036 0 015.523 12c0-.79.132-1.55.373-2.265L1.341 6.573A11.944 11.944 0 000 12c0 1.93.459 3.755 1.341 5.427l4.554-3.192z" />
  </svg>
  <span>Sign up with Google</span>
</button>

          <p className="text-center text-xs text-slate-500 mt-6">
            Already managing a suite?{" "}
            <Link href="/auth/login/hr" className="text-blue-400 hover:text-blue-300 font-semibold transition-colors">Sign In</Link>
          </p>
        </div>
      </div>
    </div>
  );
}