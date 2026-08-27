'use client'
import { useState } from 'react'
import Link from 'next/link'

export default function HROptimizer() {
  const [step, setStep] = useState<'input' | 'result'>('input')
  const [jd, setJd] = useState('')
  const [role, setRole] = useState('')

  const analyze = async () => {
    if (!jd.trim()) return
    setStep('result')
  }

  const insights = [
    { icon: '🎯', title: 'Keyword density is low', desc: '"TypeScript" appears once. Top candidates scan for it — mention it 3–4x across requirements, responsibilities, and benefits.' },
    { icon: '⚠️', title: 'Requirements list is too long', desc: '18 requirements will reduce applicant quality. Trim to 8–10 must-haves and move nice-to-haves to a separate section.' },
    { icon: '💡', title: 'Add salary range', desc: 'JDs with salary ranges get 35% more qualified applicants. Consider adding even a wide range.' },
    { icon: '📊', title: 'Missing team context', desc: 'Candidates want to know team size and structure. Add "You\'ll join a team of X engineers reporting to..."' },
    { icon: '🌍', title: 'Remote policy is ambiguous', desc: '"Flexible work" is vague. State clearly: "Fully remote", "Hybrid (3 days/week in office)", or "On-site only".' },
  ]

  return (
    <div style={{ minHeight: '100vh', background: '#0a0a08', fontFamily: 'Inter, sans-serif', color: 'rgba(255,255,255,.88)' }}>
      <div style={{ height: 56, borderBottom: '1px solid rgba(255,255,255,.07)', display: 'flex', alignItems: 'center', padding: '0 28px', gap: 16 }}>
        <Link href="/hr/dashboard" style={{ color: 'rgba(255,255,255,.4)', textDecoration: 'none', fontSize: 13 }}>← HR Dashboard</Link>
        <span style={{ color: 'rgba(255,255,255,.15)' }}>·</span>
        <span style={{ fontSize: 13, color: 'rgba(255,255,255,.6)', fontWeight: 600 }}>JD Optimizer</span>
      </div>

      <div style={{ maxWidth: 800, margin: '0 auto', padding: '40px 24px' }}>
        <div style={{ marginBottom: 36 }}>
          <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.14em', textTransform: 'uppercase', color: '#13c28e', marginBottom: 12 }}>For HR Teams</p>
          <h1 style={{ fontFamily: "Inter, sans-serif", fontSize: 'clamp(32px,4vw,48px)', fontWeight: 600, letterSpacing: '-.5px', marginBottom: 12 }}>
            Job Description Optimizer
          </h1>
          <p style={{ fontSize: 15, color: 'rgba(255,255,255,.4)', lineHeight: 1.7 }}>
            Paste your job description and get actionable suggestions to attract better candidates and reduce time-to-hire.
          </p>
        </div>

        {step === 'input' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ background: '#111110', border: '1px solid rgba(255,255,255,.08)', borderRadius: 14, padding: 24 }}>
              <div style={{ fontSize: 12, fontWeight: 600, letterSpacing: '.08em', textTransform: 'uppercase', color: 'rgba(255,255,255,.3)', marginBottom: 12 }}>Role Title</div>
              <input value={role} onChange={e => setRole(e.target.value)} placeholder="e.g. Senior Frontend Engineer" style={{ width: '100%', background: '#161614', border: '1px solid rgba(255,255,255,.08)', borderRadius: 10, padding: '12px 14px', fontSize: 14, fontFamily: 'Inter, sans-serif', color: 'rgba(255,255,255,.8)', outline: 'none' }} />
            </div>
            <div style={{ background: '#111110', border: '1px solid rgba(255,255,255,.08)', borderRadius: 14, padding: 24 }}>
              <div style={{ fontSize: 12, fontWeight: 600, letterSpacing: '.08em', textTransform: 'uppercase', color: 'rgba(255,255,255,.3)', marginBottom: 12 }}>Job Description</div>
              <textarea value={jd} onChange={e => setJd(e.target.value)} placeholder="Paste your current job description here..." style={{ width: '100%', background: '#161614', border: '1px solid rgba(255,255,255,.08)', borderRadius: 10, padding: 14, fontSize: 13, fontFamily: 'Inter, sans-serif', color: 'rgba(255,255,255,.8)', outline: 'none', resize: 'none', lineHeight: 1.7, minHeight: 200 }} />
            </div>
            <button onClick={analyze} style={{ background: '#13c28e', color: '#fff', fontWeight: 700, fontSize: 15, padding: '14px', borderRadius: 10, border: 'none', cursor: 'pointer', fontFamily: 'Inter, sans-serif', letterSpacing: '.03em' }}>
              🔍 Analyze Job Description
            </button>
          </div>
        )}

        {step === 'result' && (
          <div>
            <div style={{ background: '#111110', border: '1px solid rgba(255,255,255,.08)', borderRadius: 14, padding: 24, marginBottom: 24 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ fontSize: 13, fontWeight: 600 }}>JD Quality Score</span>
                <span style={{ fontSize: 11, color: '#e2b04a', fontWeight: 600, background: 'rgba(226,176,74,.1)', padding: '3px 10px', borderRadius: 100, border: '1px solid rgba(226,176,74,.2)' }}>5 improvements found</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12 }}>
                <div style={{ fontFamily: "Inter, sans-serif", fontSize: 52, fontWeight: 600, color: '#e2b04a', lineHeight: 1 }}>64</div>
                <div style={{ paddingBottom: 8 }}>
                  <div style={{ fontSize: 13, color: 'rgba(255,255,255,.5)' }}>/ 100 · Fair</div>
                  <div style={{ fontSize: 12, color: 'rgba(255,255,255,.35)', marginTop: 2 }}>Estimated: 89/100 after improvements</div>
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {insights.map((s, i) => (
                <div key={i} style={{ background: '#111110', border: '1px solid rgba(255,255,255,.08)', borderRadius: 12, padding: '16px 20px', display: 'flex', gap: 14, alignItems: 'flex-start' }}>
                  <span style={{ fontSize: 20, flexShrink: 0, marginTop: 1 }}>{s.icon}</span>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 5 }}>{s.title}</div>
                    <div style={{ fontSize: 13, color: 'rgba(255,255,255,.4)', lineHeight: 1.65 }}>{s.desc}</div>
                  </div>
                </div>
              ))}
            </div>

            <button onClick={() => setStep('input')} style={{ marginTop: 20, width: '100%', background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.1)', color: 'rgba(255,255,255,.5)', fontWeight: 600, fontSize: 14, padding: '13px', borderRadius: 10, cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}>
              ← Analyze Another JD
            </button>
          </div>
        )}
      </div>
    </div>
  )
}