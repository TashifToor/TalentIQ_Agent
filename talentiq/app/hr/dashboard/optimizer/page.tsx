"use client";
import React from "react";
import { Sparkles, Cpu, ChevronLeft } from "lucide-react";
import { useRouter } from "next/navigation";

export default function TalentOptimizerHub() {
  const router = useRouter();

  return (
    <div className="p-6 max-w-5xl mx-auto text-white font-sans">
      {/* Top Breadcrumb Navigation */}
      <button 
        onClick={() => router.back()}
        className="flex items-center gap-1 text-xs text-slate-400 hover:text-white transition-colors mb-6 font-mono"
      >
        <ChevronLeft size={14} /> BACK_TO_DASHBOARD
      </button>

      {/* Header Module */}
      <div className="p-8 bg-[#0a0d1d] border border-slate-900 rounded-2xl relative overflow-hidden shadow-2xl mb-6">
        <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/5 rounded-full blur-3xl pointer-events-none" />
        
        <div className="flex items-center gap-3 mb-3">
          <div className="p-2 bg-indigo-600/10 border border-indigo-500/20 text-indigo-400 rounded-xl">
            <Cpu size={20} />
          </div>
          <span className="text-[10px] font-mono uppercase tracking-widest text-indigo-400 bg-indigo-500/5 px-2 py-0.5 rounded-md border border-indigo-500/10">
            Agentic Core v1.0
          </span>
        </div>

        <h1 className="text-2xl font-black text-white tracking-tight">TalentIQ Core Optimizer</h1>
        <p className="text-slate-400 text-xs mt-1 max-w-xl">
          Deployment system active. Ready to ingest telemetry data, process resume parsing weights, and structure LLM prompt execution pipelines.
        </p>
      </div>

      {/* Interactive Testing Panel */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="p-6 bg-slate-950/40 border border-slate-900 rounded-xl hover:border-slate-800 transition-colors">
          <h3 className="text-sm font-bold text-white mb-1.5 flex items-center gap-1.5">
            <Sparkles size={14} className="text-amber-400" /> Vector Optimization
          </h3>
          <p className="text-xs text-slate-400 font-mono mb-4">status: WAITING_FOR_PAYLOAD</p>
          <div className="h-32 bg-slate-950 border border-slate-900 rounded-lg flex items-center justify-center text-[11px] text-slate-600 font-mono">
            [Drop optimization parameters here]
          </div>
        </div>

        <div className="p-6 bg-slate-950/40 border border-slate-900 rounded-xl hover:border-slate-800 transition-colors">
          <h3 className="text-sm font-bold text-white mb-1.5">System Analytics</h3>
          <p className="text-xs text-slate-400 font-mono mb-4">stream: ACTIVE</p>
          <div className="space-y-2.5">
            <div className="flex justify-between items-center text-xs font-mono">
              <span className="text-slate-500">Latency Gate:</span>
              <span className="text-emerald-400">0.04ms</span>
            </div>
            <div className="flex justify-between items-center text-xs font-mono">
              <span className="text-slate-500">FastAPI Port Connection:</span>
              <span className="text-blue-400">8000_LIVE</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}