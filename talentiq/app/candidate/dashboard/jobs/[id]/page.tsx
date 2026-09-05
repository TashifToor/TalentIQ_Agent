'use client'
import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { api } from '@/lib/api'
import ApplicationStrategyCard from '@/components/modules/candidate/ApplicationStrategyCard'

function ScoreRing({ value }: { value: number }) {
    const color = value >= 70 ? '#13c28e' : value >= 40 ? '#e2b04a' : '#ef4444'
    const size = 88, stroke = 7, r = (size - stroke) / 2, c = 2 * Math.PI * r
    return (
        <svg width={size} height={size}>
            <circle cx={size / 2} cy={size / 2} r={r} stroke="rgba(255,255,255,.08)" strokeWidth={stroke} fill="none" />
            <circle cx={size / 2} cy={size / 2} r={r} stroke={color} strokeWidth={stroke} fill="none"
                strokeDasharray={c} strokeDashoffset={c - (value / 100) * c} strokeLinecap="round"
                transform={`rotate(-90 ${size / 2} ${size / 2})`} />
            <text x="50%" y="52%" textAnchor="middle" dominantBaseline="middle" fill="#fff" fontSize="20" fontWeight="700" fontFamily="Inter,sans-serif">{value}%</text>
        </svg>
    )
}

const STATUS_META: Record<string, { label: string; color: string; bg: string }> = {
    applied: { label: 'Applied', color: '#e2b04a', bg: 'rgba(226,176,74,.1)' },
    screening: { label: 'Screening', color: '#7c9cf0', bg: 'rgba(124,156,240,.1)' },
    interview: { label: 'Interview', color: '#7c3aed', bg: 'rgba(124,58,237,.12)' },
    rejected: { label: 'Rejected', color: '#ef4444', bg: 'rgba(239,68,68,.1)' },
    selected: { label: 'Selected', color: '#13c28e', bg: 'rgba(19,194,142,.1)' },
}

export default function JobDetailPage() {
    const params = useParams()
    const jobId = params?.id as string

    const [job, setJob] = useState<any>(null)
    const [error, setError] = useState('')

    const [cvText, setCvText] = useState('')
    const [resumeSource, setResumeSource] = useState<'none' | 'reused' | 'pasted'>('none')
    const [match, setMatch] = useState<any>(null)
    const [matchLoading, setMatchLoading] = useState(false)
    const [matchError, setMatchError] = useState('')

    const [why, setWhy] = useState<any>(null)
    const [whyOpen, setWhyOpen] = useState(false)

    const [applying, setApplying] = useState(false)
    const [applyFile, setApplyFile] = useState<File | null>(null)
    const [applyError, setApplyError] = useState('')
    const [applySubmitting, setApplySubmitting] = useState(false)
    const [showApplyModal, setShowApplyModal] = useState(false)

    const [savedResumes, setSavedResumes] = useState<any[]>([])
    const [selectedResumeId, setSelectedResumeId] = useState<string | 'upload'>('upload')
    const [generatingPdf, setGeneratingPdf] = useState(false)

    useEffect(() => {
        if (!jobId) return
        api.getJob(jobId).then(setJob).catch((e: any) => setError(e.message || 'Could not load this job.'))
        api.listResumes().then((r: any) => {
            const list = Array.isArray(r) ? r : []
            setSavedResumes(list)
            if (list.length > 0) setSelectedResumeId(list[0].id)   // default to most recent saved resume; candidate can still switch to upload
        }).catch(() => { })
        api.getLatestResume().then((r: any) => {
            if (r.available && r.cv_text) {
                setCvText(r.cv_text); setResumeSource('reused')
                // Cheap, deterministic "why this job" chip -- separate from the full LLM AI Match below.
                api.whyRecommended(jobId, r.cv_text).then((w: any) => { if (w.has_enough_data) setWhy(w) }).catch(() => { })
            }
        }).catch(() => { })
    }, [jobId])

    const runMatch = async (text: string) => {
        if (!text.trim()) return
        setMatchLoading(true); setMatchError('')
        try {
            const r = await api.matchJob(jobId, text)
            setMatch(r)
        } catch (e: any) {
            setMatchError(e.message || 'Could not compute your job match right now.')
        } finally {
            setMatchLoading(false)
        }
    }

    const submitApplication = async () => {
        setApplySubmitting(true); setApplyError('')
        try {
            let fileToSubmit = applyFile
            if (selectedResumeId !== 'upload') {
                // Candidate picked a saved (possibly tailored) resume -- generate
                // its real PDF via the existing CV Builder /generate endpoint and
                // submit THAT, so what they explicitly selected is exactly what
                // gets sent. Never silently substitutes a different resume.
                const chosen = savedResumes.find(r => r.id === selectedResumeId)
                setGeneratingPdf(true)
                const full = await api.getResume(selectedResumeId)
                const blob = await api.generateCVBuilder({ cv_data: full.cv_data, template: full.template || 'modern', accent_color: full.accent_color })
                setGeneratingPdf(false)
                fileToSubmit = new File([blob], `${(chosen?.name || 'resume').replace(/\s+/g, '_')}.pdf`, { type: 'application/pdf' })
            }
            if (!fileToSubmit) { setApplyError('Select a resume or attach a file to apply.'); setApplySubmitting(false); return }
            await api.applyToJob(jobId, fileToSubmit)
            setShowApplyModal(false)
            setApplying(false)
            const j = await api.getJob(jobId)
            setJob(j)
        } catch (e: any) {
            setApplyError(e.message || 'Application failed.')
        } finally {
            setApplySubmitting(false)
            setGeneratingPdf(false)
        }
    }

    if (error) return <div style={{ minHeight: '100vh', background: '#0c0c0a', color: '#ef4444', padding: 40, fontFamily: 'Inter,sans-serif' }}>{error}</div>
    if (!job) return <div style={{ minHeight: '100vh', background: '#0c0c0a', color: 'rgba(255,255,255,.4)', padding: 40, fontFamily: 'Inter,sans-serif' }}>Loading…</div>

    return (
        <div style={{ minHeight: '100vh', background: '#0c0c0a', fontFamily: 'Inter, sans-serif', color: 'rgba(255,255,255,.88)' }}>
            <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
        .jobs-input { background: #161614; border: 1px solid rgba(255,255,255,.09); border-radius: 8px; padding: 9px 12px; font-size: 13px; color: #fff; font-family: Inter, sans-serif; outline: none; width: 100%; }
      `}</style>
            <div style={{ maxWidth: 680, margin: '0 auto', padding: '36px 24px 100px' }}>
                <Link href="/candidate/dashboard/jobs" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'rgba(255,255,255,.4)', textDecoration: 'none', marginBottom: 22 }}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 18l-6-6 6-6" /></svg>
                    Back to Find Jobs
                </Link>

                <div style={{ fontSize: 24, fontWeight: 700 }}>{job.title}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 6, flexWrap: 'wrap' }}>
                    <div style={{ fontSize: 13, color: 'rgba(255,255,255,.4)' }}>
                        {[job.company, job.location, job.work_arrangement, job.employment_type?.replace('_', ' ')].filter(Boolean).join(' · ')}
                    </div>
                    {job.has_applied && (
                        <span style={{
                            fontSize: 10.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.03em', padding: '3px 10px', borderRadius: 100,
                            background: (STATUS_META[job.application_status] || STATUS_META.applied).bg,
                            color: (STATUS_META[job.application_status] || STATUS_META.applied).color,
                        }}>{(STATUS_META[job.application_status] || STATUS_META.applied).label}</span>
                    )}
                </div>
                {(job.salary_min || job.salary_max) && (
                    <div style={{ fontSize: 13.5, color: '#13c28e', marginTop: 8, fontWeight: 600 }}>
                        {job.salary_currency || ''} {job.salary_min ?? '?'} – {job.salary_max ?? '?'}
                    </div>
                )}
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 12 }}>
                    {[...(job.required_skills || []), ...(job.preferred_skills || [])].map((s: string) => (
                        <span key={s} style={{ fontSize: 11, background: 'rgba(255,255,255,.06)', padding: '4px 10px', borderRadius: 100, color: 'rgba(255,255,255,.6)' }}>{s}</span>
                    ))}
                </div>

                {why && (
                    <div style={{ marginTop: 16, background: 'rgba(19,194,142,.05)', border: '1px solid rgba(19,194,142,.15)', borderRadius: 10, overflow: 'hidden' }}>
                        <button onClick={() => setWhyOpen(o => !o)} style={{
                            width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'none', border: 'none', cursor: 'pointer',
                            padding: '12px 16px', fontFamily: 'Inter,sans-serif', color: '#13c28e', fontSize: 12, fontWeight: 700,
                        }}>
                            Why am I seeing this job?
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ transform: whyOpen ? 'rotate(180deg)' : 'none', transition: 'transform .15s' }}><path d="M6 9l6 6 6-6" /></svg>
                        </button>
                        {whyOpen && (
                            <div style={{ padding: '0 16px 14px' }}>
                                {why.reasons?.length > 0 ? (
                                    <>
                                        <div style={{ fontSize: 11, color: 'rgba(255,255,255,.4)', marginBottom: 6 }}>Recommended because:</div>
                                        {why.reasons.slice(0, 4).map((r: string, i: number) => <div key={i} style={{ fontSize: 12, color: 'rgba(255,255,255,.7)', marginBottom: 2 }}>✓ {r}</div>)}
                                    </>
                                ) : (
                                    <div style={{ fontSize: 12, color: 'rgba(255,255,255,.5)' }}>Recommended based on your profile and resume.</div>
                                )}
                            </div>
                        )}
                    </div>
                )}

                {/* ── Job Fit Snapshot ────────────────────────────────────── */}
                <div id="job-fit-card" style={{ background: '#111110', border: '1px solid rgba(255,255,255,.07)', borderRadius: 14, padding: 22, marginTop: 26 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>Your Job Match</div>
                    <div style={{ fontSize: 11, color: 'rgba(255,255,255,.35)', marginBottom: 16 }}>AI-assisted job fit — not a guaranteed hiring decision.</div>

                    {!match && (
                        <div>
                            <textarea className="jobs-input" style={{ minHeight: 90, resize: 'vertical', marginBottom: 8 }}
                                placeholder="Paste your resume text to see your match…" value={cvText}
                                onChange={e => { setCvText(e.target.value); setResumeSource('pasted') }} />
                            {resumeSource === 'reused' && <div style={{ fontSize: 11, color: 'rgba(255,255,255,.35)', marginBottom: 8 }}>Reused from your most recent application. Edit or replace it above if you'd like.</div>}
                            {matchError && <div style={{ fontSize: 11.5, color: '#ef4444', marginBottom: 8 }}>{matchError}</div>}
                            <button onClick={() => runMatch(cvText)} disabled={matchLoading || !cvText.trim()} style={{
                                fontFamily: 'Inter,sans-serif', fontWeight: 700, fontSize: 12, padding: '8px 16px', borderRadius: 8, border: 'none', cursor: 'pointer',
                                background: '#e2b04a', color: '#0a0a08', opacity: matchLoading || !cvText.trim() ? .6 : 1,
                            }}>{matchLoading ? 'Analyzing…' : 'See My Match'}</button>
                        </div>
                    )}

                    {match && (
                        <div>
                            {/* Snapshot row: score + one-line recommendation, always visible together */}
                            <div style={{ display: 'flex', gap: 18, alignItems: 'center' }}>
                                <ScoreRing value={match.overall_score} />
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ fontSize: 13.5, fontWeight: 700, color: '#fff' }}>{match.fit_level}</div>
                                    <div style={{ fontSize: 11, color: 'rgba(255,255,255,.4)', marginTop: 5, lineHeight: 1.55 }}>{match.score_explanation}</div>
                                </div>
                            </div>

                            {/* Sub-signal breakdown — real, deterministic where possible; qualitative where not */}
                            {match.signals?.length > 0 && (
                                <div style={{ display: 'flex', gap: 8, marginTop: 16, flexWrap: 'wrap' }}>
                                    {match.signals.map((s: any) => (
                                        <div key={s.key} style={{ flex: 1, minWidth: 100, background: 'rgba(255,255,255,.03)', borderRadius: 8, padding: '9px 12px' }}>
                                            <div style={{ fontSize: 9.5, color: 'rgba(255,255,255,.35)', textTransform: 'uppercase', letterSpacing: '.04em' }}>{s.label}</div>
                                            <div style={{ fontSize: 14, fontWeight: 700, color: '#fff', marginTop: 2 }}>
                                                {s.percent !== null && s.percent !== undefined ? `${s.percent}%` : s.qualitative}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* Compact chip rows instead of long bulleted lists */}
                            {match.strengths?.length > 0 && (
                                <div style={{ marginTop: 16 }}>
                                    <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.04em', color: 'rgba(255,255,255,.35)', marginBottom: 7 }}>Strong matches</div>
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                                        {match.strengths.map((s: string, i: number) => (
                                            <span key={i} style={{ fontSize: 11.5, color: '#13c28e', background: 'rgba(19,194,142,.08)', padding: '4px 10px', borderRadius: 100 }}>✓ {s}</span>
                                        ))}
                                    </div>
                                </div>
                            )}
                            {(match.skill_gaps?.required?.length > 0 || match.skill_gaps?.nice_to_have?.length > 0) && (
                                <div style={{ marginTop: 12 }}>
                                    <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.04em', color: 'rgba(255,255,255,.35)', marginBottom: 7 }}>Missing skills</div>
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                                        {[...(match.skill_gaps.required || []), ...(match.skill_gaps.nice_to_have || [])].map((s: string, i: number) => (
                                            <span key={i} style={{ fontSize: 11.5, color: '#e2b04a', background: 'rgba(226,176,74,.08)', padding: '4px 10px', borderRadius: 100 }}>△ {s}</span>
                                        ))}
                                    </div>
                                </div>
                            )}

                            <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
                                <div style={{ flex: 1, minWidth: 140, background: 'rgba(255,255,255,.03)', borderRadius: 8, padding: '9px 12px' }}>
                                    <div style={{ fontSize: 9.5, color: 'rgba(255,255,255,.35)', textTransform: 'uppercase', letterSpacing: '.04em' }}>Interview readiness</div>
                                    <div style={{ fontSize: 12.5, fontWeight: 600, color: '#fff', marginTop: 2 }}>{match.interview_readiness}</div>
                                </div>
                            </div>

                            {match.overall_score < 80 && (
                                <Link href="/candidate/dashboard/optimizer" style={{ textDecoration: 'none' }}>
                                    <div style={{ marginTop: 16, fontSize: 12, fontWeight: 700, color: '#7c3aed', display: 'inline-block' }}>Improve My Resume →</div>
                                </Link>
                            )}
                        </div>
                    )}
                </div>

                {/* ── Application Strategy ────────────────────────────────── */}
                {!job.has_applied && (
                    <div style={{ marginTop: 20 }}>
                        <ApplicationStrategyCard
                            match={match}
                            hasResume={!!cvText.trim()}
                            jobTitle={job.title}
                            company={job.company}
                            onImproveResume={() => {
                                if (cvText.trim()) {
                                    // Real base resume text exists -- send them into the actual
                                    // Tailor My Resume flow (select/import base -> AI-optimize
                                    // against THIS job -> review/accept -> save as new version).
                                    window.location.href = `/candidate/dashboard/jobs/${jobId}/tailor`
                                    return
                                }
                                // No resume yet at all -- nothing to tailor, so go build one first.
                                window.location.href = '/candidate/dashboard/cv-builder'
                            }}
                            onPractice={() => {
                                try {
                                    sessionStorage.setItem('talentiq_job_context', JSON.stringify({
                                        target_role: job.title, company: job.company, job_description: job.description,
                                        skills_focus: [...(job.required_skills || []), ...(job.preferred_skills || [])],
                                        resume_text: cvText.trim() || undefined,
                                    }))
                                } catch { }
                                window.location.href = '/candidate/dashboard/practice'
                            }}
                            onScrollToGaps={() => {
                                const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
                                document.getElementById('job-fit-card')?.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' })
                            }}
                            onApply={() => setShowApplyModal(true)}
                        />
                    </div>
                )}

                {/* ── Description ─────────────────────────────────────────── */}
                <div style={{ marginTop: 26, fontSize: 13.5, color: 'rgba(255,255,255,.65)', lineHeight: 1.8, whiteSpace: 'pre-wrap' }}>{job.description}</div>
                {job.responsibilities && (
                    <>
                        <div style={{ fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,.5)', marginTop: 20, marginBottom: 6 }}>Responsibilities</div>
                        <div style={{ fontSize: 13, color: 'rgba(255,255,255,.6)', lineHeight: 1.8, whiteSpace: 'pre-wrap' }}>{job.responsibilities}</div>
                    </>
                )}

                {/* ── Apply ────────────────────────────────────────────────── */}
                <div style={{ marginTop: 32, position: 'sticky', bottom: 20 }}>
                    {job.has_applied ? (
                        <div style={{
                            background: (STATUS_META[job.application_status] || STATUS_META.applied).bg,
                            border: `1px solid ${(STATUS_META[job.application_status] || STATUS_META.applied).color}44`,
                            color: (STATUS_META[job.application_status] || STATUS_META.applied).color,
                            textAlign: 'center', padding: '14px', borderRadius: 10, fontSize: 13, fontWeight: 700,
                        }}>
                            ✓ Application {(STATUS_META[job.application_status] || STATUS_META.applied).label}
                        </div>
                    ) : (
                        <button onClick={() => setShowApplyModal(true)} style={{
                            width: '100%', fontFamily: 'Inter,sans-serif', fontWeight: 700, fontSize: 14, padding: '14px', borderRadius: 10, border: 'none', cursor: 'pointer',
                            background: '#e2b04a', color: '#0a0a08',
                        }}>Apply Now</button>
                    )}
                </div>

                {showApplyModal && (
                    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.6)', display: 'grid', placeItems: 'center', zIndex: 50, padding: 20 }} onClick={() => setShowApplyModal(false)}>
                        <div style={{ background: '#111110', border: '1px solid rgba(255,255,255,.1)', borderRadius: 14, padding: 26, maxWidth: 440, width: '100%', maxHeight: '85vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
                            <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>Apply to {job.title}</div>
                            <div style={{ fontSize: 11.5, color: 'rgba(255,255,255,.4)', marginBottom: 16 }}>It'll be screened automatically.</div>

                            {savedResumes.length > 0 && (
                                <div style={{ marginBottom: 14 }}>
                                    <div style={{ fontSize: 10.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.04em', color: 'rgba(255,255,255,.35)', marginBottom: 8 }}>Select resume for this application</div>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                        {savedResumes.map(r => (
                                            <label key={r.id} style={{
                                                display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, cursor: 'pointer',
                                                background: selectedResumeId === r.id ? 'rgba(226,176,74,.08)' : 'rgba(255,255,255,.03)',
                                                border: `1px solid ${selectedResumeId === r.id ? 'rgba(226,176,74,.3)' : 'rgba(255,255,255,.07)'}`,
                                                borderRadius: 8, padding: '9px 12px',
                                            }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                                                    <input type="radio" name="resume-select" checked={selectedResumeId === r.id} onChange={() => setSelectedResumeId(r.id)} />
                                                    <div style={{ minWidth: 0 }}>
                                                        <div style={{ fontSize: 12, fontWeight: 600, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.name}</div>
                                                        <div style={{ fontSize: 10, color: 'rgba(255,255,255,.35)' }}>Updated {new Date(r.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</div>
                                                    </div>
                                                </div>
                                                {r.ats_score !== null && r.ats_score !== undefined && <div style={{ fontSize: 12, fontWeight: 700, color: '#13c28e', flexShrink: 0 }}>{r.ats_score}%</div>}
                                            </label>
                                        ))}
                                        <label style={{
                                            display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer',
                                            background: selectedResumeId === 'upload' ? 'rgba(226,176,74,.08)' : 'rgba(255,255,255,.03)',
                                            border: `1px solid ${selectedResumeId === 'upload' ? 'rgba(226,176,74,.3)' : 'rgba(255,255,255,.07)'}`,
                                            borderRadius: 8, padding: '9px 12px',
                                        }}>
                                            <input type="radio" name="resume-select" checked={selectedResumeId === 'upload'} onChange={() => setSelectedResumeId('upload')} />
                                            <div style={{ fontSize: 12, fontWeight: 600, color: '#fff' }}>Upload a different file</div>
                                        </label>
                                    </div>
                                </div>
                            )}

                            {selectedResumeId === 'upload' && (
                                <input type="file" accept=".pdf,.doc,.docx" onChange={e => setApplyFile(e.target.files?.[0] || null)}
                                    style={{ fontSize: 12, color: 'rgba(255,255,255,.6)', marginBottom: 14, width: '100%' }} />
                            )}

                            <div style={{ fontSize: 11, color: 'rgba(255,255,255,.35)', marginBottom: 10 }}>
                                You'll be submitting: {selectedResumeId === 'upload' ? (applyFile?.name || 'no file selected yet') : savedResumes.find(r => r.id === selectedResumeId)?.name}
                            </div>

                            {applyError && <div style={{ fontSize: 11.5, color: '#ef4444', marginBottom: 10 }}>{applyError}</div>}
                            <div style={{ display: 'flex', gap: 10 }}>
                                <button onClick={() => setShowApplyModal(false)} style={{ flex: 1, fontFamily: 'Inter,sans-serif', fontWeight: 700, fontSize: 12.5, padding: '10px', borderRadius: 8, border: '1px solid rgba(255,255,255,.1)', background: 'rgba(255,255,255,.05)', color: 'rgba(255,255,255,.6)', cursor: 'pointer' }}>Cancel</button>
                                <button onClick={submitApplication} disabled={applySubmitting || (selectedResumeId === 'upload' && !applyFile)} style={{
                                    flex: 1, fontFamily: 'Inter,sans-serif', fontWeight: 700, fontSize: 12.5, padding: '10px', borderRadius: 8, border: 'none', cursor: 'pointer',
                                    background: '#13c28e', color: '#0a0a08', opacity: applySubmitting || (selectedResumeId === 'upload' && !applyFile) ? .6 : 1,
                                }}>{generatingPdf ? 'Preparing resume…' : applySubmitting ? 'Submitting…' : 'Submit Application'}</button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}