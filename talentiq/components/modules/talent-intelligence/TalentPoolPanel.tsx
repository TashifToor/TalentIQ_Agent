'use client'
import { useEffect, useMemo, useState, CSSProperties } from 'react'
import { api } from '@/lib/api'
import { LoadingSkeleton, EmptyState, GradientBadge } from '@/components/shared/primitives'
import { PoolCandidate, FIT_TIER_LABEL, FIT_TIER_COLOR, FitTier, InterviewStatus, INTERVIEW_STATUS_LABEL } from './types'
import { RankedCandidate } from './types'
import CandidateDetailPanel from './CandidateDetailPanel'
import ComparisonView from './ComparisonView'
import BulkDecisionModal from './BulkDecisionModal'

type TierFilter = 'all' | FitTier
type InterviewFilter = 'all' | InterviewStatus
type ScreeningFilter = 'all' | 'pending' | 'yes' | 'no'

const MAX_COMPARE = 5
const RECENT_WINDOW_MS = 7 * 24 * 60 * 60 * 1000   // "Recently Added" = last 7 days, same window used nowhere else yet — simple, honest, no invented data

export default function TalentPoolPanel({ interviewPostings, onNavigate }: {
    interviewPostings: { id: string; title: string }[]
    onNavigate?: (section: string) => void   // lets the empty-state CTAs jump to Bulk Screening / History — optional so this component still works standalone
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
    const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false)

    const [compareMode, setCompareMode] = useState(false)
    const [selected, setSelected] = useState<string[]>([])
    const [compareData, setCompareData] = useState<RankedCandidate[] | null>(null)
    const [compareLoading, setCompareLoading] = useState(false)

    const [openId, setOpenId] = useState<string | null>(null)

    const [decisionMode, setDecisionMode] = useState(false)
    const [decisionSelected, setDecisionSelected] = useState<string[]>([])
    const [bulkDecision, setBulkDecision] = useState<'accepted' | 'rejected' | null>(null)
    const toggleDecisionSelect = (id: string) => setDecisionSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])

    const [quickShortlistBusy, setQuickShortlistBusy] = useState<string | null>(null)

    const load = () => {
        setLoading(true)
        setError('')
        api.getTalentPool()
            .then((r: any) => setPool(r.candidates || []))
            .catch(() => setError('Could not load the Talent Pool right now.'))
            .finally(() => setLoading(false))
    }

    useEffect(() => { load() }, [])

    // Quick shortlist directly from the list — reuses the exact same
    // updateApplication('shortlist') call CandidateDetailPanel already uses,
    // just surfaced as a one-click action on the card too.
    const quickShortlist = async (id: string) => {
        setQuickShortlistBusy(id)
        try {
            await api.updateApplication(id, 'shortlist')
            load()
        } finally {
            setQuickShortlistBusy(null)
        }
    }

    if (openId) {
        return (
            <CandidateDetailPanel
                applicationId={openId}
                interviewPostings={interviewPostings}
                onBack={() => setOpenId(null)}
                onChanged={load}
                onToggleCompare={(c) => toggleSelect(c.id)}
                isSelectedForCompare={selected.includes(openId)}
            />
        )
    }

    const stats = useMemo(() => {
        const p = pool || []
        return {
            total: p.length,
            topMatches: p.filter(c => c.fit_tier === 'strong' || c.fit_tier === 'good').length,
            shortlisted: p.filter(c => c.is_shortlisted === 'yes').length,
            recent: p.filter(c => c.created_at && (Date.now() - new Date(c.created_at).getTime()) < RECENT_WINDOW_MS).length,
        }
    }, [pool])

    const StatsRow = () => (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 18 }} className="talent-pool-stats-row">
            {[
                ['Total Candidates', stats.total],
                ['Top Matches', stats.topMatches],
                ['Shortlisted', stats.shortlisted],
                ['Recently Added', stats.recent],
            ].map(([label, value]) => (
                <div key={label as string} style={{ background: '#ffffff', border: '1px solid #e7e4da', borderRadius: 10, padding: '12px 14px' }}>
                    <div style={{ fontSize: 20, fontWeight: 700, color: '#1f1c17' }}>{value}</div>
                    <div style={{ fontSize: 10.5, color: '#7a7468', marginTop: 2 }}>{label}</div>
                </div>
            ))}
        </div>
    )

    if (loading) {
        return (
            <div style={{ width: '100%' }}>
                <StatsRow />
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>{[0, 1, 2].map(i => <LoadingSkeleton key={i} height={64} light />)}</div>
            </div>
        )
    }
    if (error) {
        return <div style={{ fontSize: 12.5, color: '#ef4444' }}>{error}</div>
    }
    if (!pool || pool.length === 0) {
        return (
            <div style={{ maxWidth: 480, margin: '40px auto', textAlign: 'center' }}>
                <div style={{ width: 56, height: 56, borderRadius: 16, background: '#f0eee6', display: 'grid', placeItems: 'center', margin: '0 auto 18px' }}>
                    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#9c9689" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" />
                    </svg>
                </div>
                <div style={{ fontFamily: "'Space Grotesk', Inter, sans-serif", fontSize: 18, fontWeight: 600, color: '#1f1c17', marginBottom: 8 }}>Your Talent Pool is ready</div>
                <div style={{ fontSize: 12.5, color: '#7a7468', lineHeight: 1.6, marginBottom: 22 }}>
                    Candidates from your screenings will automatically appear here. Search, rank, compare and revisit your strongest candidates from one place.
                </div>
                <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
                    {onNavigate && (
                        <button onClick={() => onNavigate('bulk')} style={{ fontSize: 12.5, fontWeight: 700, background: '#e2b04a', color: '#0a0a08', border: 'none', borderRadius: 8, padding: '11px 20px', cursor: 'pointer', fontFamily: 'inherit' }}>
                            Run Bulk Screening
                        </button>
                    )}
                    {onNavigate && (
                        <button onClick={() => onNavigate('history')} style={{ fontSize: 12.5, fontWeight: 600, background: '#f0eee6', color: '#3a352d', border: '1px solid #e7e4da', borderRadius: 8, padding: '11px 20px', cursor: 'pointer', fontFamily: 'inherit' }}>
                            View Screening History
                        </button>
                    )}
                </div>
            </div>
        )
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
        <div style={{ width: '100%' }}>
            <StatsRow />

            {/* Search — always full width, its own row */}
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search name, email, or ID…" style={{ ...selectSt, width: '100%', marginBottom: 10, boxSizing: 'border-box', padding: '10px 14px' }} />

            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                <button onClick={() => setMobileFiltersOpen(o => !o)} className="talent-pool-filter-toggle-btn" style={{
                    fontSize: 11.5, fontWeight: 600, padding: '8px 14px', borderRadius: 8, cursor: 'pointer', fontFamily: 'inherit',
                    background: '#f0eee6', color: '#3a352d', border: '1px solid #e7e4da', display: 'inline-flex', alignItems: 'center', gap: 6,
                }}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 3H2l8 9.46V19l4 2v-8.54L22 3z" /></svg>
                    Filters
                </button>
            </div>

            <div className={`talent-pool-filters-row${mobileFiltersOpen ? ' open' : ''}`} style={{ flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
                <span style={{ fontSize: 10.5, fontWeight: 700, color: '#9c9689', textTransform: 'uppercase', letterSpacing: '.04em', alignSelf: 'center', marginRight: 2 }}>Filters:</span>
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
                    <span style={{ fontSize: 10.5, color: '#7a7468' }}>ATS</span>
                    <input type="number" min={0} max={100} value={minAts} onChange={e => setMinAts(Number(e.target.value) || 0)} style={{ ...selectSt, width: 50 }} />
                    <span style={{ fontSize: 10.5, color: '#7a7468' }}>–</span>
                    <input type="number" min={0} max={100} value={maxAts} onChange={e => setMaxAts(Number(e.target.value) || 100)} style={{ ...selectSt, width: 50 }} />
                </div>
                <label style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: '#5c574c', cursor: 'pointer' }}>
                    <input type="checkbox" checked={recommendedOnly} onChange={e => setRecommendedOnly(e.target.checked)} /> Recommended only
                </label>
                <button onClick={() => { setCompareMode(m => !m); setSelected([]); setCompareData(null); setDecisionMode(false); setDecisionSelected([]) }} style={{
                    marginLeft: 'auto', fontSize: 11, fontWeight: 700, padding: '7px 14px', borderRadius: 8, cursor: 'pointer', fontFamily: 'Inter,sans-serif',
                    background: compareMode ? '#13c28e' : '#f0eee6', color: compareMode ? '#0a0a08' : '#3a352d',
                    border: compareMode ? 'none' : '1px solid #e7e4da',
                }}>{compareMode ? `Comparing (${selected.length}/${MAX_COMPARE})` : 'Compare'}</button>
                <button onClick={() => { setDecisionMode(m => !m); setDecisionSelected([]); setCompareMode(false); setSelected([]); setCompareData(null) }} style={{
                    fontSize: 11, fontWeight: 700, padding: '7px 14px', borderRadius: 8, cursor: 'pointer', fontFamily: 'Inter,sans-serif',
                    background: decisionMode ? '#7c3aed' : '#f0eee6', color: decisionMode ? '#fff' : '#3a352d',
                    border: decisionMode ? 'none' : '1px solid #e7e4da',
                }}>{decisionMode ? `Selecting (${decisionSelected.length})` : 'Bulk Decisions'}</button>
            </div>

            <div style={{ fontSize: 11, color: '#7a7468', marginBottom: 10 }}>{filtered.length} of {pool.length} candidates</div>

            {decisionMode && decisionSelected.length > 0 && (
                <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
                    <button onClick={() => setBulkDecision('accepted')} style={{ fontSize: 11.5, fontWeight: 700, padding: '8px 16px', borderRadius: 8, border: 'none', cursor: 'pointer', background: '#13c28e', color: '#0a0a08', fontFamily: 'Inter,sans-serif' }}>
                        Accept Selected ({decisionSelected.length})
                    </button>
                    <button onClick={() => setBulkDecision('rejected')} style={{ fontSize: 11.5, fontWeight: 700, padding: '8px 16px', borderRadius: 8, border: '1px solid rgba(239,68,68,.3)', cursor: 'pointer', background: 'rgba(239,68,68,.1)', color: '#ef4444', fontFamily: 'Inter,sans-serif' }}>
                        Reject Selected ({decisionSelected.length})
                    </button>
                </div>
            )}

            {compareMode && (
                <div style={{ marginBottom: 14 }}>
                    {selected.length >= 2 && !compareData && (
                        <button onClick={loadCompare} disabled={compareLoading} style={{ fontSize: 11.5, fontWeight: 700, padding: '8px 16px', borderRadius: 8, border: 'none', cursor: 'pointer', background: '#7c3aed', color: '#fff', fontFamily: 'Inter,sans-serif' }}>
                            {compareLoading ? 'Loading…' : `Compare ${selected.length} Selected →`}
                        </button>
                    )}
                    {selected.length < 2 && <div style={{ fontSize: 11.5, color: '#7a7468' }}>Select 2–5 candidates below to compare.</div>}
                    {compareData && (
                        <ComparisonView candidates={compareData} onClose={() => { setCompareData(null); setCompareMode(false); setSelected([]) }} onOpen={(c) => setOpenId(c.id)} />
                    )}
                </div>
            )}

            {filtered.length === 0 ? (
                <EmptyState icon="🔍" title="No matches" description="Try loosening the filters above." light />
            ) : (
                filtered.map(c => {
                    const insight = c.recommendation?.trim() || (c.evidence.length > 0 ? c.evidence.slice(0, 2).join(' ') : null)
                    return (
                        <div key={c.id} style={{ background: '#ffffff', border: selected.includes(c.id) ? '1px solid rgba(19,194,142,.4)' : '1px solid #e7e4da', borderRadius: 12, padding: 16, marginBottom: 10, boxShadow: '0 1px 2px rgba(10,10,9,.03)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                {compareMode && (
                                    <div onClick={() => toggleSelect(c.id)} style={{
                                        width: 18, height: 18, borderRadius: 5, flexShrink: 0, cursor: 'pointer', display: 'grid', placeItems: 'center',
                                        border: selected.includes(c.id) ? 'none' : '1.5px solid #c9c4b6', background: selected.includes(c.id) ? '#13c28e' : 'transparent',
                                    }}>{selected.includes(c.id) && <span style={{ color: '#0a0a08', fontSize: 12, fontWeight: 900 }}>✓</span>}</div>
                                )}
                                {decisionMode && (
                                    <div onClick={() => toggleDecisionSelect(c.id)} style={{
                                        width: 18, height: 18, borderRadius: 5, flexShrink: 0, cursor: 'pointer', display: 'grid', placeItems: 'center',
                                        border: decisionSelected.includes(c.id) ? 'none' : '1.5px solid #c9c4b6', background: decisionSelected.includes(c.id) ? '#7c3aed' : 'transparent',
                                    }}>{decisionSelected.includes(c.id) && <span style={{ color: '#fff', fontSize: 12, fontWeight: 900 }}>✓</span>}</div>
                                )}
                                <div onClick={() => (decisionMode ? toggleDecisionSelect(c.id) : setOpenId(c.id))} style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 12, flex: 1, minWidth: 0, cursor: 'pointer', rowGap: 6 }}>
                                    <div style={{ width: 36, height: 36, borderRadius: '50%', flexShrink: 0, display: 'grid', placeItems: 'center', fontSize: 12, fontWeight: 700, color: '#fff', background: 'linear-gradient(135deg,#0b7c5e,#13c28e)' }}>
                                        {(c.candidate_name || c.cv_filename || '?').split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]?.toUpperCase()).join('')}
                                    </div>
                                    <div style={{ flex: '1 1 160px', minWidth: 140 }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                                            <div style={{ fontSize: 13.5, fontWeight: 700, color: '#1f1c17' }}>{c.candidate_name || c.cv_filename || 'Unnamed candidate'}</div>
                                            <GradientBadge label={FIT_TIER_LABEL[c.fit_tier]} tone={c.fit_tier === 'strong' || c.fit_tier === 'good' ? 'teal' : c.fit_tier === 'possible' ? 'gold' : 'neutral'} light />
                                            {c.is_shortlisted === 'yes' && <span style={{ fontSize: 9.5, fontWeight: 700, padding: '1px 6px', borderRadius: 100, background: 'rgba(19,194,142,.12)', color: '#0b7c5e' }}>Shortlisted</span>}
                                            {c.is_shortlisted === 'no' && <span style={{ fontSize: 9.5, fontWeight: 700, padding: '1px 6px', borderRadius: 100, background: 'rgba(239,68,68,.1)', color: '#ef4444' }}>Rejected</span>}
                                        </div>
                                        <div style={{ fontSize: 11, color: '#7a7468', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.resume_role_title || c.job_title}{c.candidate_email ? ` · ${c.candidate_email}` : ''}</div>
                                    </div>
                                    <div style={{ textAlign: 'center', flexShrink: 0 }}>
                                        <div style={{ fontSize: 17, fontWeight: 700, color: FIT_TIER_COLOR[c.fit_tier] }}>{c.ats_score != null ? `${c.ats_score}%` : '—'}</div>
                                        <div style={{ fontSize: 8, color: '#9c9689' }}>JOB FIT</div>
                                    </div>
                                    <div style={{ textAlign: 'right', minWidth: 90, flexShrink: 0 }}>
                                        <div style={{ fontSize: 10.5, fontWeight: 700, color: c.interview_status === 'completed' ? '#0b7c5e' : c.interview_status === 'invited' || c.interview_status === 'in_progress' ? '#c5931f' : '#7a7468' }}>
                                            {INTERVIEW_STATUS_LABEL[c.interview_status]}
                                        </div>
                                        {c.interview_posting && (
                                            <div style={{ fontSize: 9, color: '#9c9689', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 90 }}>{c.interview_posting.title}</div>
                                        )}
                                    </div>
                                </div>
                            </div>

                            <div style={{ fontSize: 10.5, color: '#7a7468', marginTop: 10, paddingLeft: (compareMode || decisionMode) ? 66 : 48 }}>
                                {c.matched_skills.length > 0 && <span style={{ color: '#0b7c5e' }}>✓ {c.matched_skills.slice(0, 4).join(', ')}</span>}
                                {c.missing_skills.length > 0 && <span style={{ marginLeft: 10, color: '#ef4444' }}>Missing: {c.missing_skills.slice(0, 3).join(', ')}</span>}
                            </div>

                            {insight && (
                                <div style={{
                                    marginTop: 10, marginLeft: (compareMode || decisionMode) ? 66 : 48, background: '#faf9f5', border: '1px solid #e7e4da',
                                    borderRadius: 8, padding: '8px 12px',
                                }}>
                                    <div style={{ fontSize: 9.5, fontWeight: 700, color: '#c5931f', textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 3 }}>Why this candidate?</div>
                                    <div style={{ fontSize: 11, color: '#5c574c', lineHeight: 1.5 }}>{insight}</div>
                                </div>
                            )}

                            <div style={{ display: 'flex', gap: 8, marginTop: 12, marginLeft: (compareMode || decisionMode) ? 66 : 48, flexWrap: 'wrap' }}>
                                <button onClick={() => setOpenId(c.id)} style={{ fontSize: 11, fontWeight: 700, padding: '6px 12px', borderRadius: 100, border: '1px solid #e7e4da', background: '#ffffff', color: '#3a352d', cursor: 'pointer', fontFamily: 'inherit' }}>View Profile</button>
                                <button onClick={() => { setCompareMode(true); toggleSelect(c.id) }} style={{ fontSize: 11, fontWeight: 700, padding: '6px 12px', borderRadius: 100, border: '1px solid #e7e4da', background: '#ffffff', color: '#3a352d', cursor: 'pointer', fontFamily: 'inherit' }}>Compare</button>
                                {c.is_shortlisted !== 'yes' && (
                                    <button disabled={quickShortlistBusy === c.id} onClick={() => quickShortlist(c.id)} style={{ fontSize: 11, fontWeight: 700, padding: '6px 12px', borderRadius: 100, border: '1px solid rgba(19,194,142,.25)', background: 'rgba(19,194,142,.08)', color: '#0b7c5e', cursor: 'pointer', fontFamily: 'inherit', opacity: quickShortlistBusy === c.id ? .6 : 1 }}>
                                        {quickShortlistBusy === c.id ? 'Shortlisting…' : '★ Shortlist'}
                                    </button>
                                )}
                            </div>
                        </div>
                    )
                })
            )}

            {bulkDecision && (
                <BulkDecisionModal
                    applicationIds={decisionSelected}
                    decision={bulkDecision}
                    onClose={() => setBulkDecision(null)}
                    onDecided={() => { load(); setDecisionSelected([]); setDecisionMode(false); setBulkDecision(null) }}
                />
            )}
        </div>
    )
}

const selectSt: CSSProperties = {
    background: '#faf9f5', border: '1px solid #e7e4da', borderRadius: 6, padding: '6px 10px',
    fontSize: 11.5, color: '#1f1c17', fontFamily: 'Inter,sans-serif', outline: 'none',
}