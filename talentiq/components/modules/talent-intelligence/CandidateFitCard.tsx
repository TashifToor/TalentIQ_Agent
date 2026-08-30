'use client'
import { useState } from 'react'
import { GradientBadge, ProgressRing } from '@/components/shared/primitives'
import { RankedCandidate, FIT_TIER_LABEL, FIT_TIER_COLOR } from './types'

function initials(name: string): string {
    return name.split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]?.toUpperCase()).join('') || '?'
}

export default function CandidateFitCard({
    candidate, rank, selected, compareMode, onToggleSelect, onOpen,
}: {
    candidate: RankedCandidate
    rank: number
    selected: boolean
    compareMode: boolean
    onToggleSelect: () => void
    onOpen: () => void
}) {
    const c = candidate
    const tierColor = FIT_TIER_COLOR[c.fit_tier]
    const canOpen = c.status === 'completed'
    const [expanded, setExpanded] = useState(false)

    return (
        <div style={{
            borderRadius: 12, marginBottom: 8,
            background: selected ? 'rgba(19,194,142,.08)' : '#ffffff',
            border: selected ? '1px solid rgba(19,194,142,.35)' : '1px solid rgba(10,10,9,.1)',
            transition: 'border-color .15s, background .15s',
        }}>
            <div
                onClick={() => (compareMode ? onToggleSelect() : canOpen ? onOpen() : undefined)}
                style={{
                    display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px',
                    cursor: compareMode || canOpen ? 'pointer' : 'default',
                }}
            >
                {compareMode && (
                    <div onClick={(e) => { e.stopPropagation(); onToggleSelect() }} style={{
                        width: 18, height: 18, borderRadius: 5, flexShrink: 0, display: 'grid', placeItems: 'center', cursor: 'pointer',
                        border: selected ? 'none' : '1.5px solid rgba(10,10,9,.2)', background: selected ? '#13c28e' : 'transparent',
                    }}>
                        {selected && <span style={{ color: '#0a0a08', fontSize: 12, fontWeight: 900 }}>✓</span>}
                    </div>
                )}

                <div style={{ width: 22, textAlign: 'center', flexShrink: 0, fontSize: 12, fontWeight: 700, color: rank <= 3 && c.fit_score != null ? '#e2b04a' : '#7a7468' }}>
                    #{rank}
                </div>

                <div style={{ width: 34, height: 34, borderRadius: '50%', flexShrink: 0, display: 'grid', placeItems: 'center', fontSize: 12, fontWeight: 700, color: '#fff', background: 'linear-gradient(135deg,#0b7c5e,#13c28e)' }}>
                    {initials(c.candidate_name)}
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                        <div style={{ fontSize: 13.5, fontWeight: 700, color: '#1f1c17', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.candidate_name}</div>
                        <GradientBadge label={FIT_TIER_LABEL[c.fit_tier]} tone={c.fit_tier === 'strong' ? 'teal' : c.fit_tier === 'good' ? 'teal' : c.fit_tier === 'possible' ? 'gold' : 'neutral'} />
                        {c.resume_available && <span style={{ fontSize: 9.5, fontWeight: 700, padding: '1px 6px', borderRadius: 100, background: 'rgba(124,58,237,.15)', color: '#a78bfa' }}>📄 Resume linked</span>}
                        {c.proctoring_flag_count > 0 && (
                            <span style={{ fontSize: 9.5, fontWeight: 700, padding: '1px 6px', borderRadius: 100, background: 'rgba(239,68,68,.12)', color: '#ef4444' }}>⚠ {c.proctoring_flag_count}</span>
                        )}
                    </div>
                    <div style={{ fontSize: 11, color: '#7a7468', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {c.evidence.slice(0, 3).join(' · ')}
                    </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexShrink: 0 }}>
                    {c.resume_available && c.ats_score != null && (
                        <div style={{ textAlign: 'center' }}>
                            <div style={{ fontSize: 13, fontWeight: 700, color: c.ats_score >= 70 ? '#13c28e' : c.ats_score >= 45 ? '#e2b04a' : '#ef4444' }}>{c.ats_score}</div>
                            <div style={{ fontSize: 8, color: '#9c9689' }}>ATS</div>
                        </div>
                    )}
                    {c.resume_available && c.skill_match_pct != null && (
                        <div style={{ textAlign: 'center' }}>
                            <div style={{ fontSize: 13, fontWeight: 700, color: c.skill_match_pct >= 70 ? '#13c28e' : c.skill_match_pct >= 45 ? '#e2b04a' : '#ef4444' }}>{c.skill_match_pct}%</div>
                            <div style={{ fontSize: 8, color: '#9c9689' }}>SKILLS</div>
                        </div>
                    )}
                    <div style={{ textAlign: 'right', minWidth: 76 }}>
                        <div style={{ fontSize: 10.5, fontWeight: 700, color: '#7a7468' }}>{c.recommendation || 'Not evaluated yet'}</div>
                        <div style={{ fontSize: 9, color: '#9c9689' }}>{c.status === 'completed' ? 'Completed' : 'In progress'}</div>
                    </div>
                    {c.fit_score != null ? (
                        <ProgressRing value={c.fit_score} size={44} accent={tierColor} />
                    ) : (
                        <div style={{ width: 44, height: 44, borderRadius: '50%', border: '2px dashed rgba(10,10,9,.14)', display: 'grid', placeItems: 'center', fontSize: 9, color: '#9c9689', textAlign: 'center', flexShrink: 0 }}>
                            N/A
                        </div>
                    )}
                    <button
                        onClick={(e) => { e.stopPropagation(); setExpanded(o => !o) }}
                        title="Why this rank?"
                        style={{
                            width: 22, height: 22, borderRadius: '50%', border: '1px solid rgba(10,10,9,.1)', background: 'none',
                            color: '#7a7468', fontSize: 11, cursor: 'pointer', display: 'grid', placeItems: 'center', flexShrink: 0,
                        }}
                    >
                        {expanded ? '−' : 'i'}
                    </button>
                </div>
            </div>
            {expanded && (
                <div style={{ padding: '0 16px 14px 54px', borderTop: '1px solid rgba(10,10,9,.1)', marginTop: 2, paddingTop: 10 }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: '#7a7468', textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 6 }}>Why this rank</div>
                    {c.evidence.map((ev, i) => (
                        <div key={i} style={{ fontSize: 11.5, color: '#5c574c', lineHeight: 1.7 }}>· {ev}</div>
                    ))}
                    {!c.resume_available && (
                        <div style={{ fontSize: 11, color: '#7a7468', marginTop: 4 }}>Resume / Skill Match: not available — no linked candidate account or CV scan found.</div>
                    )}
                    {c.resume_available && c.resume_role_title && (
                        <div style={{ fontSize: 10.5, color: '#7a7468', marginTop: 4 }}>Resume data is from the candidate's most recent CV scan (against &ldquo;{c.resume_role_title}&rdquo;) — may not have been scanned against this exact posting.</div>
                    )}
                    {!c.experience_match_available && (
                        <div style={{ fontSize: 11, color: '#7a7468', marginTop: 4 }}>Experience Match: not tracked in this data model.</div>
                    )}
                    {!c.education_match_available && (
                        <div style={{ fontSize: 11, color: '#7a7468' }}>Education Match: not tracked in this data model.</div>
                    )}
                </div>
            )}
        </div>
    )
}