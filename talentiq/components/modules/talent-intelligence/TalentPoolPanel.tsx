'use client'
import { useEffect, useState, CSSProperties } from 'react'
import { api } from '@/lib/api'
import { LoadingSkeleton, EmptyState, GradientBadge } from '@/components/shared/primitives'
import { PoolCandidate, FIT_TIER_LABEL, FIT_TIER_COLOR, FitTier, InterviewStatus, INTERVIEW_STATUS_LABEL } from './types'
import { RankedCandidate } from './types'
import CandidateDetailPanel from './CandidateDetailPanel'
import ComparisonView from './ComparisonView'

type TierFilter = 'all' | FitTier
type InterviewFilter = 'all' | InterviewStatus
type ScreeningFilter = 'all' | 'pending' | 'yes' | 'no'

const MAX_COMPARE = 5

export default function TalentPoolPanel({ interviewPostings }: {
    interviewPostings: { id: string; title: string }[]
}) {
    const [pool, setPool] = useState<PoolCandidate[] | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')

    const [search, setSearch] = useState('')
    const [tierFilter, setTierFilter] = useState<TierFilter>('all')
    const [interviewFilter, setInterviewFilter] = useState<InterviewFilter>('all')
    const [screeningFilter, setScreeningFilter] = useState<ScreeningFilter>('all')
    const [recommendedOnly, setRecommendedOnly] = useState(false)
    const [skillQuery, setSkillQuery] = useState('')
    const [minAts, setMinAts] = useState(0)
    const [maxAts, setMaxAts] = useState(100)

    const [compareMode, setCompareMode] = useState(false)
    const [selected, setSelected] = useState<string[]>([])
    const [compareData, setCompareData] = useState<RankedCandidate[] | null>(null)
    const [compareLoading, setCompareLoading] = useState(false)

    const [openId, setOpenId] = useState<string | null>(null)

    const load = () => {
        setLoading(true)
        setError('')
        api.getTalentPool()
            .then((r: any) => setPool(r.candidates || []))
            .catch(() => setError('Could not load the Talent Pool right now.'))
            .finally(() => setLoading(false))
    }

    useEffect(() => { load() }, [])

    if (openId) {
        return (
            <CandidateDetailPanel
                applicationId={openId}
                interviewPostings={interviewPostings}
                onBack={() => setOpenId(null)}
                onChanged={load}
                onToggleCompare={(c: PoolCandidate) => toggleSelect(c.id)}
                isSelectedForCompare={selected.includes(openId)}
            />
        )
    }

    if (loading) {
        return <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxWidth: 760 }}>{[0, 1, 2].map(i => <LoadingSkeleton key={i} height={64} />)}</div>
    }
    if (error) {
        return <div style={{ fontSize: 12.5, color: '#ef4444' }}>{error}</div>
    }
    if (!pool || pool.length === 0) {
        return <EmptyState icon="🗂" title="No candidates screened yet" description="Run a bulk screening — every candidate will show up here, filterable and searchable." />
    }

    function toggleSelect(id: string) {
        setSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : prev.length < MAX_COMPARE ? [...prev, id] : prev)
    }

    const filtered = pool.filter(c => {
        if (tierFilter !== 'all' && c.fit_tier !== tierFilter) return false
        if (interviewFilter !== 'all' && c.interview_status !== interviewFilter) return false
        if (screeningFilter !== 'all' && c.is_shortlisted !== screeningFilter) return false
        if (recommendedOnly && !(c.fit_tier === 'strong' || c.fit_tier === 'good')) return false
        if (c.ats_score != null && (c.ats_score < minAts || c.ats_score > maxAts)) return false
        if (skillQuery.trim()) {
            const q = skillQuery.trim().toLowerCase()
            if (!c.matched_skills.some(s => s.toLowerCase().includes(q))) return false
        }
        if (search.trim()) {
            const q = search.trim().toLowerCase()
            const hay = [c.candidate_name, c.candidate_email, c.id].filter(Boolean).join(' ').toLowerCase()
            if (!hay.includes(q)) return false
        }
        return true
    })

    const loadCompare = async () => {
        setCompareLoading(true)
        try {
            const details: PoolCandidate[] = await Promise.all(selected.map(id => api.getTalentPoolCandidate(id)))
            const mapped: RankedCandidate[] = details.map(d => ({
                id: d.id,
                candidate_name: d.candidate_name || 'Unnamed candidate',
                candidate_email: d.candidate_email || '',
                status: d.interview_status,
                fit_score: d.fit_score,
                fit_tier: d.fit_tier,
                recommendation: d.recommendation,
                ai_score: d.interview_report?.ai_score ?? null,
                assessment_score: d.interview_report?.assessment_score ?? null,
                resume_available: d.resume_available,
                ats_score: d.ats_score,
                matched_skills: d.matched_skills,
                missing_skills: d.missing_skills,
                skill_match_pct: d.skill_match_pct,
                resume_verdict: d.resume_verdict,
                resume_role_title: d.resume_role_title,
                resume_scanned_at: d.resume_scanned_at,
                experience_match_available: false,
                education_match_available: false,
                proctoring_flag_count: 0,
                evidence: d.evidence,
                created_at: d.created_at || '',
                completed_at: d.screened_at,
            }))
            setCompareData(mapped)
        } finally {
            setCompareLoading(false)
        }
    }

    return (
        <div style={{ maxWidth: 780 }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
                <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search name, email, or ID…" style={{ ...selectSt, width: 200 }} />
                <select value={tierFilter} onChange={e => setTierFilter(e.target.value as TierFilter)} style={selectSt}>
                    <option value="all">All Fit Tiers</option>
                    <option value="strong">Strong Match</option>
                    <option value="good">Good Match</option>
                    <option value="possible">Possible Match</option>
                    <option value="low">Low Match</option>
                    <option value="not_enough_data">Not Enough Data</option>
                </select>
                <select value={interviewFilter} onChange={e => setInterviewFilter(e.target.value as InterviewFilter)} style={selectSt}>
                    <option value="all">Any Interview Status</option>
                    <option value="not_invited">Not Invited</option>
                    <option value="invited">Invited</option>
                    <option value="in_progress">In Progress</option>
                    <option value="completed">Completed</option>
                    <option value="unknown">Unknown</option>
                </select>
                <select value={screeningFilter} onChange={e => setScreeningFilter(e.target.value as ScreeningFilter)} style={selectSt}>
                    <option value="all">Any Screening Status</option>
                    <option value="pending">Pending Review</option>
                    <option value="yes">Shortlisted</option>
                    <option value="no">Rejected</option>
                </select>
                <input value={skillQuery} onChange={e => setSkillQuery(e.target.value)} placeholder="Skill…" style={{ ...selectSt, width: 110 }} />
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span style={{ fontSize: 10.5, color: 'rgba(255,255,255,.4)' }}>ATS</span>
                    <input type="number" min={0} max={100} value={minAts} onChange={e => setMinAts(Number(e.target.value) || 0)} style={{ ...selectSt, width: 50 }} />
                    <span style={{ fontSize: 10.5, color: 'rgba(255,255,255,.3)' }}>–</span>
                    <input type="number" min={0} max={100} value={maxAts} onChange={e => setMaxAts(Number(e.target.value) || 100)} style={{ ...selectSt, width: 50 }} />
                </div>
                <label style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: 'rgba(255,255,255,.5)', cursor: 'pointer' }}>
                    <input type="checkbox" checked={recommendedOnly} onChange={e => setRecommendedOnly(e.target.checked)} /> Recommended only
                </label>
                <button onClick={() => { setCompareMode(m => !m); setSelected([]); setCompareData(null) }} style={{
                    marginLeft: 'auto', fontSize: 11, fontWeight: 700, padding: '7px 14px', borderRadius: 8, cursor: 'pointer', fontFamily: 'Inter,sans-serif',
                    background: compareMode ? '#13c28e' : 'rgba(255,255,255,.05)', color: compareMode ? '#0a0a08' : 'rgba(255,255,255,.6)',
                    border: compareMode ? 'none' : '1px solid rgba(255,255,255,.1)',
                }}>{compareMode ? `Comparing (${selected.length}/${MAX_COMPARE})` : 'Compare Candidates'}</button>
            </div>

            <div style={{ fontSize: 11, color: 'rgba(255,255,255,.3)', marginBottom: 10 }}>{filtered.length} of {pool.length} candidates</div>

            {compareMode && (
                <div style={{ marginBottom: 14 }}>
                    {selected.length >= 2 && !compareData && (
                        <button onClick={loadCompare} disabled={compareLoading} style={{ fontSize: 11.5, fontWeight: 700, padding: '8px 16px', borderRadius: 8, border: 'none', cursor: 'pointer', background: '#7c3aed', color: '#fff', fontFamily: 'Inter,sans-serif' }}>
                            {compareLoading ? 'Loading…' : `Compare ${selected.length} Selected →`}
                        </button>
                    )}
                    {selected.length < 2 && <div style={{ fontSize: 11.5, color: 'rgba(255,255,255,.35)' }}>Select 2–5 candidates below to compare.</div>}
                    {compareData && (
                        <ComparisonView candidates={compareData} onClose={() => { setCompareData(null); setCompareMode(false); setSelected([]) }} onOpen={(c) => setOpenId(c.id)} />
                    )}
                </div>
            )}

            {filtered.length === 0 ? (
                <EmptyState icon="🔍" title="No matches" description="Try loosening the filters above." />
            ) : (
                filtered.map(c => (
                    <div key={c.id} style={{ background: '#111110', border: selected.includes(c.id) ? '1px solid rgba(19,194,142,.35)' : '1px solid rgba(255,255,255,.06)', borderRadius: 12, padding: 14, marginBottom: 8 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                            {compareMode && (
                                <div onClick={() => toggleSelect(c.id)} style={{
                                    width: 18, height: 18, borderRadius: 5, flexShrink: 0, cursor: 'pointer', display: 'grid', placeItems: 'center',
                                    border: selected.includes(c.id) ? 'none' : '1.5px solid rgba(255,255,255,.25)', background: selected.includes(c.id) ? '#13c28e' : 'transparent',
                                }}>{selected.includes(c.id) && <span style={{ color: '#0a0a08', fontSize: 12, fontWeight: 900 }}>✓</span>}</div>
                            )}
                            <div onClick={() => setOpenId(c.id)} style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1, minWidth: 0, cursor: 'pointer' }}>
                                <div style={{ width: 32, height: 32, borderRadius: '50%', flexShrink: 0, display: 'grid', placeItems: 'center', fontSize: 11, fontWeight: 700, color: '#fff', background: 'linear-gradient(135deg,#0b7c5e,#13c28e)' }}>
                                    {(c.candidate_name || c.cv_filename || '?').split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]?.toUpperCase()).join('')}
                                </div>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                        <div style={{ fontSize: 13, fontWeight: 700, color: '#fff' }}>{c.candidate_name || c.cv_filename || 'Unnamed candidate'}</div>
                                        <GradientBadge label={FIT_TIER_LABEL[c.fit_tier]} tone={c.fit_tier === 'strong' || c.fit_tier === 'good' ? 'teal' : c.fit_tier === 'possible' ? 'gold' : 'neutral'} />
                                        {c.is_shortlisted === 'yes' && <span style={{ fontSize: 9.5, fontWeight: 700, padding: '1px 6px', borderRadius: 100, background: 'rgba(19,194,142,.12)', color: '#13c28e' }}>Shortlisted</span>}
                                        {c.is_shortlisted === 'no' && <span style={{ fontSize: 9.5, fontWeight: 700, padding: '1px 6px', borderRadius: 100, background: 'rgba(239,68,68,.1)', color: '#ef4444' }}>Rejected</span>}
                                    </div>
                                    <div style={{ fontSize: 11, color: 'rgba(255,255,255,.35)' }}>{c.job_title}{c.candidate_email ? ` · ${c.candidate_email}` : ''}</div>
                                </div>
                                <div style={{ textAlign: 'center', flexShrink: 0 }}>
                                    <div style={{ fontSize: 16, fontWeight: 700, color: FIT_TIER_COLOR[c.fit_tier] }}>{c.ats_score ?? '—'}</div>
                                    <div style={{ fontSize: 8, color: 'rgba(255,255,255,.25)' }}>ATS</div>
                                </div>
                                <div style={{ textAlign: 'right', minWidth: 90, flexShrink: 0 }}>
                                    <div style={{ fontSize: 10.5, fontWeight: 700, color: c.interview_status === 'completed' ? '#13c28e' : c.interview_status === 'invited' || c.interview_status === 'in_progress' ? '#e2b04a' : 'rgba(255,255,255,.3)' }}>
                                        {INTERVIEW_STATUS_LABEL[c.interview_status]}
                                    </div>
                                    {c.interview_posting && (
                                        <div style={{ fontSize: 9, color: 'rgba(255,255,255,.25)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 90 }}>{c.interview_posting.title}</div>
                                    )}
                                </div>
                            </div>
                        </div>
                        <div style={{ fontSize: 10.5, color: 'rgba(255,255,255,.35)', marginTop: 8, paddingLeft: compareMode ? 62 : 44 }}>
                            {c.matched_skills.length > 0 && <span style={{ color: '#13c28e' }}>✓ {c.matched_skills.slice(0, 4).join(', ')}</span>}
                            {c.missing_skills.length > 0 && <span style={{ marginLeft: 10, color: '#ef4444' }}>Missing: {c.missing_skills.slice(0, 3).join(', ')}</span>}
                        </div>
                    </div>
                ))
            )}
        </div>
    )
}

const selectSt: CSSProperties = {
    background: '#161614', border: '1px solid rgba(255,255,255,.08)', borderRadius: 6, padding: '6px 10px',
    fontSize: 11.5, color: 'rgba(255,255,255,.75)', fontFamily: 'Inter,sans-serif', outline: 'none',
}