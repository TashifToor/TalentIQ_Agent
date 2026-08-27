'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams } from 'next/navigation'
import { api } from '@/lib/api'
import RealtimeVoiceInterface from '@/components/modules/voice-engine/RealtimeVoiceInterface'
import ReadinessScreen from '@/components/modules/interview-engine/ReadinessScreen'

type Msg = { role: 'assistant' | 'candidate'; content: string }
type Question = { id: string; index: number; total: number; question: string; options: string[]; seconds_allowed: number; seconds_remaining: number }
type Posting = { title: string; company?: string; interviewer_name: string; is_active: boolean; mode: 'chatbot' | 'mcq' | 'voice_agent'; assessment_seconds_per_question?: number; assessment_question_count?: number }

const SNAPSHOT_INTERVAL_MS = 45000

export default function PublicInterviewPage() {
  const params = useParams()
  const slug = String(params?.slug || '')

  const [loadingPosting, setLoadingPosting] = useState(true)
  const [posting, setPosting] = useState<Posting | null>(null)
  const [notFound, setNotFound] = useState(false)

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [startError, setStartError] = useState('')
  const [starting, setStarting] = useState(false)
  const [showReadiness, setShowReadiness] = useState(false)
  const [recovering, setRecovering] = useState(true)

  const [sessionId, setSessionId] = useState('')
  const [useRealtimeVoice, setUseRealtimeVoice] = useState(true)
  const [status, setStatus] = useState<'idle' | 'in_progress' | 'completed'>('idle')
  const [stage, setStage] = useState<'interview' | 'assessment'>('interview')
  const [awaitingCv, setAwaitingCv] = useState(false)

  // interview (chat) stage
  const [messages, setMessages] = useState<Msg[]>([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const endRef = useRef<HTMLDivElement>(null)

  // assessment (MCQ) stage
  const [question, setQuestion] = useState<Question | null>(null)
  const [selectedOption, setSelectedOption] = useState<number | null>(null)
  const [timeLeft, setTimeLeft] = useState<number | null>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const [terminated, setTerminated] = useState(false)
  const [terminatedMessage, setTerminatedMessage] = useState('')
  const [answering, setAnswering] = useState(false)
  const [assessmentError, setAssessmentError] = useState('')

  // camera / proctoring
  const [cameraState, setCameraState] = useState<'idle' | 'requesting' | 'granted' | 'denied'>('idle')
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const snapshotTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // voice mode: standalone Voice AI Agent — TTS + mic recording, its own mode (never combined with MCQ)
  const voiceMode = posting?.mode === 'voice_agent'
  const [speaking, setSpeaking] = useState(false)
  const [micState, setMicState] = useState<'idle' | 'recording' | 'transcribing'>('idle')
  const [micError, setMicError] = useState('')
  const [lastHeard, setLastHeard] = useState('')
  const micStreamRef = useRef<MediaStream | null>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const spokenMessageCountRef = useRef(0)

  // CV upload
  const [uploadingCv, setUploadingCv] = useState(false)
  const [sendError, setSendError] = useState('')
  const cvFileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!slug) return
    api.getPublicInterviewPosting(slug)
      .then((p: any) => setPosting(p))
      .catch(() => setNotFound(true))
      .finally(() => setLoadingPosting(false))

    const saved = sessionStorage.getItem(`interview_session_${slug}`)
    if (!saved) { setRecovering(false); return }
    let parsed: any
    try { parsed = JSON.parse(saved) } catch { sessionStorage.removeItem(`interview_session_${slug}`); setRecovering(false); return }

    // Verify against the server before trusting the cache — a completed or
    // no-longer-valid session must never silently resume as if in-progress.
    api.getPublicInterviewSession(slug, parsed.sessionId)
      .then((s: any) => {
        if (s.status === 'completed') {
          sessionStorage.removeItem(`interview_session_${slug}`)
          setStatus('completed')
        } else {
          setSessionId(s.session_id)
          setMessages(s.transcript?.length ? s.transcript : (parsed.messages || []))
          setStatus(s.status)
          setStage(s.stage === 'assessment' ? 'assessment' : 'interview')
          setAwaitingCv(!!s.awaiting_cv)
        }
      })
      .catch(() => { sessionStorage.removeItem(`interview_session_${slug}`) })
      .finally(() => setRecovering(false))
  }, [slug])

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, sending])

  useEffect(() => {
    if (sessionId) {
      sessionStorage.setItem(`interview_session_${slug}`, JSON.stringify({ sessionId, messages, status, stage, awaitingCv }))
    }
  }, [sessionId, messages, status, stage, awaitingCv, slug])

  // ── Text-to-speech ──
  const speak = useCallback((text: string): Promise<void> => {
    return new Promise(resolve => {
      if (!voiceMode || typeof window === 'undefined' || !window.speechSynthesis) { resolve(); return }
      window.speechSynthesis.cancel()
      const utter = new SpeechSynthesisUtterance(text)
      utter.rate = 1.0
      utter.pitch = 1.0
      utter.onstart = () => setSpeaking(true)
      utter.onend = () => { setSpeaking(false); resolve() }
      utter.onerror = () => { setSpeaking(false); resolve() }
      window.speechSynthesis.speak(utter)
    })
  }, [voiceMode])

  // Speak each new assistant message exactly once, in order.
  useEffect(() => {
    if (!voiceMode || stage !== 'interview') return
    if (messages.length > spokenMessageCountRef.current) {
      const newOnes = messages.slice(spokenMessageCountRef.current).filter(m => m.role === 'assistant')
      spokenMessageCountRef.current = messages.length
      newOnes.forEach(m => speak(m.content))
    }
  }, [messages, voiceMode, stage, speak])

  // ── Mic recording — voice_agent mode only (MCQ mode never uses voice) ──
  const ensureMicStream = useCallback(async (): Promise<MediaStream> => {
    if (micStreamRef.current) return micStreamRef.current
    const s = await navigator.mediaDevices.getUserMedia({ audio: true })
    micStreamRef.current = s
    return s
  }, [])

  const startRecording = async () => {
    setMicError('')
    window.speechSynthesis?.cancel()
    setSpeaking(false)
    try {
      const stream = await ensureMicStream()
      const mimeType = MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : ''
      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream)
      audioChunksRef.current = []
      recorder.ondataavailable = e => { if (e.data.size > 0) audioChunksRef.current.push(e.data) }
      recorder.start()
      mediaRecorderRef.current = recorder
      setMicState('recording')
    } catch (e) {
      setMicError('Could not access your microphone. Please allow mic access and try again.')
    }
  }

  const stopRecordingAndHandle = () => {
    const recorder = mediaRecorderRef.current
    if (!recorder || recorder.state === 'inactive') return
    recorder.onstop = async () => {
      setMicState('transcribing')
      const blob = new Blob(audioChunksRef.current, { type: recorder.mimeType || 'audio/webm' })
      try {
        const res: any = await api.transcribeVoice(slug, sessionId, blob)
        const text = (res.text || '').trim()
        setLastHeard(text)
        if (!text) { setMicError("Didn't catch that — please try again."); setMicState('idle'); return }
        setMicState('idle')
        await sendMessage(text)
      } catch (e: any) {
        setMicError(e?.message || 'Could not transcribe that — please try again.')
        setMicState('idle')
      }
    }
    recorder.stop()
  }

  useEffect(() => {
    return () => {
      micStreamRef.current?.getTracks().forEach(t => t.stop())
      window.speechSynthesis?.cancel()
    }
  }, [])

  // ── Proctoring: tab-switch = immediate termination; blur = soft flag ──
  const flag = useCallback((type: string, detail?: string) => {
    if (!sessionId || stage !== 'assessment') return
    api.reportProctoringFlag(slug, sessionId, type, detail)
  }, [slug, sessionId, stage])

  const terminateNow = useCallback(async (type: string) => {
    if (!sessionId || stage !== 'assessment' || terminated) return
    setTerminated(true) // set immediately so the render switches before the request even returns
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null }
    if (snapshotTimerRef.current) { clearInterval(snapshotTimerRef.current); snapshotTimerRef.current = null }
    streamRef.current?.getTracks().forEach(t => t.stop())
    streamRef.current = null
    window.speechSynthesis?.cancel()
    try {
      const res: any = await api.terminateAssessment(slug, sessionId, type)
      setTerminatedMessage(res?.message || 'Your session was ended because you left the page during the proctored assessment.')
      setStatus('completed')
    } catch {
      setTerminatedMessage('Your session was ended because you left the page during the proctored assessment. This has been flagged for the hiring team.')
      setStatus('completed')
    }
  }, [slug, sessionId, stage, terminated])

  useEffect(() => {
    const onVisibility = () => { if (document.hidden) terminateNow('tab_hidden') }
    const onBlur = () => flag('window_blur')
    const onUnload = () => {
      if (!sessionId || stage !== 'assessment') return
      try {
        navigator.sendBeacon?.(
          `${(process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000')}/interview/public/${slug}/${sessionId}/assessment/flag`,
          new Blob([JSON.stringify({ type: 'left_site' })], { type: 'application/json' })
        )
      } catch {}
    }
    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('blur', onBlur)
    window.addEventListener('beforeunload', onUnload)
    return () => {
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('blur', onBlur)
      window.removeEventListener('beforeunload', onUnload)
    }
  }, [flag, terminateNow, sessionId, stage, slug])

  // ── Camera setup + periodic snapshots ──
  const stopCamera = useCallback(() => {
    if (snapshotTimerRef.current) { clearInterval(snapshotTimerRef.current); snapshotTimerRef.current = null }
    streamRef.current?.getTracks().forEach(t => t.stop())
    streamRef.current = null
  }, [])

  const captureSnapshot = useCallback(() => {
    const video = videoRef.current, canvas = canvasRef.current
    if (!video || !canvas || !streamRef.current) return
    canvas.width = video.videoWidth || 320
    canvas.height = video.videoHeight || 240
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
    canvas.toBlob(blob => {
      if (blob) api.uploadProctoringPhoto(slug, sessionId, blob)
    }, 'image/jpeg', 0.7)
  }, [slug, sessionId])

  const requestCameraAndBeginAssessment = async () => {
    setCameraState('requesting')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 320, height: 240 } })
      streamRef.current = stream
      if (videoRef.current) videoRef.current.srcObject = stream
      setCameraState('granted')
      snapshotTimerRef.current = setInterval(captureSnapshot, SNAPSHOT_INTERVAL_MS)
      setTimeout(captureSnapshot, 2000) // one early snapshot too
      await loadCurrentQuestion()
    } catch (e) {
      setCameraState('denied')
    }
  }

  useEffect(() => () => stopCamera(), [stopCamera])

  const loadCurrentQuestion = async () => {
    setAssessmentError('')
    try {
      const q: any = await api.getCurrentAssessmentQuestion(slug, sessionId)
      setQuestion(q)
      setSelectedOption(null)
    } catch (e: any) {
      setAssessmentError(e?.message || 'Could not load the next question.')
    }
  }

  const continueToReadiness = () => {
    if (!name.trim() || !email.trim() || !email.includes('@')) {
      setStartError('Please enter your name and a valid email.')
      return
    }
    setStartError('')
    setShowReadiness(true)
  }

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
      setStatus('in_progress')
      if (res.stage === 'assessment') {
        setStage('assessment')
      } else {
        setStage('interview')
        setMessages([{ role: 'assistant', content: res.message }])
      }
    } catch (e: any) {
      setStartError(e?.message || 'Could not start the interview. Try again.')
    } finally {
      setStarting(false)
    }
  }

  // kick off camera request the moment we land on the assessment stage with no session/camera yet
  useEffect(() => {
    if (status === 'in_progress' && stage === 'assessment' && !awaitingCv && cameraState === 'idle' && sessionId) {
      requestCameraAndBeginAssessment()
    }
  }, [status, stage, awaitingCv, cameraState, sessionId])

  const sendMessage = async (overrideText?: string) => {
    const text = (overrideText !== undefined ? overrideText : input).trim()
    if (!text || sending || status !== 'in_progress' || awaitingCv) return
    setSending(true)
    setSendError('')
    setMessages(prev => [...prev, { role: 'candidate', content: text }])
    setInput('')
    try {
      const res: any = await api.sendPublicInterviewMessage(slug, sessionId, text)
      if (res.message) setMessages(prev => [...prev, { role: 'assistant', content: res.message }])
      setStatus(res.status)
      setAwaitingCv(!!res.awaiting_cv)
      if (res.next_stage === 'assessment') setStage('assessment')
    } catch (e: any) {
      // Roll back the optimistic message — it was never actually persisted
      // server-side, so leaving it in the transcript would show the
      // candidate a "sent" message the AI never received. Restore it to
      // the input so they can retry without retyping.
      setMessages(prev => prev.filter((m, i) => !(i === prev.length - 1 && m.role === 'candidate' && m.content === text)))
      setInput(text)
      setSendError(e?.message || 'Message failed to send. Please try again.')
    } finally {
      setSending(false)
    }
  }

  const submitAnswer = async (forcedIndex?: number) => {
    const indexToSend = forcedIndex !== undefined ? forcedIndex : selectedOption
    if (indexToSend === null || indexToSend === undefined || !question || answering) return
    setAnswering(true)
    setAssessmentError('')
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null }
    const questionId = question.id

    let res: any = null
    let ok = false
    for (let attempt = 0; attempt < 3 && !ok; attempt++) {
      try {
        res = await api.answerAssessmentQuestion(slug, sessionId, questionId, indexToSend)
        ok = true
      } catch (e: any) {
        if (attempt < 2) await new Promise(r => setTimeout(r, 500 * (attempt + 1)))
        else setAssessmentError(e?.message || 'Could not submit your answer — retrying...')
      }
    }
    if (ok) {
      if (res.status === 'completed') {
        stopCamera()
        setAwaitingCv(true)
        setQuestion(null)
      } else {
        setQuestion(res.next_question)
        setSelectedOption(null)
      }
      setAssessmentError('')
    }
    setAnswering(false)
  }

  // Tapping an option submits immediately — no separate "Next Question" click needed.
  const selectAndSubmit = (i: number) => {
    if (answering) return
    setSelectedOption(i)
    submitAnswer(i)
  }

  // Countdown timer — starts from the server's real remaining time (so a
  // refresh/resume doesn't hand back a full clock), auto-submits -1 at
  // zero. The server independently re-checks elapsed time on submit, so
  // this client timer is a UX convenience, not the actual enforcement.
  useEffect(() => {
    if (!question || terminated) return
    setTimeLeft(question.seconds_remaining ?? question.seconds_allowed)
    timerRef.current = setInterval(() => {
      setTimeLeft(t => {
        if (t === null) return null
        if (t <= 1) {
          if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null }
          submitAnswer(-1)
          return 0
        }
        return t - 1
      })
    }, 1000)
    return () => { if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null } }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [question?.id])

  const uploadCv = async (file: File) => {
    if (!file.name.toLowerCase().endsWith('.pdf')) { setSendError('Only PDF files are supported right now.'); return }
    setUploadingCv(true)
    setSendError('')
    try {
      const res: any = await api.uploadPublicInterviewCV(slug, sessionId, file)
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
      setStatus(res.status)
      setAwaitingCv(!!res.awaiting_cv)
    } catch (e: any) {
      setSendError(e?.message || 'Something went wrong. Please try again.')
    } finally {
      setUploadingCv(false)
    }
  }

  const base = { background: '#0a0a08', minHeight: '100vh', fontFamily: 'Inter, sans-serif', color: 'rgba(255,255,255,.88)' }
  const card = { background: '#111110', border: '1px solid rgba(255,255,255,.06)', borderRadius: 10, padding: 20 }
  const inputSt = { background: '#161614', border: '1px solid rgba(255,255,255,.08)', borderRadius: 8, padding: '11px 14px', fontSize: 13, fontFamily: 'Inter,sans-serif', color: 'rgba(255,255,255,.85)', outline: 'none', width: '100%' }

  const micButton = (size: number = 64) => (
    <button
      onClick={() => micState === 'recording' ? stopRecordingAndHandle() : startRecording()}
      disabled={micState === 'transcribing' || speaking}
      style={{
        width: size, height: size, borderRadius: '50%', border: 'none', cursor: (micState === 'transcribing' || speaking) ? 'default' : 'pointer',
        background: micState === 'recording' ? '#ef4444' : speaking ? 'rgba(255,255,255,.08)' : '#13c28e',
        display: 'grid', placeItems: 'center', flexShrink: 0,
        boxShadow: micState === 'recording' ? '0 0 0 8px rgba(239,68,68,.15)' : 'none',
        opacity: (micState === 'transcribing' || speaking) ? 0.5 : 1,
        transition: 'all .2s',
      }}>
      {micState === 'transcribing' ? (
        <svg width={size * 0.35} height={size * 0.35} viewBox="0 0 24 24" style={{ animation: 'spin 0.8s linear infinite' }}><circle cx="12" cy="12" r="9" fill="none" stroke="#0a0a08" strokeOpacity="0.3" strokeWidth="3" /><circle cx="12" cy="12" r="9" fill="none" stroke="#0a0a08" strokeWidth="3" strokeDasharray="28 56" strokeLinecap="round" /></svg>
      ) : micState === 'recording' ? (
        <svg width={size * 0.32} height={size * 0.32} viewBox="0 0 16 16" fill="#fff"><rect x="4" y="4" width="8" height="8" rx="1.5" /></svg>
      ) : (
        <svg width={size * 0.32} height={size * 0.32} viewBox="0 0 16 16" fill="#0a0a08"><rect x="5.5" y="1.5" width="5" height="8" rx="2.5" /><path d="M3.5 7.5a4.5 4.5 0 009 0M8 12v2.5" stroke="#0a0a08" strokeWidth="1.3" fill="none" strokeLinecap="round" /></svg>
      )}
    </button>
  )

  if (loadingPosting || recovering) {
    return <div style={{ ...base, display: 'grid', placeItems: 'center' }}><div style={{ color: 'rgba(255,255,255,.3)', fontSize: 13 }}>{recovering ? 'Restoring your session...' : 'Loading...'}</div></div>
  }

  if (notFound || !posting || !posting.is_active) {
    return (
      <div style={{ ...base, display: 'grid', placeItems: 'center', padding: 20 }}>
        <div style={{ ...card, maxWidth: 420, textAlign: 'center' }}>
          <div style={{ fontFamily: "Inter, sans-serif", fontSize: 24, fontWeight: 600, marginBottom: 8 }}>Link not available</div>
          <div style={{ fontSize: 13, color: 'rgba(255,255,255,.4)' }}>This interview link is no longer active. Please check with the hiring team for an updated link.</div>
        </div>
      </div>
    )
  }

  // ── Terminated for suspected cheating (highest priority — always wins) ──
  if (terminated) {
    return (
      <div style={{ ...base, display: 'grid', placeItems: 'center', padding: 20 }}>
        <div style={{ ...card, maxWidth: 440, textAlign: 'center', border: '1px solid rgba(239,68,68,.3)' }}>
          <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'rgba(239,68,68,.12)', display: 'grid', placeItems: 'center', margin: '0 auto 16px' }}>
            <span style={{ fontSize: 22 }}>⚠</span>
          </div>
          <div style={{ fontFamily: "Inter, sans-serif", fontSize: 22, fontWeight: 600, color: '#ef4444', marginBottom: 10 }}>Session Ended</div>
          <div style={{ fontSize: 13, color: 'rgba(255,255,255,.55)', lineHeight: 1.7 }}>{terminatedMessage || 'You left the page during the proctored assessment, so this session has ended and been flagged for the hiring team.'}</div>
        </div>
      </div>
    )
  }

  // ── Landing / candidate details form ──
  if (status === 'idle') {
    if (showReadiness) {
      const m = posting.mode
      return (
        <div style={{ ...base, display: 'grid', placeItems: 'center', padding: 20 }}>
          <div style={{ width: '100%' }}>
            <ReadinessScreen
              mode={m}
              title={posting.title}
              company={posting.company}
              interviewerName={posting.interviewer_name}
              candidateName={name.trim() || undefined}
              questionCount={m === 'mcq' ? posting.assessment_question_count : undefined}
              evaluationAreas={
                m === 'mcq' ? ['Accuracy across categories', 'Speed under time pressure']
                : m === 'voice_agent' ? ['Spoken communication', 'Technical reasoning', 'Real project experience']
                : ['Communication clarity', 'Technical depth', 'Real project experience']
              }
              onStart={startInterview}
              starting={starting}
              startError={startError}
            />
          </div>
        </div>
      )
    }
    return (
      <div style={{ ...base, display: 'grid', placeItems: 'center', padding: 20 }}>
        <div style={{ ...card, maxWidth: 440, width: '100%' }}>
          <div style={{ width: 40, height: 40, background: '#e2b04a', borderRadius: 10, display: 'grid', placeItems: 'center', marginBottom: 18 }}>
            <svg width="18" height="18" viewBox="0 0 16 16" fill="#0a0a08"><path d="M8 2C4.68 2 2 4.68 2 8c0 1.76.72 3.35 1.88 4.5L8 8.5l4.12 4A5.97 5.97 0 0014 8c0-3.32-2.68-6-6-6z" /></svg>
          </div>
          <div style={{ fontFamily: "Inter, sans-serif", fontSize: 26, fontWeight: 600, marginBottom: 4 }}>{posting.title}</div>
          {posting.company && <div style={{ fontSize: 13, color: 'rgba(255,255,255,.4)', marginBottom: 16 }}>{posting.company}</div>}

          {(() => {
            const modeInfo = {
              chatbot: { icon: '💬', title: 'Chatbot AI Interview', color: '#e2b04a',
                desc: `You're about to start a short AI-conducted screening interview with ${posting.interviewer_name}. It's conversational, by text — answer naturally, and give specific, concrete examples where you can.` },
              voice_agent: { icon: '🎙', title: 'Voice AI Agent', color: '#13c28e',
                desc: `You'll be interviewed by ${posting.interviewer_name} — by voice, in real time. It'll ask questions out loud, you respond by talking. Please allow microphone access when prompted, and use headphones if you can.` },
              mcq: { icon: '📝', title: 'MCQ Assessment', color: '#a78bfa',
                desc: 'This role requires a short, timed multiple-choice skills assessment. It is proctored — your camera will take periodic snapshots, and leaving this tab is flagged for the hiring team.' },
            }[posting.mode]
            return (
              <div style={{ borderRadius: 10, padding: '14px 16px', marginBottom: 16, border: `1.5px solid ${modeInfo.color}55`, background: `${modeInfo.color}14` }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <span style={{ fontSize: 18 }}>{modeInfo.icon}</span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: modeInfo.color }}>{modeInfo.title}</span>
                </div>
                <div style={{ fontSize: 12.5, color: 'rgba(255,255,255,.6)', lineHeight: 1.6 }}>{modeInfo.desc}</div>
              </div>
            )
          })()}
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,.3)', marginBottom: 20 }}>Once started, please go through to the end; it can't be skipped or paused partway.</div>
          <input placeholder="Full name" value={name} onChange={e => setName(e.target.value)} style={{ ...inputSt, marginBottom: 10 }} />
          <input placeholder="Email address" value={email} onChange={e => setEmail(e.target.value)} style={{ ...inputSt, marginBottom: 14 }} />
          {startError && <div style={{ fontSize: 12, color: '#ef4444', marginBottom: 12 }}>{startError}</div>}
          <button onClick={continueToReadiness} disabled={starting}
            style={{ width: '100%', padding: '12px 20px', borderRadius: 8, border: 'none', background: '#13c28e', color: '#0a0a08', fontSize: 13, fontWeight: 700, cursor: starting ? 'default' : 'pointer', opacity: starting ? 0.6 : 1, fontFamily: 'Inter,sans-serif' }}>
            Continue
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
          <div style={{ fontFamily: "Inter, sans-serif", fontSize: 24, fontWeight: 600, marginBottom: 8 }}>All Done</div>
          <div style={{ fontSize: 13, color: 'rgba(255,255,255,.45)', lineHeight: 1.7, marginBottom: 6 }}>
            Thanks, {name || 'there'} — your submission for <strong>{posting.title}</strong> has been sent to the hiring team.
          </div>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,.25)' }}>You can close this tab now.</div>
        </div>
      </div>
    )
  }

  // ── CV upload (shared final step, regardless of which stage(s) ran) ──
  if (awaitingCv) {
    return (
      <div style={{ ...base, display: 'grid', placeItems: 'center', padding: 20 }}>
        <div style={{ ...card, maxWidth: 440, width: '100%', textAlign: 'center' }}>
          <div style={{ fontFamily: "Inter, sans-serif", fontSize: 22, fontWeight: 600, marginBottom: 10 }}>One last thing</div>
          <div style={{ fontSize: 13, color: 'rgba(255,255,255,.5)', lineHeight: 1.7, marginBottom: 20 }}>Upload your CV so we can cross-check it against your answers — or skip if you don't have one handy.</div>
          <input ref={cvFileRef} type="file" accept="application/pdf" style={{ display: 'none' }}
            onChange={e => { const f = e.target.files?.[0]; if (f) uploadCv(f) }} />
          <button onClick={() => cvFileRef.current?.click()} disabled={uploadingCv}
            style={{ width: '100%', padding: '12px 20px', borderRadius: 8, border: '1px dashed rgba(255,255,255,.2)', background: 'transparent', color: 'rgba(255,255,255,.7)', fontSize: 13, fontWeight: 600, cursor: uploadingCv ? 'default' : 'pointer', opacity: uploadingCv ? 0.6 : 1, fontFamily: 'Inter,sans-serif', marginBottom: 10 }}>
            {uploadingCv ? 'Uploading...' : '📎 Upload your CV (PDF)'}
          </button>
          <button onClick={skipCv} disabled={uploadingCv}
            style={{ width: '100%', padding: '10px 20px', borderRadius: 8, border: '1px solid rgba(255,255,255,.1)', background: 'transparent', color: 'rgba(255,255,255,.4)', fontSize: 13, fontWeight: 600, cursor: uploadingCv ? 'default' : 'pointer', fontFamily: 'Inter,sans-serif' }}>
            Skip this step
          </button>
          {sendError && <div style={{ fontSize: 12, color: '#ef4444', marginTop: 12 }}>{sendError}</div>}
        </div>
      </div>
    )
  }

  // ── Assessment (MCQ) stage ──
  if (stage === 'assessment') {
    return (
      <div style={{ ...base, display: 'flex', flexDirection: 'column' }}>
        <video ref={videoRef} autoPlay muted playsInline style={{ display: 'none' }} />
        <canvas ref={canvasRef} style={{ display: 'none' }} />

        <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(255,255,255,.06)', display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 30, height: 30, background: '#13c28e', borderRadius: 8, display: 'grid', placeItems: 'center', flexShrink: 0 }}>
            <svg width="14" height="14" viewBox="0 0 16 16" fill="#0a0a08"><path d="M2 3h12v2H2V3zm0 4h12v2H2V7zm0 4h8v2H2v-2z" /></svg>
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700 }}>{posting.title} — Skills Assessment</div>
            {cameraState === 'granted' && <div style={{ fontSize: 10, color: '#13c28e' }}>● Camera active — proctoring on</div>}
          </div>
          {question && (
            <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 12 }}>
              {timeLeft !== null && (
                <div style={{ fontSize: 13, fontWeight: 700, color: timeLeft <= 10 ? '#ef4444' : 'rgba(255,255,255,.6)', fontVariantNumeric: 'tabular-nums' }}>
                  ⏱ {Math.floor(timeLeft / 60)}:{String(timeLeft % 60).padStart(2, '0')}
                </div>
              )}
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,.4)' }}>Question {question.index} of {question.total}</div>
            </div>
          )}
        </div>

        <div style={{ flex: 1, display: 'grid', placeItems: 'center', padding: 20 }}>
          {cameraState === 'idle' || cameraState === 'requesting' ? (
            <div style={{ ...card, maxWidth: 420, textAlign: 'center' }}>
              <div style={{ fontSize: 28, marginBottom: 10 }}>📷</div>
              <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>Camera access needed</div>
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,.45)', lineHeight: 1.6, marginBottom: 16 }}>This assessment is proctored — please allow camera access to begin. It's used only for periodic snapshots, never continuous recording.</div>
              <button onClick={requestCameraAndBeginAssessment} disabled={cameraState === 'requesting'}
                style={{ width: '100%', padding: '12px 20px', borderRadius: 8, border: 'none', background: '#13c28e', color: '#0a0a08', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'Inter,sans-serif' }}>
                {cameraState === 'requesting' ? 'Requesting access...' : 'Allow Camera & Begin'}
              </button>
            </div>
          ) : cameraState === 'denied' ? (
            <div style={{ ...card, maxWidth: 420, textAlign: 'center' }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: '#ef4444', marginBottom: 8 }}>Camera access was denied</div>
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,.45)', lineHeight: 1.6, marginBottom: 16 }}>This assessment requires camera access to proceed. Please allow it in your browser's site settings, then retry.</div>
              <button onClick={requestCameraAndBeginAssessment}
                style={{ width: '100%', padding: '12px 20px', borderRadius: 8, border: '1px solid rgba(255,255,255,.15)', background: 'transparent', color: 'rgba(255,255,255,.8)', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'Inter,sans-serif' }}>
                Retry
              </button>
            </div>
          ) : !question ? (
            <div style={{ color: 'rgba(255,255,255,.3)', fontSize: 13 }}>Loading question...</div>
          ) : (
            <div style={{ ...card, maxWidth: 560, width: '100%' }}>
              <div style={{ height: 3, background: 'rgba(255,255,255,.06)', borderRadius: 2, marginBottom: 20, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${(question.index / question.total) * 100}%`, background: 'linear-gradient(90deg,#0b7c5e,#13c28e)', transition: 'width .4s' }} />
              </div>
              <div style={{ fontSize: 15, fontWeight: 600, lineHeight: 1.6, marginBottom: 18 }}>{question.question}</div>
              {question.options.map((opt, i) => (
                <div key={i} onClick={() => selectAndSubmit(i)}
                  style={{
                    padding: '12px 14px', borderRadius: 8, marginBottom: 8, cursor: answering ? 'default' : 'pointer', fontSize: 13, lineHeight: 1.5,
                    border: `1px solid ${selectedOption === i ? '#13c28e' : 'rgba(255,255,255,.08)'}`,
                    background: selectedOption === i ? 'rgba(19,194,142,.08)' : '#161614',
                    color: selectedOption === i ? '#13c28e' : 'rgba(255,255,255,.75)',
                    opacity: answering && selectedOption !== i ? 0.5 : 1, transition: 'all .15s',
                  }}>
                  <span style={{ fontWeight: 700, marginRight: 8 }}>{String.fromCharCode(65 + i)}.</span>{opt}
                </div>
              ))}
              {assessmentError && <div style={{ fontSize: 12, color: '#ef4444', marginTop: 10 }}>{assessmentError}</div>}
              {answering && <div style={{ fontSize: 12, color: 'rgba(255,255,255,.35)', marginTop: 10, textAlign: 'center' }}>{question.index === question.total ? 'Finishing...' : 'Saving...'}</div>}
            </div>
          )}
        </div>
      </div>
    )
  }

  // ── Conversational interview stage — voice mode ──
  if (voiceMode && useRealtimeVoice && stage === 'interview' && !awaitingCv && status === 'in_progress') {
    const lastAssistant = [...messages].reverse().find(m => m.role === 'assistant')
    return (
      <div style={{ ...base, display: 'flex', flexDirection: 'column', height: '100vh', justifyContent: 'center', padding: 20 }}>
        <RealtimeVoiceInterface
          wsPath={`/interview/public/${slug}/${sessionId}/voice/ws`}
          authToken={null}
          initialQuestion={lastAssistant?.content}
          interviewerName={posting.interviewer_name}
          onCompleted={(reportReady) => { if (!reportReady) setAwaitingCv(true); else setStatus('completed') }}
          onFallback={() => setUseRealtimeVoice(false)}
        />
      </div>
    )
  }

  if (voiceMode) {
    const lastAssistant = [...messages].reverse().find(m => m.role === 'assistant')
    const lastCandidate = [...messages].reverse().find(m => m.role === 'candidate')
    return (
      <div style={{ ...base, display: 'flex', flexDirection: 'column', height: '100vh' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(255,255,255,.06)', display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 30, height: 30, background: '#e2b04a', borderRadius: 8, display: 'grid', placeItems: 'center', flexShrink: 0 }}>
            <svg width="14" height="14" viewBox="0 0 16 16" fill="#0a0a08"><path d="M8 2C4.68 2 2 4.68 2 8c0 1.76.72 3.35 1.88 4.5L8 8.5l4.12 4A5.97 5.97 0 0014 8c0-3.32-2.68-6-6-6z" /></svg>
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700 }}>{posting.title}</div>
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,.3)' }}>Voice interview with {posting.interviewer_name}</div>
          </div>
        </div>

        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 20, gap: 28 }}>
          <div style={{
            width: 120, height: 120, borderRadius: '50%', display: 'grid', placeItems: 'center',
            background: speaking ? 'radial-gradient(circle,#e2b04a,#b8860b)' : micState === 'recording' ? 'radial-gradient(circle,#ef4444,#b91c1c)' : 'radial-gradient(circle,#161614,#0a0a08)',
            border: '1px solid rgba(255,255,255,.08)',
            boxShadow: speaking ? '0 0 40px rgba(226,176,74,.35)' : micState === 'recording' ? '0 0 40px rgba(239,68,68,.3)' : 'none',
            transition: 'all .3s',
          }}>
            <svg width="40" height="40" viewBox="0 0 16 16" fill={speaking || micState === 'recording' ? '#fff' : 'rgba(255,255,255,.3)'}>
              <path d="M8 2C4.68 2 2 4.68 2 8c0 1.76.72 3.35 1.88 4.5L8 8.5l4.12 4A5.97 5.97 0 0014 8c0-3.32-2.68-6-6-6z" />
            </svg>
          </div>

          <div style={{ textAlign: 'center', maxWidth: 560, minHeight: 60 }}>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', color: 'rgba(255,255,255,.3)', marginBottom: 8 }}>
              {speaking ? `${posting.interviewer_name} is speaking...` : micState === 'recording' ? 'Listening...' : micState === 'transcribing' ? 'Thinking...' : sending ? 'Thinking...' : 'Your turn'}
            </div>
            <div style={{ fontSize: 15, lineHeight: 1.7, color: 'rgba(255,255,255,.85)' }}>
              {micState === 'recording' || micState === 'transcribing' ? (lastHeard || (lastCandidate?.content ?? '')) : (lastAssistant?.content ?? '')}
            </div>
          </div>

          {micButton(76)}
          <div style={{ fontSize: 11.5, color: 'rgba(255,255,255,.35)' }}>
            {micState === 'recording' ? 'Tap to stop' : micState === 'transcribing' ? 'Transcribing your answer...' : speaking ? 'Wait for the question to finish' : 'Tap to answer'}
          </div>
          {micError && <div style={{ fontSize: 12, color: '#ef4444' }}>{micError}</div>}
          {sendError && <div style={{ fontSize: 12, color: '#ef4444' }}>{sendError}</div>}
        </div>

        <details style={{ padding: '12px 20px', borderTop: '1px solid rgba(255,255,255,.06)' }}>
          <summary style={{ fontSize: 11, color: 'rgba(255,255,255,.3)', cursor: 'pointer' }}>Show transcript</summary>
          <div style={{ maxHeight: 200, overflowY: 'auto', marginTop: 10, maxWidth: 720 }}>
            {messages.map((m, i) => (
              <div key={i} style={{ fontSize: 12, marginBottom: 8, color: m.role === 'candidate' ? '#13c28e' : 'rgba(255,255,255,.6)' }}>
                <strong>{m.role === 'candidate' ? 'You' : posting.interviewer_name}:</strong> {m.content}
              </div>
            ))}
            <div ref={endRef} />
          </div>
        </details>
      </div>
    )
  }

  // ── Conversational interview stage — text mode ──
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
        <div style={{ maxWidth: 720, margin: '0 auto', display: 'flex', gap: 10 }}>
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() } }}
            placeholder="Type your answer..."
            disabled={sending}
            style={{ ...inputSt, flex: 1 }}
          />
          <button onClick={() => sendMessage()} disabled={sending || !input.trim()}
            style={{ padding: '0 22px', borderRadius: 8, border: 'none', background: '#13c28e', color: '#0a0a08', fontSize: 13, fontWeight: 700, cursor: sending ? 'default' : 'pointer', opacity: (sending || !input.trim()) ? 0.5 : 1, fontFamily: 'Inter,sans-serif' }}>
            Send
          </button>
        </div>
        {sendError && <div style={{ maxWidth: 720, margin: '8px auto 0', fontSize: 12, color: '#ef4444' }}>{sendError}</div>}
      </div>
    </div>
  )
}