"use client";
import React from "react";
import Link from "next/link";

export default function HRDashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen bg-[#060814] text-slate-100 font-sans">
      {/* Recruiter Sidebar */}
      <aside className="w-64 bg-[#0b0f19] border-r border-slate-800 flex flex-col justify-between p-5">
        <div>
          <div className="flex items-center gap-2 mb-8 px-2">
            <div className="w-6 h-6 bg-blue-600 rounded-lg flex items-center justify-center font-bold text-xs text-white">IQ</div>
            <span className="font-bold text-sm tracking-wide bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent">TalentIQ Enterprise</span>
          </div>
          
          <nav className="space-y-1">
            <Link href="/hr/dashboard" className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-blue-600/10 text-blue-400 border border-blue-500/20 text-xs font-medium transition-all">
              <span>📊</span> Overview Dashboard
            </Link>
            <a href="#" className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-slate-400 hover:text-slate-200 hover:bg-slate-900 text-xs font-medium transition-all">
              <span>🤖</span> Agentic Screening
            </a>
            <a href="#" className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-slate-400 hover:text-slate-200 hover:bg-slate-900 text-xs font-medium transition-all">
              <span>📁</span> Bulk CV Batches
            </a>
            <a href="#" className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-slate-400 hover:text-slate-200 hover:bg-slate-900 text-xs font-medium transition-all">
              <span>⚙️</span> Workspace Settings
            </a>
          </nav>
        </div>
        
        <div className="p-3 bg-slate-950 border border-slate-800/60 rounded-xl flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-slate-800 rounded-full flex items-center justify-center text-xs font-semibold text-slate-300">HR</div>
            <div>
              <p className="text-[10px] font-medium text-slate-300">M1 Recruiter</p>
              <span className="text-[9px] text-emerald-400 font-mono">Enterprise</span>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Container */}
      <main className="flex-1 flex flex-col overflow-hidden">
        <header className="h-16 border-b border-slate-800 bg-[#0b0f19]/40 backdrop-blur-md flex items-center justify-between px-8">
          <h2 className="text-sm font-semibold text-slate-200">Workspace Control</h2>
          <div className="text-xs text-slate-400 font-mono bg-slate-900 px-3 py-1.5 rounded-lg border border-slate-800">API Status: Online</div>
        </header>
        <div className="flex-1 overflow-y-auto p-8">{children}</div>
      </main>
    </div>
  );
}