'use client'
import { useState, useRef, useEffect } from 'react'
import { GlassCard, AnimatedButton, FeatureCard } from '@/components/shared/primitives'
import { getModeDefinition, InterviewMode } from './modeData'

interface ReadinessScreenProps {
    mode: InterviewMode
    title: string                 // role/posting title
    company?: string
    interviewerName?: string
    candidateName?: string        // optional — only shown if the caller actually has it
    questionCount?: number         // mcq only
    evaluationAreas?: string[]     // what will be evaluated — generic, no correct answers/rubric
    onStart: () => void | Promise<void>
    starting?: boolean
    startError?: string
}

type CheckStatus = 'idle' | 'checking' | 'ok' | 'failed'

const MODE_COPY: Record<InterviewMode, { subtext: string; startLabel: string }> = {
    mcq: {
        subtext: 'Please review the instructions carefully before starting your assessment.',
        startLabel: 'Start Assessment',
    },
    chatbot: {
        subtext: 'Take a moment to understand how your AI interview will work before you begin.',
        startLabel: 'Start Interview',
    },
    voice_agent: {
        subtext: "Make sure you're ready for a real-time voice conversation before starting your interview.",
        startLabel: 'Start Voice Interview',
    },
}

// Every line here maps to something this app genuinely does — nothing is
// listed unless the corresponding backend/frontend behavior actually exists.
const RULES: Record<InterviewMode, string[]> = {
    mcq: [
        'Once you start, the per-question timer begins immediately and cannot be paused.',
        'Switching tabs or leaving this page will end your assessment immediately.',
        'This assessment is proctored — periodic camera snapshots are taken while it runs.',
        'Complete the assessment in one sitting.',
    ],
    chatbot: [
        'Read each question carefully before responding.',
        'The interview adapts its follow-up questions based on what you say.',
        'Answer naturally and honestly, in your own words.',
        'Avoid refreshing or closing the page — you may lose your progress.',
    ],
    voice_agent: [
        'This is a real-time spoken conversation, not a script.',
        "You can interrupt and speak naturally — no need to wait for a beep.",
        'The interview adapts its follow-up questions based on what you say.',
        'Avoid refreshing or closing the page — you may lose your progress.',
    ],
}

const EXPECT: Record<InterviewMode, { icon: string; label: string }[]> = {
    mcq: [
        { icon: '▸', label: 'Multiple choice questions' },
        { icon: '◆', label: 'Skill evaluation' },
        { icon: '◷', label: 'Timed, per-question' },
    ],
    chatbot: [
        { icon: '▸', label: 'AI recruiter conversation' },
        { icon: '◆', label: 'Adaptive follow-up questions' },
        { icon: '✎', label: 'Written responses' },
    ],
    voice_agent: [
        { icon: '▸', label: 'Real-time voice conversation' },
        { icon: '◆', label: 'Adaptive follow-up questions' },
        { icon: '◷', label: 'Conversational evaluation' },
    ],
}

function CheckRow({
    label, status, error, onAction, actionLabel, level,
}: { label: string; status: CheckStatus; error?: string; onAction?: () => void; actionLabel?: string; level?: number }) {
    const statusColor = status === 'ok' ? '#13c28e' : status === 'failed' ? '#f87171' : 'rgba(255,255,255,.35)'
    const statusText = status === 'ok' ? 'Ready' : status === 'failed' ? 'Needs attention' : status === 'checking' ? 'Checking…' : 'Not checked'
    return (
        <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
                <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#fff' }}>{label}</div>
                    <div style={{ fontSize: 11, marginTop: 2, color: status === 'failed' ? '#f87171' : 'rgba(255,255,255,.4)' }}>
                        {status === 'failed' && error ? error : statusText}
                    </div>
                </div>
                {onAction && status !== 'checking' && (
                    <button onClick={onAction} style={{
                        padding: '7px 14px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 11.5, fontWeight: 700,
                        fontFamily: 'Inter,sans-serif', flexShrink: 0, minHeight: 32,
                        background: status === 'ok' ? 'rgba(19,194,142,.15)' : status === 'failed' ? 'rgba(248,113,113,.15)' : '#a78bfa',
                        color: status === 'ok' ? '#13c28e' : status === 'failed' ? '#f87171' : '#0a0a08',
                    }}>{status === 'ok' ? '✓ Ready' : status === 'failed' ? 'Retry' : (actionLabel || 'Check')}</button>
                )}
                {!onAction && (
                    <span style={{ fontSize: 11.5, fontWeight: 700, color: statusColor, flexShrink: 0 }}>
                        {status === 'ok' ? '✓ Ready' : status === 'failed' ? 'Unavailable' : statusText}
                    </span>
                )}
            </div>
            {typeof level === 'number' && status === 'checking' && (
                <div style={{ height: 5, background: 'rgba(255,255,255,.06)', borderRadius: 100, overflow: 'hidden', marginTop: 8 }}>
                    <div style={{ height: '100%', width: `${level * 100}%`, background: 'linear-gradient(90deg,#7c3aed,#a78bfa)', transition: 'width .1s' }} />
                </div>
            )}
        </div>
    )
}

export default function ReadinessScreen({
    mode, title, company, interviewerName, candidateName, questionCount, evaluationAreas, onStart, starting, startError,
}: ReadinessScreenProps) {
    const m = getModeDefinition(mode)
    const copy = MODE_COPY[mode]
    const needsMic = mode === 'voice_agent'
    const needsCamera = mode === 'mcq'

    const [micStatus, setMicStatus] = useState<CheckStatus>('idle')
    const [micLevel, setMicLevel] = useState(0)
    const [micError, setMicError] = useState('')
    const [camStatus, setCamStatus] = useState<CheckStatus>('idle')
    const [camError, setCamError] = useState('')
    const [speakerStatus, setSpeakerStatus] = useState<CheckStatus>('idle')
    const [connStatus, setConnStatus] = useState<CheckStatus>(typeof navigator !== 'undefined' && navigator.onLine ? 'ok' : 'failed')
    const [confirmed, setConfirmed] = useState(false)
    const testingRef = useRef(false)

    // Connection — a genuinely real signal (navigator.onLine), not a fake
    // spinner-then-checkmark. Updates live if connectivity actually changes.
    useEffect(() => {
        if (!needsMic) return
        const goOnline = () => setConnStatus('ok')
        const goOffline = () => setConnStatus('failed')
        window.addEventListener('online', goOnline)
        window.addEventListener('offline', goOffline)
        return () => { window.removeEventListener('online', goOnline); window.removeEventListener('offline', goOffline) }
    }, [needsMic])

    const testMic = async () => {
        if (testingRef.current) return
        testingRef.current = true
        setMicStatus('checking')
        setMicError('')
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
            const ctx = new AudioContext()
            const source = ctx.createMediaStreamSource(stream)
            const analyser = ctx.createAnalyser()
            analyser.fftSize = 512
            source.connect(analyser)
            const data = new Uint8Array(analyser.frequencyBinCount)

            const start = Date.now()
            let peak = 0
            const sample = () => {
                analyser.getByteTimeDomainData(data)
                let sum = 0
                for (let i = 0; i < data.length; i++) { const v = (data[i] - 128) / 128; sum += v * v }
                peak = Math.max(peak, Math.sqrt(sum / data.length))
                setMicLevel(Math.min(1, peak * 4))
                if (Date.now() - start < 1800) requestAnimationFrame(sample)
                else {
                    stream.getTracks().forEach(t => t.stop())
                    ctx.close().catch(() => { })
                    setMicStatus('ok')
                    testingRef.current = false
                }
            }
            sample()
        } catch {
            setMicError('Microphone access denied or unavailable — check your browser permissions.')
            setMicStatus('failed')
            testingRef.current = false
        }
    }

    const testCamera = async () => {
        setCamStatus('checking')
        setCamError('')
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: true })
            stream.getTracks().forEach(t => t.stop())
            setCamStatus('ok')
        } catch {
            setCamError('Camera access denied or unavailable — check your browser permissions.')
            setCamStatus('failed')
        }
    }

    // Speaker output genuinely can't be auto-verified (no API tells us sound
    // was heard) — plays a real short tone and asks the candidate to
    // self-confirm, rather than faking a pass.
    const testSpeaker = async () => {
        setSpeakerStatus('checking')
        try {
            const ctx = new (window.AudioContext || (window as any).webkitAudioContext)()
            const osc = ctx.createOscillator()
            const gain = ctx.createGain()
            osc.frequency.value = 440
            gain.gain.setValueAtTime(0.001, ctx.currentTime)
            gain.gain.linearRampToValueAtTime(0.15, ctx.currentTime + 0.05)
            gain.gain.linearRampToValueAtTime(0.001, ctx.currentTime + 0.5)
            osc.connect(gain).connect(ctx.destination)
            osc.start()
            osc.stop(ctx.currentTime + 0.5)
            setTimeout(() => { ctx.close().catch(() => { }) }, 700)
        } catch {
            // if it fails to play at all, leave status as-is — the confirm
            // button below still lets the candidate decide
        }
        setSpeakerStatus(s => (s === 'checking' ? 'idle' : s))
    }

    const canStart = confirmed
        && (!needsMic || micStatus === 'ok')
        && (!needsCamera || camStatus === 'ok')
        && (!needsMic || speakerStatus === 'ok')
    const browserSupported = typeof window !== 'undefined' && !!navigator.mediaDevices && (!needsMic || 'AudioContext' in window || 'webkitAudioContext' in window)

    return (
        <div className="wizard-step-in readiness-screen" style={{ maxWidth: 600, margin: '0 auto', padding: '0 4px' }}>
            {/* Header */}
            <div style={{ textAlign: 'center', marginBottom: 22 }}>
                <div style={{ width: 48, height: 48, borderRadius: 14, margin: '0 auto 14px', display: 'grid', placeItems: 'center', fontSize: 22, background: `${m.accent}18` }}>{m.icon}</div>
                <h1 style={{ fontFamily: 'Inter, sans-serif', fontSize: 'clamp(22px,4vw,26px)', fontWeight: 700, color: '#fff', margin: 0 }}>Before You Begin</h1>
                <p style={{ fontSize: 13, color: 'rgba(255,255,255,.5)', marginTop: 8, lineHeight: 1.6, maxWidth: 440, marginLeft: 'auto', marginRight: 'auto' }}>{copy.subtext}</p>
            </div>

            {/* Interview info card */}
            <GlassCard style={{ marginBottom: 14 }}>
                <div style={{ marginBottom: 12 }}>
                    <div style={{ fontSize: 15, fontWeight: 700, color: '#fff' }}>{title}</div>
                    {company && <div style={{ fontSize: 12, color: 'rgba(255,255,255,.4)', marginTop: 2 }}>{company}</div>}
                    {candidateName && <div style={{ fontSize: 11.5, color: 'rgba(255,255,255,.35)', marginTop: 4 }}>Candidate: {candidateName}</div>}
                </div>
                <div className="responsive-grid-3" style={{ display: 'grid', gridTemplateColumns: `repeat(${questionCount ? 3 : 2}, 1fr)`, gap: 10, paddingTop: 12, borderTop: '1px solid rgba(255,255,255,.06)' }}>
                    <div>
                        <div style={{ fontSize: 9.5, color: 'rgba(255,255,255,.3)', fontWeight: 700, textTransform: 'uppercase' }}>Type</div>
                        <div style={{ fontSize: 12.5, color: '#fff', fontWeight: 600, marginTop: 3 }}>{m.title}</div>
                    </div>
                    <div>
                        <div style={{ fontSize: 9.5, color: 'rgba(255,255,255,.3)', fontWeight: 700, textTransform: 'uppercase' }}>Duration</div>
                        <div style={{ fontSize: 12.5, color: '#fff', fontWeight: 600, marginTop: 3 }}>~{m.duration}</div>
                    </div>
                    {questionCount != null && (
                        <div>
                            <div style={{ fontSize: 9.5, color: 'rgba(255,255,255,.3)', fontWeight: 700, textTransform: 'uppercase' }}>Questions</div>
                            <div style={{ fontSize: 12.5, color: '#fff', fontWeight: 600, marginTop: 3 }}>{questionCount}</div>
                        </div>
                    )}
                </div>
                {interviewerName && mode !== 'mcq' && (
                    <div style={{ fontSize: 11.5, color: 'rgba(255,255,255,.4)', marginTop: 10 }}>Your interviewer: <strong style={{ color: 'rgba(255,255,255,.7)' }}>{interviewerName}</strong></div>
                )}
            </GlassCard>

            {/* What to expect */}
            <GlassCard style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,.4)', textTransform: 'uppercase', marginBottom: 10 }}>What to expect</div>
                <div className="responsive-grid-3" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                    {EXPECT[mode].map(e => (
                        <div key={e.label} style={{ padding: '10px 10px', borderRadius: 10, background: 'rgba(255,255,255,.03)', border: '1px solid rgba(255,255,255,.06)', textAlign: 'center' }}>
                            <div style={{ fontSize: 15, color: m.accent, marginBottom: 4 }} aria-hidden="true">{e.icon}</div>
                            <div style={{ fontSize: 11, color: 'rgba(255,255,255,.65)', lineHeight: 1.35 }}>{e.label}</div>
                        </div>
                    ))}
                </div>
                {evaluationAreas && evaluationAreas.length > 0 && (
                    <div style={{ marginTop: 14, paddingTop: 12, borderTop: '1px solid rgba(255,255,255,.06)' }}>
                        <div style={{ fontSize: 9.5, color: 'rgba(255,255,255,.3)', fontWeight: 700, textTransform: 'uppercase', marginBottom: 6 }}>What's evaluated</div>
                        {evaluationAreas.map(a => <FeatureCard key={a} icon="○" label={a} />)}
                    </div>
                )}
            </GlassCard>

            {/* Instructions & rules — mode-filtered, nothing listed unless it's real */}
            <GlassCard style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,.4)', textTransform: 'uppercase', marginBottom: 10 }}>Instructions &amp; rules</div>
                <ul style={{ margin: 0, padding: 0, listStyle: 'none' }}>
                    {RULES[mode].map((r, i) => (
                        <li key={i} style={{ display: 'flex', gap: 8, fontSize: 12.5, color: 'rgba(255,255,255,.55)', lineHeight: 1.6, marginBottom: i < RULES[mode].length - 1 ? 8 : 0 }}>
                            <span style={{ color: m.accent, flexShrink: 0 }} aria-hidden="true">•</span>
                            <span>{r}</span>
                        </li>
                    ))}
                </ul>
            </GlassCard>

            {!browserSupported && (
                <GlassCard style={{ marginBottom: 14, border: '1px solid rgba(239,68,68,.3)' }}>
                    <div style={{ fontSize: 12.5, color: '#f87171' }}>Your browser doesn't support the required audio APIs for this interview mode. Try the latest Chrome, Edge, or Safari.</div>
                </GlassCard>
            )}

            {/* Device readiness — voice: mic + speaker + connection; assessment: camera */}
            {needsMic && (
                <GlassCard style={{ marginBottom: 14 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,.4)', textTransform: 'uppercase', marginBottom: 12 }}>Device check</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                        <CheckRow label="Microphone" status={micStatus} error={micError} onAction={testMic} actionLabel="Test Mic" level={micStatus === 'checking' ? micLevel : undefined} />
                        <div>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', marginBottom: 8 }}>
                                <div>
                                    <div style={{ fontSize: 13, fontWeight: 700, color: '#fff' }}>Speaker</div>
                                    <div style={{ fontSize: 11, marginTop: 2, color: 'rgba(255,255,255,.4)' }}>
                                        {speakerStatus === 'ok' ? 'Confirmed by you' : 'Play a test sound, then confirm you heard it'}
                                    </div>
                                </div>
                                {speakerStatus === 'ok' && <span style={{ fontSize: 11.5, fontWeight: 700, color: '#13c28e', flexShrink: 0 }}>✓ Ready</span>}
                            </div>
                            {speakerStatus !== 'ok' && (
                                <div style={{ display: 'flex', gap: 8 }}>
                                    <button onClick={testSpeaker} style={{ padding: '7px 14px', borderRadius: 8, border: '1px solid rgba(255,255,255,.12)', background: 'transparent', color: 'rgba(255,255,255,.7)', fontSize: 11.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'Inter,sans-serif', minHeight: 32 }}>▸ Play Test Sound</button>
                                    <button onClick={() => setSpeakerStatus('ok')} style={{ padding: '7px 14px', borderRadius: 8, border: 'none', background: '#a78bfa', color: '#0a0a08', fontSize: 11.5, fontWeight: 700, cursor: 'pointer', fontFamily: 'Inter,sans-serif', minHeight: 32 }}>I heard it</button>
                                </div>
                            )}
                        </div>
                        <CheckRow label="Connection" status={connStatus} />
                    </div>
                </GlassCard>
            )}

            {needsCamera && (
                <GlassCard style={{ marginBottom: 14 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,.4)', textTransform: 'uppercase', marginBottom: 12 }}>Device check</div>
                    <CheckRow label="Camera" status={camStatus} error={camError} onAction={testCamera} actionLabel="Test Camera" />
                </GlassCard>
            )}

            {/* Confirmation */}
            <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 16, cursor: 'pointer', padding: '2px 2px' }}>
                <input
                    type="checkbox"
                    checked={confirmed}
                    onChange={e => setConfirmed(e.target.checked)}
                    style={{ width: 18, height: 18, marginTop: 1, flexShrink: 0, accentColor: m.accent, cursor: 'pointer' }}
                />
                <span style={{ fontSize: 12.5, color: 'rgba(255,255,255,.6)', lineHeight: 1.5 }}>
                    I have read and understood the instructions and I'm ready to begin.
                </span>
            </label>

            {startError && <div style={{ fontSize: 12, color: '#ef4444', textAlign: 'center', marginBottom: 12 }}>{startError}</div>}

            <AnimatedButton onClick={onStart} disabled={!canStart || !browserSupported} loading={!!starting} fullWidth>
                {starting ? 'Starting…' : `${copy.startLabel} →`}
            </AnimatedButton>
            {!canStart && !starting && (
                <div style={{ fontSize: 10.5, color: 'rgba(255,255,255,.3)', textAlign: 'center', marginTop: 8 }}>
                    {!confirmed ? 'Check the box above to continue' : 'Complete the device checks above to continue'}
                </div>
            )}
        </div>
    )
}