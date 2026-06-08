"use client";
import React from "react";

export default function HRDashboard() {
  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div>
        <h1 className="text-xl font-bold tracking-tight text-white">Welcome Back, Recruiter</h1>
        <p className="text-xs text-slate-400 mt-1">LangGraph workflows process automatically based on your ingestion queues.</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          { title: "Active Screening Pools", metric: "12", sub: "3 Agent Pipelines active", color: "border-blue-500/20" },
          { title: "Total CVs Scanned", metric: "1,482", sub: "+242 processed this week", color: "border-purple-500/20" },
          { title: "Average Matching Match Rate", metric: "74.2%", sub: "Top fit criteria strictness", color: "border-teal-500/20" }
        ].map((item, idx) => (
          <div key={idx} className={`bg-[#0b0f19] border ${item.color} p-5 rounded-2xl shadow-sm`}>
            <p className="text-xs font-medium text-slate-400">{item.title}</p>
            <h3 className="text-2xl font-bold mt-2 text-white font-mono">{item.metric}</h3>
            <span className="text-[10px] text-slate-500 block mt-1">{item.sub}</span>
          </div>
        ))}
      </div>

      {/* Live Agent Activity Queue Placeholder */}
      <div className="bg-[#0b0f19] border border-slate-800 rounded-2xl p-6">
        <div className="flex items-center justify-between pb-4 border-b border-slate-800/60">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">Live LangGraph Agent Execution Queue</h3>
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
        </div>
        <div className="py-8 text-center text-xs text-slate-500">
          No CV batches running right now. Ready to process Python/FastAPI pipelines.
        </div>
      </div>
    </div>
  );
}