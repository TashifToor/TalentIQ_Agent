'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { api } from '@/lib/api'

export default function CandidateHistory() {
  const [history, setHistory] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    api.getScanHistory()
      .then((data: any) => setHistory(Array.isArray(data) ? data : []))
      .catch((err: any) => setError(err.message || 'Failed to load history.'))
      .finally(() => setLoading(false))
  }, [])

  return (
    <div style={{ minHeight: '100vh', background: '#0c0c0a', fontFamily: 'Syne, sans-serif', color: 'rgba(255,255,255,.88)' }}>
      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@500;600&family=Syne:wght@400;500;600;700&display=swap');
        @keyframes fadeUp { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        .fade-up { animation: fadeUp .4s ease both; }
        .history-row { transition: background .2s, transform .2s; }
        .history-row:hover { background: #1b1b18; transform: translateX(2px); }
      `}</style>

      <div style={{ maxWidth: 720, margin: '0 auto', padding: '40px 24px 80px' }}>
        <Link href="/candidate/dashboard" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'rgba(255,255,255,.4)', textDecoration: 'none', marginBottom: 28 }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 18l-6-6 6-6" /></svg>
          Back to Dashboard
        </Link>

        <div style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 28, fontWeight: 600, marginBottom: 4 }}>Scan History</div>
        <div style={{ fontSize: 13, color: 'rgba(255,255,255,.3)', marginBottom: 28 }}>All your past CV screenings</div>

        {error && (
          <div style={{ background: 'rgba(239,68,68,.08)', border: '1px solid rgba(239,68,68,.2)', color: '#ef4444', fontSize: 12, padding: '10px 14px', borderRadius: 8, marginBottom: 20 }}>{error}</div>
        )}

        {loading ? (
          <div style={{ fontSize: 13, color: 'rgba(255,255,255,.3)', textAlign: 'center', padding: '40px 0' }}>Loading…</div>
        ) : history.length === 0 ? (
          <div style={{ background: '#111110', border: '1px solid rgba(255,255,255,.07)', borderRadius: 12, padding: 40, textAlign: 'center' }}>
            <div style={{ fontSize: 13, color: 'rgba(255,255,255,.3)', marginBottom: 14 }}>No scans yet.</div>
            <Link href="/candidate/dashboard" style={{ fontSize: 13, color: '#e2b04a', textDecoration: 'none', fontWeight: 600 }}>Run your first scan →</Link>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {history.map((h, i) => {
              const score = h.candidate_score ?? 0
              const color = score >= 80 ? '#13c28e' : score >= 50 ? '#e2b04a' : '#ef4444'
              return (
                <div key={h.id ?? i} className="history-row fade-up" style={{ background: '#111110', border: '1px solid rgba(255,255,255,.07)', borderRadius: 10, padding: '16px 20px', animationDelay: `${i * 40}ms` }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                    <div style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 26, fontWeight: 600, color, width: 44, textAlign: 'center', flexShrink: 0 }}>{score}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{h.role_title || 'Untitled Role'}</div>
                      <div style={{ fontSize: 11, color: 'rgba(255,255,255,.3)' }}>
                        {h.final_verdict || 'Match Result'} · {h.created_at ? new Date(h.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : ''}
                      </div>
                    </div>
                    {h.is_shortlisted === 'True' && (
                      <span style={{ fontSize: 10, fontWeight: 600, color: '#13c28e', background: 'rgba(19,194,142,.1)', border: '1px solid rgba(19,194,142,.2)', padding: '3px 9px', borderRadius: 100, flexShrink: 0 }}>Shortlisted</span>
                    )}
                  </div>
                  {(h.matched_skills?.length || h.missing_skills?.length) ? (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 12, paddingTop: 12, borderTop: '1px solid rgba(255,255,255,.05)' }}>
                      {(h.matched_skills || []).slice(0, 5).map((s: string) => (
                        <span key={s} style={{ fontSize: 11, color: '#13c28e', background: 'rgba(19,194,142,.08)', padding: '3px 9px', borderRadius: 100 }}>{s}</span>
                      ))}
                      {(h.missing_skills || []).slice(0, 3).map((s: string) => (
                        <span key={s} style={{ fontSize: 11, color: '#ef4444', background: 'rgba(239,68,68,.06)', padding: '3px 9px', borderRadius: 100 }}>{s}</span>
                      ))}
                    </div>
                  ) : null}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}