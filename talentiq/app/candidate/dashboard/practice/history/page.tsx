'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { GlassCard, GradientBadge, EmptyState, LoadingSkeleton } from '@/components/shared/primitives'
import { getModeDefinition } from '@/components/modules/interview-engine/modeData'
import AIFeedbackReport from '@/components/modules/reports/AIFeedbackReport'
import { api } from '@/lib/api'

export default function PracticeHistoryPage() {
  const [items, setItems] = useState<any[] | null>(null)
  const [error, setError] = useState('')
  const [openId, setOpenId] = useState<string | null>(null)
  const [openReport, setOpenReport] = useState<any>(null)
  const [reportLoading, setReportLoading] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  useEffect(() => {
    api.getPracticeHistory().then(setItems).catch((e: any) => setError(e.message || 'Could not load practice history.'))
  }, [])

  const openItem = async (id: string) => {
    if (openId === id) { setOpenId(null); setOpenReport(null); return }
    setOpenId(id)
    setReportLoading(true)
    try {
      setOpenReport(await api.getPracticeReport(id))
    } catch (e: any) {
      setError(e.message || 'Could not load that report.')
    } finally {
      setReportLoading(false)
    }
  }

  const deleteItem = async (id: string) => {
    setDeletingId(id)
    try {
      await api.deletePracticeSession(id)
      setItems(prev => (prev || []).filter(i => i.id !== id))
      if (openId === id) { setOpenId(null); setOpenReport(null) }
    } catch (e: any) {
      setError(e.message || 'Could not delete that session.')
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: '#0c0c0a', fontFamily: 'Inter, sans-serif', color: 'rgba(255,255,255,.88)' }}>
      <div style={{ height: 56, borderBottom: '1px solid rgba(255,255,255,.07)', display: 'flex', alignItems: 'center', padding: '0 28px', gap: 16 }}>
        <Link href="/candidate/dashboard/practice" style={{ color: 'rgba(255,255,255,.4)', textDecoration: 'none', fontSize: 13 }}>← Interview Practice</Link>
        <span style={{ color: 'rgba(255,255,255,.15)' }}>·</span>
        <span style={{ fontSize: 13, color: 'rgba(255,255,255,.6)', fontWeight: 600 }}>Practice History</span>
      </div>

      <div style={{ maxWidth: 720, margin: '0 auto', padding: '40px 24px' }}>
        <div style={{ fontFamily: "Inter, sans-serif", fontSize: 26, fontWeight: 600, marginBottom: 20 }}>Your Practice Sessions</div>

        {error && <div style={{ fontSize: 12, color: '#ef4444', marginBottom: 14 }}>{error}</div>}

        {items === null && !error && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <LoadingSkeleton height={64} /><LoadingSkeleton height={64} /><LoadingSkeleton height={64} />
          </div>
        )}

        {items && items.length === 0 && (
          <GlassCard>
            <EmptyState icon="🎯" title="No practice sessions yet" description="Start one from Interview Practice — chat, assessment, or voice." />
          </GlassCard>
        )}

        {items && items.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {items.map(item => {
              const m = getModeDefinition(item.mode)
              const score = item.ai_score ?? item.assessment_score
              return (
                <div key={item.id}>
                  <GlassCard hoverable onClick={() => openItem(item.id)} style={{ padding: '14px 16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div style={{ width: 36, height: 36, borderRadius: 10, display: 'grid', placeItems: 'center', fontSize: 16, background: `${m.accent}18`, flexShrink: 0 }}>{m.icon}</div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13.5, fontWeight: 700, color: '#fff' }}>{item.target_role}</div>
                        <div style={{ fontSize: 11, color: 'rgba(255,255,255,.4)' }}>{m.title} · {item.created_at ? new Date(item.created_at).toLocaleDateString() : ''}</div>
                      </div>
                      {score != null && (
                        <div style={{ fontSize: 15, fontWeight: 700, color: score >= 70 ? '#13c28e' : score >= 45 ? '#e2b04a' : '#ef4444' }}>{score}</div>
                      )}
                      <GradientBadge label={item.status === 'completed' ? 'Done' : 'In progress'} tone={item.status === 'completed' ? 'teal' : 'neutral'} />
                      <button onClick={e => { e.stopPropagation(); deleteItem(item.id) }} disabled={deletingId === item.id}
                        style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,.25)', cursor: 'pointer', fontSize: 13, padding: 4 }}>
                        {deletingId === item.id ? '...' : '✕'}
                      </button>
                    </div>
                  </GlassCard>

                  {openId === item.id && (
                    <div className="scale-in" style={{ marginTop: 8, marginBottom: 4 }}>
                      {reportLoading ? <LoadingSkeleton height={120} /> : openReport && <AIFeedbackReport data={openReport} />}
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