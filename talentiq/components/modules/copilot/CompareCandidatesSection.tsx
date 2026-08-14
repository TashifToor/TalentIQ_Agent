'use client'
import { useState } from 'react'
import { GlassCard, GradientBadge, LoadingSkeleton } from '@/components/shared/primitives'
import { CompareData } from './types'
import { fetchPeerBreakdowns, PeerBreakdown } from './comparisonInsights'

function initials(name: string): string {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]?.toUpperCase()).join('') || '?'
}

const MAX_DEEP_COMPARE = 6

export default function CompareCandidatesSection({ data }: { data: CompareData }) {
  const [expanded, setExpanded] = useState(false)
  const [loading, setLoading] = useState(false)
  const [breakdowns, setBreakdowns] = useState<PeerBreakdown[] | null>(null)
  const [error, setError] = useState('')

  const loadFullComparison = async () => {
    setExpanded(true)
    if (breakdowns || loading) return
    setLoading(true)
    setError('')
    try {
      const targets = data.peers.slice(0, MAX_DEEP_COMPARE)
      const result = await fetchPeerBreakdowns(targets)
      setBreakdowns(result)
    } catch {
      setError('Could not load full comparison right now.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      {/* Real, deterministic ranking by score — always available */}
      <div style={{ marginBottom: 10 }}>
        {data.peers.slice(0, 8).map((p, i) => {
          const isSelf = p.id === data.candidateId
          return (
            <div key={p.id} style={{
              display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px', borderRadius: 8, marginBottom: 3,
              background: isSelf ? 'rgba(226,176,74,.1)' : 'transparent',
              border: isSelf ? '1px solid rgba(226,176,74,.25)' : '1px solid transparent',
            }}>
              <span style={{
                width: 18, height: 18, borderRadius: '50%', display: 'grid', placeItems: 'center', flexShrink: 0,
                fontSize: 9, fontWeight: 800, color: i === 0 ? '#0a0a08' : 'rgba(255,255,255,.5)',
                background: i === 0 ? '#e2b04a' : 'rgba(255,255,255,.08)',
              }}>{i + 1}</span>
              <span style={{ fontSize: 11.5, color: isSelf ? '#fff' : 'rgba(255,255,255,.65)', fontWeight: isSelf ? 700 : 500, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {p.name}{isSelf ? ' (this candidate)' : ''}
              </span>
              <span style={{ fontSize: 11, fontWeight: 700, color: '#13c28e', flexShrink: 0 }}>{p.score}</span>
            </div>
          )
        })}
        {data.peers.length > 8 && (
          <div style={{ fontSize: 10.5, color: 'rgba(255,255,255,.3)', padding: '2px 8px' }}>+{data.peers.length - 8} more</div>
        )}
      </div>

      {!expanded && (
        <button onClick={loadFullComparison} style={{
          width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid rgba(255,255,255,.1)',
          background: 'rgba(255,255,255,.03)', color: 'rgba(255,255,255,.7)', fontSize: 11, fontWeight: 700,
          cursor: 'pointer', fontFamily: 'Inter,sans-serif',
        }}>
          Load full side-by-side comparison →
        </button>
      )}

      {expanded && loading && (
        <div style={{ display: 'flex', gap: 8 }}>
          {[0, 1, 2].map(i => <LoadingSkeleton key={i} height={70} />)}
        </div>
      )}

      {expanded && error && <div style={{ fontSize: 11, color: '#ef4444' }}>{error}</div>}

      {expanded && breakdowns && (
        <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4 }}>
          {breakdowns.map(b => {
            const isSelf = b.id === data.candidateId
            return (
              <GlassCard key={b.id} style={{ minWidth: 150, flexShrink: 0, padding: 12, border: isSelf ? '1px solid rgba(226,176,74,.3)' : undefined }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                  <div style={{ width: 22, height: 22, borderRadius: '50%', display: 'grid', placeItems: 'center', fontSize: 9, fontWeight: 700, color: '#fff', background: 'linear-gradient(135deg,#0b7c5e,#13c28e)', flexShrink: 0 }}>
                    {initials(b.name)}
                  </div>
                  <span style={{ fontSize: 10.5, fontWeight: 700, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{b.name}</span>
                </div>
                {b.score != null && (
                  <div style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 20, fontWeight: 700, color: '#13c28e', marginBottom: 4 }}>{b.score}</div>
                )}
                {b.verdict && <div style={{ marginBottom: 6 }}><GradientBadge label={b.verdict} tone="gold" /></div>}
                {b.topStrength && (
                  <div style={{ fontSize: 10, color: '#13c28e', marginBottom: 2 }}>✓ {b.topStrength.label} {b.topStrength.pct}%</div>
                )}
                {b.topConcern && b.topConcern.pct < 60 && (
                  <div style={{ fontSize: 10, color: '#ef4444' }}>⚠ {b.topConcern.label} {b.topConcern.pct}%</div>
                )}
                {!b.breakdown && <div style={{ fontSize: 10, color: 'rgba(255,255,255,.3)' }}>No MCQ breakdown</div>}
              </GlassCard>
            )
          })}
        </div>
      )}
    </div>
  )
}