'use client'
import { RankedCandidate } from './types'

function initials(name: string): string {
    return name.split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]?.toUpperCase()).join('') || '?'
}

interface Row {
    label: string
    getValue: (c: RankedCandidate) => number | null
    getDisplay: (c: RankedCandidate) => string
    higherIsBetter: boolean
}

const ROWS: Row[] = [
    { label: 'Job Fit', getValue: c => c.fit_score, getDisplay: c => c.fit_score != null ? `${c.fit_score}%` : 'Not enough data', higherIsBetter: true },
    { label: 'ATS', getValue: c => c.resume_available ? c.ats_score : null, getDisplay: c => c.resume_available && c.ats_score != null ? String(c.ats_score) : 'Not available', higherIsBetter: true },
    { label: 'Skills', getValue: c => c.resume_available ? c.skill_match_pct : null, getDisplay: c => c.resume_available && c.skill_match_pct != null ? `${c.skill_match_pct}%` : 'Not available', higherIsBetter: true },
    { label: 'Experience', getValue: () => null, getDisplay: () => 'Not tracked', higherIsBetter: true },
    { label: 'Assessment', getValue: c => c.assessment_score, getDisplay: c => c.assessment_score != null ? `${c.assessment_score}%` : 'Not evaluated yet', higherIsBetter: true },
    { label: 'Interview', getValue: c => c.ai_score, getDisplay: c => c.ai_score != null ? String(c.ai_score) : 'Not evaluated yet', higherIsBetter: true },
    { label: 'Verdict', getValue: () => null, getDisplay: c => c.recommendation || 'Not evaluated yet', higherIsBetter: true },
]

export default function ComparisonView({ candidates, onClose, onOpen }: {
    candidates: RankedCandidate[]
    onClose: () => void
    onOpen: (candidate: RankedCandidate) => void
}) {
    return (
        <div style={{ background: '#111110', border: '1px solid rgba(255,255,255,.08)', borderRadius: 14, padding: 20, marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: 16 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#fff', flex: 1 }}>Comparing {candidates.length} candidates</div>
                <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,.4)', fontSize: 12, cursor: 'pointer', fontFamily: 'Inter,sans-serif' }}>Close ✕</button>
            </div>

            <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 480 }}>
                    <thead>
                        <tr>
                            <th style={{ textAlign: 'left', padding: '6px 10px', fontSize: 9.5, fontWeight: 700, color: 'rgba(255,255,255,.3)', textTransform: 'uppercase', letterSpacing: '.05em' }}></th>
                            {candidates.map(c => (
                                <th key={c.id} style={{ textAlign: 'center', padding: '6px 10px', minWidth: 130, cursor: 'pointer' }} onClick={() => onOpen(c)}>
                                    <div style={{ width: 32, height: 32, borderRadius: '50%', margin: '0 auto 6px', display: 'grid', placeItems: 'center', fontSize: 11, fontWeight: 700, color: '#fff', background: 'linear-gradient(135deg,#0b7c5e,#13c28e)' }}>
                                        {initials(c.candidate_name)}
                                    </div>
                                    <div style={{ fontSize: 11.5, fontWeight: 700, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.candidate_name}</div>
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {ROWS.map(row => {
                            const values = candidates.map(c => row.getValue(c))
                            const best = values.some(v => v != null) ? Math.max(...values.filter((v): v is number => v != null)) : null
                            return (
                                <tr key={row.label} style={{ borderTop: '1px solid rgba(255,255,255,.05)' }}>
                                    <td style={{ padding: '10px', fontSize: 11.5, fontWeight: 700, color: 'rgba(255,255,255,.5)' }}>{row.label}</td>
                                    {candidates.map(c => {
                                        const v = row.getValue(c)
                                        const isBest = best != null && v === best
                                        return (
                                            <td key={c.id} style={{ textAlign: 'center', padding: '10px' }}>
                                                <span style={{
                                                    fontSize: 12.5, fontWeight: isBest ? 800 : 500,
                                                    color: isBest ? '#13c28e' : v == null ? 'rgba(255,255,255,.3)' : 'rgba(255,255,255,.75)',
                                                }}>
                                                    {isBest && '★ '}{row.getDisplay(c)}
                                                </span>
                                            </td>
                                        )
                                    })}
                                </tr>
                            )
                        })}
                    </tbody>
                </table>
            </div>
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,.25)', marginTop: 10 }}>★ marks the strongest candidate for that category, among those with a real score. Click a name to open their full report.</div>
        </div>
    )
}