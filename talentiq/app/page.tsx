"use client";
import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import {
  Brain, Zap, Shield, BarChart3, Users, ChevronRight,
  CheckCircle, ArrowRight, Sparkles, FileText, Target,
  Award, Play, Menu, X, Cpu
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
        transform: visible ? "translateY(24px)" : "translateY(0)",
        transitionDelay: `${delay}ms`,
      }}>
      {children}
    </div>
  );
}

const NAV_LINKS = ["Features", "How It Works", "Pricing", "FAQ"];

const FEATURES = [
  {
    icon: Cpu,
    title: "Next-Gen ATS Scanner",
    desc: "Test your resume against modern corporate ATS screening filters. See exactly how automated corporate parsers read and score your technical background.",
    color: "text-teal-400 bg-teal-500/10 border-teal-500/20",
  },
  {
    icon: Brain,
    title: "Context-Aware Match",
    desc: "No strict or dumb keyword limitations. The system recognizes that 'building backend pipelines' deeply qualifies you for senior software engineering roles.",
    color: "text-teal-400 bg-teal-500/10 border-teal-500/20",
  },
  {
    icon: Target,
    title: "Skill Gap & Missing Matrix",
    desc: "For job seekers: know exactly what crucial technical or functional skills are missing from your profile compared to target job descriptions.",
    color: "text-teal-400 bg-teal-500/10 border-teal-500/20",
  },
  {
    icon: Zap,
    title: "Instant Batch Screening",
    desc: "For recruiters: drop dozens of incoming applicant CVs simultaneously and generate a pristine, multi-variable sorted leaderboard in seconds.",
    color: "text-teal-400 bg-teal-500/10 border-teal-500/20",
  },
  {
    icon: BarChart3,
    title: "Fair Core Eligibility Scores",
    desc: "Get an objective 0–100 ranking index complete with structured feedback on capability depth, role alignment, and experience level.",
    color: "text-teal-400 bg-teal-500/10 border-teal-500/20",
  },
  {
    icon: Shield,
    title: "Company Document Guide",
    desc: "A secure playground to upload operational guidelines or internal company manuals and query them instantly using contextual text search.",
    color: "text-teal-400 bg-teal-500/10 border-teal-500/20",
  },
];

const STEPS = [
  {
    num: "01",
    title: "Set Target Criteria",
    desc: "Recruiters paste their core job descriptions. Candidates paste their dream role details to align targeting parameters.",
    icon: FileText,
  },
  {
    num: "02",
    title: "Upload Resumes",
    desc: "Drop individual or bulk candidate profiles. Our deep extractor securely processes full text layouts without breaking formats.",
    icon: Users,
  },
  {
    num: "03",
    title: "AI & ATS Simulation",
    desc: "The screening layer reads applicant experience data, parsing structure, and project context just like real human screeners.",
    icon: Brain,
  },
  {
    num: "04",
    title: "Analyze Score Report",
    desc: "Access leaderboard rankings if hiring, or review personal missing-skill feedback loops if optimizing your own career profile.",
    icon: Award,
  },
];

const PRICING = [
  {
    name: "Free Trial",
    price: "$0",
    period: "forever",
    desc: "Test individual match performance",
    features: ["3 Full ATS screening checks", "Basic skill gap overview", "Standard file formatting support", "Personal user dashboard access"],
    cta: "Get Started Free",
    href: "/signup",
    highlighted: false,
  },
  {
    name: "Job Seeker Pro",
    price: "$9",
    period: "/month",
    desc: "Built for active candidates & developers",
    features: [
      "Unlimited ATS matching simulation",
      "Deep job eligibility analysis",
      "Precise missing-skill alerts",
      "Format structural audit feedback",
      "Priority processing speed queue",
    ],
    cta: "Optimize My Resume",
    href: "/signup",
    highlighted: false,
    badge: "For Job Seekers",
  },
  {
    name: "Hiring Suite",
    price: "$49",
    period: "/month",
    desc: "Tailored for business founders & HR leaders",
    features: [
      "Unlimited core job vacancy creation",
      "Automated bulk applicant ranking",
      "Multi-candidate leaderboard view",
      "Company guidelines assistant chatbot",
      "Shared pipeline collaboration layout",
      "Dedicated account management support",
    ],
    cta: "Deploy Hiring Suite",
    href: "/signup",
    highlighted: true,
    badge: "Recruitment Teams", // Text ko short aur clean kar diya taake break na ho
  },
];

const STATS = [
  { value: 98, suffix: "%", label: "ATS Optimization Rate" },
  { value: 90, suffix: "%", label: "Manual Screening Saved" },
  { value: 50, suffix: "K+", label: "Profiles Scanned" },
  { value: 10, suffix: "x", label: "Faster Pipeline Delivery" },
];

const FAQS = [
  {
    q: "Can I use TalentIQ as an individual job seeker?",
    a: "Absolutely! You can paste any external target job description and upload your resume to see exactly how recruiter algorithms score your profile, what key requirements you are missing, and how to fix them.",
  },
  {
    q: "Does this replace traditional corporate ATS?",
    a: "Think of it as an intelligence layer. For recruiters, it saves hours of filtering text keywords by acting as a smart screener. For applicants, it serves as a testing sandbox to survive automated enterprise filtering layers.",
  },
  {
    q: "Is my technical data and source files protected?",
    a: "Completely. Security and confidentiality are core features. All data processes happen over secure end-to-end transport tunnels, and your individual uploads are never shared or leaked outside.",
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
    <div className="min-h-screen bg-[#0b0f19] text-slate-200 overflow-x-hidden antialiased">
      {/* ── Background decoration ── */}
      <div className="fixed inset-0 pointer-events-none z-0 opacity-30">
        <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] bg-teal-500/10 rounded-full blur-[120px]" />
        <div className="absolute top-[30%] right-[-10%] w-[600px] h-[600px] bg-blue-500/10 rounded-full blur-[140px]" />
      </div>

      {/* ── Navbar ── */}
      <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${scrolled ? "backdrop-blur-md bg-[#0b0f19]/80 border-b border-slate-800" : "bg-transparent"}`}>
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-teal-500/10 border border-teal-500/20 flex items-center justify-center">
              <Brain size={16} className="text-teal-400" />
            </div>
            <span className="text-md font-bold text-white tracking-wide">TalentIQ</span>
          </div>

          <div className="hidden md:flex items-center gap-6">
            {NAV_LINKS.map(link => (
              <a key={link} href={`#${link.toLowerCase().replace(/ /g, "-")}`}
                className="text-xs text-slate-400 hover:text-white transition-colors">
                {link}
              </a>
            ))}
          </div>

          <div className="hidden md:flex items-center gap-4">
            <Link href="/login" className="text-xs text-slate-400 hover:text-white transition-colors">
              Sign In
            </Link>
            <Link href="/signup" className="bg-teal-500 hover:bg-teal-600 text-black font-semibold flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs transition-all shadow-lg shadow-teal-500/10">
              Get Started <ArrowRight size={12} />
            </Link>
          </div>

          <button className="md:hidden text-slate-400 p-2" onClick={() => setMenuOpen(!menuOpen)}>
            {menuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>

        {/* Mobile menu */}
        {menuOpen && (
          <div className="md:hidden bg-[#0c1220] border-t border-slate-800 px-5 py-4 space-y-3">
            {NAV_LINKS.map(link => (
              <a key={link} href={`#${link.toLowerCase().replace(/ /g, "-")}`}
                className="block text-sm text-slate-400 hover:text-white py-1.5"
                onClick={() => setMenuOpen(false)}>
                {link}
              </a>
            ))}
            <div className="flex gap-3 pt-2 border-t border-slate-800/60">
              <Link href="/login" className="flex-1 text-center py-2 rounded-xl text-slate-400 border border-slate-800 text-sm">Sign In</Link>
              <Link href="/signup" className="flex-1 text-center py-2 rounded-xl bg-teal-500 text-black font-medium text-sm">Sign Up</Link>
            </div>
          </div>
        )}
      </nav>

      {/* ── Hero Section ── */}
      <section className="relative z-10 min-h-screen flex flex-col items-center justify-center text-center px-4 pt-24 max-w-4xl mx-auto">
        <FadeIn>
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-teal-500/5 border border-teal-500/20 mb-6">
            <Sparkles size={12} className="text-teal-400" />
            <span className="text-xs font-medium text-teal-400">Next-Gen Intelligent ATS Matching Sandbox</span>
          </div>
        </FadeIn>

        <FadeIn delay={100}>
          <h1 className="text-4xl md:text-6xl font-extrabold text-white leading-tight mb-6 tracking-tight">
            Smart ATS Hiring Assistant
            <br />
            <span className="bg-gradient-to-r from-teal-400 via-white to-slate-200 bg-clip-text text-transparent">That Understands People</span>
          </h1>
        </FadeIn>

        <FadeIn delay={200}>
          <p className="text-md md:text-lg text-slate-400 max-w-2xl mb-10 leading-relaxed">
            Stop wasting endless hours manually reading resumes or worrying about automated bots rejecting your CV. TalentIQ analyzes profiles instantly—ranking and benchmarking true experience, capacity, and matching performance.
          </p>
        </FadeIn>

        <FadeIn delay={300}>
          <div className="flex flex-col sm:flex-row items-center gap-4 mb-12">
            <Link href="/signup" className="bg-teal-500 hover:bg-teal-600 text-black font-bold flex items-center gap-2 px-7 py-3.5 rounded-xl text-sm transition-all shadow-lg shadow-teal-500/15 group">
              Scan Your CV Free — 3 Checks Included
              <ArrowRight size={15} className="group-hover:translate-x-0.5 transition-transform" />
            </Link>
            <Link href="/login" className="flex items-center gap-2 px-6 py-3.5 rounded-xl border border-slate-800 hover:border-slate-700 bg-slate-900/40 text-sm font-medium text-white transition-colors">
              <Play size={12} fill="currentColor" /> View Dashboard
            </Link>
          </div>
        </FadeIn>
      </section>

      {/* ── Stats ── */}
      <section className="relative z-10 py-12 border-y border-slate-900 bg-slate-950/20">
        <div className="max-w-5xl mx-auto px-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
            {STATS.map((s, i) => (
              <FadeIn key={s.label} delay={i * 100}>
                <div>
                  <p className="text-3xl md:text-4xl font-extrabold text-teal-400 mb-1">
                    <Counter end={s.value} suffix={s.suffix} />
                  </p>
                  <p className="text-xs text-slate-400 font-semibold tracking-wide uppercase">{s.label}</p>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* ── Features ── */}
      <section id="features" className="relative z-10 py-24 px-4 max-w-6xl mx-auto">
        <FadeIn className="text-center mb-16">
          <span className="text-xs font-bold text-teal-400 uppercase tracking-widest">Platform Core Architecture</span>
          <h2 className="text-3xl md:text-4xl font-bold text-white mt-3 mb-4">
            Built to cross-verify role-fit layout alignments
          </h2>
          <p className="text-slate-400 max-w-lg mx-auto text-sm leading-relaxed">
            Engineered both to help teams streamline recruitment processing and allow talented applicants to beat automated corporate screening bias.
          </p>
        </FadeIn>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {FEATURES.map((f, i) => {
            const Icon = f.icon;
            return (
              <FadeIn key={f.title} delay={i * 80}>
                <div className="border border-slate-800/80 bg-slate-900/20 rounded-2xl p-6 h-full transition-all duration-300 hover:border-teal-500/30 hover:bg-slate-900/40">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center border mb-4 ${f.color}`}>
                    <Icon size={18} />
                  </div>
                  <h3 className="text-sm font-bold text-white mb-2">{f.title}</h3>
                  <p className="text-xs text-slate-400 leading-relaxed">{f.desc}</p>
                </div>
              </FadeIn>
            );
          })}
        </div>
      </section>

      {/* ── How It Works ── */}
      <section id="how-it-works" className="relative z-10 py-24 px-4 border-t border-slate-900 max-w-6xl mx-auto">
        <FadeIn className="text-center mb-16">
          <span className="text-xs font-bold text-teal-400 uppercase tracking-widest">Process Flow</span>
          <h2 className="text-3xl md:text-4xl font-bold text-white mt-3">
            Two Sides. One Unified Evaluation Model.
          </h2>
        </FadeIn>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {STEPS.map((step, i) => {
            const Icon = step.icon;
            return (
              <FadeIn key={step.num} delay={i * 120}>
                <div className="relative border border-slate-900 bg-slate-950/40 rounded-2xl p-5 h-full">
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-xl font-extrabold text-teal-400 font-mono">{step.num}</span>
                    <div className="w-8 h-8 rounded-lg bg-teal-500/5 border border-teal-500/10 flex items-center justify-center">
                      <Icon size={14} className="text-teal-400" />
                    </div>
                  </div>
                  <h3 className="text-sm font-bold text-white mb-2">{step.title}</h3>
                  <p className="text-xs text-slate-400 leading-relaxed">{step.desc}</p>
                </div>
              </FadeIn>
            );
          })}
        </div>
      </section>

      {/* ── Pricing Block with custom Hover Effects ── */}
      <section id="pricing" className="relative z-10 py-24 px-4 border-t border-slate-900 max-w-5xl mx-auto">
        <FadeIn className="text-center mb-16">
          <span className="text-xs font-bold text-teal-400 uppercase tracking-widest">Plans</span>
          <h2 className="text-3xl md:text-4xl font-bold text-white mt-3 mb-2">
            Simple, Transparent Pricing
          </h2>
          <p className="text-slate-400 text-sm">Start with our free trial. Choose a plan that suits your needs.</p>
        </FadeIn>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-stretch">
          {PRICING.map((plan, i) => (
            <FadeIn key={plan.name} delay={i * 100}>
              <div 
                className={`relative rounded-2xl p-6 h-full flex flex-col transition-all duration-300 ease-out 
                  hover:-translate-y-1.5 hover:scale-[1.02] hover:shadow-2xl hover:shadow-teal-500/5
                  ${plan.highlighted 
                    ? "bg-gradient-to-b from-slate-900 to-slate-950 border-teal-500/40 shadow-xl border-2" 
                    : "bg-slate-950/60 border border-slate-800/80 hover:border-teal-500/30"
                  }`}
              >
                {plan.badge && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span className={`text-[10px] uppercase font-bold tracking-wider px-3 py-1 rounded-full shadow-md ${
                      plan.highlighted ? "bg-teal-500 text-black" : "bg-slate-800 text-slate-200 border border-slate-700"
                    }`}>
                      {plan.badge}
                    </span>
                  </div>
                )}
                
                <div className="mb-4 mt-2">
                  <h3 className="text-md font-bold text-white">{plan.name}</h3>
                  <p className="text-xs text-slate-400 mt-1">{plan.desc}</p>
                </div>

                <div className="flex items-baseline gap-1 mb-5">
                  <span className="text-4xl font-extrabold text-white tracking-tight">{plan.price}</span>
                  <span className="text-xs text-slate-500 font-medium">{plan.period}</span>
                </div>

                <ul className="space-y-3 mb-8 flex-1">
                  {plan.features.map(f => (
                    <li key={f} className="flex items-start gap-2.5">
                      <CheckCircle size={13} className="text-teal-400 flex-shrink-0 mt-0.5" />
                      <span className="text-xs text-slate-200 leading-tight">{f}</span>
                    </li>
                  ))}
                </ul>

                <Link href={plan.href}
                  className={`w-full flex items-center justify-center gap-1.5 py-3 rounded-xl text-xs font-semibold transition-all ${
                    plan.highlighted
                      ? "bg-teal-500 hover:bg-teal-600 text-black shadow-lg shadow-teal-500/10"
                      : "bg-slate-900 hover:bg-slate-850 text-white border border-slate-800 hover:border-slate-700"
                  }`}
                >
                  {plan.cta}
                  <ChevronRight size={14} />
                </Link>
              </div>
            </FadeIn>
          ))}
        </div>
      </section>

      {/* ── FAQ ── */}
      <section id="faq" className="relative z-10 py-24 px-4 border-t border-slate-900 max-w-3xl mx-auto">
        <FadeIn className="text-center mb-12">
          <span className="text-xs font-bold text-teal-400 uppercase tracking-widest">Support</span>
          <h2 className="text-3xl font-bold text-white mt-3">Common Questions</h2>
        </FadeIn>
        <div className="space-y-3">
          {FAQS.map((faq, i) => (
            <div key={i} className={`bg-slate-950/40 rounded-xl border transition-colors ${openFaq === i ? "border-teal-500/20" : "border-slate-900"}`}>
              <button onClick={() => setOpenFaq(openFaq === i ? null : i)} className="w-full flex items-center justify-between px-5 py-4 text-left">
                <span className="text-xs md:text-sm font-semibold text-white pr-4">{faq.q}</span>
                <ChevronRight size={14} className={`text-slate-500 transition-transform ${openFaq === i ? "rotate-90" : ""}`} />
              </button>
              {openFaq === i && (
                <div className="px-5 pb-4 border-t border-slate-900/50 pt-3">
                  <p className="text-xs md:text-sm text-slate-400 leading-relaxed">{faq.a}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="relative z-10 border-t border-slate-900 bg-slate-950/40 px-4 py-8">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded-md bg-teal-500/10 flex items-center justify-center">
              <Brain size={12} className="text-teal-400" />
            </div>
            <span className="text-xs font-bold text-white tracking-wide">TalentIQ</span>
          </div>
          <p className="text-[11px] text-slate-500 text-center">
            &copy; {new Date().getFullYear()} TalentIQ. Secure automated recruitment workflows.
          </p>
          <div className="flex items-center gap-4 text-[11px] text-slate-500">
            <span className="hover:text-slate-400 cursor-pointer">Privacy Policy</span>
            <span className="hover:text-slate-400 cursor-pointer">Terms of Service</span>
          </div>
        </div>
      </footer>
    </div>
  );
}