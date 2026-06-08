"use client";
import React from "react";

export default function CandidateDashboard() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold tracking-tight text-white">Optimize Your Professional CV</h1>
        <p className="text-xs text-slate-400 mt-1">Upload your Harvard-style resume to compare against real AI agent models.</p>
      </div>

      {/* Dropzone Placeholder */}
      <div className="border-2 border-dashed border-slate-800 hover:border-teal-500/40 bg-[#0d121f]/50 transition-all rounded-2xl p-12 text-center group cursor-pointer">
        <div className="w-10 h-10 bg-slate-900 rounded-xl flex items-center justify-center mx-auto border border-slate-800 group-hover:border-teal-500/30">
          <span className="text-sm text-slate-400 group-hover:text-teal-400">📁</span>
        </div>
        <p className="text-xs font-medium text-slate-300 mt-4">Drag and drop your resume (PDF only)</p>
        <span className="text-[10px] text-slate-500 mt-1 block font-mono">Consumes 1 Scan Credit per operation</span>
      </div>
    </div>
  );
}