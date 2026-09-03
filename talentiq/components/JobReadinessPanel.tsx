'use client'

import { useEffect, useRef, useState } from 'react'
import { api } from '@/lib/api'

// --- Types (mirror schemas/cv_builder.py CVData) ---
type Education = { degree: string; institution: string; start_year: string; end_year: string; details: string }
type Experience = { title: string; company: string; start_date: string; end_date: string; bullets: string[] }
type Project = { name: string; description: string; tech_stack: string }
type SkillGroup = { category: string; items: string[] }
type CVData = {
    full_name: string; role_title: string; email: string; phone: string; location: string; linkedin: string; github: string
    summary: string; skills: string[]; skill_groups: SkillGroup[]
    education: Education[]; experience: Experience[]; projects: Project[]; achievements: string[]
    photo_base64?: string | null
}

type ATSCategory = { score: number; issues: string[]; recommendations: string[] }
type ATSResult = {
    overall_score: number
    target_score: number
    categories: Record<string, ATSCategory>
    top_issues: string[]
    recommendations: string[]
}

const CATEGORY_LABELS: Record<string, string> = {
    formatting_compatibility: 'Formatting Compatibility',
    section_completeness: 'Section Completeness',
    keyword_quality: 'Keyword Quality',
    skills_visibility: 'Skills Visibility',
    experience_clarity: 'Experience Clarity',
    achievement_quality: 'Achievement / Bullet Quality',
    contact_completeness: 'Contact Information',
}

// --- Palette — matches CVBuilderWizard's light theme on this same page ---
const gold = '#e2b04a'
const panel = '#ffffff'
const border = '#e7e4da'
const textDim = '#7a7468'
const textMain = '#1f1c17'
const green = '#0b7c5e'
const red = '#ef4444'
const yellow = '#c5931f'

const card: React.CSSProperties = { background: panel, border: `1px solid ${border}`, borderRadius: 14, padding: 22 }
const sectionHeading: React.CSSProperties = { fontFamily: "Inter, sans-serif", fontSize: 22, fontWeight: 600, color: textMain, marginBottom: 4 }
const sectionSub: React.CSSProperties = { fontSize: 13, color: textDim, marginBottom: 16, lineHeight: 1.6 }
const btn: React.CSSProperties = { fontSize: 13, fontWeight: 700, padding: '10px 18px', borderRadius: 9, border: 'none', background: gold, color: '#0a0a08', cursor: 'pointer', fontFamily: 'inherit' }
const btnGhost: React.CSSProperties = { fontSize: 12.5, fontWeight: 600, padding: '8px 14px', borderRadius: 8, border: `1px solid ${border}`, background: 'transparent', color: textDim, cursor: 'pointer', fontFamily: 'inherit' }
const chip = (color: string): React.CSSProperties => ({ fontSize: 12, fontWeight: 600, padding: '5px 11px', borderRadius: 100, background: `${color}18`, color, border: `1px solid ${color}40` })

function cvDataToText(cv: CVData): string {
    const lines: string[] = []
    lines.push(cv.full_name || '')
    if (cv.role_title) lines.push(cv.role_title)
    lines.push([cv.email, cv.phone, cv.location, cv.linkedin, cv.github].filter(Boolean).join(' | '))
    if (cv.summary) lines.push('\nSUMMARY\n' + cv.summary)
    const allSkills = cv.skill_groups.length ? cv.skill_groups.flatMap(g => g.items) : cv.skills
    if (allSkills.length) lines.push('\nSKILLS\n' + allSkills.join(', '))
    if (cv.experience.length) {
        lines.push('\nEXPERIENCE')
        cv.experience.forEach(e => {
            lines.push(`${e.title} at ${e.company} (${e.start_date} - ${e.end_date || 'Present'})`)
            e.bullets.filter(Boolean).forEach(b => lines.push('- ' + b))
        })
    }
    if (cv.projects.length) {
        lines.push('\nPROJECTS')
        cv.projects.forEach(p => lines.push(`${p.name}: ${p.description} [${p.tech_stack}]`))
    }
    if (cv.education.length) {
        lines.push('\nEDUCATION')
        cv.education.forEach(ed => lines.push(`${ed.degree}, ${ed.institution} (${ed.start_year}-${ed.end_year})`))
    }
    if (cv.achievements.filter(Boolean).length) lines.push('\nACHIEVEMENTS\n' + cv.achievements.filter(Boolean).join('; '))
    return lines.join('\n')
}

function ScoreRing({ score, size = 92 }: { score: number; size?: number }) {
    const radius = (size - 10) / 2
    const circumference = 2 * Math.PI * radius
    const offset = circumference * (1 - score / 100)
    const color = score >= 80 ? green : score >= 55 ? yellow : red
    return (
        <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
            <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
                <circle cx={size / 2} cy={size / 2} r={radius} stroke="#9c9689" strokeWidth={7} fill="none" />
                <circle cx={size / 2} cy={size / 2} r={radius} stroke={color} strokeWidth={7} fill="none"
                    strokeDasharray={circumference} strokeDashoffset={offset} strokeLinecap="round" style={{ transition: 'stroke-dashoffset .6s ease' }} />
            </svg>
            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column' }}>
                <span style={{ fontSize: size * 0.28, fontWeight: 700, color: textMain, lineHeight: 1 }}>{score}</span>
            </div>
        </div>
    )
}

function MiniBar({ label, score }: { label: string; score: number }) {
    const color = score >= 80 ? green : score >= 55 ? yellow : red
    return (
        <div style={{ marginBottom: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                <span style={{ color: textMain, fontWeight: 600 }}>{label}</span>
                <span style={{ color }}>{score}</span>
            </div>
            <div style={{ height: 6, borderRadius: 4, background: 'rgba(10,10,9,.05)', overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${score}%`, background: color, borderRadius: 4, transition: 'width .5s ease' }} />
            </div>
        </div>
    )
}

type ResumeSource = 'builder' | 'upload'
type JobMatchResult = { metrics: { candidate_score: number; matched_skills: string[]; missing_skills: string[]; final_verdict: string }; deep_analysis: string }
type AssistantEntry = { question: string; answer: string }

export default function JobReadinessPanel({
    cv, template, onApplyOptimizedCv,
}: {
    cv: CVData
    template: string
    onApplyOptimizedCv: (cv: CVData) => void
}) {
    const [resumeSource, setResumeSource] = useState<ResumeSource>('builder')
    const [uploadedCv, setUploadedCv] = useState<CVData | null>(null)
    const [uploading, setUploading] = useState(false)
    const fileRef = useRef<HTMLInputElement>(null)

    const activeCv = resumeSource === 'upload' && uploadedCv ? uploadedCv : cv

    // --- ATS Score ---
    const [ats, setAts] = useState<ATSResult | null>(null)
    const [atsLoading, setAtsLoading] = useState(false)
    const [atsError, setAtsError] = useState('')

    const runAtsScore = async () => {
        setAtsLoading(true)
        setAtsError('')
        try {
            const res = await api.getAtsScore(activeCv, template)
            setAts(res)
        } catch (e: any) {
            setAtsError(e.message || 'Could not analyze resume.')
        } finally {
            setAtsLoading(false)
        }
    }

    // --- Job Match Lab ---
    const [jd, setJd] = useState('')
    const [jobMatch, setJobMatch] = useState<JobMatchResult | null>(null)
    const [jobMatchLoading, setJobMatchLoading] = useState(false)
    const [jobMatchError, setJobMatchError] = useState('')
    const [beforeAfter, setBeforeAfter] = useState<{ before: number; after: number; changed: string[] } | null>(null)
    const [optimizing, setOptimizing] = useState(false)
    const [optimizedCv, setOptimizedCv] = useState<CVData | null>(null)

    const runJobMatch = async () => {
        if (!jd.trim()) { setJobMatchError('Paste a job description first.'); return }
        setJobMatchLoading(true)
        setJobMatchError('')
        setBeforeAfter(null)
        try {
            const res = await api.screenCandidate(jd.trim(), cvDataToText(activeCv))
            setJobMatch(res)
        } catch (e: any) {
            setJobMatchError(e.message || 'Could not run Job Match analysis.')
        } finally {
            setJobMatchLoading(false)
        }
    }

    const runOptimizeForJob = async () => {
        if (!jd.trim() || !jobMatch) return
        setOptimizing(true)
        setJobMatchError('')
        try {
            const beforeScore = jobMatch.metrics.candidate_score
            const optRes = await api.optimizeCvForJob(activeCv, jd.trim())
            const newCv: CVData = optRes.cv_data
            setOptimizedCv(newCv)
            const afterMatch = await api.screenCandidate(jd.trim(), cvDataToText(newCv))
            setJobMatch(afterMatch)
            setBeforeAfter({ before: beforeScore, after: afterMatch.metrics.candidate_score, changed: optRes.changed_sections })
        } catch (e: any) {
            setJobMatchError(e.message || 'Could not optimize resume for this job.')
        } finally {
            setOptimizing(false)
        }
    }

    const applyOptimized = () => {
        if (optimizedCv) {
            onApplyOptimizedCv(optimizedCv)
            setOptimizedCv(null)
        }
    }

    // --- Interview / practice data (for Gap Radar + Readiness) ---
    const [practice, setPractice] = useState<{ ai_score: number | null; assessment_score: number | null; breakdown: Record<string, Record<string, number>> | null } | null>(null)

    useEffect(() => {
        (async () => {
            try {
                const history = await api.getPracticeHistory()
                const latestCompleted = (history || []).find((h: any) => h.status === 'completed')
                if (!latestCompleted) return
                const report = await api.getPracticeReport(latestCompleted.id)
                setPractice({
                    ai_score: report.ai_score ?? null,
                    assessment_score: report.assessment_score ?? null,
                    breakdown: report.assessment_breakdown ?? null,
                })
            } catch {
                // no practice history yet — Career Gap Radar / Readiness just omit this signal
            }
        })()
    }, [])

    // --- Career Gap Radar (derived, no backend call) ---
    type GapRow = { label: string; status: 'strong' | 'improve' | 'missing' | 'interview'; reason: string }
    const gapRows: GapRow[] = []
    if (jobMatch) {
        jobMatch.metrics.matched_skills.forEach(s => gapRows.push({ label: s, status: 'strong', reason: 'Found in your resume and required by this job.' }))
        jobMatch.metrics.missing_skills.forEach(s => gapRows.push({ label: s, status: 'missing', reason: 'This appears in the target job requirements but was not found in your resume.' }))
    }
    if (ats) {
        Object.entries(ats.categories).forEach(([key, cat]) => {
            if (cat.score < 60) {
                gapRows.push({ label: CATEGORY_LABELS[key] || key, status: 'improve', reason: cat.issues[0] || 'Below target on your resume analysis.' })
            }
        })
    }
    if (practice?.breakdown) {
        Object.entries(practice.breakdown).forEach(([topic, stats]: [string, any]) => {
            const pct = stats?.percentage ?? stats?.score ?? null
            if (typeof pct === 'number' && pct < 60) {
                gapRows.push({ label: topic, status: 'interview', reason: `Your recent interview practice suggests ${topic} answers need improvement.` })
            }
        })
    }

    const gapMeta: Record<GapRow['status'], { icon: string; color: string; label: string }> = {
        strong: { icon: '🟢', color: green, label: 'Strong' },
        improve: { icon: '🟡', color: yellow, label: 'Improvement Area' },
        missing: { icon: '🔴', color: red, label: 'Missing' },
        interview: { icon: '🟡', color: yellow, label: 'Interview Improvement' },
    }

    // --- Improvement Plan (derived, no backend call) ---
    const planItems: string[] = []
    if (ats) {
        ats.recommendations.slice(0, 3).forEach(r => planItems.push(r))
    }
    if (jobMatch) {
        jobMatch.metrics.missing_skills.slice(0, 3).forEach(s => planItems.push(`Add "${s}" to your resume only if you genuinely have this experience.`))
    }
    if (practice?.breakdown) {
        const weak = Object.entries(practice.breakdown).find(([, s]: [string, any]) => (s?.percentage ?? s?.score ?? 100) < 60)
        if (weak) planItems.push(`Practice ${weak[0]} interview questions — your last practice session showed room to improve here.`)
    }
    if (jobMatch || ats) planItems.push('Re-run Job Match Lab / ATS analysis after making changes to track your progress.')

    // --- Career Readiness (derived, no backend call — "Not enough data" where a signal is missing) ---
    const readinessParts: { label: string; value: number | null }[] = [
        { label: 'Resume Readiness', value: ats ? ats.overall_score : null },
        { label: 'Job Match', value: jobMatch ? jobMatch.metrics.candidate_score : null },
        {
            label: 'Skill Coverage',
            value: jobMatch
                ? Math.round((jobMatch.metrics.matched_skills.length / Math.max(1, jobMatch.metrics.matched_skills.length + jobMatch.metrics.missing_skills.length)) * 100)
                : null,
        },
        { label: 'Project Evidence', value: activeCv.projects.length > 0 ? Math.min(100, activeCv.projects.length * 34) : null },
        { label: 'Interview Readiness', value: practice?.ai_score ?? practice?.assessment_score ?? null },
    ]
    const availableParts = readinessParts.filter(p => p.value !== null) as { label: string; value: number }[]
    const overallReadiness = availableParts.length ? Math.round(availableParts.reduce((s, p) => s + p.value, 0) / availableParts.length) : null

    // --- AI Resume Assistant ---
    const [assistantLog, setAssistantLog] = useState<AssistantEntry[]>([])
    const [rewriteBulletIdx, setRewriteBulletIdx] = useState<{ exp: number; bullet: number } | null>(null)
    const [rewriteBusy, setRewriteBusy] = useState(false)
    const [rewriteResult, setRewriteResult] = useState<{ original: string; rewritten: string } | null>(null)

    const askAssistant = (question: string, answer: string) => setAssistantLog(prev => [...prev, { question, answer }])

    const handleQuickAction = (action: string) => {
        if (action === 'ats_low') {
            askAssistant('Why is my ATS score low?', ats
                ? (ats.top_issues.length ? ats.top_issues.join(' ') : `Your ATS score is ${ats.overall_score}/100 — nothing critical found, just polish left.`)
                : 'Run "Make My Resume ATS-Friendly" first so I have something real to look at.')
        } else if (action === 'job_low') {
            askAssistant('Why is my Job Match low?', jobMatch
                ? `Your match score is ${jobMatch.metrics.candidate_score}. Missing skills for this role: ${jobMatch.metrics.missing_skills.join(', ') || 'none — nice.'}`
                : 'Run Job Match Lab against a job description first.')
        } else if (action === 'missing_keywords') {
            askAssistant('What keywords am I missing?', jobMatch
                ? (jobMatch.metrics.missing_skills.length ? jobMatch.metrics.missing_skills.join(', ') : 'None found — your resume already covers this job\'s key terms.')
                : 'Run Job Match Lab first so I know which job to check against.')
        } else if (action === 'which_section') {
            if (!ats) { askAssistant('Which section should I improve first?', 'Run "Make My Resume ATS-Friendly" first.'); return }
            const worst = Object.entries(ats.categories).sort((a, b) => a[1].score - b[1].score)[0]
            askAssistant('Which section should I improve first?', `Start with ${CATEGORY_LABELS[worst[0]] || worst[0]} — it's your lowest-scoring area at ${worst[1].score}/100.`)
        }
    }

    const runRewrite = async (instruction: 'stronger' | 'concise' | 'ats_friendly') => {
        if (!rewriteBulletIdx) return
        const text = activeCv.experience[rewriteBulletIdx.exp]?.bullets[rewriteBulletIdx.bullet]
        if (!text) return
        setRewriteBusy(true)
        setRewriteResult(null)
        try {
            const res = await api.assistantRewrite(text, instruction, jd.trim() || undefined)
            setRewriteResult(res)
        } catch (e: any) {
            setRewriteResult({ original: text, rewritten: text })
        } finally {
            setRewriteBusy(false)
        }
    }

    const applyRewrite = () => {
        if (!rewriteResult || !rewriteBulletIdx || resumeSource === 'upload') return
        const newCv: CVData = JSON.parse(JSON.stringify(cv))
        newCv.experience[rewriteBulletIdx.exp].bullets[rewriteBulletIdx.bullet] = rewriteResult.rewritten
        onApplyOptimizedCv(newCv)
        setRewriteResult(null)
        setRewriteBulletIdx(null)
    }

    return (
        <div style={{ maxWidth: 1100, margin: '48px auto 0', padding: '0 16px 60px', fontFamily: 'Inter, sans-serif', color: textMain }}>
            <div style={{ marginBottom: 28 }}>
                <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.14em', textTransform: 'uppercase', color: gold, marginBottom: 8 }}>Job Readiness System</p>
                <h2 style={{ fontFamily: "Inter, sans-serif", fontSize: 'clamp(26px,3vw,36px)', fontWeight: 600, marginBottom: 8 }}>
                    Turn this resume into an offer
                </h2>
                <p style={{ fontSize: 13.5, color: textDim, lineHeight: 1.7, maxWidth: 640 }}>
                    Score your resume, match it against a real job, find the concrete gaps, and get a plan to close them — all built on your actual resume data.
                </p>
            </div>

            {/* Resume source */}
            <div style={{ display: 'flex', gap: 10, marginBottom: 24 }}>
                <button onClick={() => setResumeSource('builder')} style={resumeSource === 'builder' ? btn : btnGhost}>Use resume I'm building</button>
                <button onClick={() => fileRef.current?.click()} style={resumeSource === 'upload' ? btn : btnGhost} disabled={uploading}>
                    {uploading ? 'Uploading…' : 'Upload existing resume'}
                </button>
                <input ref={fileRef} type="file" accept=".pdf" style={{ display: 'none' }} onChange={async e => {
                    const f = e.target.files?.[0]
                    if (!f) return
                    setUploading(true)
                    try {
                        const data = await api.parseCVForBuilder(f)
                        setUploadedCv(data)
                        setResumeSource('upload')
                    } catch {
                        /* handled via existing wizard error patterns elsewhere; keep this action non-blocking */
                    } finally {
                        setUploading(false)
                    }
                }} />
                {resumeSource === 'upload' && uploadedCv && <span style={{ fontSize: 12, color: textDim, alignSelf: 'center' }}>Analyzing: {uploadedCv.full_name || 'uploaded resume'}</span>}
            </div>

            {/* 1. ATS Resume Optimization */}
            <div style={{ ...card, marginBottom: 20 }}>
                <h3 style={sectionHeading}>ATS Resume Optimization</h3>
                <p style={sectionSub}>Formatting, section completeness, keyword grounding, and bullet quality — scored directly from your actual resume content.</p>
                {!ats && !atsLoading && <button style={btn} onClick={runAtsScore}>Make My Resume ATS-Friendly</button>}
                {atsLoading && <div style={{ fontSize: 13, color: textDim }}>Analyzing…</div>}
                {atsError && <div style={{ fontSize: 12.5, color: red, marginTop: 8 }}>{atsError}</div>}

                {ats && (
                    <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 24, marginBottom: 20 }}>
                            <ScoreRing score={ats.overall_score} />
                            <div>
                                <div style={{ fontSize: 13, color: textDim }}>Current Score: <b style={{ color: textMain }}>{ats.overall_score}</b> · Target: <b style={{ color: green }}>{ats.target_score}+</b></div>
                                <div style={{ fontSize: 12.5, color: textDim, marginTop: 4 }}>{ats.top_issues.length} issue(s) found across {Object.keys(ats.categories).length} categories.</div>
                            </div>
                            <div style={{ marginLeft: 'auto' }}>
                                <button style={btnGhost} onClick={runAtsScore}>Re-run analysis</button>
                            </div>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '4px 24px', marginBottom: 16 }}>
                            {Object.entries(ats.categories).map(([key, catData]) => (
                                <MiniBar key={key} label={CATEGORY_LABELS[key] || key} score={catData.score} />
                            ))}
                        </div>

                        {ats.top_issues.length > 0 && (
                            <div style={{ background: '#faf9f5', border: `1px solid ${border}`, borderRadius: 10, padding: 14 }}>
                                <div style={{ fontSize: 11.5, fontWeight: 700, color: textDim, textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 8 }}>Recommendations</div>
                                {ats.recommendations.map((r, i) => (
                                    <div key={i} style={{ fontSize: 12.5, color: '#3a352d', marginBottom: 6, lineHeight: 1.5 }}>• {r}</div>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* 2. Job Match Lab */}
            <div style={{ ...card, marginBottom: 20 }}>
                <h3 style={sectionHeading}>Job Match Lab <span style={chip(gold)}>Premium</span></h3>
                <p style={sectionSub}>Paste a real job description — see exactly what matches, what's missing, and optimize honestly.</p>

                <textarea value={jd} onChange={e => setJd(e.target.value)} placeholder="Paste the target job description here…"
                    style={{ width: '100%', minHeight: 100, background: '#faf9f5', border: `1px solid ${border}`, borderRadius: 10, padding: 12, fontSize: 13, color: textMain, outline: 'none', resize: 'vertical', fontFamily: 'inherit', marginBottom: 12, boxSizing: 'border-box' }} />

                <div style={{ display: 'flex', gap: 10 }}>
                    <button style={btn} onClick={runJobMatch} disabled={jobMatchLoading}>{jobMatchLoading ? 'Analyzing…' : 'Analyze Against This Job'}</button>
                    {jobMatch && <button style={btnGhost} onClick={runOptimizeForJob} disabled={optimizing}>{optimizing ? 'Optimizing…' : 'Optimize Resume for This Job'}</button>}
                </div>
                {jobMatchError && <div style={{ fontSize: 12.5, color: red, marginTop: 8 }}>{jobMatchError}</div>}

                {jobMatch && (
                    <div style={{ marginTop: 20 }}>
                        {beforeAfter && (
                            <div style={{ display: 'flex', gap: 24, alignItems: 'center', background: '#faf9f5', border: `1px solid ${border}`, borderRadius: 10, padding: 16, marginBottom: 16 }}>
                                <div style={{ textAlign: 'center' }}>
                                    <div style={{ fontSize: 11, color: textDim, textTransform: 'uppercase' }}>Before</div>
                                    <div style={{ fontSize: 26, fontWeight: 700 }}>{beforeAfter.before}</div>
                                </div>
                                <div style={{ fontSize: 20, color: textDim }}>→</div>
                                <div style={{ textAlign: 'center' }}>
                                    <div style={{ fontSize: 11, color: textDim, textTransform: 'uppercase' }}>After</div>
                                    <div style={{ fontSize: 26, fontWeight: 700, color: green }}>{beforeAfter.after}</div>
                                </div>
                                <div style={{ marginLeft: 8 }}>
                                    <div style={{ fontSize: 13, fontWeight: 700, color: beforeAfter.after >= beforeAfter.before ? green : red }}>
                                        {beforeAfter.after >= beforeAfter.before ? '+' : ''}{beforeAfter.after - beforeAfter.before} Job Match
                                    </div>
                                    {beforeAfter.changed.length > 0 && (
                                        <div style={{ fontSize: 11.5, color: textDim }}>What changed: {beforeAfter.changed.join(', ')}</div>
                                    )}
                                </div>
                                {optimizedCv && (
                                    <button style={{ ...btn, marginLeft: 'auto' }} onClick={applyOptimized}>Keep these changes</button>
                                )}
                            </div>
                        )}

                        <div style={{ display: 'flex', alignItems: 'center', gap: 20, marginBottom: 16 }}>
                            <ScoreRing score={jobMatch.metrics.candidate_score} size={72} />
                            <div style={{ fontSize: 13, color: textDim }}>{jobMatch.metrics.final_verdict}</div>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                            <div>
                                <div style={{ fontSize: 11.5, fontWeight: 700, color: green, textTransform: 'uppercase', marginBottom: 8 }}>Found in your resume</div>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                                    {jobMatch.metrics.matched_skills.map(s => <span key={s} style={chip(green)}>{s}</span>)}
                                </div>
                            </div>
                            <div>
                                <div style={{ fontSize: 11.5, fontWeight: 700, color: red, textTransform: 'uppercase', marginBottom: 8 }}>Required, not found</div>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                                    {jobMatch.metrics.missing_skills.map(s => <span key={s} style={chip(red)}>{s}</span>)}
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* 3. Career Gap Radar */}
            <div style={{ ...card, marginBottom: 20 }}>
                <h3 style={sectionHeading}>Career Gap Radar</h3>
                <p style={sectionSub}>Concrete gaps between your current profile and the target role — never a verdict on whether you're employable.</p>
                {gapRows.length === 0 ? (
                    <div style={{ fontSize: 13, color: textDim }}>Run the ATS analysis and Job Match Lab above to populate your radar.</div>
                ) : (
                    <div>
                        {gapRows.map((row, i) => {
                            const meta = gapMeta[row.status]
                            return (
                                <div key={i} style={{ display: 'flex', gap: 12, alignItems: 'flex-start', padding: '10px 0', borderBottom: i < gapRows.length - 1 ? `1px solid ${border}` : 'none' }}>
                                    <span style={{ fontSize: 16, lineHeight: 1.4 }}>{meta.icon}</span>
                                    <div style={{ flex: 1 }}>
                                        <div style={{ fontSize: 13.5, fontWeight: 700 }}>{row.label} <span style={{ fontSize: 11, fontWeight: 600, color: meta.color, marginLeft: 6 }}>{meta.label}</span></div>
                                        <div style={{ fontSize: 12, color: textDim, marginTop: 2 }}>{row.reason}</div>
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                )}
            </div>

            {/* 4. Improvement Plan */}
            {planItems.length > 0 && (
                <div style={{ ...card, marginBottom: 20 }}>
                    <h3 style={sectionHeading}>Your Improvement Plan</h3>
                    <p style={sectionSub}>Actions tied directly to the gaps found above.</p>
                    <ol style={{ margin: 0, paddingLeft: 20 }}>
                        {planItems.map((item, i) => (
                            <li key={i} style={{ fontSize: 13, color: '#3a352d', marginBottom: 8, lineHeight: 1.6 }}>{item}</li>
                        ))}
                    </ol>
                </div>
            )}

            {/* 5 & 6. Career Readiness + progress */}
            <div style={{ ...card, marginBottom: 20 }}>
                <h3 style={sectionHeading}>Career Readiness</h3>
                <p style={sectionSub}>An estimate of how prepared your current profile is for the selected job, based on the resume, job-match, skills, and interview signals actually available.</p>
                <div style={{ display: 'flex', alignItems: 'center', gap: 24, marginBottom: 18 }}>
                    {overallReadiness !== null ? <ScoreRing score={overallReadiness} /> : (
                        <div style={{ width: 92, height: 92, borderRadius: '50%', border: `2px dashed ${border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, color: textDim, textAlign: 'center', padding: 6 }}>Not enough data</div>
                    )}
                    <div style={{ fontSize: 13, color: textDim }}>{overallReadiness !== null ? `${overallReadiness} / 100` : 'Run the tools above to build your readiness score.'}</div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '4px 24px' }}>
                    {readinessParts.map(p => (
                        <div key={p.label} style={{ marginBottom: 10 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                                <span style={{ color: textMain, fontWeight: 600 }}>{p.label}</span>
                                <span style={{ color: p.value === null ? textDim : (p.value >= 80 ? green : p.value >= 55 ? yellow : red) }}>{p.value === null ? 'Not enough data' : p.value}</span>
                            </div>
                            <div style={{ height: 6, borderRadius: 4, background: 'rgba(10,10,9,.05)', overflow: 'hidden' }}>
                                <div style={{ height: '100%', width: `${p.value ?? 0}%`, background: p.value === null ? 'transparent' : (p.value >= 80 ? green : p.value >= 55 ? yellow : red), borderRadius: 4, transition: 'width .5s ease' }} />
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* 7. AI Resume Assistant */}
            <div style={card}>
                <h3 style={sectionHeading}>AI Resume Assistant</h3>
                <p style={sectionSub}>Grounded in your actual resume and, when set, the job description above. It never invents experience.</p>

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
                    <button style={btnGhost} onClick={() => handleQuickAction('ats_low')}>Why is my ATS score low?</button>
                    <button style={btnGhost} onClick={() => handleQuickAction('job_low')}>Why is my Job Match low?</button>
                    <button style={btnGhost} onClick={() => handleQuickAction('missing_keywords')}>What keywords am I missing?</button>
                    <button style={btnGhost} onClick={() => handleQuickAction('which_section')}>Which section should I improve first?</button>
                </div>

                {assistantLog.length > 0 && (
                    <div style={{ marginBottom: 20 }}>
                        {assistantLog.map((entry, i) => (
                            <div key={i} style={{ marginBottom: 12, background: '#faf9f5', border: `1px solid ${border}`, borderRadius: 10, padding: 12 }}>
                                <div style={{ fontSize: 12, fontWeight: 700, color: gold, marginBottom: 4 }}>{entry.question}</div>
                                <div style={{ fontSize: 12.5, color: '#3a352d', lineHeight: 1.6 }}>{entry.answer}</div>
                            </div>
                        ))}
                    </div>
                )}

                {resumeSource === 'builder' && activeCv.experience.length > 0 && (
                    <div style={{ borderTop: `1px solid ${border}`, paddingTop: 16 }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: textDim, marginBottom: 10 }}>Rewrite a bullet</div>
                        <select
                            value={rewriteBulletIdx ? `${rewriteBulletIdx.exp}-${rewriteBulletIdx.bullet}` : ''}
                            onChange={e => {
                                if (!e.target.value) { setRewriteBulletIdx(null); return }
                                const [exp, bullet] = e.target.value.split('-').map(Number)
                                setRewriteBulletIdx({ exp, bullet })
                                setRewriteResult(null)
                            }}
                            style={{ width: '100%', background: '#faf9f5', border: `1px solid ${border}`, borderRadius: 8, padding: '9px 12px', fontSize: 12.5, color: textMain, marginBottom: 10 }}
                        >
                            <option value="">Select a bullet…</option>
                            {activeCv.experience.map((exp, ei) => exp.bullets.map((b, bi) => b.trim() ? (
                                <option key={`${ei}-${bi}`} value={`${ei}-${bi}`}>{exp.title || 'Role'}: {b.slice(0, 60)}{b.length > 60 ? '…' : ''}</option>
                            ) : null))}
                        </select>

                        {rewriteBulletIdx && (
                            <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                                <button style={btnGhost} onClick={() => runRewrite('stronger')} disabled={rewriteBusy}>Improve this bullet</button>
                                <button style={btnGhost} onClick={() => runRewrite('concise')} disabled={rewriteBusy}>Make more concise</button>
                                <button style={btnGhost} onClick={() => runRewrite('ats_friendly')} disabled={rewriteBusy}>Make ATS-friendly</button>
                            </div>
                        )}
                        {rewriteBusy && <div style={{ fontSize: 12.5, color: textDim }}>Rewriting…</div>}
                        {rewriteResult && (
                            <div style={{ background: '#faf9f5', border: `1px solid ${border}`, borderRadius: 10, padding: 12 }}>
                                <div style={{ fontSize: 11, color: textDim, marginBottom: 6 }}>Original</div>
                                <div style={{ fontSize: 12.5, color: '#5c574c', marginBottom: 10, lineHeight: 1.5 }}>{rewriteResult.original}</div>
                                <div style={{ fontSize: 11, color: green, marginBottom: 6 }}>Suggested</div>
                                <div style={{ fontSize: 12.5, color: textMain, marginBottom: 12, lineHeight: 1.5 }}>{rewriteResult.rewritten}</div>
                                <button style={btn} onClick={applyRewrite}>Apply to my resume</button>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    )
}