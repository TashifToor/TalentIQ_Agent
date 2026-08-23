'use client'

import { useEffect, useRef, useState } from 'react'
import { api } from '@/lib/api'

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

type ATSResult = {
    overall_score: number
    target_score: number
    categories: Record<string, { score: number; issues: string[]; recommendations: string[] }>
    top_issues: string[]
    recommendations: string[]
}

const gold = '#d4af6d'
const panelBg = '#141412'
const border = 'rgba(255,255,255,.1)'
const textDim = 'rgba(245,242,235,.4)'
const textMain = '#f5f2eb'
const green = '#34d399'
const red = '#f87171'
const yellow = '#e2b04a'

function scoreColor(score: number) {
    return score >= 80 ? green : score >= 55 ? yellow : red
}

function cvDataToText(cv: CVData): string {
    const lines: string[] = []
    lines.push(cv.full_name || '')
    if (cv.role_title) lines.push(cv.role_title)
    const allSkills = cv.skill_groups.length ? cv.skill_groups.flatMap(g => g.items) : cv.skills
    if (cv.summary) lines.push('\nSUMMARY\n' + cv.summary)
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
    return lines.join('\n')
}

type QuickAction = 'summary' | 'strengthen' | 'keywords' | 'bullet' | 'gaps'
type Target = { kind: 'summary' } | { kind: 'bullet'; exp: number; bullet: number }

const btnGhost: React.CSSProperties = {
    fontSize: 11.5, fontWeight: 600, padding: '7px 10px', borderRadius: 7, border: `1px solid ${border}`,
    background: 'transparent', color: textDim, cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left', width: '100%',
}
const btnGold: React.CSSProperties = {
    fontSize: 12, fontWeight: 700, padding: '9px 14px', borderRadius: 8, border: 'none',
    background: gold, color: '#0a0a08', cursor: 'pointer', fontFamily: 'inherit',
}

export default function AIResumeAssistant({
    cv, onCvChange, jobDescription, template,
}: {
    cv: CVData
    onCvChange: (cv: CVData) => void
    jobDescription: string
    template: string
}) {
    const [open, setOpen] = useState(false) // drawer/sheet open state — irrelevant on desktop (always visible there)
    const [action, setAction] = useState<QuickAction | null>(null)
    const [target, setTarget] = useState<Target | null>(null)
    const [instruction, setInstruction] = useState<'stronger' | 'concise' | 'ats_friendly'>('stronger')
    const [suggestion, setSuggestion] = useState<{ original: string; rewritten: string } | null>(null)
    const [busy, setBusy] = useState(false)
    const [gapsResult, setGapsResult] = useState<{ matched: string[]; missing: string[] } | null>(null)
    const [gapsLoading, setGapsLoading] = useState(false)
    const [gapsError, setGapsError] = useState('')

    // --- ATS score — reuses the exact same /cv-builder/ats-score endpoint the
    // Job Readiness panel below uses; this is just a second, compact place it's
    // rendered, not a second scoring system. Debounced so it doesn't fire on
    // every keystroke, and refreshes automatically after any Apply below.
    const [ats, setAts] = useState<ATSResult | null>(null)
    const [atsLoading, setAtsLoading] = useState(false)
    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

    const refreshAts = () => {
        setAtsLoading(true)
        api.getAtsScore(cv, template).then(setAts).catch(() => { }).finally(() => setAtsLoading(false))
    }

    useEffect(() => {
        const hasContent = cv.full_name || cv.summary || cv.experience.length || cv.skills.length || cv.skill_groups.length
        if (!hasContent) return
        if (debounceRef.current) clearTimeout(debounceRef.current)
        debounceRef.current = setTimeout(refreshAts, 900)
        return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [cv, template])

    const resetSuggestion = () => { setSuggestion(null) }

    const startSummary = () => {
        setAction('summary'); resetSuggestion()
        if (!cv.summary.trim()) return
        setTarget({ kind: 'summary' })
        runRewrite({ kind: 'summary' }, 'stronger')
    }

    const startBulletPicker = (which: 'strengthen' | 'bullet') => {
        setAction(which); resetSuggestion(); setTarget(null)
    }

    const pickBullet = (exp: number, bullet: number) => {
        const t: Target = { kind: 'bullet', exp, bullet }
        setTarget(t)
        runRewrite(t, 'stronger')
    }

    const runRewrite = async (t: Target, instr: 'stronger' | 'concise' | 'ats_friendly') => {
        const text = t.kind === 'summary' ? cv.summary : cv.experience[t.exp]?.bullets[t.bullet]
        if (!text || !text.trim()) return
        setInstruction(instr)
        setBusy(true)
        setSuggestion(null)
        try {
            const res = await api.assistantRewrite(text, instr, jobDescription.trim() || undefined)
            setSuggestion(res)
        } catch {
            setSuggestion(null)
        } finally {
            setBusy(false)
        }
    }

    const applySuggestion = () => {
        if (!suggestion || !target) return
        const newCv: CVData = JSON.parse(JSON.stringify(cv))
        if (target.kind === 'summary') newCv.summary = suggestion.rewritten
        else newCv.experience[target.exp].bullets[target.bullet] = suggestion.rewritten
        onCvChange(newCv)
        setSuggestion(null)
        setTarget(null)
        setAction(null)
        setTimeout(refreshAts, 300) // resume changed -> ATS analysis -> updated score
    }

    const tryAgain = () => { if (target) runRewrite(target, instruction) }

    const runGaps = async (mode: 'keywords' | 'gaps') => {
        setAction(mode)
        resetSuggestion()
        if (!jobDescription.trim()) {
            setGapsResult(null)
            setGapsError(mode === 'keywords' ? 'Paste a job description in Step 4 first — keyword matching needs a real job to compare against.' : '')
            return
        }
        setGapsLoading(true)
        setGapsError('')
        try {
            const res = await api.screenCandidate(jobDescription.trim(), cvDataToText(cv))
            setGapsResult({ matched: res.metrics.matched_skills, missing: res.metrics.missing_skills })
        } catch (e: any) {
            setGapsError(e.message || 'Could not check this against the job right now.')
        } finally {
            setGapsLoading(false)
        }
    }

    const hasBullets = cv.experience.some(e => e.bullets.some(b => b.trim()))

    const panelContent = (
        <>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 4 }}>
                <div>
                    <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 18, fontWeight: 600, color: textMain }}>✨ AI Resume Assistant</div>
                    <div style={{ fontSize: 11, color: textDim, marginTop: 1 }}>Improve your resume with AI</div>
                </div>
                <button onClick={() => setOpen(false)} className="ai-assistant-close" style={{ display: 'none', background: 'none', border: 'none', color: textDim, cursor: 'pointer', fontSize: 18, lineHeight: 1, padding: 4 }}>✕</button>
            </div>

            {/* Compact live ATS score — same endpoint as the full ATS card below */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '14px 0', padding: '10px 12px', background: '#1a1a17', border: `1px solid ${border}`, borderRadius: 10 }}>
                <div style={{ width: 34, height: 34, borderRadius: '50%', display: 'grid', placeItems: 'center', fontSize: 12, fontWeight: 700, flexShrink: 0, border: `2px solid ${ats ? scoreColor(ats.overall_score) : border}`, color: ats ? scoreColor(ats.overall_score) : textDim }}>
                    {atsLoading ? '…' : ats ? ats.overall_score : '—'}
                </div>
                <div style={{ fontSize: 11, color: textDim, lineHeight: 1.4 }}>
                    {ats ? <>ATS score · target {ats.target_score}+{ats.top_issues.length ? ` · ${ats.top_issues.length} issue${ats.top_issues.length === 1 ? '' : 's'}` : ''}</> : atsLoading ? 'Scoring your resume…' : 'Add resume details to see your ATS score'}
                </div>
            </div>

            {/* Quick actions */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 14 }}>
                <button style={btnGhost} onClick={startSummary} disabled={!cv.summary.trim()}>📝 Improve my summary</button>
                <button style={btnGhost} onClick={() => startBulletPicker('strengthen')} disabled={!hasBullets}>💪 Strengthen this experience</button>
                <button style={btnGhost} onClick={() => runGaps('keywords')}>🔑 Add relevant keywords</button>
                <button style={btnGhost} onClick={() => startBulletPicker('bullet')} disabled={!hasBullets}>✏️ Improve this bullet point</button>
                <button style={btnGhost} onClick={() => runGaps('gaps')}>🎯 What am I missing for this job?</button>
            </div>

            {/* Bullet picker — shared by "strengthen this experience" and "improve this bullet point" (same real capability, two entry points) */}
            {(action === 'strengthen' || action === 'bullet') && !target && (
                <div style={{ marginBottom: 14 }}>
                    <div style={{ fontSize: 11, color: textDim, marginBottom: 6 }}>Pick a bullet:</div>
                    <select onChange={e => { if (!e.target.value) return; const [exp, b] = e.target.value.split('-').map(Number); pickBullet(exp, b) }}
                        defaultValue="" style={{ width: '100%', background: '#1e1e1b', border: `1px solid ${border}`, borderRadius: 8, padding: '8px 10px', fontSize: 12, color: textMain, boxSizing: 'border-box' }}>
                        <option value="">Select…</option>
                        {cv.experience.map((exp, ei) => exp.bullets.map((b, bi) => b.trim() ? (
                            <option key={`${ei}-${bi}`} value={`${ei}-${bi}`}>{exp.title || 'Role'}: {b.slice(0, 50)}{b.length > 50 ? '…' : ''}</option>
                        ) : null))}
                    </select>
                </div>
            )}

            {/* Keyword / gap results — real Job Match engine, same as Job Match Lab below */}
            {(action === 'keywords' || action === 'gaps') && (
                <div style={{ marginBottom: 14 }}>
                    {gapsLoading && <div style={{ fontSize: 12, color: textDim }}>Checking against the job…</div>}
                    {gapsError && <div style={{ fontSize: 12, color: textDim, lineHeight: 1.5 }}>{gapsError}</div>}
                    {gapsResult && (
                        <div style={{ fontSize: 12 }}>
                            {gapsResult.missing.length > 0 ? (
                                <>
                                    <div style={{ color: red, fontWeight: 700, fontSize: 11, marginBottom: 6 }}>Not found in your resume</div>
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 10 }}>
                                        {gapsResult.missing.map(s => <span key={s} style={{ fontSize: 11, padding: '3px 9px', borderRadius: 100, background: `${red}18`, color: red, border: `1px solid ${red}40` }}>{s}</span>)}
                                    </div>
                                    <div style={{ fontSize: 11, color: textDim }}>Add these only where you genuinely have the experience.</div>
                                </>
                            ) : (
                                <div style={{ color: green, fontSize: 12 }}>Nothing missing — your resume already covers this job's key terms.</div>
                            )}
                        </div>
                    )}
                </div>
            )}

            {/* Current -> AI Suggestion -> Apply / Try Again */}
            {target && (
                <div style={{ borderTop: `1px solid ${border}`, paddingTop: 14 }}>
                    <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
                        {(['stronger', 'concise', 'ats_friendly'] as const).map(i => (
                            <button key={i} onClick={() => runRewrite(target, i)} style={{
                                fontSize: 10.5, fontWeight: 600, padding: '5px 9px', borderRadius: 100, cursor: 'pointer', fontFamily: 'inherit',
                                border: `1px solid ${instruction === i ? gold : border}`, background: instruction === i ? `${gold}18` : 'transparent', color: instruction === i ? gold : textDim,
                            }}>{i === 'stronger' ? 'Stronger' : i === 'concise' ? 'Concise' : 'ATS-friendly'}</button>
                        ))}
                    </div>

                    {busy && <div style={{ fontSize: 12, color: textDim }}>Thinking…</div>}

                    {suggestion && !busy && (
                        <>
                            <div style={{ fontSize: 10.5, fontWeight: 700, color: textDim, textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 4 }}>Current</div>
                            <div style={{ fontSize: 12, color: 'rgba(245,242,235,.5)', marginBottom: 10, lineHeight: 1.5, padding: '8px 10px', background: '#1a1a17', borderRadius: 8 }}>{suggestion.original}</div>
                            <div style={{ fontSize: 10.5, fontWeight: 700, color: green, textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 4 }}>AI Suggestion</div>
                            <div style={{ fontSize: 12, color: textMain, marginBottom: 12, lineHeight: 1.5, padding: '8px 10px', background: `${green}0f`, border: `1px solid ${green}30`, borderRadius: 8 }}>{suggestion.rewritten}</div>
                            <div style={{ display: 'flex', gap: 8 }}>
                                <button style={btnGold} onClick={applySuggestion}>Apply to Resume</button>
                                <button style={{ ...btnGhost, width: 'auto', padding: '9px 14px' }} onClick={tryAgain}>Try Again</button>
                            </div>
                        </>
                    )}
                </div>
            )}
        </>
    )

    return (
        <>
            {/* Floating trigger — hidden on desktop via CSS, visible tablet/mobile */}
            <button onClick={() => setOpen(true)} className="ai-assistant-trigger" style={{
                display: 'none', position: 'fixed', bottom: 20, right: 20, zIndex: 90,
                background: gold, color: '#0a0a08', border: 'none', borderRadius: 100, padding: '12px 18px',
                fontSize: 13, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer', boxShadow: '0 8px 24px rgba(0,0,0,.4)',
                alignItems: 'center', gap: 6,
            }}>✨ AI Assistant</button>

            <div className={`ai-assistant-backdrop${open ? ' open' : ''}`} onClick={() => setOpen(false)} />

            <div className={`ai-assistant-col${open ? ' open' : ''}`} style={{
                flex: '0 1 320px', minWidth: 300, background: panelBg, border: `1px solid ${border}`, borderRadius: 14,
                padding: 18, position: 'sticky', top: 16, alignSelf: 'flex-start', maxHeight: 'calc(100vh - 32px)', overflowY: 'auto',
            }}>
                {panelContent}
            </div>
        </>
    )
}