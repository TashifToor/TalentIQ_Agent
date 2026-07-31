'use client'
import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'

export default function LandingPage() {
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 50)
    window.addEventListener('scroll', onScroll)
    const obs = new IntersectionObserver(entries => entries.forEach(e => { if (e.isIntersecting) e.target.classList.add('visible') }), { threshold: 0.12 })
    document.querySelectorAll('.reveal').forEach(el => obs.observe(el))
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <div style={{ background: 'var(--paper)', color: 'var(--ink)', fontFamily: 'Inter, sans-serif' }}>

      {/* NAV */}
      <nav style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 200, height: 68,
        padding: '0 5%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        transition: 'all .4s', background: scrolled ? 'rgba(247,245,240,.96)' : 'transparent',
        backdropFilter: scrolled ? 'blur(20px)' : 'none',
        borderBottom: scrolled ? '1px solid var(--border)' : '1px solid transparent',
      }}>
        <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none', fontFamily: "'Cormorant Garamond', serif", fontSize: 22, fontWeight: 600, color: 'var(--ink)' }}>
          <div style={{ width: 32, height: 32, background: 'var(--ink)', borderRadius: 9, display: 'grid', placeItems: 'center', flexShrink: 0 }}>
            <svg width="14" height="14" viewBox="0 0 16 16" fill="#e2b04a"><path d="M8 2C4.68 2 2 4.68 2 8c0 1.76.72 3.35 1.88 4.5L8 8.5l4.12 4A5.97 5.97 0 0014 8c0-3.32-2.68-6-6-6z" /></svg>
          </div>
          TalentIQ
        </Link>
        <div style={{ display: 'flex', gap: 36 }}>
          {['Features', 'How it works', 'Pricing'].map(l => (
            <a key={l} href={`#${l.toLowerCase().replace(/ /g, '-')}`} style={{ fontSize: 13, fontWeight: 500, color: 'var(--ink2)', textDecoration: 'none' }}>{l}</a>
          ))}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Link href="/auth/login" style={{ fontSize: 13, fontWeight: 500, color: 'var(--ink2)', textDecoration: 'none', padding: '8px 16px', borderRadius: 8 }}>Log in</Link>
          <Link href="/auth/login" style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)', background: 'var(--gold2)', padding: '9px 20px', borderRadius: 8, textDecoration: 'none', transition: 'all .25s' }}>Try free</Link>
        </div>
      </nav>

      {/* HERO */}
      <section id="hero" style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '120px 5% 80px', textAlign: 'center', position: 'relative', overflow: 'hidden' }}>
        {/* BG */}
        <div style={{ position: 'absolute', inset: 0, zIndex: 0 }}>
          <div style={{ position: 'absolute', inset: 0, backgroundImage: 'radial-gradient(circle, var(--border) 1px, transparent 1px)', backgroundSize: '36px 36px', opacity: .6 }} />
          <div className="drift" style={{ position: 'absolute', width: 600, height: 600, borderRadius: '50%', background: 'radial-gradient(circle, rgba(197,147,31,.15) 0%, transparent 70%)', top: '-10%', left: '-10%', filter: 'blur(80px)', opacity: .5 }} />
          <div className="drift drift-d1" style={{ position: 'absolute', width: 500, height: 500, borderRadius: '50%', background: 'radial-gradient(circle, rgba(11,107,87,.1) 0%, transparent 70%)', bottom: '-10%', right: '-5%', filter: 'blur(80px)', opacity: .5 }} />
        </div>

        {/* Floating chips */}
        {[
          { text: '✓  Match score: 91%', style: { bottom: '26%', left: '7%' }, color: 'var(--teal)' },
          { text: '⚡ Analyzed in 1.9s', style: { top: '30%', right: '6%' }, color: 'var(--gold)' },
          { text: '📋 18 candidates ranked', style: { bottom: '33%', right: '8%' }, color: 'var(--ink2)' },
          { text: '🎯 2 skill gaps found', style: { top: '36%', left: '6%' }, color: 'var(--ink3)' },
        ].map((chip, i) => (
          <div key={i} className={`animate-float float-d${i}`} style={{ position: 'absolute', background: '#fff', border: '1px solid var(--border)', borderRadius: 8, padding: '9px 14px', fontSize: 12, fontWeight: 600, boxShadow: '0 4px 20px rgba(0,0,0,.07)', zIndex: 2, color: chip.color, ...chip.style }}>
            {chip.text}
          </div>
        ))}

        <div style={{ position: 'relative', zIndex: 1, maxWidth: 820 }}>
          {/* Eyebrow */}
          <div className="animate-fade-up" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: '#fff', border: '1px solid var(--border)', borderRadius: 100, padding: '6px 18px 6px 8px', fontSize: 12, fontWeight: 500, letterSpacing: '.06em', color: 'var(--ink2)', marginBottom: 36 }}>
            <div style={{ width: 22, height: 22, background: 'var(--gold2)', borderRadius: '50%', display: 'grid', placeItems: 'center' }}>
              <svg width="10" height="10" fill="none" viewBox="0 0 10 10" stroke="#fff" strokeWidth="2" strokeLinecap="round"><path d="M2 5l2.5 2.5L8 2.5" /></svg>
            </div>
            Intelligent Recruitment Platform
          </div>

          {/* Headline */}
          <h1 className="animate-fade-up d2" style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 'clamp(52px,7vw,88px)', lineHeight: 1.04, letterSpacing: '-1.5px', marginBottom: 28 }}>
            <span style={{ color: 'var(--ink2)', fontWeight: 400 }}>Hire the right people.</span>
            <br />
            <span style={{ fontWeight: 600, color: 'var(--ink)' }}>Faster than <em style={{ fontStyle: 'italic', color: 'var(--gold)', fontWeight: 400 }}>ever before.</em></span>
          </h1>

          <p className="animate-fade-up d3" style={{ fontSize: 17, color: 'var(--ink2)', maxWidth: 520, margin: '0 auto 44px', lineHeight: 1.75, fontWeight: 400 }}>
            Upload a CV, set your role criteria, and get a comprehensive match score with skill analysis in under 3 seconds. No guesswork. No bias. Just clarity.
          </p>

          {/* CTAs */}
          <div className="animate-fade-up d4" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16, flexWrap: 'wrap', marginBottom: 72 }}>
            <Link href="/auth/login" style={{ display: 'inline-flex', alignItems: 'center', gap: 10, fontSize: 15, fontWeight: 600, color: 'var(--ink)', background: 'var(--gold2)', padding: '15px 32px', borderRadius: 10, textDecoration: 'none', transition: 'all .25s', letterSpacing: '.02em' }}>
              Try 3 free scans — no signup →
            </Link>
            <button style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 15, color: 'var(--ink)', border: '1.5px solid var(--border)', background: 'transparent', padding: '15px 28px', borderRadius: 10, cursor: 'pointer', transition: 'all .25s' }}>
              <svg width="15" height="15" fill="none" viewBox="0 0 15 15"><circle cx="7.5" cy="7.5" r="6" stroke="currentColor" strokeWidth="1.3" /><path d="M6 5.5l3 2-3 2V5.5z" fill="currentColor" /></svg>
              Watch demo
            </button>
          </div>

          {/* Hero scan widget */}
          <div className="animate-fade-up d5" style={{ background: '#fff', border: '1.5px solid var(--border)', borderRadius: 20, maxWidth: 520, margin: '0 auto', overflow: 'hidden', boxShadow: '0 12px 56px rgba(0,0,0,.08)' }}>
            <div style={{ padding: '18px 24px', borderBottom: '1px solid var(--paper2)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: '.08em', color: 'var(--ink)', textTransform: 'uppercase' }}>CV ANALYZER</span>
              <span style={{ background: 'var(--gold-light)', color: 'var(--gold)', fontSize: 11, fontWeight: 700, padding: '4px 12px', borderRadius: 100, border: '1px solid rgba(197,147,31,.2)' }}>3 free scans</span>
            </div>
            <div style={{ padding: 24 }}>
              <div style={{ border: '2px dashed var(--border)', borderRadius: 12, padding: 28, textAlign: 'center', cursor: 'pointer', background: 'var(--paper)', marginBottom: 14 }}>
                <div style={{ fontSize: 28, marginBottom: 8 }}>📄</div>
                <p style={{ fontSize: 13, color: 'var(--ink2)' }}><strong>Drop your CV here</strong> or click to upload</p>
                <p style={{ fontSize: 11, color: 'var(--ink3)', marginTop: 4 }}>PDF or DOCX · No account needed</p>
              </div>
              <div style={{ background: 'var(--paper2)', borderRadius: 8, padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div><strong style={{ fontSize: 13, color: 'var(--ink)' }}>Free scans remaining</strong><br /><span style={{ fontSize: 11, color: 'var(--ink3)' }}>3 scans before sign-up required</span></div>
                <div style={{ display: 'flex', gap: 6 }}>
                  {[1, 2, 3].map(i => (
                    <div key={i} style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--gold2)', display: 'grid', placeItems: 'center' }}>
                      <svg width="12" height="12" fill="none" viewBox="0 0 12 12" stroke="var(--ink)" strokeWidth="2" strokeLinecap="round"><path d="M2 6l3 3 5-5" /></svg>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* MARQUEE */}
      <div style={{ background: 'var(--ink)', padding: '18px 0', overflow: 'hidden' }}>
        <div className="animate-marquee" style={{ display: 'flex', whiteSpace: 'nowrap' }}>
          {Array(2).fill(['CV Scoring', 'Skill Gap Detection', 'HR Policy Chatbot', 'Bulk Screening', 'Role Matching', 'Candidate Ranking', 'Bias-Free Hiring', 'Instant Insights']).flat().map((item, i) => (
            <div key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 12, padding: '0 32px', fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,.3)', letterSpacing: '.1em', textTransform: 'uppercase', borderRight: '1px solid rgba(255,255,255,.06)' }}>
              <div style={{ width: 4, height: 4, borderRadius: '50%', background: 'var(--gold2)' }} />
              {item}
            </div>
          ))}
        </div>
      </div>

      {/* FEATURES */}
      <section id="features" style={{ padding: '110px 5%' }}>
        <div style={{ maxWidth: 1160, margin: '0 auto' }}>
          <p className="reveal" style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--gold)', marginBottom: 14 }}>What We Do</p>
          <h2 className="reveal" style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 'clamp(36px,4vw,56px)', color: 'var(--ink)', lineHeight: 1.1, letterSpacing: '-.5px', marginBottom: 64 }}>
            Smart screening.<br /><em style={{ fontStyle: 'italic', color: 'var(--ink2)', fontWeight: 400 }}>Real results.</em>
          </h2>
          <div className="reveal" style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 2, background: 'var(--border)' }}>
            {[
              { n: '01', t: 'Instant CV Analysis', p: 'Upload any CV and get a detailed match score with reasoning, skill breakdown, and role fit assessment — within seconds.' },
              { n: '02', t: 'Skill Gap Detection', p: 'Automatically surfaces missing skills from job description requirements. Helps candidates improve, helps HR shortlist faster.' },
              { n: '03', t: 'Policy Chatbot', p: 'HR teams upload company documents and policies. Get instant, accurate answers to employee questions — 24/7.' },
              { n: '04', t: 'Bulk Candidate Ranking', p: 'Screen 50+ CVs at once. Get a ranked shortlist with scores and reasoning so you never miss a great candidate.', dark: true },
              { n: '05', t: 'Explainable Scores', p: 'Every score comes with a breakdown. Candidates understand exactly where they stand. Hiring managers can defend every decision.' },
              { n: '06', t: 'Role-Based Portals', p: 'Separate dashboards for candidates and HR teams — each tailored to their workflow, data visibility, and goals.' },
            ].map(f => (
              <div key={f.n} style={{ background: f.dark ? 'var(--ink)' : 'var(--paper)', padding: 36, transition: 'background .25s', cursor: 'default' }}
                onMouseOver={e => { if (!f.dark) (e.currentTarget as HTMLElement).style.background = '#fff' }}
                onMouseOut={e => { if (!f.dark) (e.currentTarget as HTMLElement).style.background = 'var(--paper)' }}>
                <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 48, color: f.dark ? 'rgba(255,255,255,.08)' : 'var(--paper3)', fontWeight: 600, lineHeight: 1, marginBottom: 20 }}>{f.n}</div>
                <h3 style={{ fontSize: 16, fontWeight: 600, color: f.dark ? '#fff' : 'var(--ink)', marginBottom: 10, letterSpacing: '-.2px' }}>{f.t}</h3>
                <p style={{ fontSize: 14, color: f.dark ? 'rgba(255,255,255,.4)' : 'var(--ink3)', lineHeight: 1.75 }}>{f.p}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section id="how-it-works" style={{ background: 'var(--dark)', padding: '110px 5%' }}>
        <div style={{ maxWidth: 1000, margin: '0 auto', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 80, alignItems: 'center' }}>
          <div>
            <p className="reveal" style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--gold2)', marginBottom: 14 }}>The Process</p>
            <h2 className="reveal" style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 'clamp(32px,4vw,48px)', color: '#fff', lineHeight: 1.15, letterSpacing: '-.4px', marginBottom: 40 }}>
              From upload to insight<br /><em style={{ fontStyle: 'italic', color: 'rgba(255,255,255,.35)', fontWeight: 400 }}>in under 5 seconds.</em>
            </h2>
            <div className="reveal">
              {[
                { n: '1', t: 'Upload your CV or job description', p: 'Drop a PDF or paste text. Structure, content, and skills extracted automatically.' },
                { n: '2', t: 'Set the role requirements', p: 'Paste a job description or choose from common role templates pre-built for you.' },
                { n: '3', t: 'AI runs the full analysis', p: 'A multi-step pipeline grades relevance, gaps, and strengths — then generates human-readable reasoning.' },
                { n: '4', t: 'Read your score and next steps', p: 'Get a 0–100 match score with detailed breakdown, missing skills, and actionable improvements.' },
              ].map((s, i) => (
                <div key={i} style={{ display: 'flex', gap: 20, padding: '22px 0', borderBottom: i < 3 ? '1px solid rgba(255,255,255,.06)' : 'none', cursor: 'default', transition: 'padding .2s' }}
                  onMouseOver={e => (e.currentTarget as HTMLElement).style.paddingLeft = '8px'}
                  onMouseOut={e => (e.currentTarget as HTMLElement).style.paddingLeft = '0'}>
                  <div style={{ width: 36, height: 36, borderRadius: '50%', border: '1px solid rgba(255,255,255,.1)', display: 'grid', placeItems: 'center', fontFamily: "'Cormorant Garamond', serif", fontSize: 16, color: 'rgba(255,255,255,.4)', flexShrink: 0, transition: 'all .25s' }}>{s.n}</div>
                  <div><h4 style={{ fontSize: 14, fontWeight: 600, color: 'rgba(255,255,255,.85)', marginBottom: 4 }}>{s.t}</h4><p style={{ fontSize: 13, color: 'rgba(255,255,255,.35)', lineHeight: 1.65 }}>{s.p}</p></div>
                </div>
              ))}
            </div>
          </div>

          {/* Score Mock */}
          <div className="reveal" style={{ background: '#161614', border: '1px solid rgba(255,255,255,.07)', borderRadius: 20, padding: 28, position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: 'linear-gradient(90deg, var(--gold) 0%, var(--teal2) 60%, transparent 100%)' }} />
            <svg width="0" height="0"><defs><linearGradient id="rg" x1="0" y1="0" x2="1" y2="0"><stop offset="0%" stopColor="#c5931f" /><stop offset="100%" stopColor="#13c28e" /></linearGradient></defs></svg>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,.3)', letterSpacing: '.1em', textTransform: 'uppercase' }}>Match Analysis</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--teal2)', fontWeight: 500 }}>
                <div className="live-pulse" style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--teal2)' }} />Live
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 20, marginBottom: 24 }}>
              <div style={{ position: 'relative', width: 88, height: 88, flexShrink: 0 }}>
                <svg width="88" height="88" viewBox="0 0 88 88" style={{ transform: 'rotate(-90deg)' }}>
                  <circle cx="44" cy="44" r="35" fill="none" stroke="#1e1e1b" strokeWidth="8" />
                  <circle className="ring-anim" cx="44" cy="44" r="35" fill="none" stroke="url(#rg)" strokeWidth="8" strokeLinecap="round" strokeDasharray="220" strokeDashoffset="33" style={{ '--ring-end': '33' } as React.CSSProperties} />
                </svg>
                <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                  <span style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 28, fontWeight: 600, color: '#fff', lineHeight: 1 }}>85</span>
                  <small style={{ fontSize: 10, color: 'rgba(255,255,255,.4)', marginTop: 2 }}>/ 100</small>
                </div>
              </div>
              <div>
                <h4 style={{ fontSize: 15, fontWeight: 600, color: '#fff', marginBottom: 4 }}>Aisha Rao</h4>
                <p style={{ fontSize: 12, color: 'rgba(255,255,255,.4)', marginBottom: 10 }}>Senior Frontend Engineer</p>
                <span style={{ background: 'rgba(11,107,87,.2)', color: 'var(--teal2)', fontSize: 11, padding: '3px 10px', borderRadius: 100, fontWeight: 600 }}>Strong Match</span>
              </div>
            </div>
            {[
              { l: 'Skills', w: '92%', d: '.2s', gold: true }, { l: 'Experience', w: '78%', d: '.4s', gold: false },
              { l: 'Role Fit', w: '85%', d: '.6s', gold: true }, { l: 'Gaps', w: '24%', d: '.8s', gold: false },
            ].map(b => (
              <div key={b.l} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                <span style={{ fontSize: 11, color: 'rgba(255,255,255,.4)', width: 72, flexShrink: 0 }}>{b.l}</span>
                <div style={{ flex: 1, height: 5, background: '#1e1e1b', borderRadius: 3, overflow: 'hidden' }}>
                  <div className="bar-anim" style={{ height: '100%', borderRadius: 3, background: b.gold ? 'linear-gradient(90deg,var(--gold),var(--gold2))' : 'linear-gradient(90deg,var(--teal),var(--teal2))', '--bw': b.w, animationDelay: b.d } as React.CSSProperties} />
                </div>
                <span style={{ fontSize: 11, color: 'rgba(255,255,255,.4)', width: 30, textAlign: 'right' }}>{b.w}</span>
              </div>
            ))}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 12 }}>
              {[['React', true], ['TypeScript', true], ['Node.js', true], ['Docker', false], ['K8s', false]].map(([s, m]) => (
                <span key={String(s)} style={{ fontSize: 11, padding: '4px 10px', borderRadius: 100, background: m ? 'rgba(11,107,87,.15)' : '#1e1e1b', color: m ? 'var(--teal2)' : 'rgba(255,255,255,.35)', border: `1px solid ${m ? 'rgba(19,148,118,.2)' : 'rgba(255,255,255,.06)'}` }}>{String(s)}</span>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* FREE SCANS BANNER */}
      <section style={{ background: 'var(--dark)', padding: '80px 5%', textAlign: 'center', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: 600, height: 300, background: 'radial-gradient(ellipse, rgba(197,147,31,.1), transparent 70%)' }} />
        <h2 className="reveal" style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 'clamp(36px,4vw,54px)', color: '#fff', marginBottom: 16, position: 'relative', zIndex: 1, letterSpacing: '-.5px' }}>
          Start for free.<br /><em style={{ fontStyle: 'italic', color: 'var(--gold2)' }}>No credit card. No account.</em>
        </h2>
        <p className="reveal" style={{ fontSize: 16, color: 'rgba(255,255,255,.4)', marginBottom: 40, position: 'relative', zIndex: 1 }}>Your first 3 CV scans are completely free.</p>
        <div className="reveal" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, marginBottom: 40, position: 'relative', zIndex: 1 }}>
          {[1, 2, 3].map((n, i) => (
            <>
              {i > 0 && <span key={`p${n}`} style={{ color: 'rgba(255,255,255,.2)', fontSize: 20 }}>+</span>}
              <div key={n} style={{ width: 72, height: 72, borderRadius: '50%', background: 'rgba(255,255,255,.06)', border: '1px solid rgba(255,255,255,.1)', display: 'grid', placeItems: 'center', fontFamily: "'Cormorant Garamond', serif", fontSize: 28, color: 'var(--gold2)', cursor: 'default', transition: 'all .3s' }}>{n}</div>
            </>
          ))}
        </div>
        <Link href="/auth/login" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 15, fontWeight: 600, color: 'var(--ink)', background: 'var(--gold2)', padding: '15px 32px', borderRadius: 10, textDecoration: 'none', position: 'relative', zIndex: 1 }}>
          Scan your first CV free →
        </Link>
      </section>

      {/* PRICING */}
      <section id="pricing" style={{ background: 'var(--paper2)', padding: '110px 5%' }}>
        <div style={{ maxWidth: 1000, margin: '0 auto' }}>
          <p className="reveal" style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--gold)', marginBottom: 14 }}>After Your 3 Free Scans</p>
          <h2 className="reveal" style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 'clamp(36px,4vw,56px)', color: 'var(--ink)', lineHeight: 1.1, letterSpacing: '-.5px', marginBottom: 16 }}>Choose your path.</h2>
          <p className="reveal" style={{ fontSize: 16, color: 'var(--ink2)', marginBottom: 64 }}>Two focused plans built for how you actually use TalentIQ.</p>
          <div className="reveal" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
            {/* Candidate */}
            <div style={{ background: 'var(--ink)', borderRadius: 20, padding: 44 }}>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 11, fontWeight: 600, letterSpacing: '.1em', textTransform: 'uppercase', padding: '6px 14px', borderRadius: 100, background: 'rgba(255,255,255,.08)', color: 'rgba(255,255,255,.5)', marginBottom: 28 }}>For Job Seekers</div>
              <h3 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 36, color: '#fff', lineHeight: 1.15, marginBottom: 12, letterSpacing: '-.4px' }}>Know your score<br />before you apply.</h3>
              <p style={{ fontSize: 15, color: 'rgba(255,255,255,.45)', lineHeight: 1.75, marginBottom: 28 }}>Scan your CV against any job description and get a full analysis, skill gap report, and improvement tips.</p>
              <div style={{ marginBottom: 28 }}>
                <span style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 52, fontWeight: 600, color: 'var(--gold2)' }}>$9</span>
                <span style={{ fontSize: 16, color: 'rgba(255,255,255,.3)' }}>/mo</span>
                <p style={{ fontSize: 13, color: 'rgba(255,255,255,.35)', marginTop: 4 }}>After 3 free scans · Cancel anytime</p>
              </div>
              <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 32 }}>
                {['Unlimited CV scans', 'Full match score + breakdown', 'Skill gap reports', 'CV improvement suggestions', 'Job role library access'].map(f => (
                  <li key={f} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 14, color: 'rgba(255,255,255,.7)' }}>
                    <span style={{ width: 18, height: 18, borderRadius: '50%', background: 'rgba(226,176,74,.2)', color: 'var(--gold2)', display: 'grid', placeItems: 'center', fontSize: 10, flexShrink: 0 }}>✓</span>{f}
                  </li>
                ))}
              </ul>
              <Link href="/auth/signup/candidate" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 14, fontWeight: 600, padding: '13px 26px', borderRadius: 10, textDecoration: 'none', background: 'var(--gold2)', color: 'var(--ink)', transition: 'all .25s' }}>Start as Candidate →</Link>
            </div>
            {/* HR */}
            <div style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 20, padding: 44 }}>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 11, fontWeight: 600, letterSpacing: '.1em', textTransform: 'uppercase', padding: '6px 14px', borderRadius: 100, background: 'var(--paper2)', color: 'var(--ink3)', marginBottom: 28 }}>For HR Teams</div>
              <h3 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 36, color: 'var(--ink)', lineHeight: 1.15, marginBottom: 12, letterSpacing: '-.4px' }}>Screen smarter.<br />Hire faster.</h3>
              <p style={{ fontSize: 15, color: 'var(--ink3)', lineHeight: 1.75, marginBottom: 28 }}>Bulk-screen candidates, rank your shortlist, and let your policy chatbot handle repetitive HR questions automatically.</p>
              <div style={{ marginBottom: 28 }}>
                <span style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 52, fontWeight: 600, color: 'var(--ink)' }}>$49</span>
                <span style={{ fontSize: 16, color: 'var(--ink3)' }}>/mo</span>
                <p style={{ fontSize: 13, color: 'var(--ink3)', marginTop: 4 }}>14-day free trial · No credit card needed</p>
              </div>
              <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 32 }}>
                {['Unlimited bulk CV screening', 'Ranked candidate shortlists', 'HR policy chatbot', 'Team workspace (up to 5 seats)', 'Export reports as PDF'].map(f => (
                  <li key={f} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 14, color: 'var(--ink2)' }}>
                    <span style={{ width: 18, height: 18, borderRadius: '50%', background: 'rgba(11,107,87,.1)', color: 'var(--teal)', display: 'grid', placeItems: 'center', fontSize: 10, flexShrink: 0 }}>✓</span>{f}
                  </li>
                ))}
              </ul>
              <Link href="/auth/signup/hr" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 14, fontWeight: 600, padding: '13px 26px', borderRadius: 10, textDecoration: 'none', background: 'var(--ink)', color: '#fff', transition: 'all .25s' }}>Start HR Trial →</Link>
            </div>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer style={{ background: 'var(--dark)', padding: '80px 5% 36px' }}>
        <div style={{ maxWidth: 1160, margin: '0 auto' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', gap: 48, marginBottom: 64 }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontFamily: "'Cormorant Garamond', serif", fontSize: 20, fontWeight: 600, color: 'rgba(255,255,255,.9)', marginBottom: 12 }}>
                <div style={{ width: 28, height: 28, background: 'var(--gold2)', borderRadius: 7, display: 'grid', placeItems: 'center' }}><svg width="13" height="13" viewBox="0 0 16 16" fill="#0a0a09"><path d="M8 2C4.68 2 2 4.68 2 8c0 1.76.72 3.35 1.88 4.5L8 8.5l4.12 4A5.97 5.97 0 0014 8c0-3.32-2.68-6-6-6z" /></svg></div>
                TalentIQ
              </div>
              <p style={{ fontSize: 14, color: 'rgba(255,255,255,.35)', lineHeight: 1.75, maxWidth: 280 }}>Smarter hiring for teams that value quality, speed, and fairness.</p>
            </div>
            {[
              { h: 'Product', links: ['Features', 'Pricing', 'Changelog', 'API'] },
              { h: 'For You', links: ['For Candidates', 'For HR Teams', 'For Agencies'] },
              { h: 'Company', links: ['About', 'Privacy', 'Terms', 'Contact'] },
            ].map(col => (
              <div key={col.h}>
                <h5 style={{ fontSize: 11, fontWeight: 600, letterSpacing: '.12em', textTransform: 'uppercase', color: 'rgba(255,255,255,.3)', marginBottom: 18 }}>{col.h}</h5>
                {col.links.map(l => <a key={l} href="#" style={{ display: 'block', fontSize: 14, color: 'rgba(255,255,255,.4)', textDecoration: 'none', marginBottom: 10 }}>{l}</a>)}
              </div>
            ))}
          </div>
          <div style={{ borderTop: '1px solid rgba(255,255,255,.06)', paddingTop: 28, display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 13, color: 'rgba(255,255,255,.25)' }}>
            <span>© 2025 TalentIQ · All rights reserved</span>
            <span>Built for people who care about hiring well</span>
          </div>
        </div>
      </footer>
    </div>
  )
}