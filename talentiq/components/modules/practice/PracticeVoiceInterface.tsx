'use client'
import { useState, useRef, useEffect } from 'react'
import { GlassCard, GradientBadge, AnimatedButton } from '@/components/shared/primitives'
import { api } from '@/lib/api'

interface Msg { role: 'assistant' | 'candidate'; content: string }

export default function PracticeVoiceInterface({
  sessionId, initialTranscript, interviewerName, onComplete,
}: { sessionId: string; initialTranscript: Msg[]; interviewerName: string; onComplete: () => void }) {
  const [transcript, setTranscript] = useState<Msg[]>(initialTranscript)
  const [recording, setRecording] = useState(false)
  const [processing, setProcessing] = useState(false)
  const [error, setError] = useState('')
  const [typedFallback, setTypedFallback] = useState('')
  const [showTypeFallback, setShowTypeFallback] = useState(false)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [transcript])

  const speak = (text: string) => {
    if (typeof window === 'undefined' || !window.speechSynthesis) return
    window.speechSynthesis.cancel()
    const u = new SpeechSynthesisUtterance(text)
    u.rate = 1
    window.speechSynthesis.speak(u)
  }

  useEffect(() => {
    // Speak the opening message once, on mount
    const last = initialTranscript[initialTranscript.length - 1]
    if (last?.role === 'assistant') speak(last.content)
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
      setRecording(true)
    } catch {
      setError('Could not access your microphone — check permissions, or type your answer below instead.')
      setShowTypeFallback(true)
    }
  }

  const stopRecording = () => {
    mediaRecorderRef.current?.stop()
    setRecording(false)
  }

  const handleRecordedAnswer = async (blob: Blob) => {
    setProcessing(true)
    try {
      const { text } = await api.transcribePracticeAudio(sessionId, blob)
      if (!text?.trim()) { setError('Could not hear a clear answer — try again or type it instead.'); setShowTypeFallback(true); return }
      await submitAnswer(text.trim())
    } catch (err: any) {
      setError(err.message || 'Transcription failed — try again or type your answer.')
      setShowTypeFallback(true)
    } finally {
      setProcessing(false)
    }
  }

  const submitAnswer = async (text: string) => {
    setTranscript(t => [...t, { role: 'candidate', content: text }])
    try {
      const res = await api.sendPracticeMessage(sessionId, text)
      setTranscript(t => [...t, { role: 'assistant', content: res.message }])
      speak(res.message)
      if (res.action === 'conclude') setTimeout(onComplete, 1200)
    } catch (err: any) {
      setError(err.message || 'Could not send your answer.')
    }
  }

  const submitTyped = async () => {
    const text = typedFallback.trim()
    if (!text) return
    setTypedFallback('')
    setShowTypeFallback(false)
    setProcessing(true)
    await submitAnswer(text)
    setProcessing(false)
  }

  return (
    <div style={{ maxWidth: 640, margin: '0 auto' }}>
      <div style={{ textAlign: 'center', marginBottom: 8 }}>
        <GradientBadge label="Push-to-talk — not real-time" tone="neutral" icon="ℹ" />
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
          disabled={processing}
          className={recording ? 'voice-pulse' : ''}
          style={{
            width: 72, height: 72, borderRadius: '50%', border: 'none', cursor: processing ? 'default' : 'pointer',
            background: recording ? 'linear-gradient(135deg,#ef4444,#f87171)' : 'linear-gradient(135deg,#7c3aed,#a78bfa)',
            display: 'grid', placeItems: 'center', opacity: processing ? .5 : 1,
          }}>
          <span style={{ fontSize: 26 }}>{processing ? '⏳' : recording ? '⏹' : '🎙'}</span>
        </button>
        <div style={{ fontSize: 11.5, color: 'rgba(255,255,255,.4)', marginTop: 10 }}>
          {processing ? 'Transcribing...' : recording ? 'Recording — tap to stop' : 'Tap to record your answer'}
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