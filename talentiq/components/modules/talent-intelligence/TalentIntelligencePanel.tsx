'use client'
import { useEffect, useState } from 'react'
import { api } from '@/lib/api'
import { LoadingSkeleton, EmptyState } from '@/components/shared/primitives'
import { PostingRanking, RankingFilter, RankedCandidate } from './types'
import CandidateFitCard from './CandidateFitCard'
import ComparisonView from './ComparisonView'

const FILTERS: { key: RankingFilter; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'strong', label: 'Strong Match' },
    { key: 'good', label: 'Good Match' },
    { key: 'possible', label: 'Possible Match' },
    { key: 'low', label: 'Low Match' },
    { key: 'interviewed', label: 'Interviewed' },
    { key: 'not_interviewed', label: 'Not Interviewed' },
    { key: 'recommended', label: 'Recommended' },
]

function applyFilter(candidates: RankedCandidate[], filter: RankingFilter): RankedCandidate[] {
    switch (filter) {
        case 'strong': return candidates.filter(c => c.fit_tier === 'strong')
        case 'good': return candidates.filter(c => c.fit_tier === 'good')
        case 'possible': return candidates.filter(c => c.fit_tier === 'possible')
        case 'low': return candidates.filter(c => c.fit_tier === 'low')
        case 'interviewed': return candidates.filter(c => c.status === 'completed')
        case 'not_interviewed': return candidates.filter(c => c.status !== 'completed')
        case 'recommended': return candidates.filter(c => c.recommendation === 'Strong Hire' || c.recommendation === 'Hire')
        default: return candidates
    }
}

export default function TalentIntelligencePanel({ postingId, onOpenCandidate }: {
    postingId: string
    onOpenCandidate: (candidate: RankedCandidate) => void
}) {
    const [data, setData] = useState<PostingRanking | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')
    const [filter, setFilter] = useState<RankingFilter>('all')
    const [compareMode, setCompareMode] = useState(false)
    const [selected, setSelected] = useState<string[]>([])

    useEffect(() => {
        let cancelled = false
        setLoading(true)
        setError('')
        api.getPostingRanking(postingId)
            .then((r: PostingRanking) => { if (!cancelled) setData(r) })
            .catch(() => { if (!cancelled) setError('Could not load candidate ranking right now.') })
            .finally(() => { if (!cancelled) setLoading(false) })
        return () => { cancelled = true }
    }, [postingId])

    const toggleSelect = (id: string) => {
        setSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : prev.length < 5 ? [...prev, id] : prev)
    }

    if (loading) {
        return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {[0, 1, 2, 3].map(i => <LoadingSkeleton key={i} height={64} light />)}
            </div>
        )
    }
    if (error) {
        return <div style={{ padding: 20, fontSize: 12.5, color: '#ef4444' }}>{error}</div>
    }
    if (!data || data.total_candidates === 0) {
        return <EmptyState icon="🎯" title="No candidates yet" description="Candidates who take this interview will be ranked here by real fit signals." light />
    }

    const filtered = applyFilter(data.candidates, filter)
    const selectedCandidates = data.candidates.filter(c => selected.includes(c.id))

    return (
        <div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 14 }}>
                <div style={{ background: '#ffffff', border: '1px solid #e7e4da', borderRadius: 10, padding: '8px 14px' }}>
                    <div style={{ fontSize: 16, fontWeight: 700, color: '#13c28e' }}>{data.strong_count}</div>
                    <div style={{ fontSize: 9, color: '#7a7468' }}>STRONG MATCH</div>
                </div>
                <div style={{ background: '#ffffff', border: '1px solid #e7e4da', borderRadius: 10, padding: '8px 14px' }}>
                    <div style={{ fontSize: 16, fontWeight: 700, color: '#5cb8e4' }}>{data.good_count}</div>
                    <div style={{ fontSize: 9, color: '#7a7468' }}>GOOD MATCH</div>
                </div>
                <div style={{ background: '#ffffff', border: '1px solid #e7e4da', borderRadius: 10, padding: '8px 14px' }}>
                    <div style={{ fontSize: 16, fontWeight: 700, color: '#e2b04a' }}>{data.possible_count}</div>
                    <div style={{ fontSize: 9, color: '#7a7468' }}>POSSIBLE MATCH</div>
                </div>
                <div style={{ background: '#ffffff', border: '1px solid #e7e4da', borderRadius: 10, padding: '8px 14px' }}>
                    <div style={{ fontSize: 16, fontWeight: 700, color: '#ef4444' }}>{data.low_count}</div>
                    <div style={{ fontSize: 9, color: '#7a7468' }}>LOW MATCH</div>
                </div>
                <div style={{ background: '#ffffff', border: '1px solid #e7e4da', borderRadius: 10, padding: '8px 14px' }}>
                    <div style={{ fontSize: 16, fontWeight: 700, color: '#7a7468' }}>{data.not_enough_data_count}</div>
                    <div style={{ fontSize: 9, color: '#7a7468' }}>NOT ENOUGH DATA</div>
                </div>
                <div style={{ marginLeft: 'auto' }}>
                    <button
                        onClick={() => { setCompareMode(m => !m); setSelected([]) }}
                        style={{
                            fontSize: 11.5, fontWeight: 700, padding: '9px 16px', borderRadius: 9, cursor: 'pointer', fontFamily: 'Inter,sans-serif',
                            background: compareMode ? '#13c28e' : '#f0eee6', color: compareMode ? '#0a0a08' : '#3a352d',
                            border: compareMode ? 'none' : '1px solid rgba(10,10,9,.1)',
                        }}
                    >
                        {compareMode ? `Comparing (${selected.length}/5)` : 'Compare Candidates'}
                    </button>
                </div>
            </div>

            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 14 }}>
                {FILTERS.map(f => (
                    <button
                        key={f.key}
                        onClick={() => setFilter(f.key)}
                        style={{
                            fontSize: 11, fontWeight: 600, padding: '6px 12px', borderRadius: 100, cursor: 'pointer', fontFamily: 'Inter,sans-serif',
                            background: filter === f.key ? 'rgba(19,194,142,.15)' : 'transparent',
                            color: filter === f.key ? '#13c28e' : '#5c574c',
                            border: filter === f.key ? '1px solid rgba(19,194,142,.35)' : '1px solid rgba(10,10,9,.1)',
                        }}
                    >
                        {f.label}
                    </button>
                ))}
            </div>

            {compareMode && selected.length >= 2 && (
                <ComparisonView candidates={selectedCandidates} onClose={() => { setCompareMode(false); setSelected([]) }} onOpen={onOpenCandidate} />
            )}
            {compareMode && selected.length < 2 && (
                <div style={{ fontSize: 11.5, color: '#7a7468', marginBottom: 14 }}>Select 2–5 candidates below to compare them side-by-side.</div>
            )}

            {filtered.length === 0 ? (
                <EmptyState icon="🔍" title="No candidates match this filter" description="Try a different filter to see more candidates." light />
            ) : (
                filtered.map((c, i) => (
                    <CandidateFitCard
                        key={c.id}
                        candidate={c}
                        rank={data.candidates.findIndex(x => x.id === c.id) + 1}
                        selected={selected.includes(c.id)}
                        compareMode={compareMode}
                        onToggleSelect={() => toggleSelect(c.id)}
                        onOpen={() => onOpenCandidate(c)}
                    />
                ))
            )}
        </div>
    )
}