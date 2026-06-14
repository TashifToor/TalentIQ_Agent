"use client";
import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { Terminal, Lock, Mail, AlertTriangle } from "lucide-react";

export default function TalentIQCoreLogin() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setError("Please fill in all access parameters.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      // 🚀 1:1 Mapping to your FastAPI Router Endpoint
      const response = await fetch("http://localhost:8000/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: email,
          password: password,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        // Captures your HTTPException layout details ("Invalid email or password", etc.)
        throw new Error(data.detail || "Authentication handshake failed.");
      }

      // 🔐 Store access token from TokenResponse schema
      localStorage.setItem("token", data.access_token);
      
      // 🎯 Match user.role directly from your backend's automated response schema
      const userRole = data.role ? data.role.toLowerCase() : "";

      if (userRole === "hr") {
        router.push("/hr/dashboard");
      } else if (userRole === "candidate") {
        router.push("/candidate/dashboard");
      } else {
        setError(`Access denied. Context role '${data.role}' is not recognized.`);
        setLoading(false);
      }

    } catch (err: any) {
      // Handles network collapse or wrong credentials
      setError(err.message || "Core network timeout or connection refused.");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#050711] flex items-center justify-center p-4 font-sans">
      <div className="w-full max-w-md bg-[#0a0d1d] border border-slate-900 rounded-2xl p-8 shadow-2xl relative overflow-hidden">
        
        {/* Top Radial Glow */}
        <div className="absolute -top-10 -right-10 w-32 h-32 bg-blue-500/10 rounded-full blur-3xl" />

        {/* Brand Header */}
        <div className="text-center mb-8">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center border border-blue-400/20 text-white shadow-lg mx-auto mb-3">
            <Terminal size={20} />
          </div>
          <h2 className="text-xl font-black text-white tracking-tight">TalentIQ Gate</h2>
          <p className="text-xs text-slate-400 mt-1">Direct Auth Connection System Active</p>
        </div>

        {/* Error Alert Box */}
        {error && (
          <div className="mb-5 p-3.5 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl flex items-start gap-2.5 text-xs font-mono">
            <AlertTriangle size={16} className="shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {/* Dynamic Credentials Intake Form */}
        <form onSubmit={handleLoginSubmit} className="space-y-4">
          <div>
            <label className="text-[10px] font-mono uppercase tracking-wider text-slate-400 block mb-1.5">
              Identity Vector (Email)
            </label>
            <div className="relative">
              <Mail size={14} className="absolute left-3.5 top-3.5 text-slate-500" />
              <input 
                type="email" 
                placeholder="name@talentiq.ai" 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-slate-950/60 border border-slate-900 rounded-xl pl-10 pr-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-blue-500/50 font-mono transition-colors"
                required
              />
            </div>
          </div>

          <div>
            <label className="text-[10px] font-mono uppercase tracking-wider text-slate-400 block mb-1.5">
              Access Payload (Password)
            </label>
            <div className="relative">
              <Lock size={14} className="absolute left-3.5 top-3.5 text-slate-500" />
              <input 
                type="password" 
                placeholder="••••••••" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-slate-950/60 border border-slate-900 rounded-xl pl-10 pr-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-blue-500/50 font-mono transition-colors"
                required
              />
            </div>
          </div>

          <button 
            type="submit"
            disabled={loading}
            className="w-full mt-2 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 disabled:from-slate-800 disabled:to-slate-800 text-white font-bold rounded-xl text-xs transition-all tracking-wide shadow-lg shadow-blue-600/10 flex items-center justify-center"
          >
            {loading ? "Authenticating Vector..." : "Authorize Console"}
          </button>
        </form>

        {/* Processing Spinner Shield */}
        {loading && (
          <div className="absolute inset-0 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center rounded-2xl">
            <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          </div>
        )}

      </div>
    </div>
  );
}