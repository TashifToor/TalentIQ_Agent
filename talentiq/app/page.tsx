'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'

export default function LandingPage() {
  const [scrolled, setScrolled] = useState(false)
  const [mobileNavOpen, setMobileNavOpen] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 50)
    window.addEventListener('scroll', onScroll)
    const obs = new IntersectionObserver(entries => entries.forEach(e => { if (e.isIntersecting) e.target.classList.add('visible') }), { threshold: 0.12 })
    document.querySelectorAll('.reveal').forEach(el => obs.observe(el))
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const NAV_LINKS = ['Interview Modes', 'How it works', 'Get started']

  return (
    <div style={{ background: 'var(--paper)', color: 'var(--ink)', fontFamily: 'Inter, sans-serif' }}>

      {/* NAV */}
      <nav style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 200, height: 68,
        padding: '0 5%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        transition: 'all .4s', background: scrolled || mobileNavOpen ? 'rgba(247,245,240,.96)' : 'transparent',
        backdropFilter: scrolled || mobileNavOpen ? 'blur(20px)' : 'none',
        borderBottom: scrolled || mobileNavOpen ? '1px solid var(--border)' : '1px solid transparent',
      }}>
        <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none', fontFamily: "'Cormorant Garamond', serif", fontSize: 22, fontWeight: 600, color: 'var(--ink)' }}>
          <div style={{ width: 32, height: 32, background: 'var(--ink)', borderRadius: 9, display: 'grid', placeItems: 'center', flexShrink: 0 }}>
            <svg width="14" height="14" viewBox="0 0 16 16" fill="#e2b04a"><path d="M8 2C4.68 2 2 4.68 2 8c0 1.76.72 3.35 1.88 4.5L8 8.5l4.12 4A5.97 5.97 0 0014 8c0-3.32-2.68-6-6-6z" /></svg>
          </div>
          TalentIQ
        </Link>

        <div className="landing-nav-links" style={{ display: 'flex', gap: 36 }}>
          {NAV_LINKS.map(l => (
            <a key={l} href={`#${l.toLowerCase().replace(/ /g, '-')}`} style={{ fontSize: 13, fontWeight: 500, color: 'var(--ink2)', textDecoration: 'none' }}>{l}</a>
          ))}
        </div>

        <div className="landing-nav-cta" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Link href="/auth/login" style={{ fontSize: 13, fontWeight: 500, color: 'var(--ink2)', textDecoration: 'none', padding: '8px 16px', borderRadius: 8 }}>Log in</Link>
          <Link href="/auth/signup/hr" style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)', background: 'var(--gold2)', padding: '9px 20px', borderRadius: 8, textDecoration: 'none', transition: 'all .25s' }}>Start hiring</Link>
        </div>

        <button className="landing-nav-toggle" onClick={() => setMobileNavOpen(v => !v)} aria-label="Toggle menu"
          style={{ display: 'none', background: 'none', border: 'none', fontSize: 22, color: 'var(--ink)', cursor: 'pointer' }}>
          {mobileNavOpen ? '✕' : '☰'}
        </button>
      </nav>

      {mobileNavOpen && (
        <div className="landing-mobile-menu" style={{ position: 'fixed', top: 68, left: 0, right: 0, background: 'var(--paper)', borderBottom: '1px solid var(--border)', zIndex: 199, padding: '20px 5%', display: 'flex', flexDirection: 'column', gap: 16 }}>
          {NAV_LINKS.map(l => (
            <a key={l} href={`#${l.toLowerCase().replace(/ /g, '-')}`} onClick={() => setMobileNavOpen(false)} style={{ fontSize: 15, fontWeight: 500, color: 'var(--ink)', textDecoration: 'none' }}>{l}</a>
          ))}
          <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
            <Link href="/auth/login" style={{ flex: 1, textAlign: 'center', fontSize: 14, fontWeight: 600, color: 'var(--ink)', border: '1px solid var(--border)', padding: '11px', borderRadius: 8, textDecoration: 'none' }}>Log in</Link>
            <Link href="/auth/signup/hr" style={{ flex: 1, textAlign: 'center', fontSize: 14, fontWeight: 600, color: 'var(--ink)', background: 'var(--gold2)', padding: '11px', borderRadius: 8, textDecoration: 'none' }}>Start hiring</Link>
          </div>
        </div>
      )}

      {/* HERO */}
      <section id="hero" style={{ minHeight: '92vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '120px 5% 80px', textAlign: 'center', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', inset: 0, zIndex: 0 }}>
          <div style={{ position: 'absolute', inset: 0, backgroundImage: 'radial-gradient(circle, var(--border) 1px, transparent 1px)', backgroundSize: '36px 36px', opacity: .6 }} />
          <div className="drift" style={{ position: 'absolute', width: 600, height: 600, borderRadius: '50%', background: 'radial-gradient(circle, rgba(197,147,31,.15) 0%, transparent 70%)', top: '-10%', left: '-10%', filter: 'blur(80px)', opacity: .5 }} />
          <div className="drift drift-d1" style={{ position: 'absolute', width: 500, height: 500, borderRadius: '50%', background: 'radial-gradient(circle, rgba(11,107,87,.1) 0%, transparent 70%)', bottom: '-10%', right: '-5%', filter: 'blur(80px)', opacity: .5 }} />
        </div>

        <div style={{ position: 'relative', zIndex: 1, maxWidth: 860 }} className="landing-hero-inner">
          <div className="animate-fade-up" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: '#fff', border: '1px solid var(--border)', borderRadius: 100, padding: '6px 18px 6px 8px', fontSize: 12, fontWeight: 500, letterSpacing: '.06em', color: 'var(--ink2)', marginBottom: 36 }}>
            <div style={{ width: 22, height: 22, background: 'var(--gold2)', borderRadius: '50%', display: 'grid', placeItems: 'center' }}>
              <svg width="10" height="10" fill="none" viewBox="0 0 10 10" stroke="#fff" strokeWidth="2" strokeLinecap="round"><path d="M2 5l2.5 2.5L8 2.5" /></svg>
            </div>
            AI Hiring & Interview Platform
          </div>

          <h1 className="animate-fade-up d2 landing-hero-h1" style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 'clamp(40px,6vw,76px)', lineHeight: 1.08, letterSpacing: '-1.5px', marginBottom: 28 }}>
            <span style={{ color: 'var(--ink2)', fontWeight: 400 }}>Recruiters run AI interviews.</span>
            <br />
            <span style={{ fontWeight: 600, color: 'var(--ink)' }}>Candidates <em style={{ fontStyle: 'italic', color: 'var(--gold)', fontWeight: 400 }}>practice</em> for them here.</span>
          </h1>

          <p className="animate-fade-up d3" style={{ fontSize: 17, color: 'var(--ink2)', maxWidth: 580, margin: '0 auto 44px', lineHeight: 1.75, fontWeight: 400 }}>
            One platform, two sides of the same interview. HR teams build chat, assessment, and voice interviews and get evidence-based AI reports on every candidate. Candidates practice the exact same three formats before the real thing, with real feedback after every session.
          </p>

          <div className="animate-fade-up d4 landing-hero-ctas" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16, flexWrap: 'wrap', marginBottom: 72 }}>
            <Link href="/auth/signup/hr" style={{ display: 'inline-flex', alignItems: 'center', gap: 10, fontSize: 15, fontWeight: 600, color: 'var(--ink)', background: 'var(--gold2)', padding: '15px 32px', borderRadius: 10, textDecoration: 'none', transition: 'all .25s', letterSpacing: '.02em' }}>
              For Recruiters — Start Hiring →
            </Link>
            <Link href="/auth/signup/candidate" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 15, fontWeight: 600, color: 'var(--ink)', border: '1.5px solid var(--border)', background: '#fff', padding: '15px 28px', borderRadius: 10, textDecoration: 'none', transition: 'all .25s' }}>
              For Candidates — Practice Free →
            </Link>
          </div>

          {/* Real journeys, not a fake dashboard screenshot */}
          <div className="animate-fade-up d5 landing-journey-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2, background: 'var(--border)', maxWidth: 720, margin: '0 auto', borderRadius: 16, overflow: 'hidden' }}>
            <div style={{ background: '#fff', padding: '24px 22px', textAlign: 'left' }}>
              <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--gold)', marginBottom: 12 }}>For Hiring Teams</div>
              {['Create interview', 'AI interviews candidate', 'AI evaluates evidence', 'You get the report'].map((step, i) => (
                <div key={step} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, color: 'var(--ink2)', marginBottom: i < 3 ? 8 : 0 }}>
                  <span style={{ width: 18, height: 18, borderRadius: '50%', background: 'var(--gold-light)', color: 'var(--gold)', fontSize: 10, fontWeight: 700, display: 'grid', placeItems: 'center', flexShrink: 0 }}>{i + 1}</span>{step}
                </div>
              ))}
            </div>
            <div style={{ background: '#fff', padding: '24px 22px', textAlign: 'left' }}>
              <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--teal)', marginBottom: 12 }}>For Candidates</div>
              {['Upload your CV', 'Practice chat, MCQ, or voice', 'AI interviews you', 'Get real feedback'].map((step, i) => (
                <div key={step} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, color: 'var(--ink2)', marginBottom: i < 3 ? 8 : 0 }}>
                  <span style={{ width: 18, height: 18, borderRadius: '50%', background: 'rgba(11,107,87,.1)', color: 'var(--teal)', fontSize: 10, fontWeight: 700, display: 'grid', placeItems: 'center', flexShrink: 0 }}>{i + 1}</span>{step}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* MARQUEE — real capabilities only */}
      <div style={{ background: 'var(--ink)', padding: '18px 0', overflow: 'hidden' }}>
        <div className="animate-marquee" style={{ display: 'flex', whiteSpace: 'nowrap' }}>
          {Array(2).fill(['AI Chat Interviews', 'AI Assessments', 'Real-Time Voice Interviews', 'AI Feedback Reports', 'Interview Practice', 'CV & ATS Analysis', 'Hiring Copilot', 'Candidate Comparison']).flat().map((item, i) => (
            <div key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 12, padding: '0 32px', fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,.3)', letterSpacing: '.1em', textTransform: 'uppercase', borderRight: '1px solid rgba(255,255,255,.06)' }}>
              <div style={{ width: 4, height: 4, borderRadius: '50%', background: 'var(--gold2)' }} />
              {item}
            </div>
          ))}
        </div>
      </div>

      {/* AI INTERVIEW MODES */}
      <section id="interview-modes" style={{ padding: '110px 5%' }}>
        <div style={{ maxWidth: 1160, margin: '0 auto' }}>
          <p className="reveal" style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--gold)', marginBottom: 14 }}>Three Real Interview Formats</p>
          <h2 className="reveal" style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 'clamp(32px,4vw,52px)', color: 'var(--ink)', lineHeight: 1.1, letterSpacing: '-.5px', marginBottom: 20, maxWidth: 640 }}>
            Same three modes, whether you're building or practicing.
          </h2>
          <p className="reveal" style={{ fontSize: 15, color: 'var(--ink2)', maxWidth: 560, marginBottom: 56, lineHeight: 1.7 }}>
            HR picks one per role. Candidates practice all three, for free, before the real thing.
          </p>

          <div className="reveal landing-modes-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 20 }}>
            {[
              {
                icon: '💬', color: 'var(--gold)', bg: 'var(--gold-light)', title: 'AI Chat Interview',
                desc: 'Adaptive text conversation — the AI asks follow-ups based on what you actually say, not a fixed script.',
                points: ['Resume & JD aware', 'Dynamic follow-up questions', 'Project deep-dives'],
              },
              {
                icon: '📝', color: 'var(--teal)', bg: 'rgba(11,107,87,.08)', title: 'AI Assessment',
                desc: 'Structured multiple-choice evaluation across skill categories, with a server-enforced timer so it can\u2019t be gamed from the browser.',
                points: ['AI-generated or custom question bank', 'Per-question timer, backend-verified', 'Auto-scored, instant results'],
              },
              {
                icon: '🎙', color: '#7c3aed', bg: 'rgba(124,58,237,.08)', title: 'AI Voice Interview',
                desc: 'Real WebSocket voice with streaming speech-to-text and text-to-speech. You can interrupt the AI naturally; it stops and listens.',
                points: ['Live transcription as you speak', 'Real interruption support', 'Falls back to push-to-talk if your connection can\u2019t sustain real-time'],
              },
            ].map(m => (
              <div key={m.title} style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 16, padding: 28 }}>
                <div style={{ width: 46, height: 46, borderRadius: 12, background: m.bg, display: 'grid', placeItems: 'center', fontSize: 20, marginBottom: 18 }}>{m.icon}</div>
                <h3 style={{ fontSize: 17, fontWeight: 700, color: 'var(--ink)', marginBottom: 8 }}>{m.title}</h3>
                <p style={{ fontSize: 13.5, color: 'var(--ink3)', lineHeight: 1.7, marginBottom: 16 }}>{m.desc}</p>
                {m.points.map(p => (
                  <div key={p} style={{ display: 'flex', gap: 8, fontSize: 12.5, color: 'var(--ink2)', marginBottom: 6, alignItems: 'flex-start' }}>
                    <span style={{ color: m.color, flexShrink: 0 }}>◆</span>{p}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* HR vs CANDIDATE PILLARS */}
      <section style={{ background: 'var(--dark)', padding: '110px 5%' }}>
        <div style={{ maxWidth: 1160, margin: '0 auto' }} className="landing-audience-grid" >
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2, background: 'rgba(255,255,255,.06)', borderRadius: 20, overflow: 'hidden' }} className="landing-audience-inner">
            {/* HR */}
            <div style={{ background: 'var(--dark2)', padding: 44 }}>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 11, fontWeight: 600, letterSpacing: '.1em', textTransform: 'uppercase', padding: '6px 14px', borderRadius: 100, background: 'rgba(226,176,74,.12)', color: 'var(--gold2)', marginBottom: 24 }}>For Hiring Teams</div>
              <h3 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 30, color: '#fff', lineHeight: 1.2, marginBottom: 14, letterSpacing: '-.4px' }}>
                Create AI-powered interviews. Evaluate candidates with evidence. Decide faster.
              </h3>
              <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 11, marginBottom: 32 }}>
                {[
                  'Interview Builder — chat, assessment, or voice, per role',
                  'AI feedback reports with real evidence, not vibes',
                  'Hiring Copilot — JD analysis and interview-quality checks',
                  'Compare candidates by real scores, side by side',
                ].map(f => (
                  <li key={f} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, fontSize: 14, color: 'rgba(255,255,255,.7)' }}>
                    <span style={{ width: 18, height: 18, borderRadius: '50%', background: 'rgba(226,176,74,.2)', color: 'var(--gold2)', display: 'grid', placeItems: 'center', fontSize: 10, flexShrink: 0, marginTop: 2 }}>✓</span>{f}
                  </li>
                ))}
              </ul>
              <Link href="/auth/signup/hr" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 14, fontWeight: 600, padding: '13px 26px', borderRadius: 10, textDecoration: 'none', background: 'var(--gold2)', color: 'var(--ink)' }}>Start Hiring →</Link>
            </div>
            {/* Candidate */}
            <div style={{ background: 'var(--dark2)', padding: 44 }}>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 11, fontWeight: 600, letterSpacing: '.1em', textTransform: 'uppercase', padding: '6px 14px', borderRadius: 100, background: 'rgba(19,194,142,.12)', color: 'var(--teal2)', marginBottom: 24 }}>For Candidates</div>
              <h3 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 30, color: '#fff', lineHeight: 1.2, marginBottom: 14, letterSpacing: '-.4px' }}>
                Prepare with your CV. Practice the real formats. Walk in ready.
              </h3>
              <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 11, marginBottom: 32 }}>
                {[
                  'CV analysis against any job description, with a real match score',
                  'Practice chat, assessment, and voice interviews — unlimited',
                  'Personalized AI feedback after every practice session',
                  'Practice history so you can see yourself improve',
                ].map(f => (
                  <li key={f} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, fontSize: 14, color: 'rgba(255,255,255,.7)' }}>
                    <span style={{ width: 18, height: 18, borderRadius: '50%', background: 'rgba(19,194,142,.2)', color: 'var(--teal2)', display: 'grid', placeItems: 'center', fontSize: 10, flexShrink: 0, marginTop: 2 }}>✓</span>{f}
                  </li>
                ))}
              </ul>
              <Link href="/auth/signup/candidate" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 14, fontWeight: 600, padding: '13px 26px', borderRadius: 10, textDecoration: 'none', background: 'var(--teal2)', color: 'var(--ink)' }}>Practice Free →</Link>
            </div>
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section id="how-it-works" style={{ padding: '110px 5%' }}>
        <div style={{ maxWidth: 1000, margin: '0 auto' }}>
          <p className="reveal" style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--gold)', marginBottom: 14 }}>The Process</p>
          <h2 className="reveal" style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 'clamp(30px,4vw,44px)', color: 'var(--ink)', lineHeight: 1.15, letterSpacing: '-.4px', marginBottom: 48 }}>
            From job description<br /><em style={{ fontStyle: 'italic', color: 'var(--ink2)', fontWeight: 400 }}>to hiring decision.</em>
          </h2>
          <div className="reveal">
            {[
              { t: 'HR pastes a job description', p: 'Choose chat, assessment, or voice — the Interview Builder generates a shareable candidate link.' },
              { t: 'Candidate takes the interview', p: 'They open the link and go straight in — no account needed for a recruiter-created interview.' },
              { t: 'AI evaluates with evidence', p: 'Every score in the report is backed by something the AI actually observed — no invented conclusions.' },
              { t: 'HR reviews and decides', p: 'Read the report, compare candidates, and use the Hiring Copilot for a second pass on the JD or the shortlist.' },
            ].map((s, i) => (
              <div key={i} style={{ display: 'flex', gap: 20, padding: '20px 0', borderBottom: i < 3 ? '1px solid var(--border)' : 'none' }}>
                <div style={{ width: 36, height: 36, borderRadius: '50%', border: '1px solid var(--border)', display: 'grid', placeItems: 'center', fontFamily: "'Cormorant Garamond', serif", fontSize: 16, color: 'var(--ink3)', flexShrink: 0 }}>{i + 1}</div>
                <div><h4 style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)', marginBottom: 4 }}>{s.t}</h4><p style={{ fontSize: 13, color: 'var(--ink3)', lineHeight: 1.65 }}>{s.p}</p></div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* GET STARTED — honest, no fabricated pricing */}
      <section id="get-started" style={{ background: 'var(--paper2)', padding: '110px 5%' }}>
        <div style={{ maxWidth: 1000, margin: '0 auto' }}>
          <p className="reveal" style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--gold)', marginBottom: 14 }}>Get Started</p>
          <h2 className="reveal" style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 'clamp(32px,4vw,48px)', color: 'var(--ink)', lineHeight: 1.1, letterSpacing: '-.5px', marginBottom: 16 }}>Pick your side.</h2>
          <p className="reveal" style={{ fontSize: 15, color: 'var(--ink2)', marginBottom: 56 }}>No credit card to try either one.</p>
          <div className="reveal landing-cta-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
            <div style={{ background: 'var(--ink)', borderRadius: 20, padding: 44 }}>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 11, fontWeight: 600, letterSpacing: '.1em', textTransform: 'uppercase', padding: '6px 14px', borderRadius: 100, background: 'rgba(255,255,255,.08)', color: 'rgba(255,255,255,.5)', marginBottom: 24 }}>For Job Seekers</div>
              <h3 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 30, color: '#fff', lineHeight: 1.2, marginBottom: 14 }}>Practice free, anytime.</h3>
              <p style={{ fontSize: 14.5, color: 'rgba(255,255,255,.45)', lineHeight: 1.75, marginBottom: 28 }}>CV analysis, and unlimited chat/assessment/voice practice interviews with real AI feedback after each one.</p>
              <Link href="/auth/signup/candidate" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 14, fontWeight: 600, padding: '13px 26px', borderRadius: 10, textDecoration: 'none', background: 'var(--gold2)', color: 'var(--ink)' }}>Start as Candidate →</Link>
            </div>
            <div style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 20, padding: 44 }}>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 11, fontWeight: 600, letterSpacing: '.1em', textTransform: 'uppercase', padding: '6px 14px', borderRadius: 100, background: 'var(--paper2)', color: 'var(--ink3)', marginBottom: 24 }}>For HR Teams</div>
              <h3 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 30, color: 'var(--ink)', lineHeight: 1.2, marginBottom: 14 }}>Try the full builder free.</h3>
              <p style={{ fontSize: 14.5, color: 'var(--ink3)', lineHeight: 1.75, marginBottom: 28 }}>Build chat, assessment, and voice interviews and get AI reports on every candidate during your trial.</p>
              <Link href="/auth/signup/hr" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 14, fontWeight: 600, padding: '13px 26px', borderRadius: 10, textDecoration: 'none', background: 'var(--ink)', color: '#fff' }}>Start HR Trial →</Link>
            </div>
          </div>
        </div>
      </section>

      {/* FOOTER — every link real */}
      <footer style={{ background: 'var(--dark)', padding: '80px 5% 36px' }}>
        <div style={{ maxWidth: 1160, margin: '0 auto' }}>
          <div className="landing-footer-grid" style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 48, marginBottom: 64 }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontFamily: "'Cormorant Garamond', serif", fontSize: 20, fontWeight: 600, color: 'rgba(255,255,255,.9)', marginBottom: 12 }}>
                <div style={{ width: 28, height: 28, background: 'var(--gold2)', borderRadius: 7, display: 'grid', placeItems: 'center' }}><svg width="13" height="13" viewBox="0 0 16 16" fill="#0a0a09"><path d="M8 2C4.68 2 2 4.68 2 8c0 1.76.72 3.35 1.88 4.5L8 8.5l4.12 4A5.97 5.97 0 0014 8c0-3.32-2.68-6-6-6z" /></svg></div>
                TalentIQ
              </div>
              <p style={{ fontSize: 14, color: 'rgba(255,255,255,.35)', lineHeight: 1.75, maxWidth: 280 }}>AI interviews for hiring teams. AI practice for candidates. Same platform, evidence-based reports on both sides.</p>
            </div>
            <div>
              <h5 style={{ fontSize: 11, fontWeight: 600, letterSpacing: '.12em', textTransform: 'uppercase', color: 'rgba(255,255,255,.3)', marginBottom: 18 }}>Product</h5>
              <a href="#interview-modes" style={{ display: 'block', fontSize: 14, color: 'rgba(255,255,255,.4)', textDecoration: 'none', marginBottom: 10 }}>Interview Modes</a>
              <a href="#how-it-works" style={{ display: 'block', fontSize: 14, color: 'rgba(255,255,255,.4)', textDecoration: 'none', marginBottom: 10 }}>How it works</a>
              <a href="#get-started" style={{ display: 'block', fontSize: 14, color: 'rgba(255,255,255,.4)', textDecoration: 'none', marginBottom: 10 }}>Get started</a>
            </div>
            <div>
              <h5 style={{ fontSize: 11, fontWeight: 600, letterSpacing: '.12em', textTransform: 'uppercase', color: 'rgba(255,255,255,.3)', marginBottom: 18 }}>Company</h5>
              <Link href="/privacy" style={{ display: 'block', fontSize: 14, color: 'rgba(255,255,255,.4)', textDecoration: 'none', marginBottom: 10 }}>Privacy</Link>
              <Link href="/terms" style={{ display: 'block', fontSize: 14, color: 'rgba(255,255,255,.4)', textDecoration: 'none', marginBottom: 10 }}>Terms</Link>
            </div>
          </div>
          <div style={{ borderTop: '1px solid rgba(255,255,255,.06)', paddingTop: 28, display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 13, color: 'rgba(255,255,255,.25)', flexWrap: 'wrap', gap: 8 }}>
            <span>© 2026 TalentIQ · All rights reserved</span>
            <span>Built for people who care about hiring well</span>
          </div>
        </div>
      </footer>
    </div>
  )
}