'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'

export default function LandingPage() {
  const [scrolled, setScrolled] = useState(false)
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const [activeMode, setActiveMode] = useState(0)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 50)
    window.addEventListener('scroll', onScroll)
    const obs = new IntersectionObserver(entries => entries.forEach(e => { if (e.isIntersecting) e.target.classList.add('visible') }), { threshold: 0.12 })
    document.querySelectorAll('.reveal').forEach(el => obs.observe(el))
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const NAV_LINKS = ['Interview Modes', 'Voice AI', 'How it works', 'Get started']

  const MODES = [
    {
      icon: '💬', color: 'var(--gold)', bg: 'var(--gold-light)', title: 'AI Chat Interview',
      desc: 'Adaptive text conversation — the AI asks follow-ups based on what you actually say, not a fixed script.',
      points: ['Resume & JD aware', 'Dynamic follow-up questions', 'Project deep-dives'],
      preview: ['AI: Walk me through a backend system you designed.', 'You: I built a rate-limited ingestion pipeline for…', 'AI: What trade-off did that limiter force on you?'],
    },
    {
      icon: '📝', color: 'var(--teal)', bg: 'rgba(11,107,87,.08)', title: 'AI Assessment',
      desc: "Structured multiple-choice evaluation across skill categories, with a server-enforced timer so it can't be gamed from the browser.",
      points: ['AI-generated or custom question bank', 'Per-question timer, backend-verified', 'Auto-scored, instant results'],
      preview: ['Q4 of 12 · Backend fundamentals', 'What happens when a DB connection pool is exhausted?', '00:22 remaining · auto-submits on timeout'],
    },
    {
      icon: '🎙', color: '#7c3aed', bg: 'rgba(124,58,237,.08)', title: 'AI Voice Interview',
      desc: "Real WebSocket voice with streaming speech-to-text and text-to-speech. You can interrupt the AI naturally; it stops and listens.",
      points: ['Live transcription as you speak', 'Real interruption support', "Falls back to push-to-talk if your connection can't sustain real-time"],
      preview: ['AI (speaking): Tell me about a time you solved a difficult problem…', 'listening…', 'transcribing in real time'],
    },
  ]

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
            AI-Powered Hiring
          </div>

          <h1 className="animate-fade-up d2 landing-hero-h1" style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 'clamp(40px,6vw,76px)', lineHeight: 1.08, letterSpacing: '-1.5px', marginBottom: 28 }}>
            <span style={{ fontWeight: 600, color: 'var(--ink)' }}>Hire better people.</span>
            <br />
            <span style={{ color: 'var(--ink2)', fontWeight: 400 }}>With AI that <em style={{ fontStyle: 'italic', color: 'var(--gold)', fontWeight: 400 }}>actually</em> interviews them.</span>
          </h1>

          <p className="animate-fade-up d3" style={{ fontSize: 17, color: 'var(--ink2)', maxWidth: 580, margin: '0 auto 44px', lineHeight: 1.75, fontWeight: 400 }}>
            HR teams build chat, assessment, and voice interviews and get evidence-based AI reports on every candidate. Candidates get a modern prep experience — CV analysis, unlimited practice, and real feedback — before the interview that counts.
          </p>

          <div className="animate-fade-up d4 landing-hero-ctas" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16, flexWrap: 'wrap', marginBottom: 64 }}>
            <Link href="/auth/signup/hr" style={{ display: 'inline-flex', alignItems: 'center', gap: 10, fontSize: 15, fontWeight: 600, color: 'var(--ink)', background: 'var(--gold2)', padding: '15px 32px', borderRadius: 10, textDecoration: 'none', transition: 'all .25s', letterSpacing: '.02em' }}>
              Start Hiring →
            </Link>
            <Link href="/auth/signup/candidate" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 15, fontWeight: 600, color: 'var(--ink)', border: '1.5px solid var(--border)', background: '#fff', padding: '15px 28px', borderRadius: 10, textDecoration: 'none', transition: 'all .25s' }}>
              Practice an Interview
            </Link>
          </div>

          {/* Layered product visualization — real capabilities, illustrative interface */}
          <div className="animate-fade-up d5 landing-hero-visual" style={{ position: 'relative', maxWidth: 780, margin: '0 auto', height: 260 }}>
            <div style={{ position: 'absolute', left: 0, top: 20, width: '58%', background: '#fff', border: '1px solid var(--border)', borderRadius: 14, padding: 18, textAlign: 'left', boxShadow: '0 20px 50px -20px rgba(20,18,10,.18)' }}>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--gold)', marginBottom: 10 }}>Interview Builder · HR</div>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)', marginBottom: 6 }}>Senior Backend Engineer</div>
              <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
                {['Chat', 'Assessment', 'Voice'].map(t => (
                  <span key={t} style={{ fontSize: 10.5, fontWeight: 600, padding: '4px 9px', borderRadius: 100, background: 'var(--paper2)', color: 'var(--ink3)', border: '1px solid var(--border)' }}>{t}</span>
                ))}
              </div>
              <div style={{ fontSize: 12, color: 'var(--ink3)' }}>Shareable candidate link generated</div>
            </div>
            <div style={{ position: 'absolute', right: 0, bottom: 10, width: '54%', background: 'var(--dark2)', borderRadius: 14, padding: 18, textAlign: 'left', boxShadow: '0 20px 50px -20px rgba(20,18,10,.3)' }}>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--teal2)', marginBottom: 10 }}>AI Evaluation · Illustrative preview</div>
              {['Skills', 'Experience', 'Communication', 'Role Fit'].map((f, i) => (
                <div key={f} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 7 }}>
                  <span style={{ fontSize: 11.5, color: 'rgba(255,255,255,.55)', width: 92, flexShrink: 0 }}>{f}</span>
                  <div style={{ flex: 1, height: 5, borderRadius: 3, background: 'rgba(255,255,255,.1)', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${58 + i * 11}%`, borderRadius: 3, background: 'var(--teal2)' }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* TRUST / POSITIONING STRIP */}
      <div style={{ background: 'var(--ink)', padding: '18px 0', overflow: 'hidden' }}>
        <div className="animate-marquee" style={{ display: 'flex', whiteSpace: 'nowrap' }}>
          {Array(2).fill(['AI Chat Interviews', 'AI Assessments', 'Real-Time Voice Interviews', 'Candidate Intelligence', 'Interview Practice', 'CV & ATS Analysis', 'Hiring Copilot', 'Candidate Comparison']).flat().map((item, i) => (
            <div key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 12, padding: '0 32px', fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,.3)', letterSpacing: '.1em', textTransform: 'uppercase', borderRight: '1px solid rgba(255,255,255,.06)' }}>
              <div style={{ width: 4, height: 4, borderRadius: '50%', background: 'var(--gold2)' }} />
              {item}
            </div>
          ))}
        </div>
      </div>

      {/* AI INTERVIEW MODES — interactive selector */}
      <section id="interview-modes" style={{ padding: '110px 5%' }}>
        <div style={{ maxWidth: 1160, margin: '0 auto' }}>
          <p className="reveal" style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--gold)', marginBottom: 14 }}>Three Real Interview Formats</p>
          <h2 className="reveal" style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 'clamp(32px,4vw,52px)', color: 'var(--ink)', lineHeight: 1.1, letterSpacing: '-.5px', marginBottom: 20, maxWidth: 640 }}>
            One interview platform. Three ways to evaluate talent.
          </h2>
          <p className="reveal" style={{ fontSize: 15, color: 'var(--ink2)', maxWidth: 560, marginBottom: 56, lineHeight: 1.7 }}>
            HR picks one per role. Candidates practice all three, for free, before the real thing.
          </p>

          <div className="reveal landing-modes-layout" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 32, alignItems: 'start' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {MODES.map((m, i) => (
                <button
                  key={m.title}
                  onClick={() => setActiveMode(i)}
                  aria-pressed={activeMode === i}
                  style={{
                    textAlign: 'left', cursor: 'pointer', background: activeMode === i ? '#fff' : 'transparent',
                    border: `1px solid ${activeMode === i ? 'var(--border)' : 'transparent'}`,
                    borderRadius: 16, padding: 22, transition: 'all .25s',
                    boxShadow: activeMode === i ? '0 12px 30px -18px rgba(20,18,10,.2)' : 'none',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: activeMode === i ? 12 : 0 }}>
                    <div style={{ width: 42, height: 42, borderRadius: 11, background: m.bg, display: 'grid', placeItems: 'center', fontSize: 18, flexShrink: 0 }}>{m.icon}</div>
                    <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--ink)' }}>{m.title}</h3>
                  </div>
                  {activeMode === i && (
                    <>
                      <p style={{ fontSize: 13.5, color: 'var(--ink3)', lineHeight: 1.7, marginBottom: 14 }}>{m.desc}</p>
                      {m.points.map(p => (
                        <div key={p} style={{ display: 'flex', gap: 8, fontSize: 12.5, color: 'var(--ink2)', marginBottom: 6, alignItems: 'flex-start' }}>
                          <span style={{ color: m.color, flexShrink: 0 }}>◆</span>{p}
                        </div>
                      ))}
                    </>
                  )}
                </button>
              ))}
            </div>

            {/* Live preview panel — swaps with activeMode */}
            <div style={{ background: 'var(--dark)', borderRadius: 18, padding: 28, minHeight: 320, display: 'flex', flexDirection: 'column' }}>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: 'rgba(255,255,255,.35)', marginBottom: 18 }}>
                {MODES[activeMode].title} · Illustrative preview
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, flex: 1, justifyContent: 'center' }}>
                {MODES[activeMode].preview.map((line, i) => (
                  <div key={i} style={{
                    alignSelf: i % 2 === 0 ? 'flex-start' : 'flex-end',
                    maxWidth: '85%', background: i % 2 === 0 ? 'rgba(255,255,255,.06)' : 'var(--gold2)',
                    color: i % 2 === 0 ? 'rgba(255,255,255,.8)' : 'var(--ink)',
                    fontSize: 13, lineHeight: 1.6, padding: '10px 14px', borderRadius: 12,
                  }}>{line}</div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* THE AI INTERVIEWER — feature story */}
      <section id="ai-interviewer" style={{ background: 'var(--dark)', padding: '110px 5%' }}>
        <div style={{ maxWidth: 1000, margin: '0 auto', textAlign: 'center' }}>
          <p className="reveal" style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--gold2)', marginBottom: 14 }}>The AI Interviewer</p>
          <h2 className="reveal" style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 'clamp(30px,4vw,46px)', color: '#fff', lineHeight: 1.15, letterSpacing: '-.4px', marginBottom: 48 }}>
            It doesn't just ask questions.<br /><em style={{ fontStyle: 'italic', color: 'rgba(255,255,255,.5)', fontWeight: 400 }}>It listens for what matters.</em>
          </h2>

          <div className="reveal" style={{ background: 'var(--dark2)', borderRadius: 20, padding: 36, textAlign: 'left', maxWidth: 720, margin: '0 auto' }}>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: 'rgba(255,255,255,.3)', marginBottom: 20 }}>Chat interview · Illustrative preview</div>

            <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
              <div style={{ width: 26, height: 26, borderRadius: '50%', background: 'var(--gold2)', flexShrink: 0, display: 'grid', placeItems: 'center', fontSize: 11, fontWeight: 700, color: 'var(--ink)' }}>AI</div>
              <div style={{ background: 'rgba(255,255,255,.06)', borderRadius: 12, padding: '12px 16px', fontSize: 13.5, color: 'rgba(255,255,255,.85)', lineHeight: 1.6 }}>
                Tell me about a backend system you designed and one difficult trade-off you made.
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginBottom: 24 }}>
              <div style={{ background: 'var(--gold2)', borderRadius: 12, padding: '12px 16px', fontSize: 13.5, color: 'var(--ink)', lineHeight: 1.6, maxWidth: '80%' }}>
                I built an ingestion pipeline with a rate limiter — I traded strict ordering for throughput under load.
              </div>
            </div>

            <div style={{ borderTop: '1px solid rgba(255,255,255,.08)', paddingTop: 20 }}>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--teal2)', marginBottom: 12 }}>Analyzing</div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {['Skills', 'Experience', 'Communication', 'Role Fit'].map(tag => (
                  <span key={tag} className="pulse-chip" style={{ fontSize: 11.5, fontWeight: 600, padding: '6px 12px', borderRadius: 100, background: 'rgba(19,194,142,.12)', color: 'var(--teal2)' }}>{tag}</span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* VOICE AI — hero feature */}
      <section id="voice-ai" style={{ padding: '110px 5%' }}>
        <div style={{ maxWidth: 1000, margin: '0 auto', textAlign: 'center' }}>
          <p className="reveal" style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--gold)', marginBottom: 14 }}>Voice AI</p>
          <h2 className="reveal" style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 'clamp(30px,4vw,46px)', color: 'var(--ink)', lineHeight: 1.15, letterSpacing: '-.4px', marginBottom: 48 }}>
            Interviews that feel like conversations.
          </h2>

          <div className="reveal" style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 20, padding: 36, textAlign: 'left', maxWidth: 640, margin: '0 auto' }}>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--ink3)', marginBottom: 20 }}>Voice interview · Illustrative preview</div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 20 }}>
              <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'rgba(124,58,237,.1)', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#7c3aed" strokeWidth="2"><path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z" /><path d="M19 10v2a7 7 0 01-14 0v-2M12 19v4" /></svg>
              </div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>AI Interviewer — speaking</div>
                <div style={{ fontSize: 12.5, color: 'var(--ink3)' }}>"Tell me about a time you solved a difficult problem."</div>
              </div>
            </div>

            <div className="voice-waveform" style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 44, marginBottom: 20 }}>
              {Array.from({ length: 28 }).map((_, i) => (
                <span key={i} className="voice-bar" style={{ width: 4, borderRadius: 2, background: '#7c3aed', opacity: .35 + (i % 5) * 0.12, animationDelay: `${i * 0.05}s` }} />
              ))}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'var(--paper2)', borderRadius: 10, padding: '12px 16px' }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--teal)', flexShrink: 0 }} />
              <span style={{ fontSize: 12.5, color: 'var(--ink3)' }}>Listening — live transcript streaming in real time</span>
            </div>
          </div>

          <p className="reveal" style={{ fontSize: 13, color: 'var(--ink3)', marginTop: 24, maxWidth: 480, margin: '24px auto 0' }}>
            Built on real-time WebSocket voice with streaming speech-to-text and text-to-speech. Candidates can interrupt the AI naturally — it stops and listens, the way a real interviewer would.
          </p>
        </div>
      </section>

      {/* CANDIDATE JOURNEY */}
      <section id="candidate-journey" style={{ background: 'var(--paper2)', padding: '110px 5%' }}>
        <div style={{ maxWidth: 1160, margin: '0 auto' }}>
          <p className="reveal" style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--teal)', marginBottom: 14 }}>For Candidates</p>
          <h2 className="reveal" style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 'clamp(30px,4vw,46px)', color: 'var(--ink)', lineHeight: 1.15, letterSpacing: '-.4px', marginBottom: 48, maxWidth: 640 }}>
            Candidates don't just apply. They prepare.
          </h2>

          <div className="reveal landing-journey-row" style={{ display: 'flex', overflowX: 'auto', gap: 0, paddingBottom: 8 }}>
            {['Upload CV', 'Resume Analysis', 'ATS Insights', 'Practice Interview', 'AI Feedback', 'Improve', 'Apply with Confidence'].map((step, i, arr) => (
              <div key={step} style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>
                <div style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 12, padding: '14px 18px', minWidth: 150 }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--teal)', marginBottom: 4 }}>{String(i + 1).padStart(2, '0')}</div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>{step}</div>
                </div>
                {i < arr.length - 1 && <div style={{ width: 28, height: 1, background: 'var(--border)', flexShrink: 0 }} />}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* HR INTELLIGENCE */}
      <section id="hr-intelligence" style={{ padding: '110px 5%' }}>
        <div style={{ maxWidth: 1160, margin: '0 auto' }}>
          <p className="reveal" style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--gold)', marginBottom: 14 }}>For Hiring Teams</p>
          <h2 className="reveal" style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 'clamp(30px,4vw,46px)', color: 'var(--ink)', lineHeight: 1.15, letterSpacing: '-.4px', marginBottom: 48, maxWidth: 640 }}>
            From interviews to decisions.
          </h2>

          <div className="reveal landing-hr-grid" style={{ display: 'grid', gridTemplateColumns: '1.1fr 1fr', gap: 40, alignItems: 'center' }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
              {['Candidate pool', 'Screening', 'Interview', 'Assessment', 'AI Analysis', 'Candidate Report', 'Compare', 'Hiring Decision'].map((s, i) => (
                <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--ink2)', background: '#fff', border: '1px solid var(--border)', borderRadius: 100, padding: '8px 14px' }}>{s}</span>
                  {i < 7 && <span style={{ color: 'var(--ink3)', fontSize: 12 }}>→</span>}
                </div>
              ))}
            </div>

            <div style={{ background: 'var(--dark)', borderRadius: 18, padding: 28 }}>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: 'rgba(255,255,255,.35)', marginBottom: 16 }}>Candidate report · Illustrative preview</div>
              {['Strengths', 'Concerns', 'Evidence'].map(section => (
                <div key={section} style={{ marginBottom: 14 }}>
                  <div style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--gold2)', marginBottom: 6 }}>{section}</div>
                  <div style={{ fontSize: 12.5, color: 'rgba(255,255,255,.6)', lineHeight: 1.6 }}>
                    {section === 'Strengths' && 'Clear system-design reasoning, backed by a specific project example.'}
                    {section === 'Concerns' && 'Limited detail on testing strategy when asked directly.'}
                    {section === 'Evidence' && 'Quotes and timestamps from the interview transcript.'}
                  </div>
                </div>
              ))}
              <div style={{ borderTop: '1px solid rgba(255,255,255,.08)', paddingTop: 14, fontSize: 12.5, color: 'rgba(255,255,255,.5)' }}>Final verdict included alongside the full transcript.</div>
            </div>
          </div>
        </div>
      </section>

      {/* HIRING COPILOT */}
      <section id="copilot" style={{ background: 'var(--dark)', padding: '110px 5%' }}>
        <div style={{ maxWidth: 1000, margin: '0 auto', textAlign: 'center' }}>
          <p className="reveal" style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--gold2)', marginBottom: 14 }}>Hiring Copilot</p>
          <h2 className="reveal" style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 'clamp(30px,4vw,46px)', color: '#fff', lineHeight: 1.15, letterSpacing: '-.4px', marginBottom: 48 }}>
            Your AI hiring copilot, alongside every decision.
          </h2>

          <div className="reveal landing-copilot-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 16, maxWidth: 800, margin: '0 auto' }}>
            {[
              { t: 'JD Insights', d: 'Flags vague requirements and missing must-haves before you post the role.' },
              { t: 'Candidate Comparison', d: 'Lines candidates up side by side against the same evidence-based criteria.' },
              { t: 'Interview Analysis', d: 'Surfaces the parts of the transcript most relevant to the hiring decision.' },
            ].map(c => (
              <div key={c.t} style={{ background: 'var(--dark2)', borderRadius: 14, padding: 22, textAlign: 'left' }}>
                <div style={{ fontSize: 13.5, fontWeight: 700, color: '#fff', marginBottom: 8 }}>{c.t}</div>
                <div style={{ fontSize: 12.5, color: 'rgba(255,255,255,.5)', lineHeight: 1.65 }}>{c.d}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* HR vs CANDIDATE PILLARS */}
      <section style={{ padding: '110px 5%' }}>
        <div style={{ maxWidth: 1160, margin: '0 auto' }} className="landing-audience-grid">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2, background: 'var(--border)', borderRadius: 20, overflow: 'hidden' }} className="landing-audience-inner">
            <div style={{ background: '#fff', padding: 44 }}>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 11, fontWeight: 600, letterSpacing: '.1em', textTransform: 'uppercase', padding: '6px 14px', borderRadius: 100, background: 'var(--gold-light)', color: 'var(--gold)', marginBottom: 24 }}>For Hiring Teams</div>
              <h3 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 30, color: 'var(--ink)', lineHeight: 1.2, marginBottom: 14, letterSpacing: '-.4px' }}>
                Create AI-powered interviews. Evaluate candidates with evidence. Decide faster.
              </h3>
              <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 11, marginBottom: 32 }}>
                {[
                  'Interview Builder — chat, assessment, or voice, per role',
                  'AI feedback reports with real evidence, not vibes',
                  'Hiring Copilot — JD analysis and interview-quality checks',
                  'Compare candidates by real scores, side by side',
                ].map(f => (
                  <li key={f} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, fontSize: 14, color: 'var(--ink2)' }}>
                    <span style={{ width: 18, height: 18, borderRadius: '50%', background: 'var(--gold-light)', color: 'var(--gold)', display: 'grid', placeItems: 'center', fontSize: 10, flexShrink: 0, marginTop: 2 }}>✓</span>{f}
                  </li>
                ))}
              </ul>
              <Link href="/auth/signup/hr" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 14, fontWeight: 600, padding: '13px 26px', borderRadius: 10, textDecoration: 'none', background: 'var(--gold2)', color: 'var(--ink)' }}>Explore the HR experience →</Link>
            </div>
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
              <Link href="/auth/signup/candidate" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 14, fontWeight: 600, padding: '13px 26px', borderRadius: 10, textDecoration: 'none', background: 'var(--teal2)', color: 'var(--ink)' }}>Explore Candidate tools →</Link>
            </div>
          </div>
        </div>
      </section>

      {/* SECURITY / TRUST */}
      <section style={{ padding: '80px 5%', borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)' }}>
        <div style={{ maxWidth: 1160, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 24 }} className="landing-security-row">
          <div style={{ maxWidth: 380 }}>
            <p className="reveal" style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--gold)', marginBottom: 10 }}>Built for serious hiring</p>
            <p className="reveal" style={{ fontSize: 14, color: 'var(--ink3)', lineHeight: 1.7 }}>Every dashboard and interview session sits behind authentication and is scoped to the account that owns it.</p>
          </div>
          <div className="reveal" style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
            {['Authenticated dashboards', 'Candidate-scoped data', 'Protected interview sessions', 'Secure APIs'].map(s => (
              <span key={s} style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--ink2)', background: 'var(--paper2)', border: '1px solid var(--border)', borderRadius: 100, padding: '9px 16px' }}>{s}</span>
            ))}
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

      {/* GET STARTED */}
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

      {/* FINAL CTA */}
      <section style={{ background: 'var(--dark)', padding: '140px 5%', textAlign: 'center', position: 'relative', overflow: 'hidden' }}>
        <div className="drift" style={{ position: 'absolute', width: 700, height: 700, borderRadius: '50%', background: 'radial-gradient(circle, rgba(226,176,74,.12) 0%, transparent 70%)', top: '-30%', left: '50%', transform: 'translateX(-50%)', filter: 'blur(90px)' }} />
        <div style={{ position: 'relative', zIndex: 1, maxWidth: 720, margin: '0 auto' }}>
          <h2 className="reveal" style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 'clamp(34px,5vw,58px)', color: '#fff', lineHeight: 1.1, letterSpacing: '-.5px', marginBottom: 20 }}>
            The next great hire is already out there.
          </h2>
          <p className="reveal" style={{ fontSize: 16, color: 'rgba(255,255,255,.55)', lineHeight: 1.7, marginBottom: 44, maxWidth: 500, margin: '0 auto 44px' }}>
            Give hiring teams the tools to discover them, evaluate them, and make better decisions.
          </p>
          <div className="reveal" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16, flexWrap: 'wrap' }}>
            <Link href="/auth/signup/hr" style={{ fontSize: 15, fontWeight: 600, color: 'var(--ink)', background: 'var(--gold2)', padding: '15px 32px', borderRadius: 10, textDecoration: 'none' }}>Start Hiring</Link>
            <Link href="/auth/signup/candidate" style={{ fontSize: 15, fontWeight: 600, color: '#fff', border: '1.5px solid rgba(255,255,255,.2)', padding: '15px 28px', borderRadius: 10, textDecoration: 'none' }}>Practice an Interview</Link>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer style={{ background: 'var(--dark)', padding: '80px 5% 36px', borderTop: '1px solid rgba(255,255,255,.06)' }}>
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
              <a href="#voice-ai" style={{ display: 'block', fontSize: 14, color: 'rgba(255,255,255,.4)', textDecoration: 'none', marginBottom: 10 }}>Voice AI</a>
              <a href="#hr-intelligence" style={{ display: 'block', fontSize: 14, color: 'rgba(255,255,255,.4)', textDecoration: 'none', marginBottom: 10 }}>Hiring Intelligence</a>
              <a href="#how-it-works" style={{ display: 'block', fontSize: 14, color: 'rgba(255,255,255,.4)', textDecoration: 'none', marginBottom: 10 }}>How it works</a>
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

      {/* Component-scoped CSS for new motion (respects prefers-reduced-motion) */}
      <style jsx>{`
        .voice-bar { animation: voiceBar 1.1s ease-in-out infinite; }
        @keyframes voiceBar { 0%, 100% { height: 8px; } 50% { height: 40px; } }
        .pulse-chip { animation: pulseChip 1.8s ease-in-out infinite; }
        @keyframes pulseChip { 0%, 100% { opacity: 1; } 50% { opacity: .55; } }
        @media (prefers-reduced-motion: reduce) {
          .voice-bar, .pulse-chip { animation: none !important; }
        }
        @media (max-width: 860px) {
          .landing-modes-layout, .landing-hr-grid { grid-template-columns: 1fr !important; }
          .landing-copilot-grid { grid-template-columns: 1fr !important; }
          .landing-security-row { flex-direction: column; align-items: flex-start !important; }
        }
      `}</style>
    </div>
  )
}