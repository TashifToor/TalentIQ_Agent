'use client'
import { useEffect, useRef } from 'react'

interface Props {
  role: 'candidate' | 'hr'
  onClose: () => void
}

export default function UpgradeModal({ role, onClose }: Props) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) onClose() }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [onClose])

  const isCandidate = role === 'candidate'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div ref={ref} className="relative w-full max-w-md mx-4 rounded-2xl overflow-hidden shadow-2xl">
        {/* Top accent */}
        <div className="h-1 w-full" style={{ background: 'linear-gradient(90deg, #c5931f, #e2b04a, #13c28e)' }} />

        <div style={{ background: '#111110', border: '1px solid rgba(255,255,255,.08)' }} className="p-8">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <p style={{ color: '#e2b04a', fontSize: 11, fontWeight: 700, letterSpacing: '.12em', textTransform: 'uppercase', marginBottom: 6 }}>
                Free Scans Used
              </p>
              <h2 style={{ fontFamily: "Inter, sans-serif", fontSize: 30, fontWeight: 600, color: 'rgba(255,255,255,.9)', lineHeight: 1.15 }}>
                {isCandidate ? 'Ready to go deeper?' : 'Scale your screening?'}
              </h2>
            </div>
            <button onClick={onClose} style={{ color: 'rgba(255,255,255,.3)', fontSize: 24, lineHeight: 1, background: 'none', border: 'none', cursor: 'pointer', padding: '0 4px' }}>×</button>
          </div>

          {/* Description */}
          <p style={{ fontSize: 14, color: 'rgba(255,255,255,.45)', lineHeight: 1.75, marginBottom: 28 }}>
            {isCandidate
              ? "You've used all 3 free scans. Upgrade to run unlimited CV analyses, get full skill breakdowns, and see exactly how to improve."
              : "Your trial scans are up. Upgrade to unlock unlimited bulk screening, ranked shortlists, and HR policy chatbot."}
          </p>

          {/* Price highlight */}
          <div style={{ background: 'rgba(226,176,74,.08)', border: '1px solid rgba(226,176,74,.18)', borderRadius: 12, padding: '16px 20px', marginBottom: 24, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <p style={{ fontSize: 12, color: 'rgba(255,255,255,.4)', marginBottom: 4, fontWeight: 600 }}>{isCandidate ? 'Candidate Pro' : 'HR Team'}</p>
              <p style={{ fontFamily: "Inter, sans-serif", fontSize: 38, fontWeight: 600, color: '#e2b04a', lineHeight: 1 }}>
                {isCandidate ? '$9' : '$49'}<span style={{ fontFamily: 'Inter, sans-serif', fontSize: 14, color: 'rgba(255,255,255,.3)' }}>/mo</span>
              </p>
            </div>
            <div style={{ textAlign: 'right' }}>
              {isCandidate ? (
                <><p style={{ fontSize: 12, color: 'rgba(255,255,255,.5)' }}>Unlimited scans</p><p style={{ fontSize: 12, color: 'rgba(255,255,255,.5)' }}>Skill gap reports</p><p style={{ fontSize: 12, color: 'rgba(255,255,255,.5)' }}>CV improvement tips</p></>
              ) : (
                <><p style={{ fontSize: 12, color: 'rgba(255,255,255,.5)' }}>Bulk screening</p><p style={{ fontSize: 12, color: 'rgba(255,255,255,.5)' }}>Policy chatbot</p><p style={{ fontSize: 12, color: 'rgba(255,255,255,.5)' }}>Team workspace</p></>
              )}
            </div>
          </div>

          {/* CTA */}
          <button
            onClick={() => { onClose(); window.location.href = '/pricing' }}
            style={{ width: '100%', background: '#e2b04a', color: '#0a0a09', fontWeight: 700, fontSize: 15, padding: '14px', borderRadius: 10, border: 'none', cursor: 'pointer', transition: 'all .25s', letterSpacing: '.02em', fontFamily: 'Inter, sans-serif', marginBottom: 10 }}
            onMouseOver={e => { (e.target as HTMLButtonElement).style.background = '#f5d87a'; (e.target as HTMLButtonElement).style.transform = 'translateY(-1px)' }}
            onMouseOut={e => { (e.target as HTMLButtonElement).style.background = '#e2b04a'; (e.target as HTMLButtonElement).style.transform = 'none' }}
          >
            Upgrade now — {isCandidate ? '$9' : '$49'}/mo →
          </button>
          <button onClick={onClose} style={{ width: '100%', background: 'transparent', border: '1px solid rgba(255,255,255,.1)', color: 'rgba(255,255,255,.35)', fontWeight: 500, fontSize: 13, padding: '11px', borderRadius: 10, cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}>
            Maybe later
          </button>
        </div>
      </div>
    </div>
  )
}