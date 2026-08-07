'use client'
import { useState, useMemo } from 'react'
import { GlassCard, GradientBadge, LoadingSkeleton } from '@/components/shared/primitives'
import { CopilotContext, CapabilityItem } from './types'
import { getJDInsights } from './jdInsights'
import { getCandidateInsights, PeerCandidate } from './candidateInsights'
import { AIFeedbackData } from '../reports/AIFeedbackReport'

const CONTEXT_META: Record<CopilotContext, { title: string; emptyHint: string }> = {
  job_creation: { title: 'Copilot · Job', emptyHint: 'Start typing a job description — I\'ll analyze it as you go.' },
  interview_builder: { title: 'Copilot · Interview', emptyHint: 'Paste a job description in the config step — I\'ll analyze it here.' },
  candidate_review: { title: 'Copilot · Candidate', emptyHint: 'Select a candidate to see a summary, evidence, and a recommendation.' },
  reports: { title: 'Copilot · Reports', emptyHint: 'Open a report to see AI-derived insights here.' },
}

function CapabilityRow({ item }: { item: CapabilityItem }) {
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
  // available
  return (
    <div style={{ padding: '9px 0', borderBottom: '1px solid rgba(255,255,255,.05)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5 }}>
        <span style={{ fontSize: 12 }}>{item.icon}</span>
        <span style={{ fontSize: 11.5, fontWeight: 700, color: 'rgba(255,255,255,.85)' }}>{item.label}</span>
      </div>
      {item.content && (
        <div style={{ fontSize: 11.5, color: 'rgba(255,255,255,.55)', lineHeight: 1.6, paddingLeft: 20, whiteSpace: 'pre-wrap' }}>{item.content}</div>
      )}
    </div>
  )
}

export default function CopilotPanel({
  context, jd, report, candidateName, peers, defaultCollapsed = false,
}: {
  context: CopilotContext
  jd?: string
  report?: AIFeedbackData | null
  candidateName?: string
  peers?: PeerCandidate[]
  defaultCollapsed?: boolean
}) {
  const [collapsed, setCollapsed] = useState(defaultCollapsed)
  const meta = CONTEXT_META[context]

  const result = useMemo(() => {
    if (context === 'job_creation' || context === 'interview_builder') return getJDInsights(jd || '')
    return getCandidateInsights(report ?? null, candidateName, peers)
  }, [context, jd, report, candidateName, peers])

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
    <GlassCard style={{ width: 260, flexShrink: 0, alignSelf: 'flex-start', position: 'sticky', top: 20, maxHeight: 'calc(100vh - 140px)', overflowY: 'auto' }}>
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