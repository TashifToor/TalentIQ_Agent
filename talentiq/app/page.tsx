"use client";
import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import {
  Brain, Zap, Shield, BarChart3, Users, ChevronRight,
  CheckCircle, ArrowRight, Star, Menu, X, Sparkles,
  FileText, Target, TrendingUp, Clock, Award, Play,
} from "lucide-react";

/* ── Animated counter ── */
function Counter({ end, suffix = "" }: { end: number; suffix?: string }) {
  const [count, setCount] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return;
      let start = 0;
      const duration = 1800;
      const step = Math.ceil(end / (duration / 16));
      const timer = setInterval(() => {
        start = Math.min(start + step, end);
        setCount(start);
        if (start >= end) clearInterval(timer);
      }, 16);
      observer.disconnect();
    }, { threshold: 0.5 });
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, [end]);
  return <span ref={ref}>{count}{suffix}</span>;
}

/* ── Section fade-in on scroll ── */
function FadeIn({ children, delay = 0, className = "" }: { children: React.ReactNode; delay?: number; className?: string }) {
  const [visible, setVisible] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const observer = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) { setVisible(true); observer.disconnect(); }
    }, { threshold: 0.1 });
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);
  return (
    <div ref={ref} className={`transition-all duration-700 ${className}`}
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0)" : "translateY(24px)",
        transitionDelay: `${delay}ms`,
      }}>
      {children}
    </div>
  );
}

const NAV_LINKS = ["Features", "How It Works", "Pricing", "FAQ"];

const FEATURES = [
  {
    icon: Brain,
    title: "LLaMA 3.3 70B Reasoning",
    desc: "Not keyword matching — deep chain-of-thought analysis of every candidate's actual skill depth and project complexity.",
    color: "text-g-400 bg-g-500/10 border-g-500/20",
  },
  {
    icon: Zap,
    title: "Agentic RAG Pipeline",
    desc: "LangGraph-powered multi-node pipeline automatically screens, ranks, and shortlists candidates without human intervention.",
    color: "text-blue-400 bg-blue-500/10 border-blue-500/20",
  },
  {
    icon: Target,
    title: "Candidate Eligibility Engine",
    desc: "Tell candidates exactly what to fix: 'Add Docker deployment experience to pass this role's screening.'",
    color: "text-purple-400 bg-purple-500/10 border-purple-500/20",
  },
  {
    icon: Shield,
    title: "HR Policy Assistant",
    desc: "RAG-powered chatbot that answers HR policy questions instantly from your company's own documents.",
    color: "text-green-400 bg-green-500/10 border-green-500/20",
  },
  {
    icon: BarChart3,
    title: "Auto-Ranked Shortlists",
    desc: "HR gets candidates ranked 0–100 with full reasoning. No more manual CV reading — just review the top 5.",
    color: "text-orange-400 bg-orange-500/10 border-orange-500/20",
  },
  {
    icon: TrendingUp,
    title: "FAISS Semantic Search",
    desc: "Vector embeddings ensure semantic skill matching — 'built APIs' matches 'REST backend development'.",
    color: "text-pink-400 bg-pink-500/10 border-pink-500/20",
  },
];

const STEPS = [
  {
    num: "01",
    title: "HR posts a job",
    desc: "Paste your job description. TalentIQ parses requirements and builds a semantic skill matrix.",
    icon: FileText,
  },
  {
    num: "02",
    title: "Candidates apply",
    desc: "Candidates upload their CV. Our RAG pipeline extracts real skills, not just keywords.",
    icon: Users,
  },
  {
    num: "03",
    title: "AI screens & ranks",
    desc: "LLaMA 3.3 70B reasons through each CV. LangGraph executes a 4-step analysis pipeline.",
    icon: Brain,
  },
  {
    num: "04",
    title: "HR gets ranked results",
    desc: "A prioritized shortlist with scores, matched skills, gaps, and deep analysis. Ready to interview.",
    icon: Award,
  },
];

const PRICING = [
  {
    name: "Free",
    price: "$0",
    period: "forever",
    desc: "Try TalentIQ risk-free",
    features: ["3 CV screening checks", "Basic skill matching", "PDF CV upload", "Dashboard access"],
    cta: "Get Started Free",
    href: "/signup",
    highlighted: false,
  },
  {
    name: "Candidate Pro",
    price: "$9",
    period: "/month",
    desc: "For job seekers",
    features: [
      "Unlimited CV screenings",
      "Deep eligibility analysis",
      "Actionable skill gap feedback",
      "Job match optimization tips",
      "Priority AI processing",
    ],
    cta: "Start Pro",
    href: "/signup",
    highlighted: false,
    badge: "Most Popular",
  },
  {
    name: "HR Suite",
    price: "$49",
    period: "/month",
    desc: "For hiring teams",
    features: [
      "Unlimited job postings",
      "Auto-rank all applicants",
      "Bulk CV screening",
      "HR Policy RAG chatbot",
      "Team collaboration",
      "Priority support",
    ],
    cta: "Start HR Suite",
    href: "/signup",
    highlighted: true,
    badge: "Best Value",
  },
];

const STATS = [
  { value: 94, suffix: "%", label: "AI Screening Accuracy" },
  { value: 90, suffix: "%", label: "Time Saved vs Manual" },
  { value: 50, suffix: "K+", label: "CVs Processed" },
  { value: 12, suffix: "hrs", label: "Avg Time Saved / Hire" },
];

const FAQS = [
  {
    q: "How is TalentIQ different from keyword-based ATS systems?",
    a: "Most ATS tools just match words. TalentIQ uses LLaMA 3.3 70B to reason about actual skill depth, project complexity, and candidate fit — the same way a senior engineer would review a CV.",
  },
  {
    q: "Is my CV data secure?",
    a: "Yes. CVs are processed in-memory and stored only temporarily for screening. We use Argon2 password hashing, JWT auth, and never share your data with third parties.",
  },
  {
    q: "Can I use TalentIQ for any job role?",
    a: "Absolutely. Paste any job description — tech, marketing, finance, operations — and our AI adapts its screening criteria accordingly.",
  },
  {
    q: "How does the HR Policy chatbot work?",
    a: "Upload your company's HR policy PDFs. Our RAG system indexes them and lets employees ask natural language questions — answered instantly from your actual documents.",
  },
  {
    q: "What happens after my free 3 checks?",
    a: "Upgrade to Candidate Pro ($9/mo) for unlimited screenings, or HR Suite ($49/mo) for team features. Cancel anytime.",
  },
];

export default function LandingPage() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handler);
    return () => window.removeEventListener("scroll", handler);
  }, []);

  return (
    <div className="min-h-screen bg-bg text-slate-200 overflow-x-hidden">

      {/* ── Fixed background effects ── */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="orb orb-1 w-[700px] h-[600px] -top-40 -left-40 animate-float" style={{ animationDuration: "10s" }} />
        <div className="orb orb-2 w-[600px] h-[500px] top-1/3 -right-40 animate-float-delay" />
        <div className="orb orb-3 w-[400px] h-[400px] bottom-0 left-1/3" />
      </div>
      <div className="fixed inset-0 bg-grid pointer-events-none z-0 opacity-50" />

      {/* ── Navbar ── */}
      <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${scrolled ? "glass border-b border-border" : "bg-transparent"}`}>
        <div className="max-w-6xl mx-auto px-5 h-16 flex items-center justify-between">
          {/* Logo */}
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl glass-gold flex items-center justify-center">
              <Brain size={15} className="text-g-400" />
            </div>
            <span className="text-sm font-bold text-white">TalentIQ</span>
            <span className="text-[10px] font-mono text-g-500/50 border border-g-500/20 px-1.5 py-0.5 rounded bg-g-500/5">v2.0</span>
          </div>

          {/* Desktop nav */}
          <div className="hidden md:flex items-center gap-1">
            {NAV_LINKS.map(link => (
              <a key={link} href={`#${link.toLowerCase().replace(/ /g, "-")}`}
                className="text-xs text-slate-500 hover:text-white transition-colors px-3 py-1.5 rounded-lg hover:bg-white/5">
                {link}
              </a>
            ))}
          </div>

          {/* CTA buttons */}
          <div className="hidden md:flex items-center gap-2">
            <Link href="/login" className="text-xs text-slate-400 hover:text-white transition-colors px-3 py-1.5 rounded-lg hover:bg-white/5">
              Sign In
            </Link>
            <Link href="/signup" className="btn-gold flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs">
              Get Started Free <ArrowRight size={12} />
            </Link>
          </div>

          {/* Mobile menu button */}
          <button className="md:hidden text-slate-400 p-2" onClick={() => setMenuOpen(!menuOpen)}>
            {menuOpen ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>

        {/* Mobile menu */}
        {menuOpen && (
          <div className="md:hidden glass border-t border-border px-5 py-4 space-y-2">
            {NAV_LINKS.map(link => (
              <a key={link} href={`#${link.toLowerCase().replace(/ /g, "-")}`}
                className="block text-sm text-slate-400 hover:text-white py-2 transition-colors"
                onClick={() => setMenuOpen(false)}>
                {link}
              </a>
            ))}
            <div className="flex gap-2 pt-2">
              <Link href="/login" className="flex-1 text-center py-2 rounded-xl btn-ghost text-sm border border-border">Sign In</Link>
              <Link href="/signup" className="flex-1 text-center py-2 rounded-xl btn-gold text-sm">Sign Up</Link>
            </div>
          </div>
        )}
      </nav>

      {/* ── Hero Section ── */}
      <section className="relative z-10 min-h-screen flex flex-col items-center justify-center text-center px-5 pt-20">
        <FadeIn>
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass-gold border border-g-500/20 mb-8">
            <Sparkles size={12} className="text-g-400" />
            <span className="text-xs font-mono text-g-400">Powered by LLaMA 3.3 70B · LangGraph · FAISS</span>
          </div>
        </FadeIn>

        <FadeIn delay={100}>
          <h1 className="text-5xl md:text-7xl font-bold text-white leading-tight max-w-4xl mb-6">
            AI Recruitment
            <br />
            <span className="text-gold-gradient">That Actually Thinks</span>
          </h1>
        </FadeIn>

        <FadeIn delay={200}>
          <p className="text-lg text-slate-400 max-w-2xl mb-10 leading-relaxed">
            Stop wasting hours on manual CV screening. TalentIQ&apos;s agentic AI
            reads between the lines — ranking candidates by real skill depth,
            not just keyword matches.
          </p>
        </FadeIn>

        <FadeIn delay={300}>
          <div className="flex flex-col sm:flex-row items-center gap-3 mb-16">
            <Link href="/signup"
              className="btn-gold flex items-center gap-2 px-7 py-3.5 rounded-xl text-sm font-semibold">
              Start Free — 3 Checks Included
              <ArrowRight size={15} />
            </Link>
            <Link href="/login"
              className="flex items-center gap-2 px-6 py-3.5 rounded-xl btn-ghost border border-border text-sm">
              <Play size={13} />
              Sign In to Dashboard
            </Link>
          </div>
        </FadeIn>

        {/* Hero visual — fake dashboard preview */}
        <FadeIn delay={400} className="w-full max-w-4xl">
          <div className="relative">
            <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-bg z-10 pointer-events-none" />
            <div className="card rounded-2xl overflow-hidden border border-border">
              {/* Fake topbar */}
              <div className="glass border-b border-border flex items-center px-4 py-3 gap-3">
                <div className="flex gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-red-500/60" />
                  <div className="w-3 h-3 rounded-full bg-g-500/60" />
                  <div className="w-3 h-3 rounded-full bg-green-500/60" />
                </div>
                <div className="flex-1 h-5 rounded-md bg-border/50 max-w-xs" />
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full glass-gold">
                  <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                  <span className="text-[10px] font-mono text-green-400">LLaMA Active</span>
                </div>
              </div>
              {/* Fake content */}
              <div className="p-4 grid grid-cols-3 gap-3">
                <div className="col-span-1 space-y-2">
                  <div className="h-24 rounded-xl skeleton" />
                  <div className="h-32 rounded-xl skeleton" />
                  <div className="h-10 rounded-xl bg-g-500/20 border border-g-500/20 flex items-center justify-center">
                    <span className="text-[10px] font-mono text-g-400">Run Deep Screening</span>
                  </div>
                </div>
                <div className="col-span-2 space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { label: "Score", value: "90/100", color: "text-green-400" },
                      { label: "Matched", value: "10/12", color: "text-g-400" },
                      { label: "Verdict", value: "Shortlisted ", color: "text-green-400" },
                      { label: "Interview", value: "Triggered", color: "text-blue-400" },
                    ].map(s => (
                      <div key={s.label} className="card rounded-xl p-3 flex items-center gap-2">
                        <div>
                          <p className="text-[9px] text-slate-600 font-mono">{s.label}</p>
                          <p className={`text-sm font-bold ${s.color}`}>{s.value}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="card rounded-xl p-3 space-y-1.5">
                    <p className="text-[10px] text-g-400 font-semibold font-mono">DEEP AI ANALYSIS</p>
                    <div className="h-2 rounded-full skeleton w-full" />
                    <div className="h-2 rounded-full skeleton w-4/5" />
                    <div className="h-2 rounded-full skeleton w-3/4" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </FadeIn>
      </section>

      {/* ── Stats ── */}
      <section className="relative z-10 py-16 border-y border-border">
        <div className="max-w-4xl mx-auto px-5">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
            {STATS.map((s, i) => (
              <FadeIn key={s.label} delay={i * 100}>
                <div>
                  <p className="text-4xl font-bold glow-gold mb-1">
                    <Counter end={s.value} suffix={s.suffix} />
                  </p>
                  <p className="text-xs text-slate-500">{s.label}</p>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* ── Features ── */}
      <section id="features" className="relative z-10 py-24 px-5">
        <div className="max-w-6xl mx-auto">
          <FadeIn className="text-center mb-16">
            <span className="text-xs font-mono text-g-400 uppercase tracking-widest">Features</span>
            <h2 className="text-4xl font-bold text-white mt-3 mb-4">
              Not just a resume parser.
              <br />
              <span className="text-gold-gradient">An AI that reasons.</span>
            </h2>
            <p className="text-slate-500 max-w-xl mx-auto text-sm leading-relaxed">
              Every feature is built around one idea: understand candidates the way
              an experienced engineer would — not a keyword scanner.
            </p>
          </FadeIn>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {FEATURES.map((f, i) => {
              const Icon = f.icon;
              return (
                <FadeIn key={f.title} delay={i * 80}>
                  <div className="card card-hover rounded-2xl p-5 h-full cursor-default">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center border mb-4 ${f.color}`}>
                      <Icon size={18} />
                    </div>
                    <h3 className="text-sm font-semibold text-white mb-2">{f.title}</h3>
                    <p className="text-xs text-slate-500 leading-relaxed">{f.desc}</p>
                  </div>
                </FadeIn>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── How It Works ── */}
      <section id="how-it-works" className="relative z-10 py-24 px-5 border-t border-border">
        <div className="max-w-5xl mx-auto">
          <FadeIn className="text-center mb-16">
            <span className="text-xs font-mono text-g-400 uppercase tracking-widest">How It Works</span>
            <h2 className="text-4xl font-bold text-white mt-3 mb-4">
              From job post to
              <span className="text-gold-gradient"> shortlist in minutes</span>
            </h2>
          </FadeIn>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {STEPS.map((step, i) => {
              const Icon = step.icon;
              return (
                <FadeIn key={step.num} delay={i * 120}>
                  <div className="relative card rounded-2xl p-5">
                    {/* Connector line */}
                    {i < STEPS.length - 1 && (
                      <div className="hidden lg:block absolute top-8 -right-2 w-4 h-px bg-border z-10" />
                    )}
                    <div className="flex items-center gap-3 mb-4">
                      <span className="text-2xl font-bold text-gold-gradient font-mono">{step.num}</span>
                      <div className="w-8 h-8 rounded-lg glass-gold flex items-center justify-center">
                        <Icon size={14} className="text-g-400" />
                      </div>
                    </div>
                    <h3 className="text-sm font-semibold text-white mb-2">{step.title}</h3>
                    <p className="text-xs text-slate-500 leading-relaxed">{step.desc}</p>
                  </div>
                </FadeIn>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── Two-sided platform callout ── */}
      <section className="relative z-10 py-20 px-5 border-t border-border">
        <div className="max-w-5xl mx-auto grid md:grid-cols-2 gap-5">
          {/* Candidate side */}
          <FadeIn>
            <div className="card rounded-2xl p-6 border border-g-500/15 relative overflow-hidden h-full">
              <div className="absolute top-0 right-0 w-32 h-32 bg-g-500/5 rounded-full blur-2xl" />
              <div className="relative z-10">
                <div className="w-10 h-10 rounded-xl glass-gold flex items-center justify-center mb-4">
                  <Users size={18} className="text-g-400" />
                </div>
                <span className="text-xs font-mono text-g-400 uppercase tracking-widest">For Candidates</span>
                <h3 className="text-xl font-bold text-white mt-2 mb-3">The Eligibility Engine</h3>
                <p className="text-sm text-slate-400 leading-relaxed mb-4">
                  Upload your CV + paste a job description. Get a precise score
                  and actionable steps: <em className="text-g-300">"Add Docker deployment experience
                  and one scalable system project to pass this role."</em>
                </p>
                <ul className="space-y-2">
                  {["Real eligibility score", "Exact skill gaps identified", "Specific improvement steps", "Interview readiness check"].map(f => (
                    <li key={f} className="flex items-center gap-2 text-xs text-slate-400">
                      <CheckCircle size={12} className="text-g-400 flex-shrink-0" />
                      {f}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </FadeIn>

          {/* HR side */}
          <FadeIn delay={150}>
            <div className="card rounded-2xl p-6 border border-blue-500/15 relative overflow-hidden h-full">
              <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 rounded-full blur-2xl" />
              <div className="relative z-10">
                <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center mb-4">
                  <Shield size={18} className="text-blue-400" />
                </div>
                <span className="text-xs font-mono text-blue-400 uppercase tracking-widest">For HR Teams</span>
                <h3 className="text-xl font-bold text-white mt-2 mb-3">The Autopilot Screener</h3>
                <p className="text-sm text-slate-400 leading-relaxed mb-4">
                  Post a job, let candidates apply. TalentIQ automatically screens
                  every CV and delivers a ranked shortlist with AI reasoning.
                  Your team just reviews the top candidates.
                </p>
                <ul className="space-y-2">
                  {["Auto-rank all applicants", "90% less manual screening", "Deep analysis per candidate", "HR Policy RAG chatbot"].map(f => (
                    <li key={f} className="flex items-center gap-2 text-xs text-slate-400">
                      <CheckCircle size={12} className="text-blue-400 flex-shrink-0" />
                      {f}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </FadeIn>
        </div>
      </section>

      {/* ── Pricing ── */}
      <section id="pricing" className="relative z-10 py-24 px-5 border-t border-border">
        <div className="max-w-5xl mx-auto">
          <FadeIn className="text-center mb-16">
            <span className="text-xs font-mono text-g-400 uppercase tracking-widest">Pricing</span>
            <h2 className="text-4xl font-bold text-white mt-3 mb-4">
              Simple, transparent pricing
            </h2>
            <p className="text-slate-500 text-sm">Start free. Upgrade when you need more.</p>
          </FadeIn>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {PRICING.map((plan, i) => (
              <FadeIn key={plan.name} delay={i * 100}>
                <div className={`relative card rounded-2xl p-6 h-full flex flex-col ${
                  plan.highlighted
                    ? "border-g-500/30 ring-1 ring-g-500/20"
                    : "border-border"
                }`}>
                  {plan.badge && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                      <span className={`text-[10px] font-mono font-bold px-3 py-1 rounded-full ${
                        plan.highlighted ? "bg-g-500 text-black" : "bg-border text-slate-400"
                      }`}>
                        {plan.badge}
                      </span>
                    </div>
                  )}
                  <div className="mb-4">
                    <h3 className="text-sm font-semibold text-white">{plan.name}</h3>
                    <p className="text-xs text-slate-600 mt-0.5">{plan.desc}</p>
                  </div>
                  <div className="flex items-baseline gap-1 mb-5">
                    <span className="text-4xl font-bold text-white">{plan.price}</span>
                    <span className="text-xs text-slate-500">{plan.period}</span>
                  </div>
                  <ul className="space-y-2.5 mb-6 flex-1">
                    {plan.features.map(f => (
                      <li key={f} className="flex items-start gap-2">
                        <CheckCircle size={12} className="text-g-400 flex-shrink-0 mt-0.5" />
                        <span className="text-xs text-slate-400">{f}</span>
                      </li>
                    ))}
                  </ul>
                  <Link href={plan.href}
                    className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium transition-all ${
                      plan.highlighted
                        ? "btn-gold"
                        : "btn-ghost border border-border hover:border-g-500/25"
                    }`}>
                    {plan.cta}
                    <ChevronRight size={14} />
                  </Link>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* ── FAQ ── */}
      <section id="faq" className="relative z-10 py-24 px-5 border-t border-border">
        <div className="max-w-3xl mx-auto">
          <FadeIn className="text-center mb-12">
            <span className="text-xs font-mono text-g-400 uppercase tracking-widest">FAQ</span>
            <h2 className="text-4xl font-bold text-white mt-3">Frequently Asked Questions</h2>
          </FadeIn>
          <div className="space-y-2">
            {FAQS.map((faq, i) => (
              <FadeIn key={i} delay={i * 60}>
                <div className={`card rounded-xl overflow-hidden border transition-all ${
                  openFaq === i ? "border-g-500/25" : "border-border"
                }`}>
                  <button
                    onClick={() => setOpenFaq(openFaq === i ? null : i)}
                    className="w-full flex items-center justify-between px-5 py-4 text-left">
                    <span className="text-sm font-medium text-white pr-4">{faq.q}</span>
                    <ChevronRight size={14} className={`text-slate-600 flex-shrink-0 transition-transform ${openFaq === i ? "rotate-90" : ""}`} />
                  </button>
                  {openFaq === i && (
                    <div className="px-5 pb-4 border-t border-border/50">
                      <p className="text-sm text-slate-400 leading-relaxed pt-3">{faq.a}</p>
                    </div>
                  )}
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA Banner ── */}
      <section className="relative z-10 py-24 px-5 border-t border-border">
        <FadeIn>
          <div className="max-w-3xl mx-auto text-center">
            <div className="w-14 h-14 rounded-2xl glass-gold flex items-center justify-center mx-auto mb-6 animate-glow">
              <Brain size={24} className="text-g-400" />
            </div>
            <h2 className="text-4xl font-bold text-white mb-4">
              Ready to hire smarter?
            </h2>
            <p className="text-slate-500 text-sm mb-8 max-w-md mx-auto leading-relaxed">
              Join teams using TalentIQ to cut screening time by 90% and find
              the right candidates faster with AI reasoning.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <Link href="/signup"
                className="btn-gold flex items-center gap-2 px-8 py-3.5 rounded-xl text-sm font-semibold">
                Get Started Free
                <ArrowRight size={15} />
              </Link>
              <Link href="/login"
                className="flex items-center gap-2 px-6 py-3.5 rounded-xl btn-ghost border border-border text-sm text-slate-400">
                Sign In
              </Link>
            </div>
            <p className="text-xs text-slate-700 mt-5">
              3 free checks · No credit card required · Cancel anytime
            </p>
          </div>
        </FadeIn>
      </section>

      {/* ── Footer ── */}
      <footer className="relative z-10 border-t border-border px-5 py-8">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <div className="w-6 h-6 rounded-lg glass-gold flex items-center justify-center">
              <Brain size={11} className="text-g-400" />
            </div>
            <span className="text-sm font-bold text-white">TalentIQ</span>
            <span className="text-xs text-slate-700">v2.0</span>
          </div>
          <p className="text-xs text-slate-700 text-center">
            Built with Next.js · FastAPI · LLaMA 3.3 70B · LangGraph · FAISS
          </p>
          <div className="flex items-center gap-4 text-xs text-slate-700">
            <span className="hover:text-slate-400 cursor-pointer transition-colors">Privacy</span>
            <span className="hover:text-slate-400 cursor-pointer transition-colors">Terms</span>
            <Link href="/login" className="hover:text-g-400 transition-colors">Sign In</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}