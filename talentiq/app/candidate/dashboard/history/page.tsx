'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { api } from '@/lib/api'

const STEP_ICONS = ['📋', '💪', '⚠️', '✅']
const STEP_COLORS = ['#4f46e5', '#e2b04a', '#ef4444', '#13c28e']

function AnalysisCarousel({ text }: { text: string }) {
  const [active, setActive] = useState(0)

  const steps = (text || '')
    .split(/\n(?=\*\*Step)/)
    .filter(Boolean)
    .map((block: string) => {
      const headingMatch = block.match(/^\*\*(.+?)\*\*/)
      const heading = headingMatch ? headingMatch[1].replace(/^Step \d+:\s*/, '') : 'Analysis'
      const body = block.replace(/^\*\*(.+?)\*\*/, '').replace(/^\n+/, '').trim()
      return { heading, body }
    })

  if (steps.length === 0) return (
    <div style={{ fontSize: 12, color: '#7a7468', padding: '12px 0' }}>No analysis available.</div>
  )

  return (
    <div>
      {/* Step tabs */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 14, flexWrap: 'wrap' }}>
        {steps.map((s, i) => (
          <button key={i} onClick={() => setActive(i)} style={{
            display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 100,
            fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'Inter, sans-serif',
            border: `1px solid ${active === i ? STEP_COLORS[i % STEP_COLORS.length] : 'rgba(10,10,9,.1)'}`,
            background: active === i ? `${STEP_COLORS[i % STEP_COLORS.length]}18` : 'transparent',
            color: active === i ? STEP_COLORS[i % STEP_COLORS.length] : '#7a7468',
            transition: 'all .2s',
          }}>
            <span>{STEP_ICONS[i % STEP_ICONS.length]}</span>
            {s.heading}
          </button>
        ))}
      </div>

      {/* Active step */}
      <div style={{
        padding: '16px 18px', background: '#faf9f5', borderRadius: 10,
        borderLeft: `3px solid ${STEP_COLORS[active % STEP_COLORS.length]}`,
        transition: 'all .25s',
      }}>
        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8, color: '#1f1c17' }}>
          {STEP_ICONS[active % STEP_ICONS.length]} {steps[active]?.heading}
        </div>
        <p style={{ fontSize: 12.5, color: '#5c574c', lineHeight: 1.8, margin: 0, whiteSpace: 'pre-wrap' }}>
          {steps[active]?.body}
        </p>
      </div>

      {/* Dot navigation */}
      <div style={{ display: 'flex', justifyContent: 'center', gap: 6, marginTop: 12 }}>
        {steps.map((_, i) => (
          <div key={i} onClick={() => setActive(i)} style={{
            width: active === i ? 20 : 6, height: 6, borderRadius: 3,
            background: active === i ? STEP_COLORS[i % STEP_COLORS.length] : 'rgba(10,10,9,.09)',
            cursor: 'pointer', transition: 'all .3s',
          }} />
        ))}
      </div>
    </div>
  )
}

export default function CandidateHistory() {
  const [history, setHistory] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [expandedId, setExpandedId] = useState<number | string | null>(null)

  useEffect(() => {
    api.getScanHistory()
      .then((data: any) => setHistory(Array.isArray(data) ? data : []))
      .catch((err: any) => setError(err.message || 'Failed to load history.'))
      .finally(() => setLoading(false))
  }, [])

  return (
    <div style={{ minHeight: '100vh', background: '#f7f5f0', fontFamily: 'Inter, sans-serif', color: '#1f1c17' }}>
      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
        @keyframes fadeUp { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes expandIn { from { opacity: 0; max-height: 0; } to { opacity: 1; max-height: 1000px; } }
        .fade-up { animation: fadeUp .4s ease both; }
        .expand-in { animation: expandIn .35s ease both; overflow: hidden; }
        .history-row { transition: background .2s; cursor: pointer; }
        .history-row:hover { background: #f0eee6; }
        .chevron { transition: transform .25s; }
      `}</style>

      <div style={{ maxWidth: 760, margin: '0 auto', padding: '40px 24px 80px' }}>
        <Link href="/candidate/dashboard" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#7a7468', textDecoration: 'none', marginBottom: 28 }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 18l-6-6 6-6" /></svg>
          Back to Dashboard
        </Link>

        <div style={{ fontFamily: "Inter, sans-serif", fontSize: 28, fontWeight: 600, marginBottom: 4 }}>Scan History</div>
        <div style={{ fontSize: 13, color: '#7a7468', marginBottom: 28 }}>All your past CV screenings — click any scan to see the full breakdown</div>

        {error && (
          <div style={{ background: 'rgba(239,68,68,.08)', border: '1px solid rgba(239,68,68,.2)', color: '#ef4444', fontSize: 12, padding: '10px 14px', borderRadius: 8, marginBottom: 20 }}>{error}</div>
        )}

        {loading ? (
          <div style={{ fontSize: 13, color: '#7a7468', textAlign: 'center', padding: '40px 0' }}>Loading…</div>
        ) : history.length === 0 ? (
          <div style={{ background: '#ffffff', border: '1px solid rgba(10,10,9,.1)', borderRadius: 12, padding: 40, textAlign: 'center' }}>
            <div style={{ fontSize: 13, color: '#7a7468', marginBottom: 14 }}>No scans yet.</div>
            <Link href="/candidate/dashboard" style={{ fontSize: 13, color: '#e2b04a', textDecoration: 'none', fontWeight: 600 }}>Run your first scan →</Link>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {history.map((h, i) => {
              const score = h.candidate_score ?? 0
              const color = score >= 80 ? '#13c28e' : score >= 50 ? '#e2b04a' : '#ef4444'
              const isOpen = expandedId === (h.id ?? i)
              return (
                <div key={h.id ?? i} className="fade-up" style={{ background: '#ffffff', border: '1px solid rgba(10,10,9,.1)', borderRadius: 10, overflow: 'hidden', animationDelay: `${i * 40}ms` }}>
                  <div className="history-row" onClick={() => setExpandedId(isOpen ? null : (h.id ?? i))} style={{ padding: '16px 20px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                      <div style={{ fontFamily: "Inter, sans-serif", fontSize: 26, fontWeight: 600, color, width: 44, textAlign: 'center', flexShrink: 0 }}>{score}</div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{h.role_title || 'Untitled Role'}</div>
                        <div style={{ fontSize: 11, color: '#7a7468' }}>
                          {h.final_verdict || 'Match Result'} · {h.created_at ? new Date(h.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : ''}
                        </div>
                      </div>
                      {h.is_shortlisted === 'True' && (
                        <span style={{ fontSize: 10, fontWeight: 600, color: '#13c28e', background: 'rgba(19,194,142,.1)', border: '1px solid rgba(19,194,142,.2)', padding: '3px 9px', borderRadius: 100, flexShrink: 0 }}>Shortlisted</span>
                      )}
                      <svg className="chevron" style={{ transform: isOpen ? 'rotate(90deg)' : 'rotate(0deg)', flexShrink: 0 }} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#7a7468" strokeWidth="2"><path d="M9 18l6-6-6-6" /></svg>
                    </div>
                  </div>

                  {isOpen && (
                    <div className="expand-in" style={{ borderTop: '1px solid rgba(10,10,9,.1)', padding: '20px 20px 22px', background: '#faf9f5' }}>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 18 }}>
                        <div>
                          <div style={{ fontSize: 11, fontWeight: 600, color: '#13c28e', letterSpacing: '.05em', textTransform: 'uppercase', marginBottom: 8 }}>Matched Skills</div>
                          {(h.matched_skills?.length ?? 0) === 0 ? (
                            <div style={{ fontSize: 12, color: '#9c9689' }}>None recorded.</div>
                          ) : (
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                              {h.matched_skills.map((s: string) => (
                                <span key={s} style={{ fontSize: 11, color: '#13c28e', background: 'rgba(19,194,142,.08)', padding: '4px 10px', borderRadius: 100 }}>{s}</span>
                              ))}
                            </div>
                          )}
                        </div>
                        <div>
                          <div style={{ fontSize: 11, fontWeight: 600, color: '#ef4444', letterSpacing: '.05em', textTransform: 'uppercase', marginBottom: 8 }}>Missing Skills</div>
                          {(h.missing_skills?.length ?? 0) === 0 ? (
                            <div style={{ fontSize: 12, color: '#9c9689' }}>None — full match.</div>
                          ) : (
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                              {h.missing_skills.map((s: string) => (
                                <span key={s} style={{ fontSize: 11, color: '#ef4444', background: 'rgba(239,68,68,.06)', padding: '4px 10px', borderRadius: 100 }}>{s}</span>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>

                      <div style={{ fontSize: 11, fontWeight: 600, color: '#7a7468', letterSpacing: '.05em', textTransform: 'uppercase', marginBottom: 12 }}>Full Analysis</div>
                      <AnalysisCarousel text={h.deep_analysis} />
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}