"use client";
import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Send, User, Sparkles, Clock, ArrowLeft,
  MessageSquare, Trash2, Loader2, Shield, Database, BookOpen,
} from "lucide-react";
import { apiMe, apiLogout, getToken } from "@/lib/api";

interface Msg {
  role: "user" | "assistant";
  content: string;
  time?: string;
  streaming?: boolean;
}

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

function getToken2(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("talentiq_token");
}

// Separate API call for HR policy chat — you will wire your own backend here
async function apiHRChat(message: string): Promise<{ answer: string; created_at: string }> {
  const token = getToken2();
  const res = await fetch(`${BASE}/hr/chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ message }),
  });
  if (!res.ok) {
    let msg = `HTTP ${res.status}`;
    try { const e = await res.json(); msg = e.detail ?? msg; } catch {}
    throw new Error(msg);
  }
  return res.json();
}

function parseAnswer(text: string) {
  return text.split("\n").filter(l => l.trim()).map((line, i) => {
    if (line.startsWith("**") && line.endsWith("**"))
      return (
        <p key={i} className="text-g-400 font-semibold text-sm mt-2 first:mt-0">
          {line.slice(2, -2)}
        </p>
      );
    if (line.startsWith("- ") || line.startsWith("• "))
      return (
        <div key={i} className="flex gap-2 text-sm text-slate-300 leading-relaxed">
          <span className="text-g-600 flex-shrink-0 mt-0.5">▸</span>
          <span>{line.slice(2)}</span>
        </div>
      );
    return <p key={i} className="text-sm text-slate-300 leading-relaxed">{line}</p>;
  });
}

const QUICK_QUESTIONS = [
  "What is our employee leave policy?",
  "Explain the onboarding process for new hires.",
  "What are the performance review guidelines?",
  "What is the compensation and benefits structure?",
  "How does the disciplinary process work?",
  "What are the training and development opportunities?",
];

export default function HRPolicyPage() {
  const router = useRouter();
  const [userName, setUserName] = useState("");
  const [msgs, setMsgs]         = useState<Msg[]>([]);
  const [input, setInput]       = useState("");
  const [loading, setLoading]   = useState(false);
  const endRef  = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!getToken()) { router.replace("/login"); return; }
    apiMe().then(u => setUserName(u.name)).catch(() => router.replace("/login"));
  }, [router]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [msgs, loading]);

  const send = async (question?: string) => {
    const q = (question ?? input).trim();
    if (!q || loading) return;
    setInput("");

    const now = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    setMsgs(p => [...p, { role: "user", content: q, time: now }]);
    setLoading(true);

    try {
      const res = await apiHRChat(q);
      const botMsg: Msg = {
        role: "assistant",
        content: res.answer,
        time: new Date(res.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        streaming: true,
      };
      setMsgs(p => [...p, botMsg]);
      setTimeout(
        () => setMsgs(p => p.map((m, i) => i === p.length - 1 ? { ...m, streaming: false } : m)),
        Math.min(res.answer.length * 12, 2500)
      );
    } catch (e: unknown) {
      setMsgs(p => [...p, {
        role: "assistant",
        content: `Error: ${e instanceof Error ? e.message : "Something went wrong. Make sure HR backend is running."}`,
      }]);
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  };

  return (
    <div className="flex flex-col h-screen bg-bg overflow-hidden">
      {/* Background */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="orb orb-1 w-[500px] h-[400px] -top-20 -right-20" style={{ filter: "blur(100px)" }} />
        <div className="orb orb-2 w-[400px] h-[400px] -bottom-20 -left-20" style={{ filter: "blur(100px)" }} />
      </div>
      <div className="fixed inset-0 bg-grid pointer-events-none z-0 opacity-40" />

      {/* ── Header ── */}
      <header className="glass border-b border-border flex items-center px-5 py-3 gap-4 sticky top-0 z-50 flex-shrink-0">
        <Link href="/dashboard"
          className="flex items-center gap-1.5 text-slate-600 hover:text-g-400 transition-colors group">
          <ArrowLeft size={15} className="group-hover:-translate-x-0.5 transition-transform" />
          <span className="text-xs">Dashboard</span>
        </Link>

        <div className="h-4 w-px bg-border" />

        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl glass-gold flex items-center justify-center flex-shrink-0">
            <Shield size={14} className="text-g-400" />
          </div>
          <div>
            <p className="text-sm font-semibold text-white leading-none">HR Policy Assistant</p>
            <p className="text-[10px] font-mono text-slate-600 mt-0.5">
              POST /hr/chat · Company Policy Corpus
            </p>
          </div>
        </div>

        {/* Live badge */}
        <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-full glass-gold ml-2">
          <div className="relative flex-shrink-0">
            <div className="w-1.5 h-1.5 rounded-full bg-green-400" />
            <div className="absolute inset-0 rounded-full bg-green-400 animate-pulse"
              style={{ animationDuration: "2s" }} />
          </div>
          <span className="text-[11px] font-mono text-green-400">RAG Active</span>
        </div>

        <div className="hidden md:flex items-center gap-1.5 text-[10px] font-mono text-slate-700 ml-1">
          <Database size={10} />
          <span>HR Policy corpus</span>
        </div>

        <div className="ml-auto flex items-center gap-2">
          {msgs.length > 0 && (
            <button onClick={() => setMsgs([])}
              className="flex items-center gap-1.5 text-xs text-slate-600 hover:text-red-400 transition-colors px-2.5 py-1.5 rounded-lg hover:bg-red-500/5">
              <Trash2 size={12} />
              <span className="hidden sm:inline">Clear</span>
            </button>
          )}
          <div className="flex items-center gap-2 px-2 py-1.5 rounded-lg glass cursor-default">
            <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-g-600 to-g-400 flex items-center justify-center text-[10px] font-bold text-black">
              {userName?.[0]?.toUpperCase() ?? "U"}
            </div>
            <span className="text-xs text-slate-400 hidden sm:block">{userName}</span>
          </div>
          <button onClick={() => { apiLogout(); router.push("/login"); }}
            className="text-xs text-slate-700 hover:text-red-400 transition-colors px-2 py-1.5 rounded-lg hover:bg-red-500/5">
            Logout
          </button>
        </div>
      </header>

      {/* ── Body: sidebar + chat ── */}
      <div className="flex flex-1 overflow-hidden relative z-10">

        {/* ── Left quick questions sidebar ── */}
        <div className="hidden md:flex flex-col w-64 flex-shrink-0 border-r border-border p-4 gap-3 overflow-y-auto"
          style={{ background: "rgba(13,13,26,0.75)" }}>
          <div className="flex items-center gap-2 mb-1">
            <BookOpen size={12} className="text-g-500" />
            <span className="text-[10px] font-mono font-semibold text-slate-500 uppercase tracking-widest">
              Quick Questions
            </span>
          </div>
          {QUICK_QUESTIONS.map((q, i) => (
            <button key={i} onClick={() => send(q)} disabled={loading}
              className="text-left flex items-start gap-2.5 px-3 py-2.5 rounded-xl card border border-border
                hover:border-g-500/25 hover:bg-g-500/4 disabled:opacity-40 transition-all duration-200 group">
              <div className="w-5 h-5 rounded-md glass-gold flex items-center justify-center flex-shrink-0 mt-0.5">
                <span className="text-[10px] font-mono font-bold text-g-400">{i + 1}</span>
              </div>
              <span className="text-xs text-slate-500 group-hover:text-slate-300 transition-colors leading-relaxed">
                {q}
              </span>
            </button>
          ))}

          {/* Corpus info box */}
          <div className="mt-auto pt-4 border-t border-border">
            <div className="card rounded-xl p-3 space-y-2">
              <div className="flex items-center gap-1.5">
                <Database size={11} className="text-g-500" />
                <span className="text-[10px] font-mono text-slate-500">Policy Documents</span>
              </div>
              {[
                "Recruitment & Hiring",
                "Employee Handbook",
                "Performance Management",
                "Compensation Guide",
                "Training & Development",
                "Disciplinary Policy",
                "Onboarding Guide",
                "DEI Policy",
              ].map(doc => (
                <div key={doc} className="flex items-center gap-1.5">
                  <div className="w-1 h-1 rounded-full bg-g-600 flex-shrink-0" />
                  <span className="text-[10px] text-slate-700">{doc}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── Chat area ── */}
        <div className="flex flex-col flex-1 min-w-0">
          <div className="flex-1 overflow-y-auto px-4 py-5 space-y-4">

            {/* Empty state */}
            {msgs.length === 0 && (
              <div className="flex flex-col items-center gap-5 py-10 animate-fade-up max-w-lg mx-auto text-center">
                <div className="relative">
                  <div className="w-16 h-16 rounded-2xl glass flex items-center justify-center">
                    <Shield size={26} className="text-g-500/40" />
                  </div>
                  <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-lg glass-gold flex items-center justify-center border border-g-500/30">
                    <Sparkles size={11} className="text-g-400" />
                  </div>
                </div>
                <div>
                  <p className="text-base font-semibold text-white">HR Policy Assistant</p>
                  <p className="text-sm text-slate-600 mt-1">
                    Ask me anything about company policies, benefits, onboarding, and more.
                  </p>
                </div>
                {/* Mobile quick questions */}
                <div className="flex flex-wrap gap-2 justify-center md:hidden">
                  {QUICK_QUESTIONS.slice(0, 4).map(q => (
                    <button key={q} onClick={() => send(q)}
                      className="text-xs text-slate-400 border border-border px-3 py-1.5 rounded-full
                        hover:border-g-500/30 hover:text-g-400 hover:bg-g-500/5 transition-all">
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Messages */}
            {msgs.map((msg, i) => (
              <div key={i}
                className={`flex gap-3 max-w-3xl animate-fade-up ${msg.role === "user" ? "ml-auto flex-row-reverse" : ""}`}>
                <div className={`w-8 h-8 rounded-xl flex-shrink-0 flex items-center justify-center mt-0.5 ${
                  msg.role === "user" ? "card border border-border" : "glass-gold"
                }`}>
                  {msg.role === "user"
                    ? <User size={14} className="text-slate-400" />
                    : <Sparkles size={13} className="text-g-400" />}
                </div>
                <div className={`max-w-[78%] rounded-2xl px-4 py-3 space-y-1.5 ${
                  msg.role === "user"
                    ? "card border border-border rounded-tr-sm"
                    : "glass border border-white/[0.04] rounded-tl-sm"
                }`}>
                  {msg.role === "user"
                    ? <p className="text-sm text-slate-200">{msg.content}</p>
                    : <div className="space-y-1.5">
                        {parseAnswer(msg.content)}
                        {msg.streaming && (
                          <span className="inline-block w-1.5 h-4 bg-g-400 cursor-blink rounded-sm ml-0.5 align-middle" />
                        )}
                      </div>
                  }
                  {msg.time && (
                    <div className="flex items-center gap-1 mt-1.5">
                      <Clock size={9} className="text-slate-700" />
                      <span className="text-[10px] text-slate-700 font-mono">{msg.time}</span>
                    </div>
                  )}
                </div>
              </div>
            ))}

            {/* Typing */}
            {loading && (
              <div className="flex gap-3 max-w-3xl animate-fade-in">
                <div className="w-8 h-8 rounded-xl glass-gold flex-shrink-0 flex items-center justify-center mt-0.5">
                  <Sparkles size={13} className="text-g-400" />
                </div>
                <div className="glass border border-white/[0.04] rounded-2xl rounded-tl-sm px-4 py-3 flex items-center gap-1.5">
                  {[0, 1, 2].map(j => (
                    <div key={j} className="w-1.5 h-1.5 rounded-full bg-g-400/60 animate-bounce-dot"
                      style={{ animationDelay: `${j * 0.18}s` }} />
                  ))}
                </div>
              </div>
            )}
            <div ref={endRef} />
          </div>

          {/* ── Input bar ── */}
          <div className="border-t border-border glass px-4 py-3.5 flex-shrink-0">
            <div className="max-w-3xl mx-auto flex items-center gap-3">
              <div className={`flex-1 flex items-center gap-2.5 rounded-xl px-4 py-2.5 transition-all duration-200 ${
                input ? "glass-gold" : "card border border-border focus-within:border-g-500/30"
              }`}>
                <MessageSquare size={13} className="text-slate-700 flex-shrink-0" />
                <input
                  ref={inputRef}
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
                  placeholder="Ask about HR policies…"
                  disabled={loading}
                  className="flex-1 bg-transparent text-sm text-slate-200 placeholder-slate-700 focus:outline-none min-w-0"
                />
              </div>
              <button onClick={() => send()} disabled={!input.trim() || loading}
                className="btn-gold w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 disabled:opacity-40">
                {loading
                  ? <Loader2 size={15} className="animate-spin text-black" />
                  : <Send size={15} className="text-black" />}
              </button>
            </div>
            <p className="text-[10px] font-mono text-slate-800 text-center mt-2">
              POST /hr/chat · RAG · Company Policy Corpus
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
