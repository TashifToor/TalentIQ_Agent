'use client'
import { useState, useEffect, useRef } from 'react'
import { useParams } from 'next/navigation'
import { api } from '@/lib/api'

type Msg = { role: 'assistant' | 'candidate'; content: string }

export default function PublicInterviewPage() {
  const params = useParams()
  const slug = String(params?.slug || '')

  const [loadingPosting, setLoadingPosting] = useState(true)
  const [posting, setPosting] = useState<{ title: string; company?: string; interviewer_name: string; is_active: boolean } | null>(null)
  const [notFound, setNotFound] = useState(false)

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [startError, setStartError] = useState('')
  const [starting, setStarting] = useState(false)

  const [sessionId, setSessionId] = useState('')
  const [messages, setMessages] = useState<Msg[]>([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [status, setStatus] = useState<'idle' | 'in_progress' | 'completed'>('idle')
  const [awaitingCv, setAwaitingCv] = useState(false)
  const [uploadingCv, setUploadingCv] = useState(false)
  const [sendError, setSendError] = useState('')
  const endRef = useRef<HTMLDivElement>(null)
  const cvFileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!slug) return
    api.getPublicInterviewPosting(slug)
      .then((p: any) => setPosting(p))
      .catch(() => setNotFound(true))
      .finally(() => setLoadingPosting(false))

    // resume an in-progress session on refresh
    const saved = sessionStorage.getItem(`interview_session_${slug}`)
    if (saved) {
      try {
        const parsed = JSON.parse(saved)
        setSessionId(parsed.sessionId)
        setMessages(parsed.messages)
        setStatus(parsed.status)
        setAwaitingCv(!!parsed.awaitingCv)
      } catch {}
    }
  }, [slug])

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, sending])

  useEffect(() => {
    if (sessionId) {
      sessionStorage.setItem(`interview_session_${slug}`, JSON.stringify({ sessionId, messages, status, awaitingCv }))
    }
  }, [sessionId, messages, status, awaitingCv, slug])

  const base = { background: '#0a0a08', minHeight: '100vh', fontFamily: 'Syne, sans-serif', color: 'rgba(255,255,255,.88)' }
  const card = { background: '#111110', border: '1px solid rgba(255,255,255,.06)', borderRadius: 10, padding: 20 }
  const inputSt = { background: '#161614', border: '1px solid rgba(255,255,255,.08)', borderRadius: 8, padding: '11px 14px', fontSize: 13, fontFamily: 'Syne,sans-serif', color: 'rgba(255,255,255,.85)', outline: 'none', width: '100%' }

  const startInterview = async () => {
    if (!name.trim() || !email.trim() || !email.includes('@')) {
      setStartError('Please enter your name and a valid email.')
      return
    }
    setStarting(true)
    setStartError('')
    try {
      const res: any = await api.startPublicInterview(slug, name.trim(), email.trim())
      setSessionId(res.session_id)
      setMessages([{ role: 'assistant', content: res.message }])
      setStatus('in_progress')
    } catch (e: any) {
      setStartError(e?.message || 'Could not start the interview. Try again.')
    } finally {
      setStarting(false)
    }
  }

  const sendMessage = async () => {
    const text = input.trim()
    if (!text || sending || status !== 'in_progress' || awaitingCv) return
    setSending(true)
    setSendError('')
    setMessages(prev => [...prev, { role: 'candidate', content: text }])
    setInput('')
    try {
      const res: any = await api.sendPublicInterviewMessage(slug, sessionId, text)
      if (res.message) {
        setMessages(prev => [...prev, { role: 'assistant', content: res.message }])
      }
      setStatus(res.status)
      setAwaitingCv(!!res.awaiting_cv)
    } catch (e: any) {
      setSendError(e?.message || 'Message failed to send. Please try again.')
    } finally {
      setSending(false)
    }
  }

  const uploadCv = async (file: File) => {
    if (!file.name.toLowerCase().endsWith('.pdf')) {
      setSendError('Only PDF files are supported right now.')
      return
    }
    setUploadingCv(true)
    setSendError('')
    try {
      const res: any = await api.uploadPublicInterviewCV(slug, sessionId, file)
      if (res.message) setMessages(prev => [...prev, { role: 'assistant', content: res.message }])
      setStatus(res.status)
      setAwaitingCv(!!res.awaiting_cv)
    } catch (e: any) {
      setSendError(e?.message || 'Could not upload your CV. Please try again.')
    } finally {
      setUploadingCv(false)
    }
  }

  const skipCv = async () => {
    setUploadingCv(true)
    setSendError('')
    try {
      const res: any = await api.skipPublicInterviewCV(slug, sessionId)
      if (res.message) setMessages(prev => [...prev, { role: 'assistant', content: res.message }])
      setStatus(res.status)
      setAwaitingCv(!!res.awaiting_cv)
    } catch (e: any) {
      setSendError(e?.message || 'Something went wrong. Please try again.')
    } finally {
      setUploadingCv(false)
    }
  }

  if (loadingPosting) {
    return <div style={{ ...base, display: 'grid', placeItems: 'center' }}><div style={{ color: 'rgba(255,255,255,.3)', fontSize: 13 }}>Loading...</div></div>
  }

  if (notFound || !posting || !posting.is_active) {
    return (
      <div style={{ ...base, display: 'grid', placeItems: 'center', padding: 20 }}>
        <div style={{ ...card, maxWidth: 420, textAlign: 'center' }}>
          <div style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 24, fontWeight: 600, marginBottom: 8 }}>Link not available</div>
          <div style={{ fontSize: 13, color: 'rgba(255,255,255,.4)' }}>This interview link is no longer active. Please check with the hiring team for an updated link.</div>
        </div>
      </div>
    )
  }

  // ── Landing / candidate details form ──
  if (status === 'idle') {
    return (
      <div style={{ ...base, display: 'grid', placeItems: 'center', padding: 20 }}>
        <div style={{ ...card, maxWidth: 440, width: '100%' }}>
          <div style={{ width: 40, height: 40, background: '#e2b04a', borderRadius: 10, display: 'grid', placeItems: 'center', marginBottom: 18 }}>
            <svg width="18" height="18" viewBox="0 0 16 16" fill="#0a0a08"><path d="M8 2C4.68 2 2 4.68 2 8c0 1.76.72 3.35 1.88 4.5L8 8.5l4.12 4A5.97 5.97 0 0014 8c0-3.32-2.68-6-6-6z" /></svg>
          </div>
          <div style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 26, fontWeight: 600, marginBottom: 4 }}>{posting.title}</div>
          {posting.company && <div style={{ fontSize: 13, color: 'rgba(255,255,255,.4)', marginBottom: 6 }}>{posting.company}</div>}
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,.35)', marginBottom: 16 }}>You'll be interviewed by {posting.interviewer_name}, our AI screening interviewer.</div>
          <div style={{ fontSize: 13, color: 'rgba(255,255,255,.5)', lineHeight: 1.7, marginBottom: 20 }}>
            You're about to start a short AI-conducted screening interview for this role. It's conversational — answer naturally, and give specific, concrete examples where you can. Once started, please go through to the end; it can't be skipped or paused partway.
          </div>
          <input placeholder="Full name" value={name} onChange={e => setName(e.target.value)} style={{ ...inputSt, marginBottom: 10 }} />
          <input placeholder="Email address" value={email} onChange={e => setEmail(e.target.value)} style={{ ...inputSt, marginBottom: 14 }} />
          {startError && <div style={{ fontSize: 12, color: '#ef4444', marginBottom: 12 }}>{startError}</div>}
          <button onClick={startInterview} disabled={starting}
            style={{ width: '100%', padding: '12px 20px', borderRadius: 8, border: 'none', background: '#13c28e', color: '#0a0a08', fontSize: 13, fontWeight: 700, cursor: starting ? 'default' : 'pointer', opacity: starting ? 0.6 : 1, fontFamily: 'Syne,sans-serif' }}>
            {starting ? 'Starting...' : 'Start Interview'}
          </button>
        </div>
      </div>
    )
  }

  // ── Completed ──
  if (status === 'completed') {
    return (
      <div style={{ ...base, display: 'grid', placeItems: 'center', padding: 20 }}>
        <div style={{ ...card, maxWidth: 460, textAlign: 'center' }}>
          <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'rgba(19,194,142,.12)', display: 'grid', placeItems: 'center', margin: '0 auto 16px' }}>
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M4 10l4 4 8-8" stroke="#13c28e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </div>
          <div style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 24, fontWeight: 600, marginBottom: 8 }}>Interview Complete</div>
          <div style={{ fontSize: 13, color: 'rgba(255,255,255,.45)', lineHeight: 1.7, marginBottom: 6 }}>
            Thanks, {name || 'there'} — your responses have been submitted to the hiring team for review.
          </div>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,.25)' }}>You can close this tab now.</div>
        </div>
      </div>
    )
  }

  // ── Live chat ──
  return (
    <div style={{ ...base, display: 'flex', flexDirection: 'column', height: '100vh' }}>
      <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(255,255,255,.06)', display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ width: 30, height: 30, background: '#e2b04a', borderRadius: 8, display: 'grid', placeItems: 'center', flexShrink: 0 }}>
          <svg width="14" height="14" viewBox="0 0 16 16" fill="#0a0a08"><path d="M8 2C4.68 2 2 4.68 2 8c0 1.76.72 3.35 1.88 4.5L8 8.5l4.12 4A5.97 5.97 0 0014 8c0-3.32-2.68-6-6-6z" /></svg>
        </div>
        <div>
          <div style={{ fontSize: 13, fontWeight: 700 }}>{posting.title}</div>
          <div style={{ fontSize: 10, color: 'rgba(255,255,255,.3)' }}>Chatting with {posting.interviewer_name} · AI Screening Interview</div>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '20px', maxWidth: 720, width: '100%', margin: '0 auto' }}>
        {messages.map((m, i) => (
          <div key={i} style={{ display: 'flex', justifyContent: m.role === 'candidate' ? 'flex-end' : 'flex-start', marginBottom: 14 }}>
            <div style={{
              maxWidth: '78%', padding: '11px 15px', borderRadius: 12, fontSize: 13, lineHeight: 1.6,
              background: m.role === 'candidate' ? '#13c28e' : '#161614',
              color: m.role === 'candidate' ? '#0a0a08' : 'rgba(255,255,255,.85)',
              border: m.role === 'candidate' ? 'none' : '1px solid rgba(255,255,255,.06)',
            }}>{m.content}</div>
          </div>
        ))}
        {sending && (
          <div style={{ display: 'flex', justifyContent: 'flex-start', marginBottom: 14 }}>
            <div style={{ padding: '11px 15px', borderRadius: 12, background: '#161614', border: '1px solid rgba(255,255,255,.06)', fontSize: 13, color: 'rgba(255,255,255,.3)' }}>Typing...</div>
          </div>
        )}
        <div ref={endRef} />
      </div>

      <div style={{ borderTop: '1px solid rgba(255,255,255,.06)', padding: 16 }}>
        {awaitingCv ? (
          <div style={{ maxWidth: 720, margin: '0 auto', display: 'flex', gap: 10, alignItems: 'center' }}>
            <input ref={cvFileRef} type="file" accept="application/pdf" style={{ display: 'none' }}
              onChange={e => { const f = e.target.files?.[0]; if (f) uploadCv(f) }} />
            <button onClick={() => cvFileRef.current?.click()} disabled={uploadingCv}
              style={{ flex: 1, padding: '12px 20px', borderRadius: 8, border: '1px dashed rgba(255,255,255,.2)', background: 'transparent', color: 'rgba(255,255,255,.7)', fontSize: 13, fontWeight: 600, cursor: uploadingCv ? 'default' : 'pointer', opacity: uploadingCv ? 0.6 : 1, fontFamily: 'Syne,sans-serif' }}>
              {uploadingCv ? 'Uploading...' : '📎 Upload your CV (PDF)'}
            </button>
            <button onClick={skipCv} disabled={uploadingCv}
              style={{ padding: '0 20px', height: 44, borderRadius: 8, border: '1px solid rgba(255,255,255,.1)', background: 'transparent', color: 'rgba(255,255,255,.4)', fontSize: 13, fontWeight: 600, cursor: uploadingCv ? 'default' : 'pointer', fontFamily: 'Syne,sans-serif' }}>
              Skip
            </button>
          </div>
        ) : (
          <div style={{ maxWidth: 720, margin: '0 auto', display: 'flex', gap: 10 }}>
            <input
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() } }}
              placeholder="Type your answer..."
              disabled={sending}
              style={{ ...inputSt, flex: 1 }}
            />
            <button onClick={sendMessage} disabled={sending || !input.trim()}
              style={{ padding: '0 22px', borderRadius: 8, border: 'none', background: '#13c28e', color: '#0a0a08', fontSize: 13, fontWeight: 700, cursor: sending ? 'default' : 'pointer', opacity: (sending || !input.trim()) ? 0.5 : 1, fontFamily: 'Syne,sans-serif' }}>
              Send
            </button>
          </div>
        )}
        {sendError && <div style={{ maxWidth: 720, margin: '8px auto 0', fontSize: 12, color: '#ef4444' }}>{sendError}</div>}
      </div>
    </div>
  )
}
