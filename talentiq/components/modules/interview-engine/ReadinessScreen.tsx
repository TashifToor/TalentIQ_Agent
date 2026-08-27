'use client'
import { useState, useRef } from 'react'
import { GlassCard, AnimatedButton, GradientBadge, FeatureCard } from '@/components/shared/primitives'
import { getModeDefinition, InterviewMode } from './modeData'

interface ReadinessScreenProps {
    mode: InterviewMode
    title: string                 // role/posting title
    company?: string
    interviewerName?: string
    questionCount?: number         // mcq only
    evaluationAreas?: string[]     // what will be evaluated — generic, no correct answers/rubric
    onStart: () => void | Promise<void>
    starting?: boolean
    startError?: string
}

type CheckStatus = 'idle' | 'checking' | 'ok' | 'failed'

export default function ReadinessScreen({
    mode, title, company, interviewerName, questionCount, evaluationAreas, onStart, starting, startError,
}: ReadinessScreenProps) {
    const m = getModeDefinition(mode)
    const needsMic = mode === 'voice_agent'
    const needsCamera = mode === 'mcq'

    const [micStatus, setMicStatus] = useState<CheckStatus>('idle')
    const [micLevel, setMicLevel] = useState(0)
    const [camStatus, setCamStatus] = useState<CheckStatus>('idle')
    const [micError, setMicError] = useState('')
    const [camError, setCamError] = useState('')
    const testingRef = useRef(false)

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

    const canStart = (!needsMic || micStatus === 'ok') && (!needsCamera || camStatus === 'ok')
    const browserSupported = typeof window !== 'undefined' && !!navigator.mediaDevices && (!needsMic || 'AudioContext' in window || 'webkitAudioContext' in window)

    return (
        <div className="wizard-step-in" style={{ maxWidth: 560, margin: '0 auto' }}>
            <div style={{ textAlign: 'center', marginBottom: 20 }}>
                <div style={{ width: 48, height: 48, borderRadius: 14, margin: '0 auto 12px', display: 'grid', placeItems: 'center', fontSize: 22, background: `${m.accent}18` }}>{m.icon}</div>
                <div style={{ fontFamily: "Inter, sans-serif", fontSize: 24, fontWeight: 600, color: '#fff' }}>Ready to begin</div>
                <div style={{ fontSize: 12.5, color: 'rgba(255,255,255,.4)', marginTop: 4 }}>{title}{company ? ` · ${company}` : ''}</div>
            </div>

            <GlassCard style={{ marginBottom: 14 }}>
                <div style={{ display: 'grid', gridTemplateColumns: `repeat(${questionCount ? 3 : 2}, 1fr)`, gap: 10, marginBottom: evaluationAreas?.length ? 16 : 0 }}>
                    <div>
                        <div style={{ fontSize: 9.5, color: 'rgba(255,255,255,.3)', fontWeight: 700, textTransform: 'uppercase' }}>Type</div>
                        <div style={{ fontSize: 12.5, color: '#fff', fontWeight: 600, marginTop: 3 }}>{m.title}</div>
                    </div>
                    <div>
                        <div style={{ fontSize: 9.5, color: 'rgba(255,255,255,.3)', fontWeight: 700, textTransform: 'uppercase' }}>Duration</div>
                        <div style={{ fontSize: 12.5, color: '#fff', fontWeight: 600, marginTop: 3 }}>{m.duration}</div>
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
                {evaluationAreas && evaluationAreas.length > 0 && (
                    <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid rgba(255,255,255,.06)' }}>
                        <div style={{ fontSize: 9.5, color: 'rgba(255,255,255,.3)', fontWeight: 700, textTransform: 'uppercase', marginBottom: 6 }}>What's evaluated</div>
                        {evaluationAreas.map(a => <FeatureCard key={a} icon="◆" label={a} />)}
                    </div>
                )}
            </GlassCard>

            {!browserSupported && (
                <GlassCard style={{ marginBottom: 14, border: '1px solid rgba(239,68,68,.3)' }}>
                    <div style={{ fontSize: 12.5, color: '#f87171' }}>Your browser doesn't support the required audio APIs for this interview mode. Try the latest Chrome, Edge, or Safari.</div>
                </GlassCard>
            )}

            {needsMic && (
                <GlassCard style={{ marginBottom: 14 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: micStatus === 'checking' ? 10 : 0 }}>
                        <div>
                            <div style={{ fontSize: 13, fontWeight: 700, color: '#fff' }}>🎙 Microphone check</div>
                            <div style={{ fontSize: 11, color: 'rgba(255,255,255,.4)', marginTop: 2 }}>
                                {micStatus === 'ok' ? 'Microphone working — we heard you.' : micStatus === 'failed' ? micError : 'Say something for 2 seconds so we can confirm your mic works.'}
                            </div>
                        </div>
                        {micStatus !== 'checking' && (
                            <button onClick={testMic} style={{
                                padding: '8px 16px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 700, fontFamily: 'Inter,sans-serif',
                                background: micStatus === 'ok' ? 'rgba(19,194,142,.15)' : '#a78bfa', color: micStatus === 'ok' ? '#13c28e' : '#0a0a08',
                            }}>{micStatus === 'ok' ? '✓ Working' : micStatus === 'failed' ? 'Retry' : 'Test Mic'}</button>
                        )}
                    </div>
                    {micStatus === 'checking' && (
                        <div style={{ height: 6, background: 'rgba(255,255,255,.06)', borderRadius: 100, overflow: 'hidden' }}>
                            <div style={{ height: '100%', width: `${micLevel * 100}%`, background: 'linear-gradient(90deg,#7c3aed,#a78bfa)', transition: 'width .1s' }} />
                        </div>
                    )}
                </GlassCard>
            )}

            {needsCamera && (
                <GlassCard style={{ marginBottom: 14 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                            <div style={{ fontSize: 13, fontWeight: 700, color: '#fff' }}>📷 Camera check</div>
                            <div style={{ fontSize: 11, color: 'rgba(255,255,255,.4)', marginTop: 2 }}>
                                {camStatus === 'ok' ? 'Camera detected.' : camStatus === 'failed' ? camError : 'This assessment is proctored — periodic photos are taken during the test.'}
                            </div>
                        </div>
                        <button onClick={testCamera} disabled={camStatus === 'checking'} style={{
                            padding: '8px 16px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 700, fontFamily: 'Inter,sans-serif',
                            background: camStatus === 'ok' ? 'rgba(19,194,142,.15)' : '#13c28e', color: camStatus === 'ok' ? '#13c28e' : '#0a0a08',
                        }}>{camStatus === 'checking' ? '...' : camStatus === 'ok' ? '✓ Working' : camStatus === 'failed' ? 'Retry' : 'Test Camera'}</button>
                    </div>
                </GlassCard>
            )}

            <GlassCard style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,.4)', textTransform: 'uppercase', marginBottom: 8 }}>Before you start</div>
                <div style={{ fontSize: 12, color: 'rgba(255,255,255,.5)', lineHeight: 1.8 }}>
                    • Once started, the timer/turns can't be paused.<br />
                    {mode === 'mcq' && <>• Switching tabs will end the assessment immediately.<br /></>}
                    {mode === 'voice_agent' && <>• Speak clearly — you can interrupt the AI naturally, just start talking.<br /></>}
                    • Find a quiet space with a stable connection.
                </div>
            </GlassCard>

            {startError && <div style={{ fontSize: 12, color: '#ef4444', textAlign: 'center', marginBottom: 12 }}>{startError}</div>}

            <AnimatedButton onClick={onStart} disabled={!canStart || !browserSupported} loading={!!starting} fullWidth>
                {starting ? 'Starting...' : 'Start Interview →'}
            </AnimatedButton>
            {!canStart && (needsMic || needsCamera) && (
                <div style={{ fontSize: 10.5, color: 'rgba(255,255,255,.3)', textAlign: 'center', marginTop: 8 }}>Complete the checks above to continue</div>
            )}
        </div>
    )
}