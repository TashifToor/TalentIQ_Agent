'use client'
import { useState, useMemo } from 'react'
import { GlassCard, GradientBadge, LoadingSkeleton, ProgressRing } from '@/components/shared/primitives'
import {
  CopilotContext, CapabilityItem, ScoreBreakdownEntry, EvidenceGroup, RecommendationData,
  CompareData, StatTile, VerdictMixEntry, CandidateStatTile,
} from './types'
import { getJDInsights } from './jdInsights'
import { getCandidateInsights, PeerCandidate } from './candidateInsights'
import { getHROverviewInsights, HROverviewInput } from './hrOverviewInsights'
import { getCandidateHomeInsights, ResumeScanResult, PracticeHistoryItem } from './candidateHomeInsights'
import { AIFeedbackData } from '../reports/AIFeedbackReport'
import CompareCandidatesSection from './CompareCandidatesSection'

const CONTEXT_META: Record<CopilotContext, { title: string; emptyHint: string }> = {
  job_creation: { title: 'Copilot · Job', emptyHint: 'Start typing a job description — I\'ll analyze it as you go.' },
  interview_builder: { title: 'Copilot · Interview', emptyHint: 'Paste a job description in the config step — I\'ll analyze it here.' },
  candidate_review: { title: 'Copilot · Candidate', emptyHint: 'Select a candidate to see a summary, evidence, and a recommendation.' },
  reports: { title: 'Copilot · Reports', emptyHint: 'Open a report to see AI-derived insights here.' },
  hr_overview: { title: 'Copilot · Hiring', emptyHint: 'Create an interview link or run a screening to see hiring insights here.' },
  candidate_home: { title: 'Copilot · You', emptyHint: 'Scan your CV or practice an interview to see insights here.' },
}

const ACCENT_FOR = (pct: number) => (pct >= 70 ? '#13c28e' : pct >= 50 ? '#e2b04a' : '#ef4444')

function ScoreBars({ entries, tone }: { entries: ScoreBreakdownEntry[]; tone: 'strength' | 'concern' }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingLeft: 20 }}>
      {entries.map(e => (
        <div key={e.key}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10.5, color: 'rgba(255,255,255,.5)', marginBottom: 3 }}>
            <span>{e.label}</span>
            <span style={{ fontWeight: 700, color: tone === 'strength' ? '#13c28e' : ACCENT_FOR(100 - e.pct) }}>{e.pct}%</span>
          </div>
          <div style={{ height: 5, borderRadius: 3, background: 'rgba(255,255,255,.06)', overflow: 'hidden' }}>
            <div style={{
              width: `${e.pct}%`, height: '100%', borderRadius: 3, transition: 'width .6s var(--ease, ease)',
              background: tone === 'strength' ? 'linear-gradient(90deg,#0b7c5e,#13c28e)' : e.severity === 'high' ? '#ef4444' : e.severity === 'medium' ? '#f59e0b' : '#e2b04a',
            }} />
          </div>
        </div>
      ))}
    </div>
  )
}

function EvidenceView({ groups }: { groups: EvidenceGroup[] }) {
  const [openGroup, setOpenGroup] = useState<string | null>(groups[0]?.label || null)
  return (
    <div style={{ paddingLeft: 20 }}>
      {groups.map(g => {
        const open = openGroup === g.label
        return (
          <div key={g.label} style={{ marginBottom: 6 }}>
            <button onClick={() => setOpenGroup(open ? null : g.label)} style={{
              display: 'flex', alignItems: 'center', gap: 6, width: '100%', background: 'none', border: 'none',
              cursor: 'pointer', padding: '4px 0', fontFamily: 'Inter,sans-serif',
            }}>
              <span style={{ fontSize: 11 }}>{g.icon}</span>
              <span style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,.7)', flex: 1, textAlign: 'left' }}>{g.label}</span>
              <span style={{ fontSize: 10, color: 'rgba(255,255,255,.3)' }}>{g.items.length}</span>
              <span style={{ fontSize: 10, color: 'rgba(255,255,255,.3)', transform: open ? 'rotate(90deg)' : 'none', transition: 'transform .2s' }}>›</span>
            </button>
            {open && (
              <div style={{ paddingLeft: 17 }}>
                {g.items.map((it, i) => (
                  <div key={i} style={{ fontSize: 10.5, color: 'rgba(255,255,255,.45)', padding: '2px 0', lineHeight: 1.5 }}>· {it}</div>
                ))}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

function RecommendationView({ data }: { data: RecommendationData }) {
  const accent = data.score != null ? ACCENT_FOR(data.score) : '#e2b04a'
  return (
    <div style={{ paddingLeft: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 10 }}>
        {data.score != null && <ProgressRing value={data.score} size={54} accent={accent} />}
        <div>
          <GradientBadge label={data.verdict} tone={data.score != null && data.score >= 70 ? 'teal' : 'gold'} />
          {data.score != null && <div style={{ fontSize: 9.5, color: 'rgba(255,255,255,.3)', marginTop: 4 }}>{data.scoreLabel}: {data.score}</div>}
        </div>
      </div>
      {data.why.length > 0 && (
        <div>
          <div style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,.4)', textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 5 }}>Why?</div>
          {data.why.map((w, i) => <div key={i} style={{ fontSize: 11, color: 'rgba(255,255,255,.6)', lineHeight: 1.6, marginBottom: 2 }}>· {w}</div>)}
        </div>
      )}
    </div>
  )
}

function TileGrid({ tiles }: { tiles: (StatTile | CandidateStatTile)[] }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, paddingLeft: 20 }}>
      {tiles.map(t => (
        <div key={t.label} style={{ background: '#161614', border: '1px solid rgba(255,255,255,.06)', borderRadius: 8, padding: '7px 9px' }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: (t as CandidateStatTile).accent || '#fff' }}>{t.value}</div>
          <div style={{ fontSize: 9, color: 'rgba(255,255,255,.35)' }}>{t.label}</div>
        </div>
      ))}
    </div>
  )
}

function VerdictMixView({ mix }: { mix: VerdictMixEntry[] }) {
  const max = Math.max(...mix.map(m => m.count), 1)
  return (
    <div style={{ paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 6 }}>
      {mix.map(m => (
        <div key={m.label} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 10.5, color: 'rgba(255,255,255,.55)', width: 78, flexShrink: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.label}</span>
          <div style={{ flex: 1, height: 6, borderRadius: 3, background: 'rgba(255,255,255,.06)', overflow: 'hidden' }}>
            <div style={{ width: `${(m.count / max) * 100}%`, height: '100%', background: 'linear-gradient(90deg,#c5931f,#e2b04a)', borderRadius: 3 }} />
          </div>
          <span style={{ fontSize: 10.5, fontWeight: 700, color: '#fff', width: 14, textAlign: 'right' }}>{m.count}</span>
        </div>
      ))}
    </div>
  )
}

function CapabilityRow({ item }: { item: CapabilityItem }) {
  const [open, setOpen] = useState(true)

  if (item.status === 'coming_soon') {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 0', opacity: .5 }}>
        <span style={{ fontSize: 12 }}>{item.icon}</span>
        <span style={{ fontSize: 11.5, color: 'rgba(255,255,255,.5)', flex: 1 }}>{item.label}</span>
        <GradientBadge label="Soon" tone="neutral" />
      </div>
    )
  }
  if (item.status === 'thinking') {
    return (
      <div style={{ padding: '8px 0' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
          <span style={{ fontSize: 12 }}>{item.icon}</span>
          <span style={{ fontSize: 11.5, color: 'rgba(255,255,255,.6)' }}>{item.label}</span>
        </div>
        <LoadingSkeleton height={10} />
      </div>
    )
  }
  if (item.status === 'error') {
    return (
      <div style={{ padding: '8px 0' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
          <span style={{ fontSize: 12 }}>{item.icon}</span>
          <span style={{ fontSize: 11.5, color: 'rgba(255,255,255,.6)' }}>{item.label}</span>
        </div>
        <div style={{ fontSize: 11, color: '#ef4444' }}>{item.errorMessage || 'Something went wrong.'}</div>
      </div>
    )
  }
  if (item.status === 'empty') {
    // Genuinely no data for this capability yet — honest, muted, no "Soon" marketing badge.
    return (
      <div style={{ padding: '9px 0', borderBottom: '1px solid rgba(255,255,255,.05)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
          <span style={{ fontSize: 12, opacity: .5 }}>{item.icon}</span>
          <span style={{ fontSize: 11.5, fontWeight: 600, color: 'rgba(255,255,255,.5)', flex: 1 }}>{item.label}</span>
        </div>
        {item.content && <div style={{ fontSize: 11, color: 'rgba(255,255,255,.32)', lineHeight: 1.6, paddingLeft: 20 }}>{item.content}</div>}
      </div>
    )
  }

  // available — plain text fallback, or a rich renderer keyed by id
  const rich = (() => {
    switch (item.id) {
      case 'strengths': return item.data ? <ScoreBars entries={item.data as ScoreBreakdownEntry[]} tone="strength" /> : null
      case 'concerns': return item.data ? <ScoreBars entries={item.data as ScoreBreakdownEntry[]} tone="concern" /> : null
      case 'evidence': return item.data ? <EvidenceView groups={item.data as EvidenceGroup[]} /> : null
      case 'recommendation': return item.data ? <RecommendationView data={item.data as RecommendationData} /> : null
      case 'compare': return item.data ? <div style={{ paddingLeft: 20 }}><CompareCandidatesSection data={item.data as CompareData} /></div> : null
      case 'hiring_overview': case 'bulk_screening': case 'resume_screening': case 'interview_practice':
        return item.data ? <TileGrid tiles={item.data as (StatTile | CandidateStatTile)[]} /> : null
      case 'hiring_decisions': return item.data ? <VerdictMixView mix={item.data as VerdictMixEntry[]} /> : null
      default: return null
    }
  })()

  return (
    <div style={{ padding: '9px 0', borderBottom: '1px solid rgba(255,255,255,.05)' }}>
      <div onClick={() => setOpen(o => !o)} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5, cursor: 'pointer' }}>
        <span style={{ fontSize: 12 }}>{item.icon}</span>
        <span style={{ fontSize: 11.5, fontWeight: 700, color: 'rgba(255,255,255,.85)', flex: 1 }}>{item.label}</span>
        <span style={{ fontSize: 9.5, color: 'rgba(255,255,255,.25)', transform: open ? 'rotate(90deg)' : 'none', transition: 'transform .2s' }}>›</span>
      </div>
      {open && (
        rich || (item.content && (
          <div style={{ fontSize: 11.5, color: 'rgba(255,255,255,.55)', lineHeight: 1.6, paddingLeft: 20, whiteSpace: 'pre-wrap' }}>{item.content}</div>
        ))
      )}
    </div>
  )
}

export default function CopilotPanel({
  context, jd, report, candidateName, peers, defaultCollapsed = false, hrOverview, candidateHome,
}: {
  context: CopilotContext
  jd?: string
  report?: AIFeedbackData | null
  candidateName?: string
  peers?: PeerCandidate[]
  defaultCollapsed?: boolean
  hrOverview?: HROverviewInput
  candidateHome?: { scanResult: ResumeScanResult | null; practiceHistory: PracticeHistoryItem[] | null }
}) {
  const [collapsed, setCollapsed] = useState(defaultCollapsed)
  const meta = CONTEXT_META[context]

  const result = useMemo(() => {
    if (context === 'job_creation' || context === 'interview_builder') return getJDInsights(jd || '')
    if (context === 'hr_overview') return hrOverview ? getHROverviewInsights(hrOverview) : { state: 'empty' as const, items: [] }
    if (context === 'candidate_home') return candidateHome ? getCandidateHomeInsights(candidateHome) : { state: 'empty' as const, items: [] }
    return getCandidateInsights(report ?? null, candidateName, peers)
  }, [context, jd, report, candidateName, peers, hrOverview, candidateHome])

  const readyCount = result.items.filter(i => i.status === 'available').length

  if (collapsed) {
    return (
      <button onClick={() => setCollapsed(false)} style={{
        width: 44, flexShrink: 0, alignSelf: 'flex-start', position: 'sticky', top: 20,
        background: 'rgba(22,22,20,.55)', border: '1px solid rgba(255,255,255,.08)', borderRadius: 12,
        padding: '14px 0', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
      }}>
        <span style={{ fontSize: 16 }}>🧠</span>
        {readyCount > 0 && (
          <span style={{ fontSize: 9, fontWeight: 700, color: '#0a0a08', background: '#13c28e', borderRadius: 100, width: 16, height: 16, display: 'grid', placeItems: 'center' }}>{readyCount}</span>
        )}
      </button>
    )
  }

  return (
    <GlassCard style={{ width: 280, flexShrink: 0, alignSelf: 'flex-start', position: 'sticky', top: 20, maxHeight: 'calc(100vh - 140px)', overflowY: 'auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
        <div style={{ width: 26, height: 26, borderRadius: 8, display: 'grid', placeItems: 'center', flexShrink: 0, background: 'linear-gradient(135deg,#7c3aed,#a78bfa)' }}>
          <svg width="13" height="13" viewBox="0 0 16 16" fill="#fff"><path d="M8 1l1.6 4.4L14 7l-4.4 1.6L8 13l-1.6-4.4L2 7l4.4-1.6z" /></svg>
        </div>
        <div style={{ fontSize: 12.5, fontWeight: 700, color: '#fff', flex: 1 }}>{meta.title}</div>
        <button onClick={() => setCollapsed(true)} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,.35)', cursor: 'pointer', fontSize: 13, padding: 4 }}>⟩</button>
      </div>

      {result.state === 'empty' && (
        <div style={{ fontSize: 11.5, color: 'rgba(255,255,255,.35)', lineHeight: 1.6, padding: '14px 0 6px' }}>{meta.emptyHint}</div>
      )}

      {result.state === 'ready' && (
        <div style={{ marginTop: 8 }}>
          {result.items.map(item => <CapabilityRow key={item.id} item={item} />)}
        </div>
      )}
    </GlassCard>
  )
}