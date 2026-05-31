"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Brain, Zap, Upload, FileCheck, X, CheckCircle, AlertTriangle,
  BarChart3, Loader2, Activity, ChevronDown, ChevronUp,
  LogOut, Bell, Settings, FileText, XCircle,
  TrendingUp, Target, MessageSquare, Shield,
} from "lucide-react";
import { apiMe, apiUploadCV, apiScreen, apiLogout, getToken, type ScreeningResult } from "@/lib/api";

type Step = "idle" | "uploading" | "screening" | "done" | "error";

/* ── Score Gauge ──────────────────────────────────────────────── */
function ScoreGauge({ score }: { score: number }) {
  const [live, setLive] = useState(false);
  useEffect(() => { const t = setTimeout(() => setLive(true), 150); return () => clearTimeout(t); }, []);

  const r = 52, circ = 2 * Math.PI * r, arc = circ * 0.75;
  const fill = live ? arc - (score / 100) * arc : arc;
  const color = score >= 75 ? "#22c55e" : score >= 55 ? "#F59E0B" : "#ef4444";
  const label = score >= 75 ? "Excellent Match" : score >= 55 ? "Good Match" : "Poor Match";
  const badgeCls = score >= 75
    ? "bg-green-500/10 border-green-500/25 text-green-400"
    : score >= 55
    ? "bg-g-500/10 border-g-500/25 text-g-400"
    : "bg-red-500/10 border-red-500/25 text-red-400";

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative w-40 h-40">
        <svg viewBox="0 0 144 144" className="w-full h-full">
          <defs>
            <linearGradient id="sg" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor={score >= 75 ? "#16a34a" : score >= 55 ? "#D97706" : "#dc2626"} />
              <stop offset="100%" stopColor={color} />
            </linearGradient>
            <filter id="sg-glow">
              <feGaussianBlur stdDeviation="3" result="b" />
              <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>
          </defs>
          {/* Track */}
          <circle cx="72" cy="72" r={r} fill="none" stroke="#222236" strokeWidth="9"
            strokeDasharray={`${arc} ${circ - arc}`} strokeDashoffset={circ * 0.375}
            transform="rotate(135 72 72)" strokeLinecap="round" />
          {/* Fill */}
          <circle cx="72" cy="72" r={r} fill="none" stroke="url(#sg)" strokeWidth="9"
            strokeDasharray={`${arc} ${circ - arc}`}
            strokeDashoffset={`${circ * 0.375 + fill}`}
            transform="rotate(135 72 72)" strokeLinecap="round" filter="url(#sg-glow)"
            style={{ transition: "stroke-dashoffset 1.4s cubic-bezier(0.34,1.56,0.64,1)" }} />
          <circle cx="72" cy="72" r="28" fill="#12121F" />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-4xl font-bold font-mono" style={{ color }}>{score}</span>
          <span className="text-[10px] text-slate-600 font-mono">/100</span>
        </div>
      </div>
      <span className={`text-xs font-medium px-3 py-1 rounded-full border ${badgeCls}`}>{label}</span>
    </div>
  );
}

/* ── Analysis Accordion ───────────────────────────────────────── */
function AnalysisAccordion({ text }: { text: string }) {
  const [open, setOpen] = useState(true);
  const lines = text.split(/\n+/).filter(l => l.trim());
  return (
    <div className="card rounded-2xl overflow-hidden">
      <button onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-3 px-5 py-4 text-left hover:bg-white/[0.01] transition-colors">
        <div className="w-7 h-7 rounded-lg glass-gold flex items-center justify-center flex-shrink-0">
          <Brain size={13} className="text-g-400" />
        </div>
        <span className="text-sm font-semibold text-white flex-1">Deep AI Analysis</span>
        <span className="text-[10px] font-mono text-slate-600 mr-2">LLaMA 3.3 70B · LangGraph</span>
        {open ? <ChevronUp size={14} className="text-slate-600" /> : <ChevronDown size={14} className="text-slate-600" />}
      </button>
      {open && (
        <div className="px-5 pb-5 border-t border-border/60 pt-4 space-y-2">
          {lines.map((line, i) => {
            const isBold = line.startsWith("**") || line.startsWith("##") || /^[A-Z\s]{4,}:/.test(line);
            const clean = line.replace(/^#+\s*/, "").replace(/\*\*/g, "");
            return isBold ? (
              <p key={i} className="text-g-400 font-semibold text-sm mt-3 first:mt-0">{clean}</p>
            ) : line.startsWith("- ") || line.startsWith("• ") ? (
              <div key={i} className="flex gap-2.5 text-xs text-slate-400 leading-relaxed">
                <span className="text-g-600 flex-shrink-0 mt-0.5">▸</span>
                <span>{line.slice(2)}</span>
              </div>
            ) : (
              <p key={i} className="text-xs text-slate-400 leading-relaxed">{line}</p>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ── Skill Pill ───────────────────────────────────────────────── */
function Pill({ label, type }: { label: string; type: "match" | "gap" }) {
  return (
    <span className={`pill text-xs px-2.5 py-1 rounded-lg font-medium flex items-center gap-1.5 cursor-default ${
      type === "match"
        ? "bg-green-500/8 border border-green-500/20 text-green-400 hover:shadow-[0_3px_12px_rgba(34,197,94,0.2)]"
        : "bg-g-500/8 border border-g-500/20 text-g-400 hover:shadow-[0_3px_12px_rgba(245,158,11,0.2)]"
    }`}>
      {type === "match"
        ? <CheckCircle size={10} className="text-green-400" />
        : <AlertTriangle size={10} className="text-g-400" />}
      {label}
    </span>
  );
}

/* ── TopBar ───────────────────────────────────────────────────── */
function TopBar({ user, onLogout }: { user: string; onLogout: () => void }) {
  return (
    <header className="h-14 border-b border-border glass flex items-center px-5 gap-4 sticky top-0 z-50 flex-shrink-0">
      <div className="flex items-center gap-2.5">
        <div className="w-8 h-8 rounded-xl glass-gold flex items-center justify-center animate-glow">
          <Brain size={15} className="text-g-400" />
        </div>
        <span className="text-sm font-bold text-white">TalentIQ</span>
        <span className="text-[10px] font-mono text-g-500/50 border border-g-500/15 px-1.5 py-0.5 rounded bg-g-500/5">v2.0</span>
      </div>

      <div className="h-4 w-px bg-border mx-1" />

      <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-full glass-gold">
        <div className="relative flex-shrink-0">
          <div className="w-1.5 h-1.5 rounded-full bg-green-400" />
          <div className="absolute inset-0 rounded-full bg-green-400 animate-pulse" style={{ animationDuration: "2s" }} />
        </div>
        <span className="text-[11px] font-mono text-green-400">LLaMA 3.3 70B · Active</span>
      </div>

      {/* CV Chat link */}
      {/* Nav links */}
<Link href="/chat"
  className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg btn-ghost text-xs transition-all">
  <MessageSquare size={13} />
  CV Chat
</Link>
<Link href="/hr-policy"
  className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg btn-ghost text-xs transition-all">
  <Shield size={13} />
  HR Policies
</Link>

      <div className="ml-auto flex items-center gap-2.5">
        <button className="relative text-slate-600 hover:text-g-400 transition-colors p-2 rounded-lg hover:bg-g-500/5">
          <Bell size={15} />
          <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-red-500" />
        </button>
        <button className="text-slate-600 hover:text-slate-300 transition-colors p-2 rounded-lg hover:bg-white/5">
          <Settings size={15} />
        </button>
        <div className="h-4 w-px bg-border" />
        <div className="flex items-center gap-2 px-2 py-1.5 rounded-lg glass cursor-default">
          <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-g-600 to-g-400 flex items-center justify-center text-[10px] font-bold text-black">
            {user ? user[0].toUpperCase() : "U"}
          </div>
          <span className="text-xs text-slate-400 hidden sm:block truncate max-w-[100px]">{user}</span>
        </div>
        <button onClick={onLogout} title="Logout"
          className="text-slate-700 hover:text-red-400 transition-colors p-2 rounded-lg hover:bg-red-500/5">
          <LogOut size={14} />
        </button>
      </div>
    </header>
  );
}

/* ── Main Dashboard ───────────────────────────────────────────── */
export default function DashboardPage() {
  const router = useRouter();
  const [userName, setUserName]   = useState("");
  const [jd, setJd]               = useState("We are hiring a Senior Backend Engineer.\n\nRequirements:\n• 5+ years Python (FastAPI / Django)\n• LangChain, RAG pipelines, FAISS\n• PostgreSQL, Redis, Docker\n• LLM integration and Agentic systems\n• LangGraph (bonus)");
  const [cvFile, setCvFile]       = useState<File | null>(null);
  const [cvText, setCvText]       = useState<string>("");
  const [dragging, setDragging]   = useState(false);
  const [step, setStep]           = useState<Step>("idle");
  const [stepLabel, setStepLabel] = useState("");
  const [result, setResult]       = useState<ScreeningResult | null>(null);
  const [apiError, setApiError]   = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  /* Auth guard */
  useEffect(() => {
    if (!getToken()) { router.replace("/login"); return; }
    apiMe().then(u => setUserName(u.name)).catch(() => router.replace("/login"));
  }, [router]);

  /* File pick */
  const pickFile = (f: File) => {
    if (!f.name.toLowerCase().endsWith(".pdf")) {
      setApiError("Only PDF files are supported."); return;
    }
    setCvFile(f);
    setCvText("");          // reset — will be filled after upload by backend
    setApiError("");
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault(); setDragging(false);
    const f = e.dataTransfer.files[0]; if (f) pickFile(f);
  };

  const LABELS = [
    "Uploading CV to server...",
    "FAISS vectorizing CV...",
    "Embedding chunks...",
    "Running LangGraph pipeline...",
    "LLaMA 3.3 70B reasoning...",
    "Computing match score...",
  ];

  const runScreening = useCallback(async () => {
    if (!cvFile) { setApiError("Please upload a CV first."); return; }
    if (!jd.trim()) { setApiError("Please enter a job description."); return; }

    setApiError(""); setResult(null);

    // Step 1: Upload — backend parses PDF with PyPDF and returns real cv_text
    setStep("uploading"); setStepLabel(LABELS[0]);
    let parsedCvText = "";
    try {
      const uploadRes = await apiUploadCV(cvFile);
      parsedCvText = uploadRes.cv_text ?? "";
      setCvText(parsedCvText);
      console.log(`[Upload] Got ${parsedCvText.length} chars from backend`);
    } catch (e) {
      console.warn("[Upload warn]", e);
      // If upload fails, we can't screen properly
      setApiError("CV upload failed. Please try again.");
      setStep("error");
      return;
    }

    if (!parsedCvText.trim()) {
      setApiError("Could not extract text from PDF. Make sure it is not a scanned image.");
      setStep("error");
      return;
    }

    // Step 2: Screen with real parsed text from backend
    setStep("screening"); setStepLabel(LABELS[1]);
    let idx = 1;
    const iv = setInterval(() => {
      idx = Math.min(idx + 1, LABELS.length - 1);
      setStepLabel(LABELS[idx]);
    }, 1000);

    try {
      const res = await apiScreen(jd, parsedCvText);
      clearInterval(iv);
      setResult(res);
      setStep("done");
    } catch (e: unknown) {
      clearInterval(iv);
      setApiError(e instanceof Error ? e.message : "Screening failed.");
      setStep("error");
    }
  }, [cvFile, jd]);

  const handleLogout = () => { apiLogout(); router.push("/login"); };
  const score = result?.metrics.candidate_score ?? 0;

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-bg">
      {/* Bg effects */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        <div className="orb orb-1 w-[600px] h-[500px] -top-40 -left-20 animate-float" style={{ animationDuration: "8s" }} />
        <div className="orb orb-2 w-[500px] h-[400px] -bottom-20 -right-20 animate-float-delay" />
        <div className="orb orb-3 w-[300px] h-[300px] top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
      </div>
      <div className="fixed inset-0 bg-grid pointer-events-none z-0 opacity-60" />

      <div className="relative z-10 flex flex-col h-full">
        <TopBar user={userName} onLogout={handleLogout} />

        <div className="flex flex-1 overflow-hidden">

          {/* ── LEFT PANEL ──────────────────────────────────────── */}
          <aside className="w-72 flex-shrink-0 border-r border-border flex flex-col overflow-y-auto"
            style={{ background: "rgba(13,13,26,0.75)" }}>

            {/* CV Upload section */}
            <div className="p-4 border-b border-border">
              <div className="flex items-center gap-2 mb-3">
                <Upload size={13} className="text-g-500" />
                <span className="text-[10px] font-mono font-semibold text-slate-500 uppercase tracking-widest">
                  Upload Candidate CV
                </span>
              </div>

              {!cvFile ? (
                <div
                  onDrop={onDrop}
                  onDragOver={e => { e.preventDefault(); setDragging(true); }}
                  onDragLeave={() => setDragging(false)}
                  onClick={() => fileRef.current?.click()}
                  className={`relative border-2 border-dashed rounded-2xl p-5 flex flex-col items-center gap-3 cursor-pointer transition-all duration-200
                    ${dragging
                      ? "border-g-500/70 bg-g-500/8 scale-[1.01]"
                      : "border-border hover:border-g-500/35 hover:bg-g-500/3"}`}
                >
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center transition-all ${dragging ? "glass-gold" : "card"}`}>
                    <Upload size={20} className={dragging ? "text-g-400" : "text-slate-600"} />
                  </div>
                  <div className="text-center">
                    <p className="text-xs font-medium text-slate-400">
                      Drop PDF or <span className="text-g-400">browse files</span>
                    </p>
                    <p className="text-[10px] text-slate-700 mt-0.5">PDF only · Max 10MB</p>
                  </div>
                  <input ref={fileRef} type="file" accept=".pdf" className="hidden"
                    onChange={e => { const f = e.target.files?.[0]; if (f) pickFile(f); }} />
                </div>
              ) : (
                <div className="animate-scale-in">
                  <div className="flex items-center gap-3 glass-gold rounded-xl px-3 py-2.5">
                    <div className="w-9 h-9 rounded-lg glass-gold flex items-center justify-center flex-shrink-0">
                      <FileCheck size={15} className="text-g-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-slate-200 truncate">{cvFile.name}</p>
                      <p className="text-[10px] text-slate-600">
                        {(cvFile.size / 1024).toFixed(0)} KB · {cvText ? "Text extracted ✓" : "Ready"}
                      </p>
                    </div>
                    <button onClick={() => { setCvFile(null); setCvText(""); }}
                      className="text-slate-600 hover:text-red-400 transition-colors flex-shrink-0 p-1">
                      <X size={14} />
                    </button>
                  </div>
                  {cvText && (
                    <p className="text-[10px] font-mono text-green-400/70 mt-1.5 px-1">
                      ✓ {cvText.length} characters extracted for screening
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* JD section */}
            <div className="p-4 border-b border-border flex flex-col gap-3">
              <div className="flex items-center gap-2">
                <FileText size={13} className="text-g-500" />
                <span className="text-[10px] font-mono font-semibold text-slate-500 uppercase tracking-widest">
                  Job Description
                </span>
              </div>

              {/* Tags */}
              <div className="flex flex-wrap gap-1.5">
                {[
                  ["Backend",   "text-g-400 border-g-500/20 bg-g-500/5"],
                  ["AI/ML",     "text-blue-400 border-blue-500/20 bg-blue-500/5"],
                  ["Senior",    "text-purple-400 border-purple-500/20 bg-purple-500/5"],
                  ["Full-Time", "text-green-400 border-green-500/20 bg-green-500/5"],
                ].map(([t, c]) => (
                  <span key={t} className={`text-[10px] font-mono px-2 py-0.5 rounded border ${c}`}>{t}</span>
                ))}
              </div>

              <textarea
                value={jd} onChange={e => setJd(e.target.value)} rows={10}
                className="input-field w-full rounded-xl px-3 py-2.5 text-xs font-mono min-h-[160px] resize-none"
                placeholder="Paste job description here..."
              />

              {/* Run button */}
              <button
                onClick={runScreening}
                disabled={step === "uploading" || step === "screening" || !cvFile}
                className="btn-gold w-full flex items-center justify-center gap-2.5 py-3 rounded-xl text-sm"
              >
                {step === "uploading" || step === "screening" ? (
                  <>
                    <Loader2 size={14} className="animate-spin text-black" />
                    <span className="truncate text-xs text-black font-semibold">{stepLabel}</span>
                  </>
                ) : (
                  <><Zap size={14} /><span>Run Deep Screening</span></>
                )}
              </button>

              {/* Loading dots */}
              {(step === "uploading" || step === "screening") && (
                <div className="flex items-center justify-center gap-1.5 animate-fade-in">
                  {[0, 1, 2].map(i => (
                    <div key={i} className="w-1.5 h-1.5 rounded-full bg-g-500 animate-bounce-dot"
                      style={{ animationDelay: `${i * 0.2}s` }} />
                  ))}
                  <span className="text-[10px] font-mono text-slate-600 ml-1.5">Processing…</span>
                </div>
              )}

              {/* Error */}
              {apiError && (
                <div className="flex items-start gap-2 bg-red-500/8 border border-red-500/20 rounded-xl px-3 py-2.5 animate-scale-in">
                  <XCircle size={13} className="text-red-400 flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-red-400 leading-relaxed">{apiError}</p>
                </div>
              )}
            </div>

            {/* Quick stats after done */}
            {step === "done" && result && (
              <div className="p-4 space-y-2 animate-fade-up">
                <p className="text-[10px] font-mono text-slate-600 uppercase tracking-widest mb-2">Quick Stats</p>
                {[
                  { label: "Score",     value: `${result.metrics.candidate_score}/100`, good: result.metrics.candidate_score >= 60 },
                  { label: "Verdict",   value: result.metrics.final_verdict,            good: result.flags.is_shortlisted },
                  { label: "Interview", value: result.flags.trigger_interview ? "Triggered ✓" : "Not triggered", good: result.flags.trigger_interview },
                ].map(s => (
                  <div key={s.label} className="flex items-center justify-between px-3 py-2 rounded-lg card">
                    <span className="text-[10px] text-slate-600 font-mono">{s.label}</span>
                    <span className={`text-[10px] font-mono font-semibold ${s.good ? "text-green-400" : "text-g-400"}`}>{s.value}</span>
                  </div>
                ))}
                <Link href="/chat"
                  className="mt-2 w-full flex items-center justify-center gap-2 py-2 rounded-xl btn-ghost text-xs border border-border hover:border-g-500/25">
                  <MessageSquare size={12} />
                  Ask about this CV
                </Link>
                <Link href="/hr-policy"
                  className="w-full flex items-center justify-center gap-2 py-2 rounded-xl btn-ghost text-xs border border-border hover:border-g-500/25">
                  <Shield size={12} />
                  HR Policies
                </Link>
              </div>
            )}
          </aside>

          {/* ── CENTER PANEL ────────────────────────────────────── */}
          <main className="flex-1 overflow-y-auto px-5 py-5 space-y-5 min-w-0">
            {/* Header */}
            <div className="flex items-center justify-between animate-fade-up">
              <div>
                <h1 className="text-base font-bold text-white">Screening Results</h1>
                <p className="text-xs text-slate-600 mt-0.5 font-mono">
                  POST /Rating/screen · LLaMA 3.3 70B · FAISS · LangGraph
                </p>
              </div>
              <div className="flex items-center gap-2">
                {step === "done" && (
                  <span className="flex items-center gap-1.5 text-[10px] font-mono text-slate-600">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />Complete
                  </span>
                )}
                <div className="flex items-center gap-1.5 px-2.5 py-1.5 card rounded-lg">
                  <Activity size={11} className={
                    step === "done" ? "text-green-400" :
                    step === "error" ? "text-red-400" :
                    step === "idle" ? "text-slate-600" : "text-g-400"
                  } />
                  <span className="text-[11px] font-mono text-slate-500 capitalize">
                    {step === "idle" ? "Awaiting Input" :
                     step === "uploading" ? "Uploading..." :
                     step === "screening" ? "Screening..." :
                     step === "done" ? "Complete" : "Error"}
                  </span>
                </div>
              </div>
            </div>

            {/* ── Idle state ── */}
            {step === "idle" && (
              <div className="flex flex-col items-center justify-center h-64 gap-5 border border-dashed border-border rounded-2xl animate-fade-in">
                <div className="w-16 h-16 rounded-2xl card flex items-center justify-center">
                  <Brain size={28} className="text-border" />
                </div>
                <div className="text-center">
                  <p className="text-sm text-slate-500 font-medium">Ready to screen</p>
                  <p className="text-xs text-slate-700 mt-1">Upload a PDF CV + enter job description → click Run</p>
                </div>
              </div>
            )}

            {/* ── Loading state ── */}
            {(step === "uploading" || step === "screening") && (
              <div className="flex flex-col items-center justify-center h-72 gap-6 border border-border rounded-2xl card animate-fade-in">
                <div className="relative">
                  <div className="w-20 h-20 rounded-full glass flex items-center justify-center">
                    <Loader2 size={26} className="text-g-400 animate-spin" />
                  </div>
                  <div className="absolute inset-0 rounded-full border border-g-500/20 animate-pulse" />
                  <div className="absolute -inset-3 rounded-full border border-g-500/8 animate-pulse"
                    style={{ animationDelay: "0.5s" }} />
                </div>
                <div className="text-center space-y-1.5">
                  <p className="text-sm font-semibold text-white">{stepLabel}</p>
                  <p className="text-xs text-slate-600 font-mono">Agentic pipeline · LangGraph active</p>
                </div>
                <div className="flex gap-2.5">
                  {["Upload", "FAISS", "LangGraph", "LLaMA 3.3"].map((s, i) => (
                    <span key={s} className="text-[10px] font-mono px-2.5 py-1 rounded-lg card text-slate-700 animate-pulse"
                      style={{ animationDelay: `${i * 0.3}s` }}>{s}</span>
                  ))}
                </div>
              </div>
            )}

            {/* ── Error state ── */}
            {step === "error" && (
              <div className="flex flex-col items-center justify-center h-40 gap-3 border border-red-500/20 rounded-2xl bg-red-500/5 animate-scale-in">
                <XCircle size={28} className="text-red-400" />
                <p className="text-sm text-red-400 font-medium text-center px-4">{apiError || "Screening failed"}</p>
                <button onClick={() => setStep("idle")}
                  className="btn-ghost text-xs px-4 py-1.5 rounded-lg">Try Again</button>
              </div>
            )}

            {/* ── Results ── */}
            {step === "done" && result && (
              <>
                {/* Score + KPI stats */}
                <div className="grid grid-cols-3 gap-4 animate-fade-up">
                  {/* Gauge */}
                  <div className="card rounded-2xl p-5 flex flex-col items-center gap-2 relative overflow-hidden">
                    <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(245,158,11,0.04)_0%,transparent_70%)] pointer-events-none" />
                    <ScoreGauge score={score} />
                    <p className="text-[10px] font-mono text-slate-700 text-center">Composite AI match score</p>
                  </div>

                  {/* 4 KPI cards */}
                  <div className="col-span-2 grid grid-cols-2 gap-3">
                    {[
                      {
                        label: "Skills Matched",
                        value: `${result.metrics.matched_skills.length}/${result.metrics.matched_skills.length + result.metrics.missing_skills.length}`,
                        icon: CheckCircle,
                        cls: "text-green-400 bg-green-500/8 border-green-500/15",
                      },
                      {
                        label: "Skill Gaps",
                        value: result.metrics.missing_skills.length,
                        icon: AlertTriangle,
                        cls: "text-g-400 bg-g-500/8 border-g-500/15",
                      },
                      {
                        label: "Shortlisted",
                        value: result.flags.is_shortlisted ? "Yes ✓" : "No",
                        icon: Target,
                        cls: result.flags.is_shortlisted
                          ? "text-green-400 bg-green-500/8 border-green-500/15"
                          : "text-red-400 bg-red-500/8 border-red-500/15",
                      },
                      {
                        label: "Interview",
                        value: result.flags.trigger_interview ? "Triggered" : "Pending",
                        icon: TrendingUp,
                        cls: result.flags.trigger_interview
                          ? "text-blue-400 bg-blue-500/8 border-blue-500/15"
                          : "text-slate-500 bg-slate-500/8 border-slate-500/15",
                      },
                    ].map(s => {
                      const Icon = s.icon;
                      return (
                        <div key={s.label} className="card card-hover rounded-2xl p-4 flex items-center gap-3 cursor-default">
                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center border flex-shrink-0 ${s.cls}`}>
                            <Icon size={16} />
                          </div>
                          <div>
                            <p className="text-[10px] font-mono text-slate-600">{s.label}</p>
                            <p className="text-xl font-bold text-white leading-tight">{s.value}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Verdict banner */}
                <div className={`flex items-center gap-3 px-4 py-3 rounded-xl border animate-fade-up ${
                  result.flags.is_shortlisted
                    ? "bg-green-500/8 border-green-500/20"
                    : "bg-red-500/8 border-red-500/20"
                }`}>
                  {result.flags.is_shortlisted
                    ? <CheckCircle size={16} className="text-green-400 flex-shrink-0" />
                    : <XCircle size={16} className="text-red-400 flex-shrink-0" />}
                  <div className="min-w-0">
                    <p className={`text-sm font-semibold ${result.flags.is_shortlisted ? "text-green-300" : "text-red-300"}`}>
                      Final Verdict: {result.metrics.final_verdict}
                    </p>
                    <p className="text-xs text-slate-500 font-mono mt-0.5">
                      Min. experience: {result.flags.has_min_experience ? "✓ Met" : "✗ Not Met"}
                      &nbsp;·&nbsp;Shortlisted: {result.flags.is_shortlisted ? "Yes" : "No"}
                      &nbsp;·&nbsp;Interview: {result.flags.trigger_interview ? "Triggered" : "Pending"}
                    </p>
                  </div>
                </div>

                {/* Skills grid */}
                <div className="grid grid-cols-2 gap-4 animate-fade-up">
                  {[
                    {
                      title: "Matched Skills",
                      list: result.metrics.matched_skills,
                      type: "match" as const,
                      icon: CheckCircle,
                      borderCls: "border-green-500/15",
                      countCls: "bg-green-500/10 text-green-400",
                    },
                    {
                      title: "Skill Gaps",
                      list: result.metrics.missing_skills,
                      type: "gap" as const,
                      icon: AlertTriangle,
                      borderCls: "border-g-500/15",
                      countCls: "bg-g-500/10 text-g-400",
                    },
                  ].map(sec => {
                    const Icon = sec.icon;
                    return (
                      <div key={sec.title} className={`card border rounded-2xl p-4 ${sec.borderCls}`}>
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-2">
                            <Icon size={13} className={sec.type === "match" ? "text-green-400" : "text-g-400"} />
                            <span className="text-xs font-semibold text-slate-300">{sec.title}</span>
                          </div>
                          <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full ${sec.countCls}`}>
                            {sec.list.length}
                          </span>
                        </div>
                        {sec.list.length > 0 ? (
                          <div className="flex flex-wrap gap-1.5">
                            {sec.list.map(s => <Pill key={s} label={s} type={sec.type} />)}
                          </div>
                        ) : (
                          <p className="text-xs text-slate-700 font-mono italic">None detected</p>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Deep analysis */}
                {result.deep_analysis && (
                  <div className="animate-fade-up">
                    <AnalysisAccordion text={result.deep_analysis} />
                  </div>
                )}

                {/* Bottom CTA */}
                <div className="flex gap-3 animate-fade-up pb-2">
                  <Link href="/chat"
                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl btn-ghost text-sm border border-border hover:border-g-500/25">
                    <MessageSquare size={14} />
                    Ask about this CV
                  </Link>
                  <Link href="/hr-policy"
                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl btn-ghost text-sm border border-border hover:border-g-500/25">
                    <Shield size={14} />
                    HR Policies
                  </Link>
                  <button onClick={() => { setStep("idle"); setResult(null); setCvFile(null); setCvText(""); }}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl btn-ghost text-sm border border-border hover:border-red-500/20 hover:text-red-400 text-slate-500">
                    <XCircle size={14} />
                    Screen another CV
                  </button>
                </div>
              </>
            )}
          </main>
        </div>
      </div>
    </div>
  );
}
