'use client'
import { useReducer, useRef, useEffect, useState } from 'react'
import { GlassCard, GradientBadge, AnimatedButton } from '@/components/shared/primitives'
import { voiceReducer, VOICE_STATE_LABEL } from '@/components/modules/voice-engine/stateMachine'
import { BrowserTtsProvider, BatchSttProvider } from '@/components/modules/voice-engine/providers'
import { api } from '@/lib/api'

interface Msg { role: 'assistant' | 'candidate'; content: string }

const tts = new BrowserTtsProvider()

export default function PracticeVoiceInterface({
  sessionId, initialTranscript, interviewerName, onComplete,
}: { sessionId: string; initialTranscript: Msg[]; interviewerName: string; onComplete: () => void }) {
  const [transcript, setTranscript] = useState<Msg[]>(initialTranscript)
  const [voiceState, dispatch] = useReducer(voiceReducer, 'ai_speaking')
  const [error, setError] = useState('')
  const [typedFallback, setTypedFallback] = useState('')
  const [showTypeFallback, setShowTypeFallback] = useState(false)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const bottomRef = useRef<HTMLDivElement>(null)
  const stt = useRef(new BatchSttProvider(blob => api.transcribePracticeAudio(sessionId, blob)))

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [transcript])

  useEffect(() => {
    return () => {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        try { mediaRecorderRef.current.stop() } catch { /* already stopped */ }
      }
      mediaRecorderRef.current?.stream?.getTracks().forEach(t => t.stop())
      if (typeof window !== 'undefined') window.speechSynthesis?.cancel()
    }
  }, [])

  const speak = (text: string, onDone?: () => void) => {
    const playback = tts.speak(text)
    playback.onDone(() => onDone?.())
  }

  useEffect(() => {
    // Speak the opening message once, on mount — matches initial voiceState 'ai_speaking'
    const last = initialTranscript[initialTranscript.length - 1]
    if (last?.role === 'assistant') {
      speak(last.content, () => dispatch({ type: 'AI_FINISHED_SPEAKING' }))
    } else {
      dispatch({ type: 'AI_FINISHED_SPEAKING' })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const startRecording = async () => {
    setError('')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const recorder = new MediaRecorder(stream)
      chunksRef.current = []
      recorder.ondataavailable = e => chunksRef.current.push(e.data)
      recorder.onstop = () => {
        stream.getTracks().forEach(t => t.stop())
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' })
        handleRecordedAnswer(blob)
      }
      recorder.start()
      mediaRecorderRef.current = recorder
      dispatch({ type: 'CANDIDATE_STARTED' })
    } catch {
      setError('Could not access your microphone — check permissions, or type your answer below instead.')
      setShowTypeFallback(true)
    }
  }

  const stopRecording = () => {
    mediaRecorderRef.current?.stop()
    dispatch({ type: 'CANDIDATE_FINISHED' })
  }

  const handleRecordedAnswer = async (blob: Blob) => {
    try {
      const { text } = await stt.current.transcribe(blob)
      if (!text?.trim()) {
        setError('Could not hear a clear answer — try again or type it instead.')
        setShowTypeFallback(true)
        dispatch({ type: 'ERROR' })
        return
      }
      await submitAnswer(text.trim())
    } catch (err: any) {
      setError(err.message || 'Transcription failed — try again or type your answer.')
      setShowTypeFallback(true)
      dispatch({ type: 'ERROR' })
    }
  }

  const submitAnswer = async (text: string) => {
    setTranscript(t => [...t, { role: 'candidate', content: text }])
    try {
      const res = await api.sendPracticeMessage(sessionId, text)
      setTranscript(t => [...t, { role: 'assistant', content: res.message }])
      dispatch({ type: 'REPLY_READY' })
      speak(res.message, () => {
        dispatch({ type: 'AI_FINISHED_SPEAKING' })
        if (res.action === 'conclude') {
          dispatch({ type: 'INTERVIEW_CONCLUDED' })
          setTimeout(onComplete, 600)
        }
      })
    } catch (err: any) {
      setError(err.message || 'Could not send your answer.')
      dispatch({ type: 'ERROR' })
    }
  }

  const submitTyped = async () => {
    const text = typedFallback.trim()
    if (!text) return
    setTypedFallback('')
    setShowTypeFallback(false)
    dispatch({ type: 'CANDIDATE_FINISHED' }) // typed answers still route through "thinking" while the reply is fetched
    await submitAnswer(text)
  }

  const recording = voiceState === 'candidate_speaking'
  const processing = voiceState === 'thinking'
  const aiSpeaking = voiceState === 'ai_speaking'

  return (
    <div style={{ maxWidth: 640, margin: '0 auto' }}>
      <div style={{ textAlign: 'center', marginBottom: 8, display: 'flex', justifyContent: 'center', gap: 8 }}>
        <GradientBadge label="Push-to-talk — not real-time" tone="neutral" icon="ℹ" />
        <GradientBadge label={VOICE_STATE_LABEL[voiceState]} tone={aiSpeaking ? 'gold' : recording ? 'purple' : 'neutral'} />
      </div>

      <GlassCard style={{ marginBottom: 16 }}>
        <div style={{ maxHeight: 260, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 4 }}>
          {transcript.map((m, i) => (
            <div key={i} style={{ display: 'flex', gap: 8, flexDirection: m.role === 'candidate' ? 'row-reverse' : 'row' }}>
              <div style={{
                maxWidth: '80%', padding: '9px 13px', fontSize: 12.5, lineHeight: 1.6,
                background: m.role === 'candidate' ? 'rgba(167,139,250,.15)' : '#161614',
                color: m.role === 'candidate' ? '#c4b5fd' : 'rgba(255,255,255,.8)',
                borderRadius: m.role === 'candidate' ? '10px 3px 10px 10px' : '3px 10px 10px 10px',
              }}>{m.content}</div>
            </div>
          ))}
          <div ref={bottomRef} />
        </div>
      </GlassCard>

      <div style={{ textAlign: 'center', marginBottom: 14 }}>
        <button
          onClick={recording ? stopRecording : startRecording}
          disabled={processing || aiSpeaking}
          className={recording ? 'voice-pulse' : ''}
          style={{
            width: 72, height: 72, borderRadius: '50%', border: 'none', cursor: (processing || aiSpeaking) ? 'default' : 'pointer',
            background: recording ? 'linear-gradient(135deg,#ef4444,#f87171)' : 'linear-gradient(135deg,#7c3aed,#a78bfa)',
            display: 'grid', placeItems: 'center', opacity: (processing || aiSpeaking) ? .5 : 1,
          }}>
          <span style={{ fontSize: 26 }}>{processing ? '⏳' : aiSpeaking ? '🔊' : recording ? '⏹' : '🎙'}</span>
        </button>
        <div style={{ fontSize: 11.5, color: 'rgba(255,255,255,.4)', marginTop: 10 }}>
          {VOICE_STATE_LABEL[voiceState]}
        </div>
      </div>

      {error && <div style={{ fontSize: 12, color: '#ef4444', textAlign: 'center', marginBottom: 10 }}>{error}</div>}

      {showTypeFallback && (
        <div style={{ display: 'flex', gap: 8 }}>
          <input value={typedFallback} onChange={e => setTypedFallback(e.target.value)} onKeyDown={e => e.key === 'Enter' && submitTyped()}
            placeholder="Type your answer instead..." className="premium-input accent-purple"
            style={{ flex: 1, background: '#161614', border: '1px solid rgba(255,255,255,.08)', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: 'rgba(255,255,255,.85)', outline: 'none' }} />
          <AnimatedButton onClick={submitTyped} disabled={!typedFallback.trim()}>Send</AnimatedButton>
        </div>
      )}
      {!showTypeFallback && (
        <div style={{ textAlign: 'center' }}>
          <button onClick={() => setShowTypeFallback(true)} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,.3)', fontSize: 11.5, cursor: 'pointer' }}>Type instead</button>
        </div>
      )}
    </div>
  )
}