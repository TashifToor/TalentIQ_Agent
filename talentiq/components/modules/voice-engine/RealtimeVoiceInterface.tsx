'use client'
import { useEffect, useRef, useState } from 'react'
import { GlassCard, GradientBadge } from '@/components/shared/primitives'
import { VoiceState } from './stateMachine'
import { RealtimeVoiceClient } from './realtimeClient'
import { API_BASE_URL } from '@/lib/api'
import { useTheme } from '@/lib/theme-provider'

export interface RealtimeVoiceInterfaceProps {
    wsPath: string          // e.g. `/practice/sessions/${id}/voice/ws` or `/interview/public/${slug}/${sessionId}/voice/ws`
    authToken: string | null // JWT for practice sessions; null for anonymous public-interview candidates
    initialQuestion?: string
    interviewerName?: string
    onCompleted: (reportReady: boolean) => void
    onFallback: () => void  // parent should swap in the existing push-to-talk component
}

interface Turn { question: string; answer: string | null }

const STATE_META: Record<VoiceState, { label: string; sub: string; tone: 'gold' | 'purple' | 'teal' | 'neutral' }> = {
    ai_speaking: { label: 'AI SPEAKING', sub: 'Speak anytime to interrupt', tone: 'gold' },
    listening: { label: 'YOUR TURN', sub: 'Start speaking when you\u2019re ready', tone: 'purple' },
    candidate_speaking: { label: 'LISTENING', sub: 'Keep going — pause when you\u2019re done', tone: 'purple' },
    thinking: { label: 'THINKING', sub: 'AI is considering your response...', tone: 'neutral' },
    reconnecting: { label: 'RECONNECTING', sub: 'Restoring the connection...', tone: 'neutral' },
    completed: { label: 'COMPLETE', sub: 'Interview finished', tone: 'teal' },
}

function WaveBars({ active, color }: { active: boolean; color: string }) {
    const heights = [10, 18, 13, 22, 9, 19, 14]
    return (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 3, height: 24 }}>
            {heights.map((h, i) => (
                <div key={i} className={active ? 'wave-bar' : ''} style={{
                    width: 3, height: active ? h : 4, borderRadius: 2, background: color,
                    animationDelay: `${i * 0.07}s`, transition: 'height .25s var(--ease)', opacity: active ? 1 : .35,
                }} />
            ))}
        </div>
    )
}

export default function RealtimeVoiceInterface({ wsPath, authToken, initialQuestion, interviewerName, onCompleted, onFallback }: RealtimeVoiceInterfaceProps) {
    const { theme } = useTheme()
    const light = theme === 'light'
    const [voiceState, setVoiceState] = useState<VoiceState>('ai_speaking')
    const [currentQuestion, setCurrentQuestion] = useState(initialQuestion || '')
    const [partialAnswer, setPartialAnswer] = useState('')
    const [history, setHistory] = useState<Turn[]>([])
    const [muted, setMuted] = useState(false)
    const [error, setError] = useState('')
    const clientRef = useRef<RealtimeVoiceClient | null>(null)
    const scrollRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        const proto = API_BASE_URL.startsWith('https') ? 'wss' : 'ws'
        const wsUrl = `${proto}://${API_BASE_URL.replace(/^https?:\/\//, '')}${wsPath}`

        const client = new RealtimeVoiceClient(wsUrl, authToken, {
            onState: setVoiceState,
            onTranscriptPartial: text => setPartialAnswer(text),
            onTranscriptFinal: text => {
                setHistory(h => {
                    const next = [...h]
                    if (next.length > 0 && next[next.length - 1].answer == null) next[next.length - 1] = { ...next[next.length - 1], answer: text }
                    return next
                })
                setPartialAnswer('')
            },
            onAiTextDelta: () => { },
            onAiQuestion: text => {
                setCurrentQuestion(prev => {
                    if (prev) setHistory(h => [...h, { question: prev, answer: null }])
                    return text
                })
            },
            onCompleted: reportReady => onCompleted(reportReady),
            onError: detail => setError(detail),
            onFallback: () => onFallback(),
        })
        clientRef.current = client
        client.connect()

        return () => client.disconnect()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [wsPath])

    useEffect(() => { scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' }) }, [history, partialAnswer])

    const toggleMute = () => {
        const next = !muted
        clientRef.current?.setMuted(next)
        setMuted(next)
    }

    const meta = STATE_META[voiceState]
    const isAiSpeaking = voiceState === 'ai_speaking'
    const isCandidateSpeaking = voiceState === 'candidate_speaking'
    const isThinking = voiceState === 'thinking'
    const isReconnecting = voiceState === 'reconnecting'
    const turnNumber = history.length + 1

    return (
        <div style={{ maxWidth: 680, margin: '0 auto' }}>
            {/* Header — connection + progress, minimal */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <GradientBadge label={isReconnecting ? 'Reconnecting' : 'Connected'} tone={isReconnecting ? 'neutral' : 'teal'} icon={isReconnecting ? '⏳' : '●'} />
                <div style={{ fontSize: 11, color: (light ? 'var(--dash-text-faint)' : 'rgba(255,255,255,.35)'), fontWeight: 600 }}>Turn {turnNumber}</div>
            </div>

            {/* AI Interviewer presence — the primary surface */}
            <GlassCard style={{ marginBottom: 14, padding: 24, textAlign: 'center', border: isAiSpeaking ? '1.5px solid rgba(226,176,74,.35)' : '1px solid rgba(255,255,255,.08)' }}>
                <div className={isAiSpeaking ? 'voice-pulse' : ''} style={{
                    width: 88, height: 88, borderRadius: '50%', margin: '0 auto 14px', display: 'grid', placeItems: 'center',
                    background: isAiSpeaking ? 'linear-gradient(135deg,#e2b04a,#c5931f)' : 'linear-gradient(135deg,#3a3a36,#232320)',
                    transition: 'background .3s',
                }}>
                    <span style={{ fontSize: 32 }}>🎙</span>
                </div>
                <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '.08em', color: '#e2b04a', marginBottom: 6 }}>
                    AI INTERVIEWER{interviewerName ? ` · ${interviewerName}` : ''}
                </div>
                <WaveBars active={isAiSpeaking} color="#e2b04a" />
                <div style={{ fontSize: 16, lineHeight: 1.6, color: (light ? 'var(--dash-text)' : '#fff'), fontWeight: 600, marginTop: 14, minHeight: 26 }}>
                    {currentQuestion || 'Connecting to your interviewer...'}
                </div>
            </GlassCard>

            {/* Candidate turn — secondary surface, live partial transcript */}
            <GlassCard style={{ marginBottom: 14, padding: '18px 24px', border: isCandidateSpeaking ? '1.5px solid rgba(167,139,250,.35)' : '1px solid rgba(255,255,255,.08)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                    <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '.08em', color: '#a78bfa' }}>YOU</div>
                    <GradientBadge label={meta.label} tone={meta.tone} />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                    <div style={{ flexShrink: 0 }}><WaveBars active={isCandidateSpeaking} color="#a78bfa" /></div>
                    <div style={{ flex: 1, fontSize: 13.5, lineHeight: 1.6, color: partialAnswer ? (light ? 'var(--dash-text)' : 'rgba(255,255,255,.85)') : (light ? 'var(--dash-text-faint)' : 'rgba(255,255,255,.3)'), fontStyle: partialAnswer ? 'normal' : 'italic', minHeight: 22 }}>
                        {partialAnswer || meta.sub}
                    </div>
                </div>
            </GlassCard>

            {/* Conversation history — scrollable, secondary, previous turns only */}
            {history.length > 0 && (
                <GlassCard style={{ marginBottom: 14, padding: 0, overflow: 'hidden' }}>
                    <div ref={scrollRef} style={{ maxHeight: 180, overflowY: 'auto', padding: 16 }}>
                        {history.map((t, i) => (
                            <div key={i} style={{ marginBottom: i < history.length - 1 ? 14 : 0 }}>
                                <div style={{ display: 'flex', gap: 8, marginBottom: 6 }}>
                                    <span style={{ fontSize: 9.5, fontWeight: 800, color: '#e2b04a', letterSpacing: '.05em' }}>AI</span>
                                    <span style={{ fontSize: 12, color: (light ? 'var(--dash-text-muted)' : 'rgba(255,255,255,.55)'), lineHeight: 1.5 }}>{t.question}</span>
                                </div>
                                {t.answer && (
                                    <div style={{ display: 'flex', gap: 8 }}>
                                        <span style={{ fontSize: 9.5, fontWeight: 800, color: '#a78bfa', letterSpacing: '.05em' }}>YOU</span>
                                        <span style={{ fontSize: 12, color: (light ? 'var(--dash-text-muted)' : 'rgba(255,255,255,.45)'), lineHeight: 1.5 }}>{t.answer}</span>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </GlassCard>
            )}

            {/* Minimal controls — mute is the only manual action available */}
            <div style={{ display: 'flex', justifyContent: 'center', gap: 10 }}>
                <button onClick={toggleMute} style={{
                    display: 'flex', alignItems: 'center', gap: 7, padding: '9px 18px', borderRadius: 100, cursor: 'pointer',
                    border: `1px solid ${muted ? 'rgba(239,68,68,.4)' : (light ? 'var(--dash-border-soft)' : 'rgba(255,255,255,.1)')}`,
                    background: muted ? 'rgba(239,68,68,.1)' : (light ? 'var(--dash-overlay-035)' : 'rgba(255,255,255,.04)'),
                    color: muted ? '#f87171' : (light ? 'var(--dash-text-muted)' : 'rgba(255,255,255,.55)'), fontSize: 12, fontWeight: 700, fontFamily: 'Inter,sans-serif',
                }}>
                    {muted ? '🔇 Muted — tap to unmute' : '🎙 Mic on — tap to mute'}
                </button>
                <button onClick={onFallback} style={{
                    padding: '9px 18px', borderRadius: 100, cursor: 'pointer', border: '1px solid rgba(255,255,255,.1)',
                    background: (light ? 'var(--dash-overlay-035)' : 'rgba(255,255,255,.04)'), color: (light ? 'var(--dash-text-muted)' : 'rgba(255,255,255,.4)'), fontSize: 12, fontWeight: 700, fontFamily: 'Inter,sans-serif',
                }}>
                    Switch to text/push-to-talk
                </button>
            </div>

            {error && <div style={{ fontSize: 12, color: '#ef4444', textAlign: 'center', marginTop: 14 }}>{error}</div>}
        </div>
    )
}