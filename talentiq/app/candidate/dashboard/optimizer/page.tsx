'use client'
import { useState } from 'react'
import Link from 'next/link'

export default function CVOptimizer() {
  const [step, setStep] = useState<'upload' | 'analyzing' | 'result'>('upload')
  const [jd, setJd] = useState('')

  const runOptimize = async () => {
    setStep('analyzing')
    await new Promise(r => setTimeout(r, 2500))
    setStep('result')
  }

  const suggestions = [
    { type: 'critical', icon: '🔴', title: 'Add Docker to Skills section', desc: 'The JD mentions Docker 4 times. Your CV has no mention of it. Even basic Docker knowledge should be listed.' },
    { type: 'high', icon: '🟡', title: 'Quantify your React experience', desc: 'Change "Worked on React projects" to "Built 3 production React apps serving 10k+ users". Numbers matter.' },
    { type: 'medium', icon: '🟢', title: 'Move TypeScript to top of skills', desc: 'TypeScript is the #1 required skill in this JD. Put it at the top of your skills list.' },
    { type: 'medium', icon: '🟢', title: 'Add a summary section', desc: 'Your CV has no summary. A 2-line summary matching the JD keywords can boost ATS score by ~15%.' },
    { type: 'low', icon: '⚪', title: 'Remove outdated technologies', desc: 'jQuery and PHP are listed but not in the JD. They add noise without value for this role.' },
  ]

  return (
    <div style={{ minHeight: '100vh', background: '#0c0c0a', fontFamily: 'Syne, sans-serif', color: 'rgba(255,255,255,.88)' }}>
      {/* Topbar */}
      <div style={{ height: 56, borderBottom: '1px solid rgba(255,255,255,.07)', display: 'flex', alignItems: 'center', padding: '0 28px', gap: 16 }}>
        <Link href="/candidate/dashboard" style={{ color: 'rgba(255,255,255,.4)', textDecoration: 'none', fontSize: 13 }}>← Dashboard</Link>
        <span style={{ color: 'rgba(255,255,255,.15)' }}>·</span>
        <span style={{ fontSize: 13, color: 'rgba(255,255,255,.6)', fontWeight: 600 }}>CV Optimizer</span>
      </div>

      <div style={{ maxWidth: 800, margin: '0 auto', padding: '40px 24px' }}>
        <div style={{ marginBottom: 40 }}>
          <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.14em', textTransform: 'uppercase', color: '#e2b04a', marginBottom: 12 }}>AI-Powered</p>
          <h1 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 'clamp(32px,4vw,48px)', fontWeight: 600, letterSpacing: '-.5px', marginBottom: 12 }}>
            CV Optimizer
          </h1>
          <p style={{ fontSize: 15, color: 'rgba(255,255,255,.4)', lineHeight: 1.7 }}>
            Paste a job description and we'll show you exactly what to change in your CV to maximize your match score.
          </p>
        </div>

        {step === 'upload' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ background: '#111110', border: '1px solid rgba(255,255,255,.08)', borderRadius: 14, padding: 24 }}>
              <div style={{ fontSize: 12, fontWeight: 600, letterSpacing: '.08em', textTransform: 'uppercase', color: 'rgba(255,255,255,.3)', marginBottom: 12 }}>Your CV</div>
              <div style={{ border: '2px dashed rgba(255,255,255,.12)', borderRadius: 10, padding: 32, textAlign: 'center', cursor: 'pointer', background: '#161614', transition: 'all .25s' }}
                onMouseOver={e => { (e.currentTarget as HTMLElement).style.borderColor = 'rgba(226,176,74,.4)'; (e.currentTarget as HTMLElement).style.background = 'rgba(226,176,74,.03)' }}
                onMouseOut={e => { (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,.12)'; (e.currentTarget as HTMLElement).style.background = '#161614' }}>
                <div style={{ fontSize: 36, marginBottom: 12 }}>📄</div>
                <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>Drop your CV here</div>
                <div style={{ fontSize: 12, color: 'rgba(255,255,255,.3)' }}>PDF or DOCX · Max 10MB</div>
              </div>
            </div>

            <div style={{ background: '#111110', border: '1px solid rgba(255,255,255,.08)', borderRadius: 14, padding: 24 }}>
              <div style={{ fontSize: 12, fontWeight: 600, letterSpacing: '.08em', textTransform: 'uppercase', color: 'rgba(255,255,255,.3)', marginBottom: 12 }}>Target Job Description</div>
              <textarea
                value={jd} onChange={e => setJd(e.target.value)}
                placeholder="Paste the job description here. The more detailed, the better our suggestions..."
                style={{ width: '100%', background: '#161614', border: '1px solid rgba(255,255,255,.08)', borderRadius: 10, padding: 14, fontSize: 13, fontFamily: 'Syne, sans-serif', color: 'rgba(255,255,255,.8)', outline: 'none', resize: 'none', lineHeight: 1.7, minHeight: 140 }}
              />
            </div>

            <button onClick={runOptimize} style={{ background: '#e2b04a', color: '#0a0a09', fontWeight: 700, fontSize: 15, padding: '14px', borderRadius: 10, border: 'none', cursor: 'pointer', fontFamily: 'Syne, sans-serif', letterSpacing: '.03em', transition: 'all .25s' }}
              onMouseOver={e => { (e.currentTarget as HTMLElement).style.background = '#f5d87a'; (e.currentTarget as HTMLElement).style.transform = 'translateY(-1px)' }}
              onMouseOut={e => { (e.currentTarget as HTMLElement).style.background = '#e2b04a'; (e.currentTarget as HTMLElement).style.transform = 'none' }}>
              ✨ Optimize My CV
            </button>
          </div>
        )}

        {step === 'analyzing' && (
          <div style={{ textAlign: 'center', padding: '60px 0' }}>
            <div style={{ width: 60, height: 60, border: '4px solid rgba(226,176,74,.2)', borderTopColor: '#e2b04a', borderRadius: '50%', animation: 'spin .8s linear infinite', margin: '0 auto 24px' }} />
            <h3 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 24, marginBottom: 8 }}>Analyzing your CV...</h3>
            <p style={{ fontSize: 14, color: 'rgba(255,255,255,.35)' }}>Comparing against the job description. Finding gaps and opportunities.</p>
            <style dangerouslySetInnerHTML={{ __html: `@keyframes spin { to { transform: rotate(360deg) } }` }} />
          </div>
        )}

        {step === 'result' && (
          <div>
            {/* Score improvement estimate */}
            <div style={{ background: '#111110', border: '1px solid rgba(255,255,255,.08)', borderRadius: 14, padding: 24, marginBottom: 24, display: 'flex', alignItems: 'center', gap: 24 }}>
              <div style={{ textAlign: 'center', flexShrink: 0 }}>
                <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 48, fontWeight: 600, color: '#ef4444', lineHeight: 1 }}>62</div>
                <div style={{ fontSize: 12, color: 'rgba(255,255,255,.35)', marginTop: 4 }}>Current score</div>
              </div>
              <div style={{ fontSize: 24, color: 'rgba(255,255,255,.2)' }}>→</div>
              <div style={{ textAlign: 'center', flexShrink: 0 }}>
                <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 48, fontWeight: 600, color: '#13c28e', lineHeight: 1 }}>89</div>
                <div style={{ fontSize: 12, color: 'rgba(255,255,255,.35)', marginTop: 4 }}>After changes</div>
              </div>
              <div style={{ flex: 1, paddingLeft: 12 }}>
                <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 6 }}>+27 points possible</div>
                <div style={{ fontSize: 13, color: 'rgba(255,255,255,.4)', lineHeight: 1.6 }}>Apply all 5 suggestions below to go from a weak match to a strong candidate for this role.</div>
              </div>
            </div>

            {/* Suggestions */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {suggestions.map((s, i) => (
                <div key={i} style={{ background: '#111110', border: '1px solid rgba(255,255,255,.08)', borderRadius: 12, padding: '16px 20px', display: 'flex', alignItems: 'flex-start', gap: 14 }}>
                  <span style={{ fontSize: 18, flexShrink: 0, marginTop: 2 }}>{s.icon}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 5 }}>{s.title}</div>
                    <div style={{ fontSize: 13, color: 'rgba(255,255,255,.4)', lineHeight: 1.65 }}>{s.desc}</div>
                  </div>
                </div>
              ))}
            </div>

            <button onClick={() => setStep('upload')} style={{ marginTop: 20, width: '100%', background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.1)', color: 'rgba(255,255,255,.5)', fontWeight: 600, fontSize: 14, padding: '13px', borderRadius: 10, cursor: 'pointer', fontFamily: 'Syne, sans-serif', transition: 'all .2s' }}>
              ← Optimize Another CV
            </button>
          </div>
        )}
      </div>
    </div>
  )
}