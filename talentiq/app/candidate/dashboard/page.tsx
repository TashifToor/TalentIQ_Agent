"use client";
import React, { useState } from "react";
import { 
  Sparkles, FileText, CheckCircle, AlertTriangle, 
  User, Award, ListChecks, HelpCircle, MessageSquareOff, ChevronRight 
} from "lucide-react";

export default function CandidatePremiumDashboard() {
  // Mock State for Candidate Profile Optimization
  const [atsScore, setAtsScore] = useState(74);
  const [scansRemaining, setScansRemaining] = useState(12);

  return (
    <div className="min-h-screen bg-[#050711] text-slate-300 p-6 font-sans">
      
      {/* 🎒 PREMIUM COACH HEADER & TRACKER */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between border-b border-slate-900 pb-6 mb-8 gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 text-[10px] font-mono font-bold tracking-wider uppercase">
              Premium Pro Tier
            </span>
          </div>
          <h1 className="text-2xl font-black text-white tracking-tight mt-1">AI Career Co-Pilot</h1>
          <p className="text-xs text-slate-400">Optimize your professional blueprint, track structural score enhancements, and simulate target interview loops.</p>
        </div>

        {/* 💳 CANDIDATE MONTHLY BALANCE TRACKER */}
        <div className="bg-gradient-to-br from-[#0c0f22] to-[#080b16] border border-indigo-500/20 rounded-2xl p-4 flex items-center gap-4 shadow-xl min-w-[260px]">
          <div className="w-10 h-10 rounded-xl bg-indigo-500/10 flex items-center justify-center border border-indigo-500/30 text-indigo-400">
            <Sparkles size={18} />
          </div>
          <div className="flex-1">
            <p className="text-[10px] font-mono text-slate-400 uppercase tracking-wider">Coach Optimization Units</p>
            <h2 className="text-lg font-bold text-white font-mono mt-0.5">{scansRemaining} <span className="text-xs font-normal text-slate-500">Optimizations Left</span></h2>
          </div>
        </div>
      </div>

      {/* 🔄 THREE-SECTION TARGET ARCHITECTURE */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">
        
        {/* LEFT SECTION: ATS SCORE METER & PAYLOAD OPTIMIZER (5 Cols) */}
        <div className="xl:col-span-5 space-y-6">
          <div className="bg-[#0a0d1d] border border-slate-900 rounded-2xl p-6 shadow-xl relative overflow-hidden">
            <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-500/5 rounded-full blur-2xl" />
            
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-6 flex items-center gap-2">
              <Award size={14} className="text-indigo-400" /> Live ATS Scoring Index
            </h3>

            {/* Premium Radial/Linear Hybrid Score representation */}
            <div className="flex items-center justify-between bg-slate-950/60 border border-slate-900 p-5 rounded-xl mb-6">
              <div>
                <span className="text-[10px] font-mono uppercase text-slate-400 block">Current Standings</span>
                <h2 className={`text-4xl font-black font-mono mt-1 ${atsScore >= 80 ? 'text-emerald-400' : 'text-amber-400'}`}>{atsScore}%</h2>
              </div>
              <div className="text-right max-w-[160px]">
                <span className="text-[11px] text-amber-300 font-medium block">⚠️ Below Market Average</span>
                <span className="text-[10px] text-slate-500 block mt-0.5">Top-tier corporate systems trigger automatically at 85%+</span>
              </div>
            </div>

            {/* SINGLE PROFILE RE-UPLOAD CONSOLE */}
            <div className="space-y-4">
              <label className="text-[10px] uppercase font-mono font-bold text-slate-400 block">Inject Updated Harvard CV Template</label>
              <div className="border border-dashed border-slate-800 hover:border-indigo-500/40 bg-slate-950/40 transition-all rounded-xl p-6 text-center cursor-pointer group">
                <FileText size={22} className="mx-auto text-slate-600 group-hover:text-indigo-400 transition-colors" />
                <span className="text-xs font-bold text-slate-300 block mt-2">Upload Profile Blueprint</span>
                <span className="text-[9px] text-slate-600 font-mono block mt-0.5">Will burn 1 Optimization Credit</span>
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT SECTION: DEEP REMEDIAL ACTION CONSOLE & INTERVIEW RADAR (7 Cols) */}
        <div className="xl:col-span-7 space-y-6">
          
          {/* CRITICAL ACTIONS GAP REPORT */}
          <div className="bg-[#0a0d1d] border border-slate-900 rounded-2xl p-6 shadow-xl">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-4 flex items-center gap-2">
              <ListChecks size={14} className="text-indigo-400" /> High-Priority Structural Repairs
            </h3>

            <div className="space-y-3">
              {/* Gap item 1 */}
              <div className="flex items-start gap-3 bg-slate-950/40 border border-slate-900 p-3.5 rounded-xl">
                <AlertTriangle size={16} className="text-amber-400 mt-0.5 shrink-0" />
                <div className="flex-1">
                  <h4 className="text-xs font-bold text-white leading-tight">Missing Verifiable Quantification Metric</h4>
                  <p className="text-[11px] text-slate-400 mt-0.5">Your experience section lists Django/FastAPI but lacks quantitative engineering impact indicators (e.g., "optimized query response by 30%").</p>
                </div>
                <span className="text-[9px] font-mono text-amber-400 bg-amber-500/5 px-2 py-0.5 rounded border border-amber-500/10">+8 Score Pts</span>
              </div>

              {/* Gap item 2 */}
              <div className="flex items-start gap-3 bg-slate-950/40 border border-slate-900 p-3.5 rounded-xl">
                <AlertTriangle size={16} className="text-amber-400 mt-0.5 shrink-0" />
                <div className="flex-1">
                  <h4 className="text-xs font-bold text-white leading-tight">Missing Core Semantic Keywords</h4>
                  <p className="text-[11px] text-slate-400 mt-0.5">Target markets looking for software architecture expect explicit keywords: <span className="text-slate-300 font-mono text-[10px]">Stateful Workflows, Vector Embeddings</span>.</p>
                </div>
                <span className="text-[9px] font-mono text-amber-400 bg-amber-500/5 px-2 py-0.5 rounded border border-amber-500/10">+5 Score Pts</span>
              </div>

              {/* Success verified token item */}
              <div className="flex items-start gap-3 bg-[#0d1c16]/30 border border-emerald-950/50 p-3.5 rounded-xl">
                <CheckCircle size={16} className="text-emerald-400 mt-0.5 shrink-0" />
                <div className="flex-1">
                  <h4 className="text-xs font-bold text-white leading-tight">Harvard Structure Formatting Matched</h4>
                  <p className="text-[11px] text-slate-400 mt-0.5">Single-page length layout constraint, contact indexing matrix, and education parameters pass perfectly.</p>
                </div>
                <span className="text-[9px] font-mono text-emerald-400 bg-emerald-500/5 px-2 py-0.5 rounded border border-emerald-500/10">Verified</span>
              </div>
            </div>
          </div>

          {/* INTERVIEW ADVANTAGE RADAR GATE */}
          <div className="bg-gradient-to-r from-indigo-500/10 via-[#0d1127] to-[#0a0d1d] border border-indigo-500/20 p-5 rounded-2xl flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-start gap-3.5">
              <div className="w-9 h-9 rounded-xl bg-indigo-500/20 flex items-center justify-center border border-indigo-500/30 text-indigo-400 shrink-0">
                <HelpCircle size={18} />
              </div>
              <div>
                <h4 className="text-sm font-bold text-white tracking-tight">AI Technical Mock Simulator</h4>
                <p className="text-xs text-slate-400 mt-0.5">Let our agent generate 5 strict real-world engineering questions customized to your CV stack to practice live response cycles.</p>
              </div>
            </div>
            <button className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 transition-all shadow-lg shadow-indigo-600/10 whitespace-nowrap border border-indigo-400/20">
              Initialize Simulator <ChevronRight size={14} />
            </button>
          </div>

        </div>

      </div>

    </div>
  );
}