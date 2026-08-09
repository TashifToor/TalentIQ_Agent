'use client'
import { useState, useRef, useEffect } from 'react'
import { GlassCard, AnimatedButton } from '@/components/shared/primitives'
import { api } from '@/lib/api'

interface Msg { role: 'assistant' | 'candidate'; content: string }

export default function PracticeChatInterface({
  sessionId, initialTranscript, interviewerName, onComplete,
}: { sessionId: string; initialTranscript: Msg[]; interviewerName: string; onComplete: () => void }) {
  const [transcript, setTranscript] = useState<Msg[]>(initialTranscript)
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [transcript])

  const send = async () => {
    const text = input.trim()
    if (!text || sending) return
    setError('')
    setInput('')
    setTranscript(t => [...t, { role: 'candidate', content: text }])
    setSending(true)
    try {
      const res = await api.sendPracticeMessage(sessionId, text)
      setTranscript(t => [...t, { role: 'assistant', content: res.message }])
      if (res.action === 'conclude') {
        setTimeout(onComplete, 900)
      }
    } catch (err: any) {
      setError(err.message || 'Could not send your answer — try again.')
    } finally {
      setSending(false)
    }
  }

  return (
    <div style={{ maxWidth: 720, margin: '0 auto' }}>
      <GlassCard style={{ padding: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column', height: 520 }}>
        <div style={{ flex: 1, overflowY: 'auto', padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
          {transcript.map((m, i) => (
            <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', flexDirection: m.role === 'candidate' ? 'row-reverse' : 'row' }}>
              {m.role === 'assistant' && (
                <div style={{ width: 26, height: 26, borderRadius: 8, background: 'linear-gradient(135deg,#c5931f,#e2b04a)', display: 'grid', placeItems: 'center', flexShrink: 0, fontSize: 12 }}>💬</div>
              )}
              <div style={{
                maxWidth: '75%', padding: '10px 14px', fontSize: 13, lineHeight: 1.6,
                background: m.role === 'candidate' ? '#e2b04a' : '#161614',
                color: m.role === 'candidate' ? '#0a0a08' : 'rgba(255,255,255,.85)',
                borderRadius: m.role === 'candidate' ? '12px 4px 12px 12px' : '4px 12px 12px 12px',
              }}>{m.content}</div>
            </div>
          ))}
          {sending && (
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <div style={{ width: 26, height: 26, borderRadius: 8, background: 'linear-gradient(135deg,#c5931f,#e2b04a)', display: 'grid', placeItems: 'center', flexShrink: 0, fontSize: 12 }}>💬</div>
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,.3)' }}>{interviewerName} is typing...</div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        <div style={{ borderTop: '1px solid rgba(255,255,255,.06)', padding: 14, display: 'flex', gap: 10 }}>
          <input
            value={input} onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
            placeholder="Type your answer..." disabled={sending}
            className="premium-input" style={{ flex: 1, background: '#161614', border: '1px solid rgba(255,255,255,.08)', borderRadius: 8, padding: '11px 14px', fontSize: 13, color: 'rgba(255,255,255,.85)', outline: 'none' }}
          />
          <AnimatedButton onClick={send} disabled={sending || !input.trim()}>Send</AnimatedButton>
        </div>
      </GlassCard>
      {error && <div style={{ fontSize: 12, color: '#ef4444', marginTop: 10 }}>{error}</div>}
    </div>
  )
}