'use client'
import { useEffect, useState } from 'react'
import { api } from '@/lib/api'
import { GlassCard, GradientBadge, ProgressRing, LoadingSkeleton } from '@/components/shared/primitives'
import AIFeedbackReport, { AIFeedbackData } from '../reports/AIFeedbackReport'
import { PoolCandidate, FIT_TIER_LABEL, FIT_TIER_COLOR, INTERVIEW_STATUS_LABEL, InterviewStatus, AiScreeningStatus } from './types'
import DecisionCenter from './DecisionCenter'

function initials(name: string): string {
    return name.split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]?.toUpperCase()).join('') || '?'
}

const INTERVIEW_STATUS_COLOR: Record<InterviewStatus, string> = {
    unknown: 'rgba(255,255,255,.3)',
    not_invited: 'rgba(255,255,255,.3)',
    invited: '#e2b04a',
    in_progress: '#e2b04a',
    completed: '#13c28e',
}

const AI_SCREENING_STATUS_LABEL: Record<AiScreeningStatus, string> = {
    not_analyzed: 'Not Analyzed',
    queued: 'Queued',
    analyzing: 'Analyzing…',
    completed: 'Completed',
    failed: 'Failed',
}
const AI_SCREENING_STATUS_COLOR: Record<AiScreeningStatus, string> = {
    not_analyzed: 'rgba(255,255,255,.3)',
    queued: '#e2b04a',
    analyzing: '#e2b04a',
    completed: '#a78bfa',
    failed: '#ef4444',
}
const RECOMMENDATION_COLOR: Record<string, string> = {
    'Strong Match': '#13c28e',
    'Good Match': '#5cb8e4',
    'Possible Match': '#e2b04a',
    'Low Match': '#ef4444',
    'Not Enough Data': 'rgba(255,255,255,.4)',
}

export default function CandidateDetailPanel({
    applicationId, interviewPostings, onBack, onChanged, onToggleCompare, isSelectedForCompare,
}: {
    applicationId: string
    interviewPostings: { id: string; title: string }[]
    onBack: () => void
    onChanged: () => void
    onToggleCompare?: (candidate: PoolCandidate) => void
    isSelectedForCompare?: boolean
}) {
    const [candidate, setCandidate] = useState<PoolCandidate | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')
    const [busy, setBusy] = useState(false)
    const [showMove, setShowMove] = useState(false)
    const [showDecision, setShowDecision] = useState(false)
    const [movePostingId, setMovePostingId] = useState('')
    const [moveEmail, setMoveEmail] = useState('')
    const [moveMsg, setMoveMsg] = useState('')
    const [aiBusy, setAiBusy] = useState(false)
    const [aiError, setAiError] = useState('')

    const load = () => {
        setLoading(true)
        setError('')
        api.getTalentPoolCandidate(applicationId)
            .then((r: PoolCandidate) => { setCandidate(r); setMoveEmail(r.candidate_email || '') })
            .catch(() => setError('Could not load this candidate.'))
            .finally(() => setLoading(false))
    }

    useEffect(() => { load() }, [applicationId])

    // Poll while the CrewAI committee is actually running — never a fake
    // progress bar, just a real re-fetch until the backend reports a terminal
    // status (completed/failed).
    useEffect(() => {
        if (!candidate) return
        if (candidate.ai_screening_status !== 'queued' && candidate.ai_screening_status !== 'analyzing') return
        const t = setTimeout(() => {
            api.getTalentPoolCandidate(applicationId).then((r: PoolCandidate) => setCandidate(r)).catch(() => { })
        }, 3000)
        return () => clearTimeout(t)
    }, [candidate, applicationId])

    const runAiScreening = async () => {
        setAiBusy(true)
        setAiError('')
        try {
            await api.triggerAiScreening(applicationId)
            load()
        } catch (e: any) {
            setAiError(e?.message || 'Could not start AI analysis.')
        } finally {
            setAiBusy(false)
        }
    }

    const doAction = async (action: 'shortlist' | 'reject' | 'reset') => {
        setBusy(true)
        try {
            await api.updateApplication(applicationId, action)
            load()
            onChanged()
        } finally {
            setBusy(false)
        }
    }

    const submitMove = async () => {
        if (!movePostingId) return
        setBusy(true)
        setMoveMsg('')
        try {
            const res: any = await api.moveApplicationToInterview(applicationId, movePostingId, moveEmail || undefined)
            setMoveMsg(res.already_exists ? (res.interview_status === 'invited' ? 'Already invited — no second invite sent.' : `Already has an interview (${res.interview_status}) for ${res.posting_title || 'a posting'}.`) : res.emailed ? 'Invite emailed to candidate.' : 'Posting linked — share the link manually.')
            setShowMove(false)
            load()
            onChanged()
        } catch (e: any) {
            setMoveMsg(e?.message || 'Could not move to interview.')
        } finally {
            setBusy(false)
        }
    }

    if (loading) {
        return <div style={{ maxWidth: 700 }}><LoadingSkeleton height={300} /></div>
    }
    if (error || !candidate) {
        return (
            <div>
                <button onClick={onBack} style={backBtnSt}>← Back to Talent Pool</button>
                <div style={{ fontSize: 12.5, color: '#ef4444', marginTop: 12 }}>{error || 'Candidate not found.'}</div>
            </div>
        )
    }

    const c = candidate
    const report: AIFeedbackData | null = c.interview_report ? {
        id: c.interview_report.id,
        candidate_name: c.interview_report.candidate_name,
        status: 'completed',
        ai_score: c.interview_report.ai_score,
        assessment_score: c.interview_report.assessment_score,
        final_verdict: c.interview_report.final_verdict,
        experience_assessment: c.interview_report.experience_assessment,
        deep_analysis: c.interview_report.deep_analysis,
    } : null

    return (
        <div style={{ maxWidth: 760 }}>
            <button onClick={onBack} style={backBtnSt}>← Back to Talent Pool</button>

            <GlassCard style={{ marginBottom: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 14 }}>
                    <div style={{ width: 44, height: 44, borderRadius: '50%', flexShrink: 0, display: 'grid', placeItems: 'center', fontSize: 15, fontWeight: 700, color: '#fff', background: 'linear-gradient(135deg,#0b7c5e,#13c28e)' }}>
                        {initials(c.candidate_name || c.cv_filename || '?')}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 17, fontWeight: 700, color: '#fff' }}>{c.candidate_name || c.cv_filename || 'Unnamed candidate'}</div>
                        <div style={{ fontSize: 12, color: 'rgba(255,255,255,.4)' }}>{c.candidate_email || 'No email on file'}{c.job_title ? ` · ${c.job_title}` : ''}</div>
                    </div>
                    {onToggleCompare && (
                        <button onClick={() => onToggleCompare(c)} style={{
                            fontSize: 11, fontWeight: 700, padding: '7px 14px', borderRadius: 8, cursor: 'pointer', fontFamily: 'Inter,sans-serif',
                            background: isSelectedForCompare ? '#13c28e' : 'rgba(255,255,255,.05)', color: isSelectedForCompare ? '#0a0a08' : 'rgba(255,255,255,.6)',
                            border: isSelectedForCompare ? 'none' : '1px solid rgba(255,255,255,.1)',
                        }}>{isSelectedForCompare ? '✓ Selected' : '+ Compare'}</button>
                    )}
                </div>

                <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', marginBottom: 14 }}>
                    <div>
                        {c.fit_score != null ? <ProgressRing value={c.fit_score} size={54} accent={FIT_TIER_COLOR[c.fit_tier]} /> : (
                            <div style={{ width: 54, height: 54, borderRadius: '50%', border: '2px dashed rgba(255,255,255,.15)', display: 'grid', placeItems: 'center', fontSize: 9, color: 'rgba(255,255,255,.25)' }}>N/A</div>
                        )}
                        <div style={{ fontSize: 9, color: 'rgba(255,255,255,.3)', marginTop: 4, textAlign: 'center' }}>FIT SCORE</div>
                    </div>
                    <div>
                        <GradientBadge label={FIT_TIER_LABEL[c.fit_tier]} tone={c.fit_tier === 'strong' || c.fit_tier === 'good' ? 'teal' : c.fit_tier === 'possible' ? 'gold' : 'neutral'} />
                        <div style={{ fontSize: 11, color: 'rgba(255,255,255,.4)', marginTop: 6 }}>{c.recommendation || 'No verdict yet'}</div>
                    </div>
                    <div>
                        <div style={{ fontSize: 20, fontWeight: 700, color: c.ats_score != null ? (c.ats_score >= 70 ? '#13c28e' : c.ats_score >= 45 ? '#e2b04a' : '#ef4444') : 'rgba(255,255,255,.25)' }}>{c.ats_score ?? '—'}</div>
                        <div style={{ fontSize: 9, color: 'rgba(255,255,255,.3)' }}>ATS SCORE</div>
                    </div>
                    {c.skill_match_pct != null && (
                        <div>
                            <div style={{ fontSize: 20, fontWeight: 700, color: c.skill_match_pct >= 70 ? '#13c28e' : c.skill_match_pct >= 45 ? '#e2b04a' : '#ef4444' }}>{c.skill_match_pct}%</div>
                            <div style={{ fontSize: 9, color: 'rgba(255,255,255,.3)' }}>SKILL MATCH</div>
                        </div>
                    )}
                    <div>
                        <div style={{ fontSize: 12.5, fontWeight: 700, color: INTERVIEW_STATUS_COLOR[c.interview_status] }}>{INTERVIEW_STATUS_LABEL[c.interview_status]}</div>
                        <div style={{ fontSize: 9, color: 'rgba(255,255,255,.3)' }}>INTERVIEW STATUS</div>
                    </div>
                </div>

                {c.interview_posting && (
                    <div style={{ fontSize: 11.5, color: 'rgba(255,255,255,.5)', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span>Interview posting: <strong style={{ color: '#fff' }}>{c.interview_posting.title}</strong></span>
                        <a href={c.interview_posting.public_link} target="_blank" rel="noreferrer" style={{ color: '#a78bfa', fontSize: 10.5 }}>Open link ↗</a>
                    </div>
                )}

                {c.matched_skills.length > 0 && <div style={{ fontSize: 12, color: '#13c28e', marginBottom: 4 }}>✓ Matched: {c.matched_skills.join(', ')}</div>}
                {c.missing_skills.length > 0 && <div style={{ fontSize: 12, color: '#ef4444', marginBottom: 4 }}>Missing: {c.missing_skills.join(', ')}</div>}

                <div style={{ fontSize: 11, color: 'rgba(255,255,255,.3)', marginTop: 6 }}>
                    Resume scored against: <strong style={{ color: 'rgba(255,255,255,.5)' }}>{c.resume_role_title || 'Unknown'}</strong>
                    {c.resume_matches_current_context ? ' (this posting)' : ' — may not match the job currently being viewed'}
                </div>

                {c.evidence.length > 0 && (
                    <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid rgba(255,255,255,.06)' }}>
                        <div style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,.4)', textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 6 }}>Why this candidate?</div>
                        {c.evidence.map((e, i) => <div key={i} style={{ fontSize: 12, color: 'rgba(255,255,255,.55)', lineHeight: 1.7 }}>· {e}</div>)}
                    </div>
                )}
            </GlassCard>

            {/* ── Actions ── */}
            <GlassCard style={{ marginBottom: 16 }}>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                    {c.is_shortlisted === 'yes' ? (
                        <button disabled={busy} onClick={() => doAction('reset')} style={actionBtnSt('neutral')}>Unshortlist</button>
                    ) : (
                        <button disabled={busy} onClick={() => doAction('shortlist')} style={actionBtnSt('teal')}>✓ Shortlist</button>
                    )}
                    {c.is_shortlisted === 'no' ? (
                        <button disabled={busy} onClick={() => doAction('reset')} style={actionBtnSt('neutral')}>Restore</button>
                    ) : (
                        <button disabled={busy} onClick={() => doAction('reject')} style={actionBtnSt('red')}>✗ Reject</button>
                    )}
                    {c.interview_status === 'not_invited' && (
                        <button disabled={busy} onClick={() => setShowMove(m => !m)} style={actionBtnSt('purple')}>→ Move to Interview</button>
                    )}
                    {c.interview_status !== 'not_invited' && (
                        <div style={{ fontSize: 11, color: 'rgba(255,255,255,.35)', display: 'flex', alignItems: 'center', padding: '0 6px' }}>
                            Already {INTERVIEW_STATUS_LABEL[c.interview_status].toLowerCase()} — no duplicate invite needed.
                        </div>
                    )}
                    <div style={{ marginLeft: 'auto' }}>
                        {c.decision === 'pending' ? (
                            <button onClick={() => setShowDecision(true)} style={{ ...actionBtnSt('purple'), background: '#7c3aed', color: '#fff', border: 'none' }}>Make Decision</button>
                        ) : (
                            <button onClick={() => setShowDecision(true)} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'Inter,sans-serif' }}>
                                <GradientBadge label={c.decision === 'accepted' ? 'Accepted' : 'Rejected'} tone={c.decision === 'accepted' ? 'teal' : 'neutral'} />
                                <span style={{ fontSize: 10.5, color: c.notification_status === 'sent' ? '#13c28e' : c.notification_status === 'failed' ? '#ef4444' : 'rgba(255,255,255,.35)' }}>
                                    {c.notification_status === 'sent' ? 'Notified' : c.notification_status === 'failed' ? 'Notification failed' : c.notification_status === 'sending' ? 'Sending…' : 'Not notified'}
                                </span>
                            </button>
                        )}
                    </div>
                </div>

                {showMove && (
                    <div style={{ marginTop: 12, padding: 12, background: 'rgba(124,58,237,.05)', borderRadius: 8, border: '1px solid rgba(124,58,237,.15)' }}>
                        <select value={movePostingId} onChange={e => setMovePostingId(e.target.value)} style={selectSt}>
                            <option value="">Select interview posting…</option>
                            {interviewPostings.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}
                        </select>
                        {!c.candidate_email && (
                            <input value={moveEmail} onChange={e => setMoveEmail(e.target.value)} placeholder="Candidate email (required)" style={{ ...selectSt, marginTop: 8, width: '100%', boxSizing: 'border-box' }} />
                        )}
                        <button disabled={!movePostingId || (!c.candidate_email && !moveEmail) || busy} onClick={submitMove} style={{ ...actionBtnSt('purple'), marginTop: 8, width: '100%' }}>
                            {busy ? 'Sending…' : 'Send Interview Invite'}
                        </button>
                    </div>
                )}
                {moveMsg && <div style={{ fontSize: 11.5, color: '#13c28e', marginTop: 8 }}>{moveMsg}</div>}
            </GlassCard>

            {/* ── AI Screening Committee (CrewAI) — qualitative analysis, kept visually separate from the deterministic System Score above ── */}
            <GlassCard style={{ marginBottom: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#fff' }}>AI Screening Committee</div>
                    <span style={{ fontSize: 9.5, fontWeight: 700, padding: '1px 7px', borderRadius: 100, background: 'rgba(124,58,237,.12)', color: '#a78bfa' }}>AI Analysis</span>
                    <span style={{ fontSize: 10.5, fontWeight: 700, color: AI_SCREENING_STATUS_COLOR[c.ai_screening_status || 'not_analyzed'] }}>
                        {AI_SCREENING_STATUS_LABEL[c.ai_screening_status || 'not_analyzed']}
                    </span>
                    <div style={{ marginLeft: 'auto' }}>
                        {(c.ai_screening_status === 'not_analyzed' || c.ai_screening_status === 'failed' || c.ai_screening_status === 'completed' || !c.ai_screening_status) && (
                            <button disabled={aiBusy} onClick={runAiScreening} style={actionBtnSt('purple')}>
                                {aiBusy ? 'Starting…' : c.ai_screening_status === 'completed' ? 'Re-analyze' : 'Run AI Analysis'}
                            </button>
                        )}
                    </div>
                </div>
                <div style={{ fontSize: 10.5, color: 'rgba(255,255,255,.3)', marginBottom: 10 }}>
                    Four specialized agents review the resume, job fit, interview evidence, and produce a qualitative recommendation — separate from, and never overriding, the deterministic System Score above.
                </div>

                {aiError && <div style={{ fontSize: 11.5, color: '#ef4444', marginBottom: 8 }}>{aiError}</div>}

                {(c.ai_screening_status === 'queued' || c.ai_screening_status === 'analyzing') && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        <LoadingSkeleton height={16} />
                        <LoadingSkeleton height={16} />
                        <LoadingSkeleton height={16} />
                    </div>
                )}

                {c.ai_screening_status === 'failed' && !c.ai_screening_result && (
                    <div style={{ fontSize: 12, color: 'rgba(255,255,255,.35)' }}>AI analysis failed — the deterministic System Score above is unaffected. Try again with the button above.</div>
                )}

                {(!c.ai_screening_status || c.ai_screening_status === 'not_analyzed') && (
                    <div style={{ fontSize: 12, color: 'rgba(255,255,255,.35)' }}>Not analyzed yet.</div>
                )}

                {c.ai_screening_result && (
                    <div>
                        <AnalystBlock title="Resume Analyst" status="ok">
                            {c.ai_screening_result.resume_analysis.matched_skills.length > 0 && (
                                <EvidenceLine color="#13c28e">✓ Matched: {c.ai_screening_result.resume_analysis.matched_skills.join(', ')}</EvidenceLine>
                            )}
                            {c.ai_screening_result.resume_analysis.experience_evidence.map((e, i) => <EvidenceLine key={i}>{e}</EvidenceLine>)}
                            {c.ai_screening_result.resume_analysis.education_evidence.map((e, i) => <EvidenceLine key={i}>{e}</EvidenceLine>)}
                            {c.ai_screening_result.resume_analysis.unavailable_fields.length > 0 && (
                                <EvidenceLine muted>Not available: {c.ai_screening_result.resume_analysis.unavailable_fields.join(', ')}</EvidenceLine>
                            )}
                        </AnalystBlock>

                        <AnalystBlock title="Job-Fit Analyst" status="ok">
                            {c.ai_screening_result.job_fit_analysis.matched_requirements.length > 0 && (
                                <EvidenceLine color="#13c28e">✓ {c.ai_screening_result.job_fit_analysis.matched_requirements.join(', ')}</EvidenceLine>
                            )}
                            {c.ai_screening_result.job_fit_analysis.missing_requirements.length > 0 && (
                                <EvidenceLine color="#ef4444">Missing: {c.ai_screening_result.job_fit_analysis.missing_requirements.join(', ')}</EvidenceLine>
                            )}
                            {c.ai_screening_result.job_fit_analysis.concerns.map((e, i) => <EvidenceLine key={i} muted>{e}</EvidenceLine>)}
                        </AnalystBlock>

                        <AnalystBlock title="Interview Analyst" status={c.ai_screening_result.interview_analysis.available ? 'ok' : 'unavailable'}>
                            {c.ai_screening_result.interview_analysis.available ? (
                                <>
                                    {c.ai_screening_result.interview_analysis.strengths.map((e, i) => <EvidenceLine key={i} color="#13c28e">{e}</EvidenceLine>)}
                                    {c.ai_screening_result.interview_analysis.concerns.map((e, i) => <EvidenceLine key={i} color="#ef4444">{e}</EvidenceLine>)}
                                </>
                            ) : (
                                <EvidenceLine muted>{c.ai_screening_result.interview_analysis.unavailable_reason || 'Not available'}</EvidenceLine>
                            )}
                        </AnalystBlock>

                        <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid rgba(255,255,255,.08)' }}>
                            <div style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,.4)', textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 8 }}>Final AI Screening Recommendation</div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                                <span style={{ fontSize: 15, fontWeight: 700, color: RECOMMENDATION_COLOR[c.ai_screening_result.hiring_analysis.recommendation] || '#fff' }}>
                                    {c.ai_screening_result.hiring_analysis.recommendation}
                                </span>
                                <span style={{ fontSize: 10, color: 'rgba(255,255,255,.3)' }}>Confidence: {c.ai_screening_result.hiring_analysis.confidence}</span>
                            </div>
                            <div style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,.4)', marginBottom: 4 }}>Why:</div>
                            {c.ai_screening_result.hiring_analysis.reasons.map((r, i) => (
                                <div key={i} style={{ fontSize: 12, color: 'rgba(255,255,255,.55)', lineHeight: 1.7 }}>· {r}</div>
                            ))}
                        </div>
                        {c.ai_screening_updated_at && (
                            <div style={{ fontSize: 9.5, color: 'rgba(255,255,255,.25)', marginTop: 10 }}>Last analyzed {new Date(c.ai_screening_updated_at).toLocaleString()}</div>
                        )}
                    </div>
                )}
            </GlassCard>

            {/* ── Existing AI Feedback Report — reused as-is, never duplicated ── */}
            {report && <AIFeedbackReport data={report} />}
            {!report && c.interview_status === 'not_invited' && (
                <div style={{ fontSize: 12, color: 'rgba(255,255,255,.3)' }}>Not interviewed yet.</div>
            )}
            {!report && (c.interview_status === 'invited' || c.interview_status === 'in_progress') && (
                <div style={{ fontSize: 12, color: 'rgba(255,255,255,.3)' }}>Interview {c.interview_status === 'invited' ? 'invited, not started yet' : 'in progress'} — report will appear here once completed.</div>
            )}

            {showDecision && (
                <DecisionCenter candidate={c} onClose={() => setShowDecision(false)} onDecided={load} />
            )}
        </div>
    )
}

function AnalystBlock({ title, status, children }: { title: string; status: 'ok' | 'unavailable'; children: React.ReactNode }) {
    return (
        <div style={{ marginBottom: 12, paddingBottom: 12, borderBottom: '1px solid rgba(255,255,255,.05)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5 }}>
                <span style={{ fontSize: 11.5, fontWeight: 700, color: 'rgba(255,255,255,.7)' }}>{title}</span>
                <span style={{ fontSize: 9, fontWeight: 700, color: status === 'ok' ? '#13c28e' : 'rgba(255,255,255,.3)' }}>{status === 'ok' ? '● Analyzed' : '○ Not available'}</span>
            </div>
            <div style={{ paddingLeft: 4 }}>{children}</div>
        </div>
    )
}

function EvidenceLine({ children, color, muted }: { children: React.ReactNode; color?: string; muted?: boolean }) {
    return <div style={{ fontSize: 11.5, color: muted ? 'rgba(255,255,255,.3)' : color || 'rgba(255,255,255,.55)', lineHeight: 1.6 }}>· {children}</div>
}

const backBtnSt: React.CSSProperties = {
    background: 'none', border: 'none', color: 'rgba(255,255,255,.4)', fontSize: 12, cursor: 'pointer',
    marginBottom: 14, padding: 0, fontFamily: 'Inter,sans-serif',
}
const selectSt: React.CSSProperties = {
    background: '#161614', border: '1px solid rgba(255,255,255,.08)', borderRadius: 6, padding: '7px 10px',
    fontSize: 12, color: 'rgba(255,255,255,.75)', fontFamily: 'Inter,sans-serif', outline: 'none', width: '100%',
}
function actionBtnSt(tone: 'teal' | 'red' | 'purple' | 'neutral'): React.CSSProperties {
    const map = {
        teal: { bg: 'rgba(19,194,142,.12)', fg: '#13c28e', bd: 'rgba(19,194,142,.2)' },
        red: { bg: 'rgba(239,68,68,.08)', fg: '#ef4444', bd: 'rgba(239,68,68,.15)' },
        purple: { bg: 'rgba(124,58,237,.1)', fg: '#a78bfa', bd: 'rgba(124,58,237,.2)' },
        neutral: { bg: 'rgba(255,255,255,.05)', fg: 'rgba(255,255,255,.6)', bd: 'rgba(255,255,255,.1)' },
    }[tone]
    return {
        fontSize: 11.5, fontWeight: 700, fontFamily: 'Inter,sans-serif', padding: '8px 14px', borderRadius: 8,
        cursor: 'pointer', background: map.bg, color: map.fg, border: `1px solid ${map.bd}`,
    }
}