'use client'
import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { GlassCard, GradientBadge, EmptyState, LoadingSkeleton } from '@/components/shared/primitives'
import { getModeDefinition, MODE_DEFINITIONS, InterviewMode } from '@/components/modules/interview-engine/modeData'
import AIFeedbackReport from '@/components/modules/reports/AIFeedbackReport'
import { api } from '@/lib/api'

/**
 * Buckets a real created_at timestamp into a scannable date group.
 * Falls back to "Earlier" for anything we can't parse rather than guessing.
 */
function dateGroupFor(createdAt: string | undefined): string {
  if (!createdAt) return 'Earlier'
  const d = new Date(createdAt)
  if (isNaN(d.getTime())) return 'Earlier'
  const now = new Date()
  const startOfDay = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate())
  const today = startOfDay(now)
  const day = startOfDay(d)
  const diffDays = Math.round((today.getTime() - day.getTime()) / 86400000)
  if (diffDays <= 0) return 'Today'
  if (diffDays === 1) return 'Yesterday'
  if (diffDays <= 7) return 'This Week'
  return 'Earlier'
}

const GROUP_ORDER = ['Today', 'Yesterday', 'This Week', 'Earlier']

function scoreColor(score: number) {
  return score >= 70 ? '#13c28e' : score >= 45 ? '#e2b04a' : '#ef4444'
}

export default function PracticeHistoryPage() {
  const [items, setItems] = useState<any[] | null>(null)
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')
  const [modeFilter, setModeFilter] = useState<InterviewMode | 'all'>('all')

  const [openId, setOpenId] = useState<string | null>(null)
  const [openItem, setOpenItem] = useState<any>(null)
  const [openReport, setOpenReport] = useState<any>(null)
  const [reportLoading, setReportLoading] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const reduceMotion = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

  useEffect(() => {
    api.getPracticeHistory().then(setItems).catch((e: any) => setError(e.message || 'Could not load practice history.'))
  }, [])

  // Real data only — sort by created_at desc so date grouping below reads naturally.
  const sorted = useMemo(() => {
    if (!items) return []
    return [...items].sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime())
  }, [items])

  // Local, case-insensitive, whitespace-tolerant filtering over real fields only (role + mode).
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase().replace(/\s+/g, ' ')
    return sorted.filter(item => {
      if (modeFilter !== 'all' && item.mode !== modeFilter) return false
      if (!q) return true
      const role = (item.target_role || '').toLowerCase()
      const modeTitle = getModeDefinition(item.mode).title.toLowerCase()
      const status = (item.status || '').toLowerCase()
      return role.includes(q) || modeTitle.includes(q) || status.includes(q)
    })
  }, [sorted, query, modeFilter])

  const grouped = useMemo(() => {
    const map = new Map<string, any[]>()
    for (const item of filtered) {
      const g = dateGroupFor(item.created_at)
      if (!map.has(g)) map.set(g, [])
      map.get(g)!.push(item)
    }
    return GROUP_ORDER.map(g => ({ group: g, items: map.get(g) || [] })).filter(g => g.items.length > 0)
  }, [filtered])

  const openSession = async (item: any) => {
    setOpenId(item.id)
    setOpenItem(item)
    setOpenReport(null)
    setReportLoading(true)
    try {
      setOpenReport(await api.getPracticeReport(item.id))
    } catch (e: any) {
      setError(e.message || 'Could not load that report.')
    } finally {
      setReportLoading(false)
    }
  }

  const closeDrawer = () => { setOpenId(null); setOpenItem(null); setOpenReport(null) }

  const deleteItem = async (id: string) => {
    setDeletingId(id)
    try {
      await api.deletePracticeSession(id)
      setItems(prev => (prev || []).filter(i => i.id !== id))
      if (openId === id) closeDrawer()
    } catch (e: any) {
      setError(e.message || 'Could not delete that session.')
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: '#0c0c0a', fontFamily: 'Syne, sans-serif', color: 'rgba(255,255,255,.88)' }}>
      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@500;600&family=Syne:wght@400;500;600;700&display=swap');
        @keyframes fadeUp { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes drawerInRight { from { opacity: 0; transform: translateX(24px); } to { opacity: 1; transform: translateX(0); } }
        @keyframes drawerInUp { from { opacity: 0; transform: translateY(24px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes backdropIn { from { opacity: 0; } to { opacity: 1; } }
        .fade-up { animation: fadeUp .35s ease both; }

        .history-card { cursor: pointer; transition: transform .2s ease, box-shadow .2s ease, border-color .2s ease; }
        .history-card:hover { transform: translateY(-2px); border-color: rgba(255,255,255,.16) !important; }
        .history-card:active { transform: translateY(0); }

        .history-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(272px, 1fr));
          gap: 14px;
        }

        .history-search-row { display: flex; gap: 10px; flex-wrap: wrap; align-items: center; }
        .history-mode-chips { display: flex; gap: 6px; flex-wrap: wrap; }

        .history-backdrop { position: fixed; inset: 0; background: rgba(0,0,0,.55); z-index: 998; animation: backdropIn .2s ease both; }
        .history-drawer {
          position: fixed; z-index: 999; background: #111110; border: 1px solid rgba(255,255,255,.08);
          display: flex; flex-direction: column;
          left: 0; right: 0; bottom: 0; top: auto; width: 100%; max-height: 88vh;
          border-radius: 18px 18px 0 0; animation: drawerInUp .28s ease both;
        }
        @media (min-width: 760px) {
          .history-drawer {
            left: auto; top: 0; bottom: 0; right: 0; width: 440px; max-height: 100vh; height: 100vh;
            border-radius: 0; border-left: 1px solid rgba(255,255,255,.08); border-top: none;
            animation: drawerInRight .28s ease both;
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .fade-up, .history-card, .history-drawer, .history-backdrop { animation: none !important; transition: none !important; }
          .history-card:hover { transform: none; }
        }

        @media (max-width: 480px) {
          .history-search-row { flex-direction: column; align-items: stretch; }
        }
      `}</style>

      <div style={{ height: 56, borderBottom: '1px solid rgba(255,255,255,.07)', display: 'flex', alignItems: 'center', padding: '0 20px', gap: 16 }}>
        <Link href="/candidate/dashboard/practice" style={{ color: 'rgba(255,255,255,.4)', textDecoration: 'none', fontSize: 13 }}>← Interview Practice</Link>
        <span style={{ color: 'rgba(255,255,255,.15)' }}>·</span>
        <span style={{ fontSize: 13, color: 'rgba(255,255,255,.6)', fontWeight: 600 }}>Practice History</span>
      </div>

      <div style={{ maxWidth: 1040, margin: '0 auto', padding: '32px 20px 60px' }}>
        <div style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 26, fontWeight: 600, marginBottom: 4 }}>Your Practice Sessions</div>
        <div style={{ fontSize: 13, color: 'rgba(255,255,255,.3)', marginBottom: 22 }}>Every assessment, chat, and voice session — tap any card for the full report</div>

        {error && <div style={{ fontSize: 12, color: '#ef4444', marginBottom: 14 }}>{error}</div>}

        {items === null && !error && (
          <div className="history-grid">
            <LoadingSkeleton height={110} /><LoadingSkeleton height={110} /><LoadingSkeleton height={110} />
          </div>
        )}

        {items && items.length === 0 && (
          <GlassCard>
            <EmptyState icon="🎯" title="No practice sessions yet" description="Start one from Interview Practice — chat, assessment, or voice." />
          </GlassCard>
        )}

        {items && items.length > 0 && (
          <>
            <div className="history-search-row" style={{ marginBottom: 22 }}>
              <div style={{ position: 'relative', flex: '1 1 260px', minWidth: 200 }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,.3)" strokeWidth="2"
                  style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)' }}>
                  <circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3" />
                </svg>
                <input
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  placeholder="Search by role or mode…"
                  style={{
                    width: '100%', background: '#161614', border: '1px solid rgba(255,255,255,.08)', borderRadius: 10,
                    padding: '10px 14px 10px 38px', fontSize: 13, color: '#fff', outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box',
                  }}
                />
              </div>
              <div className="history-mode-chips">
                <button onClick={() => setModeFilter('all')} style={{
                  fontSize: 11, fontWeight: 600, padding: '7px 12px', borderRadius: 100, cursor: 'pointer', fontFamily: 'Syne,sans-serif',
                  border: `1px solid ${modeFilter === 'all' ? 'rgba(255,255,255,.35)' : 'rgba(255,255,255,.08)'}`,
                  background: modeFilter === 'all' ? 'rgba(255,255,255,.08)' : 'transparent',
                  color: modeFilter === 'all' ? '#fff' : 'rgba(255,255,255,.4)',
                }}>All</button>
                {MODE_DEFINITIONS.map(m => (
                  <button key={m.id} onClick={() => setModeFilter(m.id)} style={{
                    display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 600, padding: '7px 12px', borderRadius: 100, cursor: 'pointer', fontFamily: 'Syne,sans-serif',
                    border: `1px solid ${modeFilter === m.id ? m.accent : 'rgba(255,255,255,.08)'}`,
                    background: modeFilter === m.id ? `${m.accent}18` : 'transparent',
                    color: modeFilter === m.id ? m.accent : 'rgba(255,255,255,.4)',
                  }}>{m.icon} {m.title.replace('AI ', '')}</button>
                ))}
              </div>
            </div>

            {grouped.length === 0 ? (
              <GlassCard>
                <EmptyState icon="🔍" title="No matching sessions" description="Try a different role name or mode filter." />
              </GlassCard>
            ) : (
              grouped.map(({ group, items: groupItems }) => (
                <div key={group} style={{ marginBottom: 28 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: 'rgba(255,255,255,.3)', marginBottom: 12 }}>
                    {group}
                  </div>
                  <div className="history-grid">
                    {groupItems.map((item, i) => {
                      const m = getModeDefinition(item.mode)
                      const score = item.ai_score ?? item.assessment_score
                      return (
                        <GlassCard
                          key={item.id}
                          className="history-card fade-up"
                          style={{ padding: '16px 16px', animationDelay: `${i * 30}ms` }}
                          onClick={() => openSession(item)}
                        >
                          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 10 }}>
                            <div style={{ width: 34, height: 34, borderRadius: 10, display: 'grid', placeItems: 'center', fontSize: 15, background: `${m.accent}18`, flexShrink: 0 }}>{m.icon}</div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontSize: 13.5, fontWeight: 700, color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.target_role || 'Untitled role'}</div>
                              <div style={{ fontSize: 11, color: 'rgba(255,255,255,.4)' }}>{m.title} · {item.created_at ? new Date(item.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : ''}</div>
                            </div>
                            <button
                              onClick={e => { e.stopPropagation(); deleteItem(item.id) }}
                              disabled={deletingId === item.id}
                              aria-label="Delete session"
                              style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,.25)', cursor: 'pointer', fontSize: 13, padding: 6, flexShrink: 0 }}
                            >
                              {deletingId === item.id ? '…' : '✕'}
                            </button>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <GradientBadge label={item.status === 'completed' ? 'Done' : 'In progress'} tone={item.status === 'completed' ? 'teal' : 'neutral'} />
                            {score != null ? (
                              <span style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 20, fontWeight: 700, color: scoreColor(score) }}>{score}</span>
                            ) : (
                              <span style={{ fontSize: 11, color: 'rgba(255,255,255,.25)' }}>Not scored</span>
                            )}
                          </div>
                        </GlassCard>
                      )
                    })}
                  </div>
                </div>
              ))
            )}
          </>
        )}
      </div>

      {openId && (
        <>
          <div className="history-backdrop" onClick={closeDrawer} />
          <div className="history-drawer" role="dialog" aria-modal="true">
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '18px 20px', borderBottom: '1px solid rgba(255,255,255,.07)', flexShrink: 0 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{openItem?.target_role || 'Untitled role'}</div>
                <div style={{ fontSize: 11.5, color: 'rgba(255,255,255,.4)' }}>{openItem ? getModeDefinition(openItem.mode).title : ''}{openItem?.created_at ? ` · ${new Date(openItem.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}` : ''}</div>
              </div>
              <button onClick={closeDrawer} aria-label="Close" style={{ background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.1)', borderRadius: 8, width: 30, height: 30, display: 'grid', placeItems: 'center', color: 'rgba(255,255,255,.6)', cursor: 'pointer', flexShrink: 0 }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12" /></svg>
              </button>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: 20 }}>
              {reportLoading ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <LoadingSkeleton height={100} /><LoadingSkeleton height={80} /><LoadingSkeleton height={80} />
                </div>
              ) : openReport ? (
                <AIFeedbackReport data={openReport} />
              ) : (
                <EmptyState icon="📄" title="Report unavailable" description="This session doesn't have a report yet." />
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}