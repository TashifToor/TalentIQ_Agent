'use client'

import { useRef, useState } from 'react'

type ATSSignal = { label: string; status: string; note: string }
type AnalysisResult = {
    overall_score: number
    fit_level: string
    score_explanation: string
    strengths: string[]
    skill_gaps: { required: string[]; nice_to_have: string[] }
    experience_gaps: string[]
    recruiter_impression: string
    ats_signals: ATSSignal[]
    interview_readiness: string
    interview_readiness_reason: string
    focus_areas: string[]
    next_actions: string[]
}

const gold = '#e2b04a'
const green = '#34d399'
const red = '#f87171'
const yellow = '#e2b04a'
const border = 'rgba(255,255,255,.09)'
const textDim = 'rgba(255,255,255,.4)'
const textMain = 'rgba(255,255,255,.92)'
const panelBg = '#111110'

function fitColor(level: string) {
    const l = level.toLowerCase()
    if (l.includes('strong')) return green
    if (l.includes('weak') || l.includes('needs')) return red
    return yellow
}
function readinessColor(r: string) {
    const l = r.toLowerCase()
    if (l === 'ready') return green
    if (l.includes('almost')) return yellow
    return red
}
function statusColor(s: string) {
    const l = s.toLowerCase()
    if (l === 'strong') return green
    if (l === 'weak') return red
    return yellow
}

const cardBase: React.CSSProperties = {
    background: panelBg, border: `1px solid ${border}`, borderRadius: 14, padding: 20,
    minWidth: 300, maxWidth: 340, flex: '0 0 auto', display: 'flex', flexDirection: 'column', gap: 10,
}
const cardLabel: React.CSSProperties = { fontSize: 10.5, fontWeight: 700, color: textDim, textTransform: 'uppercase', letterSpacing: '.06em' }
const chip = (color: string): React.CSSProperties => ({ fontSize: 11.5, fontWeight: 600, padding: '5px 11px', borderRadius: 100, background: `${color}18`, color, border: `1px solid ${color}35` })

function ScoreRing({ score, size = 84 }: { score: number; size?: number }) {
    const radius = (size - 8) / 2
    const c = 2 * Math.PI * radius
    const offset = c * (1 - score / 100)
    const color = score >= 70 ? green : score >= 45 ? yellow : red
    return (
        <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
            <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
                <circle cx={size / 2} cy={size / 2} r={radius} stroke="rgba(255,255,255,.08)" strokeWidth={6} fill="none" />
                <circle cx={size / 2} cy={size / 2} r={radius} stroke={color} strokeWidth={6} fill="none"
                    strokeDasharray={c} strokeDashoffset={offset} strokeLinecap="round" style={{ transition: 'stroke-dashoffset .6s ease' }} />
            </svg>
            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ fontSize: size * 0.26, fontWeight: 700, color: textMain }}>{score}%</span>
            </div>
        </div>
    )
}

export default function IntelligenceCarousel({
    mode, result, scoreHistory, onImproveCv, onPracticeTopics,
}: {
    mode: 'optimizer' | 'screening'
    result: AnalysisResult
    scoreHistory?: number[]
    onImproveCv: (focus?: string) => void
    onPracticeTopics: () => void
}) {
    const trackRef = useRef<HTMLDivElement>(null)
    const [showAllStrengths, setShowAllStrengths] = useState(false)

    const scroll = (dir: 1 | -1) => {
        trackRef.current?.scrollBy({ left: dir * 320, behavior: 'smooth' })
    }

    const scoreCard = (
        <div key="score" style={cardBase} role="group" aria-label="Match score">
            <div style={cardLabel}>{mode === 'optimizer' ? 'Match Score' : 'Screening Overview'}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                <ScoreRing score={result.overall_score} />
                <div>
                    <div style={{ ...chip(fitColor(result.fit_level)), display: 'inline-block' }}>{result.fit_level}</div>
                    {scoreHistory && scoreHistory.length > 1 && (
                        <div style={{ fontSize: 11, color: textDim, marginTop: 8 }}>
                            {scoreHistory.join(' → ')}
                            <div style={{ color: green, fontWeight: 600, marginTop: 2 }}>+{scoreHistory[scoreHistory.length - 1] - scoreHistory[0]} points since you started</div>
                        </div>
                    )}
                </div>
            </div>
            <p style={{ fontSize: 12.5, color: 'rgba(255,255,255,.6)', lineHeight: 1.6, margin: 0 }}>{result.score_explanation}</p>
        </div>
    )

    const strengthsList = showAllStrengths ? result.strengths : result.strengths.slice(0, 3)
    const strengthsCard = (
        <div key="strengths" style={cardBase} role="group" aria-label="Strengths">
            <div style={cardLabel}>Strengths</div>
            {result.strengths.length === 0 ? (
                <p style={{ fontSize: 12.5, color: textDim, margin: 0 }}>Not enough information to identify strengths yet.</p>
            ) : (
                <>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                        {strengthsList.map(s => <span key={s} style={chip(green)}>{s}</span>)}
                    </div>
                    {result.strengths.length > 3 && (
                        <button onClick={() => setShowAllStrengths(v => !v)} style={{ background: 'none', border: 'none', color: gold, fontSize: 11.5, fontWeight: 600, cursor: 'pointer', padding: 0, textAlign: 'left' }}>
                            {showAllStrengths ? 'Show less' : `View all ${result.strengths.length} strengths`}
                        </button>
                    )}
                </>
            )}
        </div>
    )

    const gapsCard = mode === 'optimizer' ? (
        <div key="gaps" style={cardBase} role="group" aria-label="Skill gaps">
            <div style={cardLabel}>Skill Gaps</div>
            {result.skill_gaps.required.length === 0 && result.skill_gaps.nice_to_have.length === 0 ? (
                <p style={{ fontSize: 12.5, color: textDim, margin: 0 }}>No significant skill gaps found.</p>
            ) : (
                <>
                    {result.skill_gaps.required.length > 0 && (
                        <div>
                            <div style={{ fontSize: 10.5, color: red, fontWeight: 700, marginBottom: 6 }}>Required</div>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                                {result.skill_gaps.required.map(s => <span key={s} style={chip(red)}>{s}</span>)}
                            </div>
                        </div>
                    )}
                    {result.skill_gaps.nice_to_have.length > 0 && (
                        <div>
                            <div style={{ fontSize: 10.5, color: yellow, fontWeight: 700, marginBottom: 6, marginTop: 4 }}>Nice to have</div>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                                {result.skill_gaps.nice_to_have.map(s => <span key={s} style={chip(yellow)}>{s}</span>)}
                            </div>
                        </div>
                    )}
                    <p style={{ fontSize: 11, color: textDim, lineHeight: 1.5, margin: '4px 0 0' }}>Add these only if you genuinely have the experience.</p>
                </>
            )}
        </div>
    ) : null

    const experienceGapsCard = mode === 'optimizer' && result.experience_gaps.length > 0 ? (
        <div key="exp-gaps" style={cardBase} role="group" aria-label="Experience gaps">
            <div style={cardLabel}>Experience Gaps</div>
            {result.experience_gaps.map((g, i) => (
                <p key={i} style={{ fontSize: 12.5, color: 'rgba(255,255,255,.65)', lineHeight: 1.6, margin: 0 }}>{g}</p>
            ))}
        </div>
    ) : null

    const concernsCard = mode === 'screening' ? (
        <div key="concerns" style={cardBase} role="group" aria-label="Concerns">
            <div style={cardLabel}>Concerns</div>
            {[...result.skill_gaps.required, ...result.experience_gaps].length === 0 ? (
                <p style={{ fontSize: 12.5, color: textDim, margin: 0 }}>No significant concerns identified.</p>
            ) : (
                <>
                    {result.skill_gaps.required.map(s => <div key={s} style={{ fontSize: 12.5, color: 'rgba(255,255,255,.65)' }}>• Missing: {s}</div>)}
                    {result.experience_gaps.map((g, i) => <div key={i} style={{ fontSize: 12.5, color: 'rgba(255,255,255,.65)', lineHeight: 1.5 }}>• {g}</div>)}
                </>
            )}
        </div>
    ) : null

    const roleFitCard = mode === 'screening' ? (
        <div key="role-fit" style={cardBase} role="group" aria-label="Role fit">
            <div style={cardLabel}>Role Fit</div>
            <div style={{ ...chip(fitColor(result.fit_level)), display: 'inline-block', fontSize: 14, padding: '7px 16px' }}>{result.fit_level}</div>
            <p style={{ fontSize: 12.5, color: 'rgba(255,255,255,.6)', lineHeight: 1.6, margin: 0 }}>{result.score_explanation}</p>
        </div>
    ) : null

    const recruiterCard = (
        <div key="recruiter" style={cardBase} role="group" aria-label="Recruiter impression">
            <div style={cardLabel}>Recruiter View</div>
            <p style={{ fontSize: 12.5, color: 'rgba(255,255,255,.65)', lineHeight: 1.65, margin: 0 }}>{result.recruiter_impression}</p>
        </div>
    )

    const atsCard = mode === 'screening' ? (
        <div key="ats" style={cardBase} role="group" aria-label="ATS signals">
            <div style={cardLabel}>ATS Signals</div>
            {result.ats_signals.length === 0 ? (
                <p style={{ fontSize: 12.5, color: textDim, margin: 0 }}>Not enough information.</p>
            ) : result.ats_signals.map(sig => (
                <div key={sig.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
                    <span style={{ fontSize: 12, color: 'rgba(255,255,255,.6)' }}>{sig.label}</span>
                    <span style={{ fontSize: 11, fontWeight: 700, color: statusColor(sig.status) }}>{sig.status}</span>
                </div>
            ))}
        </div>
    ) : null

    const readinessCard = (
        <div key="readiness" style={cardBase} role="group" aria-label="Interview readiness">
            <div style={cardLabel}>Interview Readiness</div>
            <div style={{ ...chip(readinessColor(result.interview_readiness)), display: 'inline-block', fontSize: 13, padding: '6px 14px' }}>{result.interview_readiness}</div>
            <p style={{ fontSize: 12.5, color: 'rgba(255,255,255,.6)', lineHeight: 1.6, margin: 0 }}>{result.interview_readiness_reason}</p>
            {result.focus_areas.length > 0 && (
                <div>
                    <div style={{ fontSize: 10.5, color: textDim, fontWeight: 700, marginBottom: 6 }}>Focus areas</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                        {result.focus_areas.map(f => <span key={f} style={chip(gold)}>{f}</span>)}
                    </div>
                </div>
            )}
            <button onClick={onPracticeTopics} style={{ marginTop: 4, background: gold, color: '#0a0a08', fontWeight: 700, fontSize: 12, padding: '9px 14px', borderRadius: 8, border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>
                {mode === 'optimizer' ? 'Practice These Topics' : 'Start Interview Practice'}
            </button>
        </div>
    )

    const nextActionCard = (
        <div key="next" style={cardBase} role="group" aria-label="Next best action">
            <div style={cardLabel}>Next Best Action</div>
            {result.next_actions.length === 0 ? (
                <p style={{ fontSize: 12.5, color: textDim, margin: 0 }}>Not enough information.</p>
            ) : (
                <ol style={{ margin: 0, paddingLeft: 18 }}>
                    {result.next_actions.map((a, i) => <li key={i} style={{ fontSize: 12.5, color: 'rgba(255,255,255,.7)', lineHeight: 1.6, marginBottom: 4 }}>{a}</li>)}
                </ol>
            )}
            <button onClick={() => onImproveCv()} style={{ marginTop: 4, background: 'transparent', border: `1px solid ${gold}`, color: gold, fontWeight: 700, fontSize: 12, padding: '9px 14px', borderRadius: 8, cursor: 'pointer', fontFamily: 'inherit' }}>
                Improve My CV
            </button>
        </div>
    )

    const cards = mode === 'optimizer'
        ? [scoreCard, strengthsCard, gapsCard, experienceGapsCard, recruiterCard, readinessCard, nextActionCard]
        : [scoreCard, strengthsCard, concernsCard, roleFitCard, atsCard, recruiterCard, readinessCard, nextActionCard]

    return (
        <div className="intelligence-carousel">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                <div />
                <div style={{ display: 'flex', gap: 6 }} className="carousel-nav">
                    <button onClick={() => scroll(-1)} aria-label="Previous card" style={{ width: 30, height: 30, borderRadius: 8, border: `1px solid ${border}`, background: 'transparent', color: textDim, cursor: 'pointer' }}>‹</button>
                    <button onClick={() => scroll(1)} aria-label="Next card" style={{ width: 30, height: 30, borderRadius: 8, border: `1px solid ${border}`, background: 'transparent', color: textDim, cursor: 'pointer' }}>›</button>
                </div>
            </div>
            <div ref={trackRef} className="intelligence-track" style={{ display: 'flex', gap: 14, overflowX: 'auto', paddingBottom: 8, scrollSnapType: 'x mandatory' }}>
                {cards.filter(Boolean).map(c => c && (
                    <div key={(c as any).key} style={{ scrollSnapAlign: 'start' }}>{c}</div>
                ))}
            </div>
        </div>
    )
}