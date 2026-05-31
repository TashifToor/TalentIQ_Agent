"use client";
import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Brain, Send, User, Sparkles, Clock, ArrowLeft, MessageSquare, Trash2, Loader2, Info } from "lucide-react";
import { apiChat, apiChatHistory, apiMe, apiLogout, getToken } from "@/lib/api";

interface Msg {
  id?: number;
  role: "user" | "assistant";
  content: string;
  time?: string;
  streaming?: boolean;
}

function formatTime(iso: string) {
  try { return new Date(iso).toLocaleTimeString([], { hour:"2-digit", minute:"2-digit" }); }
  catch { return ""; }
}

function parseAnswer(text: string) {
  return text.split("\n").filter(l => l.trim()).map((line, i) => {
    if (line.startsWith("**") && line.endsWith("**"))
      return <p key={i} className="text-g-400 font-semibold text-sm">{line.slice(2,-2)}</p>;
    if (line.startsWith("- ") || line.startsWith("• "))
      return <div key={i} className="flex gap-2 text-sm text-slate-300 leading-relaxed"><span className="text-g-600 flex-shrink-0 mt-1">▸</span><span>{line.slice(2)}</span></div>;
    return <p key={i} className="text-sm text-slate-300 leading-relaxed">{line}</p>;
  });
}

export default function ChatPage() {
  const router = useRouter();
  const [userName, setUserName] = useState("");
  const [msgs, setMsgs]         = useState<Msg[]>([]);
  const [input, setInput]       = useState("");
  const [loading, setLoading]   = useState(false);
  const [histLoading, setHistLoading] = useState(true);
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!getToken()) { router.replace("/login"); return; }
    apiMe().then(u => setUserName(u.name)).catch(() => router.replace("/login"));
    apiChatHistory().then(hist => {
      setMsgs(hist.flatMap(h => [
        { id: h.id, role: "user" as const,      content: h.query,  time: formatTime(h.created_at) },
        { id: h.id, role: "assistant" as const, content: h.answer, time: formatTime(h.created_at) },
      ]));
    }).catch(() => {}).finally(() => setHistLoading(false));
  }, [router]);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [msgs, loading]);

  const send = async () => {
    const q = input.trim(); if (!q || loading) return;
    setInput("");
    const userMsg: Msg = { role:"user", content:q, time: new Date().toLocaleTimeString([], {hour:"2-digit",minute:"2-digit"}) };
    setMsgs(p => [...p, userMsg]);
    setLoading(true);
    try {
      const res = await apiChat(q);
      setMsgs(p => [...p, {
        role:"assistant", content:res.answer,
        time: formatTime(res.created_at), streaming:true
      }]);
      setTimeout(() => setMsgs(p => p.map((m,i) => i===p.length-1 ? {...m, streaming:false} : m)), Math.min(res.answer.length*12, 2500));
    } catch(e: unknown) {
      setMsgs(p => [...p, { role:"assistant", content:`Error: ${e instanceof Error ? e.message : "Request failed"}` }]);
    } finally { setLoading(false); inputRef.current?.focus(); }
  };

  const clearChat = () => setMsgs([]);

  const SUGGESTIONS = [
    "What are the candidate's key technical skills?",
    "Does the candidate have experience with Python and FastAPI?",
    "What projects has the candidate worked on?",
    "What is the candidate's experience level?",
    "Does the candidate have any AI/ML background?",
  ];

  return (
    <div className="flex flex-col h-screen bg-bg overflow-hidden">
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="orb orb-1 w-[500px] h-[400px] top-[-80px] right-[-60px]" style={{ filter:"blur(100px)" }} />
        <div className="orb orb-2 w-[400px] h-[400px] bottom-[-60px] left-[-60px]" style={{ filter:"blur(100px)" }} />
      </div>
      <div className="fixed inset-0 bg-grid pointer-events-none z-0 opacity-50" />

      {/* Header */}
      <header className="glass border-b border-border flex items-center px-5 py-3.5 gap-4 sticky top-0 z-50 flex-shrink-0">
        <Link href="/dashboard" className="flex items-center gap-1.5 text-slate-600 hover:text-g-400 transition-colors group">
          <ArrowLeft size={15} className="group-hover:-translate-x-0.5 transition-transform" />
          <span className="text-xs">Dashboard</span>
        </Link>
        <div className="h-4 w-px bg-border" />
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl glass-gold flex items-center justify-center">
            <MessageSquare size={14} className="text-g-400" />
          </div>
          <div>
            <p className="text-sm font-semibold text-white">CV Chat</p>
            <p className="text-[10px] font-mono text-slate-600">POST /chat · Ask questions about the uploaded CV</p>
          </div>
        </div>
        <div className="ml-auto flex items-center gap-3">
          {msgs.length > 0 && (
            <button onClick={clearChat} className="flex items-center gap-1.5 text-xs text-slate-600 hover:text-red-400 transition-colors px-2.5 py-1.5 rounded-lg hover:bg-red-500/5">
              <Trash2 size={12} /> Clear
            </button>
          )}
          <div className="flex items-center gap-2 px-2 py-1.5 rounded-lg glass cursor-default">
            <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-g-600 to-g-400 flex items-center justify-center text-[10px] font-bold text-black">
              {userName?.[0]?.toUpperCase() ?? "U"}
            </div>
            <span className="text-xs text-slate-400 hidden sm:block">{userName}</span>
          </div>
          <button onClick={() => { apiLogout(); router.push("/login"); }} className="text-slate-700 hover:text-red-400 transition-colors text-xs px-2 py-1.5 rounded-lg hover:bg-red-500/5">Logout</button>
        </div>
      </header>

      {/* Chat area */}
      <div className="flex-1 overflow-y-auto px-4 py-5 space-y-4 relative z-10">

        {/* Info banner */}
        <div className="flex items-start gap-2.5 glass-gold rounded-xl px-4 py-3 max-w-2xl mx-auto animate-fade-in">
          <Info size={13} className="text-g-400 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-slate-400 leading-relaxed">
            Ask anything about the <strong className="text-g-400">uploaded candidate CV</strong>. Make sure you've uploaded a CV on the Dashboard first via <code className="font-mono bg-border px-1 py-0.5 rounded text-[10px]">POST /Candidate/upload</code>.
          </p>
        </div>

        {/* History loading */}
        {histLoading && (
          <div className="flex justify-center py-8">
            <div className="flex items-center gap-2 text-slate-600 text-xs">
              <Loader2 size={14} className="animate-spin" /> Loading history…
            </div>
          </div>
        )}

        {/* Empty state */}
        {!histLoading && msgs.length === 0 && (
          <div className="flex flex-col items-center gap-6 py-10 animate-fade-up">
            <div className="w-16 h-16 rounded-2xl glass flex items-center justify-center">
              <Brain size={28} className="text-border" />
            </div>
            <div className="text-center">
              <p className="text-base font-semibold text-white">Ask about the CV</p>
              <p className="text-sm text-slate-600 mt-1">Start a conversation about the uploaded candidate profile</p>
            </div>
            <div className="flex flex-wrap gap-2 justify-center max-w-xl">
              {SUGGESTIONS.map(s => (
                <button key={s} onClick={() => { setInput(s); inputRef.current?.focus(); }}
                  className="text-xs text-slate-400 border border-border px-3 py-1.5 rounded-full hover:border-g-500/30 hover:text-g-400 hover:bg-g-500/5 transition-all">
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Messages */}
        {msgs.map((msg, i) => (
          <div key={i} className={`flex gap-3 max-w-3xl animate-fade-up ${msg.role==="user" ? "ml-auto flex-row-reverse" : ""}`}>
            <div className={`w-8 h-8 rounded-xl flex-shrink-0 flex items-center justify-center mt-0.5 ${
              msg.role==="user" ? "card border border-border" : "glass-gold"
            }`}>
              {msg.role==="user"
                ? <User size={14} className="text-slate-400" />
                : <Sparkles size={13} className="text-g-400" />}
            </div>
            <div className={`max-w-[78%] rounded-2xl px-4 py-3 space-y-1.5 ${
              msg.role==="user"
                ? "card border border-border rounded-tr-sm"
                : "glass border border-white/[0.04] rounded-tl-sm"
            }`}>
              {msg.role==="user"
                ? <p className="text-sm text-slate-200">{msg.content}</p>
                : <div className="space-y-1.5">
                    {parseAnswer(msg.content)}
                    {msg.streaming && <span className="inline-block w-1.5 h-4 bg-g-400 cursor-blink rounded-sm ml-0.5 align-middle" />}
                  </div>}
              {msg.time && (
                <div className="flex items-center gap-1 mt-1.5">
                  <Clock size={9} className="text-slate-700" />
                  <span className="text-[10px] text-slate-700 font-mono">{msg.time}</span>
                </div>
              )}
            </div>
          </div>
        ))}

        {/* Typing indicator */}
        {loading && (
          <div className="flex gap-3 max-w-3xl animate-fade-in">
            <div className="w-8 h-8 rounded-xl glass-gold flex-shrink-0 flex items-center justify-center mt-0.5">
              <Sparkles size={13} className="text-g-400" />
            </div>
            <div className="glass border border-white/[0.04] rounded-2xl rounded-tl-sm px-4 py-3 flex items-center gap-1.5">
              {[0,1,2].map(i=>(
                <div key={i} className="w-1.5 h-1.5 rounded-full bg-g-400/60 animate-bounce-dot" style={{animationDelay:`${i*0.18}s`}} />
              ))}
            </div>
          </div>
        )}

        <div ref={endRef} />
      </div>

      {/* Input */}
      <div className="border-t border-border glass px-4 py-3.5 flex-shrink-0 relative z-10">
        <div className="max-w-3xl mx-auto flex items-center gap-3">
          <div className={`flex-1 flex items-center gap-2.5 rounded-xl px-4 py-2.5 transition-all duration-200 ${
            input ? "glass-gold" : "card border border-border focus-within:border-g-500/30"
          }`}>
            <MessageSquare size={13} className="text-slate-700 flex-shrink-0" />
            <input
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key==="Enter" && !e.shiftKey && send()}
              placeholder="Ask about the candidate's CV…"
              disabled={loading}
              className="flex-1 bg-transparent text-sm text-slate-200 placeholder-slate-700 focus:outline-none min-w-0"
            />
          </div>
          <button onClick={send} disabled={!input.trim() || loading}
            className="btn-gold w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 disabled:opacity-40">
            {loading ? <Loader2 size={15} className="animate-spin text-black" /> : <Send size={15} className="text-black" />}
          </button>
        </div>
        <p className="text-[10px] font-mono text-slate-800 text-center mt-2">
          Powered by FAISS semantic search · LLaMA 3.3 70B · POST /chat
        </p>
      </div>
    </div>
  );
}
