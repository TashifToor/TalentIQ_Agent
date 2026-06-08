"use client";
import React from "react";
import Link from "next/link";

export default function CandidateDashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen bg-[#070a12] text-slate-100 font-sans">
      {/* Candidate Sidebar */}
      <aside className="w-64 bg-[#0d121f] border-r border-slate-800/80 flex flex-col justify-between p-5">
        <div>
          <div className="flex items-center gap-2 mb-8 px-2">
            <div className="w-6 h-6 bg-teal-500 rounded-lg flex items-center justify-center font-bold text-xs text-slate-950">IQ</div>
            <span className="font-bold text-sm tracking-wide bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent">TalentIQ Sandbox</span>
          </div>
          
          <nav className="space-y-1">
            <Link href="/candidate/dashboard" className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-teal-500/10 text-teal-400 border border-teal-500/20 text-xs font-medium transition-all">
              <span>🚀</span> ATS Scoring Engine
            </Link>
            <a href="#" className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-slate-400 hover:text-slate-200 hover:bg-slate-900 text-xs font-medium transition-all">
              <span>📝</span> Resume Enhancer
            </a>
            <a href="#" className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-slate-400 hover:text-slate-200 hover:bg-slate-900 text-xs font-medium transition-all">
              <span>🎟️</span> Buy Scan Credits
            </a>
          </nav>
        </div>
        
        <div className="p-3 bg-slate-950 border border-slate-800/60 rounded-xl flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-slate-800 rounded-full flex items-center justify-center text-xs font-semibold text-slate-300">C</div>
            <div>
              <p className="text-[10px] font-medium text-slate-300">Tashif Munir</p>
              <span className="text-[9px] text-teal-400 font-mono">15 Scan Credits Left</span>
            </div>
          </div>
        </div>
      </aside>

      {/* Main View */}
      <main className="flex-1 flex flex-col overflow-hidden">
        <header className="h-16 border-b border-slate-800 bg-[#0d121f]/40 backdrop-blur-md flex items-center justify-between px-8">
          <h2 className="text-sm font-semibold text-slate-200">Candidate Sandbox Engine</h2>
        </header>
        <div className="flex-1 overflow-y-auto p-8">{children}</div>
      </main>
    </div>
  );
}