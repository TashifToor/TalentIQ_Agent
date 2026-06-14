"use client";
import React, { useState } from "react";
import { 
  Brain, FileText, Send, UploadCloud, 
  Bot, ShieldCheck, Trash2, Cpu, Sparkles, UserCheck 
} from "lucide-react";

interface Message {
  sender: "user" | "ai";
  text: string;
  time: string;
}

export default function HRPremiumDashboard() {
  // Mock State for Credits and Management
  const [scanCredits, setScanCredits] = useState(250);
  const [uploadedPolicies, setUploadedPolicies] = useState<string[]>([
    "Leave_Policy_2026.pdf",
    "Employee_Medical_Benefits.pdf"
  ]);
  
  const [chatInput, setChatInput] = useState("");
  const [chatHistory, setChatHistory] = useState<Message[]>([
    { sender: "ai", text: "Systems online. HR Knowledge Vault initialized. Ask me anything about your uploaded policy documents.", time: "11:14 PM" }
  ]);

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim()) return;

    const userMsg: Message = { sender: "user", text: chatInput, time: "Just now" };
    setChatHistory(prev => [...prev, userMsg]);
    setChatInput("");

    // Mocking AI Reasoning engine response delay
    setTimeout(() => {
      const aiMsg: Message = {
        sender: "ai",
        text: `Based on your uploaded document '${uploadedPolicies[0] || "Policies"}', standard paternity leaves are capped at 14 business days with full basic allowance payload allocation. For extensions, approval from cluster head is mandatory.`,
        time: "Just now"
      };
      setChatHistory(prev => [...prev, aiMsg]);
    }, 1000);
  };

  return (
    <div className="min-h-screen bg-[#060814] text-slate-200 p-6 font-sans">
      
      {/* 👑 TOP ENTERPRISE HEADER */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between border-b border-slate-800/60 pb-6 mb-8 gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20 text-[10px] font-mono font-bold tracking-wider uppercase">
              HR Admin Suite Tier
            </span>
          </div>
          <h1 className="text-2xl font-extrabold text-white tracking-tight mt-1">Enterprise Command Console</h1>
          <p className="text-xs text-slate-400">Cross-examine candidates and deploy contextual HR Knowledge Base RAG Agents from a single workspace.</p>
        </div>

        {/* 💳 PREMIUM CREDITS ACCUMULATOR */}
        <div className="bg-gradient-to-br from-[#0e1326] to-[#0b0f19] border border-blue-500/20 rounded-2xl p-4 flex items-center gap-4 shadow-xl min-w-[280px]">
          <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center border border-blue-500/30 text-blue-400">
            <Cpu size={18} className="animate-pulse" />
          </div>
          <div className="flex-1">
            <p className="text-[10px] font-mono text-slate-400 uppercase tracking-wider">Enterprise Ingestion Units</p>
            <h2 className="text-xl font-black text-white font-mono mt-0.5">{scanCredits} <span className="text-xs font-normal text-slate-500">Scans Remaining</span></h2>
          </div>
        </div>
      </div>

      {/* 🔄 TWO-GRID CORE AGENT PARADIGM */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">
        
        {/* LEFT COMPONENT: CANDIDATE FORENSIC OVERVIEW (40% Width) */}
        <div className="xl:col-span-5 space-y-6">
          <div className="bg-[#0b0f19] border border-slate-900 rounded-2xl p-6 shadow-xl">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-4 flex items-center gap-2">
              <UserCheck size={14} className="text-blue-400" /> Active Candidate Evaluation
            </h3>

            {/* Quick Diagnostic Mini-View */}
            <div className="bg-slate-950/60 border border-slate-900 rounded-xl p-4 space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-xs text-slate-400">Target Match Score:</span>
                <span className="text-sm font-mono font-black text-emerald-400">94% Match</span>
              </div>
              <div className="h-1.5 w-full bg-slate-900 rounded-full overflow-hidden">
                <div className="h-full bg-emerald-400 rounded-full" style={{ width: "94%" }} />
              </div>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                Candidate pipeline shows optimum alignment with Next.js & Python environments. Core experience baseline checked and verified.
              </p>
            </div>

            {/* Quick Upload Dropzone for candidate checks */}
            <div className="mt-4 border border-dashed border-slate-800 bg-slate-950/30 rounded-xl p-4 text-center">
              <p className="text-xs text-slate-300 font-medium">Verify another single candidate profile</p>
              <span className="text-[10px] text-slate-500 block mt-0.5 font-mono">Drop single PDF here to spend 1 Credit</span>
            </div>
          </div>
        </div>

        {/* RIGHT COMPONENT: VIP HR POLICY CHATBOT WITH RAG KNOWLEDGE VAULT (70% Width) */}
        <div className="xl:col-span-7 grid grid-cols-1 lg:grid-cols-12 border border-slate-900 bg-[#0b0f19] rounded-2xl overflow-hidden shadow-2xl min-h-[580px]">
          
          {/* VAULT CONTROL PANEL (Left sub-panel of chatbot) */}
          <div className="lg:col-span-4 bg-slate-950/40 p-4 border-r border-slate-900/80 flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2 text-blue-400 mb-4">
                <ShieldCheck size={16} />
                <span className="text-[11px] font-bold uppercase font-mono tracking-wider text-slate-300">Knowledge Vault</span>
              </div>

              {/* RAG File Uploader Dropzone */}
              <div className="border border-dashed border-slate-800 hover:border-blue-500/30 bg-slate-950/60 p-4 rounded-xl text-center cursor-pointer transition-all group mb-4">
                <UploadCloud size={20} className="mx-auto text-slate-600 group-hover:text-blue-400 transition-colors" />
                <span className="text-[10px] font-bold text-slate-400 block mt-1.5">Upload Corporate Policy</span>
                <span className="text-[8px] text-slate-600 font-mono block">PDF, TXT, DOCX</span>
              </div>

              {/* List of currently injected policy models */}
              <div className="space-y-2">
                <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest block px-1">Active Embeddings</span>
                {uploadedPolicies.map((filename, i) => (
                  <div key={i} className="flex items-center justify-between bg-slate-900/60 border border-slate-800 px-2.5 py-1.5 rounded-lg text-[10px] font-mono text-slate-300">
                    <span className="truncate max-w-[110px]">{filename}</span>
                    <button 
                      onClick={() => setUploadedPolicies(prev => prev.filter((_, idx) => idx !== i))}
                      className="text-slate-600 hover:text-red-400 transition-colors"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div className="text-[9px] text-slate-600 font-mono mt-4 pt-2 border-t border-slate-900">
              Stateful token chunking active. Context window up to 32k.
            </div>
          </div>

          {/* CHAT CONTAINER FEED (Right sub-panel of chatbot) */}
          <div className="lg:col-span-8 flex flex-col h-full justify-between bg-[#0b0f19]">
            
            {/* Chatbot Header Status */}
            <div className="p-4 border-b border-slate-900/80 flex items-center gap-2 bg-slate-950/20">
              <Bot size={18} className="text-blue-400" />
              <div>
                <h4 className="text-xs font-bold text-white leading-tight">HR Policy Context Agent</h4>
                <span className="text-[9px] text-emerald-400 font-mono flex items-center gap-1">
                  <span className="w-1 h-1 rounded-full bg-emerald-400" /> Grounded via RAG Vectors
                </span>
              </div>
            </div>

            {/* Live Message Iteration Scroll area */}
            <div className="flex-1 p-4 overflow-y-auto space-y-4 min-h-[380px] max-h-[400px]">
              {chatHistory.map((msg, idx) => (
                <div key={idx} className={`flex flex-col ${msg.sender === "user" ? "items-end" : "items-start"}`}>
                  <div className={`max-w-[85%] rounded-xl px-3 py-2.5 text-xs leading-relaxed shadow-md ${
                    msg.sender === "user" 
                      ? "bg-blue-600 text-white rounded-tr-none" 
                      : "bg-slate-950/80 border border-slate-900 text-slate-300 rounded-tl-none font-sans"
                  }`}>
                    {msg.text}
                  </div>
                  <span className="text-[8px] font-mono text-slate-600 mt-1 px-1">{msg.time}</span>
                </div>
              ))}
            </div>

            {/* Input Action Form Submitter */}
            <form onSubmit={handleSendMessage} className="p-3 border-t border-slate-900/80 bg-slate-950/20 flex gap-2">
              <input 
                type="text" 
                value={chatInput}
                onChange={e => setChatInput(e.target.value)}
                placeholder="Ask about leave limits, insurance caps, or offboarding steps..."
                className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3 text-xs text-white focus:outline-none focus:border-blue-500/50 transition-all placeholder:text-slate-600"
              />
              <button type="submit" className="w-10 h-10 bg-blue-600 hover:bg-blue-500 text-white rounded-xl flex items-center justify-center shadow-lg shadow-blue-900/20 transition-colors">
                <Send size={14} />
              </button>
            </form>

          </div>

        </div>

      </div>

    </div>
  );
}