'use client'
import { useEffect, useRef, useState } from 'react'
import { GlassCard, GradientBadge } from '@/components/shared/primitives'
import { VoiceState, VOICE_STATE_LABEL } from './stateMachine'
import { RealtimeVoiceClient } from './realtimeClient'
import { API_BASE_URL } from '@/lib/api'

export interface RealtimeVoiceInterfaceProps {
  wsPath: string          // e.g. `/practice/sessions/${id}/voice/ws` or `/interview/public/${slug}/${sessionId}/voice/ws`
  authToken: string | null // JWT for practice sessions; null for anonymous public-interview candidates
  initialQuestion?: string
  onCompleted: (reportReady: boolean) => void
  onFallback: () => void  // parent should swap in the existing push-to-talk component
}

const STATE_TONE: Record<VoiceState, 'gold' | 'purple' | 'teal' | 'neutral'> = {
  ai_speaking: 'gold',
  listening: 'neutral',
  candidate_speaking: 'purple',
  thinking: 'neutral',
  reconnecting: 'neutral',
  completed: 'teal',
}

export default function RealtimeVoiceInterface({ wsPath, authToken, initialQuestion, onCompleted, onFallback }: RealtimeVoiceInterfaceProps) {
  const [voiceState, setVoiceState] = useState<VoiceState>('ai_speaking')
  const [currentQuestion, setCurrentQuestion] = useState(initialQuestion || '')
  const [partialAnswer, setPartialAnswer] = useState('')
  const [finalAnswers, setFinalAnswers] = useState<string[]>([])
  const [error, setError] = useState('')
  const clientRef = useRef<RealtimeVoiceClient | null>(null)

  useEffect(() => {
    const proto = API_BASE_URL.startsWith('https') ? 'wss' : 'ws'
    const wsUrl = `${proto}://${API_BASE_URL.replace(/^https?:\/\//, '')}${wsPath}`

    const client = new RealtimeVoiceClient(wsUrl, authToken, {
      onState: setVoiceState,
      onTranscriptPartial: text => setPartialAnswer(text),
      onTranscriptFinal: text => { setFinalAnswers(a => [...a, text]); setPartialAnswer('') },
      onAiTextDelta: () => {},
      onAiQuestion: text => setCurrentQuestion(text),
      onCompleted: reportReady => onCompleted(reportReady),
      onError: detail => setError(detail),
      onFallback: () => onFallback(),
    })
    clientRef.current = client
    client.connect()

    return () => client.disconnect()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wsPath])

  const isAiSpeaking = voiceState === 'ai_speaking'
  const isCandidateSpeaking = voiceState === 'candidate_speaking'
  const isThinking = voiceState === 'thinking'
  const isReconnecting = voiceState === 'reconnecting'

  return (
    <div style={{ maxWidth: 620, margin: '0 auto' }}>
      <div style={{ textAlign: 'center', marginBottom: 14, display: 'flex', justifyContent: 'center', gap: 8 }}>
        <GradientBadge label="Real-time voice" tone="purple" icon="⚡" />
        <GradientBadge label={VOICE_STATE_LABEL[voiceState]} tone={STATE_TONE[voiceState]} />
      </div>

      {/* Primary surface: AI question → candidate answer. Not a transcript log. */}
      <GlassCard style={{ marginBottom: 16, minHeight: 180 }}>
        <div style={{ display: 'flex', gap: 10, marginBottom: currentQuestion ? 18 : 0 }}>
          <div className={isAiSpeaking ? 'voice-pulse' : ''} style={{
            width: 32, height: 32, borderRadius: 10, flexShrink: 0, display: 'grid', placeItems: 'center', fontSize: 15,
            background: 'linear-gradient(135deg,#7c3aed,#a78bfa)',
          }}>🎙</div>
          <div style={{ fontSize: 14.5, lineHeight: 1.6, color: '#fff', fontWeight: 600, paddingTop: 4 }}>
            {currentQuestion || 'Connecting...'}
          </div>
        </div>

        {(isCandidateSpeaking || isThinking || partialAnswer) && (
          <div className="scale-in" style={{ borderTop: '1px solid rgba(255,255,255,.06)', paddingTop: 14, display: 'flex', gap: 10 }}>
            <div style={{ width: 32, height: 32, borderRadius: 10, flexShrink: 0, display: 'grid', placeItems: 'center', fontSize: 13, background: 'rgba(226,176,74,.15)' }}>🗣</div>
            <div style={{ fontSize: 13.5, lineHeight: 1.6, color: partialAnswer ? 'rgba(255,255,255,.7)' : 'rgba(255,255,255,.3)', paddingTop: 5, fontStyle: partialAnswer ? 'normal' : 'italic' }}>
              {partialAnswer || (isThinking ? 'Thinking through your answer...' : 'Listening...')}
            </div>
          </div>
        )}
      </GlassCard>

      <div style={{ textAlign: 'center', marginBottom: 10 }}>
        <div className={isCandidateSpeaking ? 'voice-pulse' : ''} style={{
          width: 56, height: 56, borderRadius: '50%', margin: '0 auto', display: 'grid', placeItems: 'center',
          background: isCandidateSpeaking ? 'linear-gradient(135deg,#a78bfa,#7c3aed)' : isAiSpeaking ? 'linear-gradient(135deg,#e2b04a,#c5931f)' : 'rgba(255,255,255,.06)',
        }}>
          <span style={{ fontSize: 22 }}>{isReconnecting ? '⏳' : isAiSpeaking ? '🔊' : isCandidateSpeaking ? '🎙' : isThinking ? '🧠' : '👂'}</span>
        </div>
        <div style={{ fontSize: 11, color: 'rgba(255,255,255,.35)', marginTop: 8 }}>
          {isAiSpeaking && 'Speak anytime to interrupt'}
          {isCandidateSpeaking && 'Listening — pause when done'}
          {voiceState === 'listening' && 'Waiting for you to speak'}
          {isThinking && 'Processing your answer'}
          {isReconnecting && 'Reconnecting...'}
        </div>
      </div>

      {finalAnswers.length > 0 && (
        <details style={{ marginTop: 12 }}>
          <summary style={{ fontSize: 11, color: 'rgba(255,255,255,.3)', cursor: 'pointer' }}>Transcript so far ({finalAnswers.length} answers)</summary>
          <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
            {finalAnswers.map((a, i) => <div key={i} style={{ fontSize: 11.5, color: 'rgba(255,255,255,.4)' }}>{i + 1}. {a}</div>)}
          </div>
        </details>
      )}

      {error && <div style={{ fontSize: 12, color: '#ef4444', textAlign: 'center', marginTop: 12 }}>{error}</div>}
    </div>
  )
}