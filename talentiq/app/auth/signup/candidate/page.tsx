"use client";
import { signIn } from "next-auth/react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Brain, ArrowRight, Mail, Lock, Zap, CheckCircle } from "lucide-react";

export default function CandidateSignupPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) { setError("Please populate all fields."); return; }
    setError(""); setLoading(true);
    try {
      // API Call: role = "candidate"
      router.push("/auth/login/candidate");
    } catch (err: any) {
      setError("Verification token missing or subscription inactive.");
    } finally { setLoading(false); }
  };

  // Real OAuth Native Pop-up Logic
  const handleGoogleSignIn = async () => {
    setError("");
    const result = await signIn("google", { 
      redirect: false, 
      callbackUrl: "/candidate/billing-gate" 
    });

    if (result?.url) {
      const width = 500;
      const height = 600;
      const left = window.screen.width / 2 - width / 2;
      const top = window.screen.height / 2 - height / 2;
      
      const popup = window.open(
        result.url,
        "Google Sign In",
        `width=${width},height=${height},top=${top},left=${left},toolbar=no,menubar=no,scrollbars=yes`
      );

      const checkPopup = setInterval(() => {
        if (!popup || popup.closed) {
          clearInterval(checkPopup);
          // Pop-up close hote hi user seedha billing gate/dashboard par land karega
          router.push("/candidate/billing-gate");
        }
      }, 1000);
    } else {
      setError("Failed to initiate Google sign in container.");
    }
  };

  return (
    <div className="min-h-screen bg-[#0b0f19] text-slate-200 flex overflow-hidden">
      {/* Left Marketing Panel for Candidates */}
      <div className="hidden lg:flex flex-col justify-between w-[45%] bg-slate-950/20 p-12 border-r border-slate-900 relative">
        <div className="absolute bottom-[-10%] right-[-10%] w-[400px] h-[400px] bg-teal-500/10 rounded-full blur-[120px]" />
        
        <div className="flex items-center gap-3 relative z-10">
          <Brain size={24} className="text-teal-400" />
          <span className="text-xl font-bold text-white tracking-wide">TalentIQ <span className="text-xs text-teal-400 font-mono">Sandbox</span></span>
        </div>

        <div className="space-y-6 relative z-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-teal-500/5 border border-teal-500/20 text-[10px] font-mono text-teal-400">
            <Zap size={10} /> Premium Candidate Portal
          </div>
          <h1 className="text-4xl font-extrabold text-white leading-tight">
            Crack the Corporate <br />
            <span className="bg-gradient-to-r from-teal-400 to-emerald-400 bg-clip-text text-transparent">ATS Filters</span>
          </h1>
          <p className="text-slate-400 text-sm max-w-sm">
            Upload your resume, paste your target job descriptions, and access live deep-reasoning alignment reports generated directly by LLaMA 3.3.
          </p>

          <div className="space-y-3 pt-2">
            {[
              "Line-by-line semantic gap diagnostics",
              "ATS scoring simulator & structural evaluation",
              "Personalized technical mock interview loops",
              "Instant Harvard-style format checker"
            ].map((text, i) => (
              <div key={i} className="flex items-center gap-3 text-xs text-slate-400">
                <CheckCircle size={14} className="text-teal-400" />
                <span>{text}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="text-xs text-slate-600 font-mono">Single Pro Access Pass · Non-refundable Sandbox Allocation</div>
      </div>

      {/* Right Form Panel */}
      <div className="flex-1 flex flex-col items-center justify-center p-8">
        <div className="w-full max-w-md bg-slate-950/20 border border-slate-900 rounded-2xl p-8 backdrop-blur-md shadow-2xl">
          <div className="mb-8">
            <h2 className="text-2xl font-bold text-white tracking-tight">Initialize Candidate Sandbox</h2>
            <p className="text-slate-400 mt-1 text-xs">Enter the email used during checkout to unlock your credentials</p>
          </div>

          <form onSubmit={handleSignup} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Checkout Email Address</label>
              <div className="relative">
                <Mail size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-600" />
                <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="name@example.com" className="w-full rounded-xl pl-10 pr-4 py-3 text-xs bg-slate-950/60 border border-slate-800 focus:border-teal-500/50 text-white focus:outline-none transition-all" />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Create Sandbox Password</label>
              <div className="relative">
                <Lock size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-600" />
                <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" className="w-full rounded-xl pl-10 pr-4 py-3 text-xs bg-slate-950/60 border border-slate-800 focus:border-teal-500/50 text-white focus:outline-none transition-all" />
              </div>
            </div>

            {error && <div className="bg-red-500/10 border border-red-500/25 rounded-xl px-3.5 py-2.5 text-xs text-red-400">{error}</div>}

            <button type="submit" disabled={loading} className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-xs font-semibold bg-teal-400 hover:bg-teal-500 text-black shadow-lg shadow-teal-500/10 transition-all">
              {loading ? "Allocating Workspace..." : <><span className="font-bold">Claim Pro Sandbox Access</span><ArrowRight size={14} /></>}
            </button>
          </form>
          
          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-800"></div></div>
            <div className="relative flex justify-center text-[10px] uppercase font-mono"><span className="bg-[#0b0f19] px-3 text-slate-500">Or Access Instantly With</span></div>
          </div>

          {/* Fixed Pop-up Google Button */}
          <button 
            type="button"
            onClick={handleGoogleSignIn}
            className="w-full flex items-center justify-center gap-3 py-3 rounded-xl text-xs font-medium bg-white text-slate-700 border border-slate-200 hover:bg-slate-50 hover:border-slate-300 transition-all shadow-sm active:scale-[0.98]"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24">
              <path fill="#EA4335" d="M5.266 9.765A7.077 7.077 0 0112 4.909c1.69 0 3.218.6 4.418 1.582l3.51-3.51C17.742 1.055 15.014 0 12 0 7.345 0 3.31 2.682 1.341 6.6l3.925 3.165z" />
              <path fill="#4285F4" d="M23.736 12.25c0-.85-.077-1.664-.218-2.455H12v4.643h6.582a5.626 5.626 0 01-2.441 3.689v3.064h3.945c2.309-2.127 3.65-5.259 3.65-8.94z" />
              <path fill="#FBBC05" d="M5.266 14.235L1.341 17.4C3.31 21.318 7.345 24 12 24c3.055 0 5.623-1.014 7.495-2.755l-3.945-3.064c-1.096.736-2.5 1.173-3.55 1.173-2.836 0-5.245-1.914-6.104-4.486l-3.925 3.165z" />
              <path fill="#34A853" d="M5.895 14.235A7.036 7.036 0 015.523 12c0-.79.132-1.55.373-2.265L1.341 6.573A11.944 11.944 0 000 12c0 1.93.459 3.755 1.341 5.427l4.554-3.192z" />
            </svg>
            <span>Sign up with Google</span>
          </button>

          <p className="text-center text-xs text-slate-500 mt-6">
            Already have your pass?{" "}
            <Link href="/auth/login/candidate" className="text-teal-400 hover:text-teal-300 font-semibold transition-colors">Sign In Here</Link>
          </p>
        </div>
      </div>
    </div>
  );
}