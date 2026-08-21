'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import ModeSelectionScreen from '@/components/modules/interview-engine/ModeSelectionScreen'
import ReadinessScreen from '@/components/modules/interview-engine/ReadinessScreen'
import { getModeDefinition, InterviewMode } from '@/components/modules/interview-engine/modeData'
import PracticeConfigForm, { PracticeConfigValues } from '@/components/modules/practice/PracticeConfigForm'
import PracticeChatInterface from '@/components/modules/practice/PracticeChatInterface'
import PracticeAssessmentInterface from '@/components/modules/practice/PracticeAssessmentInterface'
import PracticeVoiceInterface from '@/components/modules/practice/PracticeVoiceInterface'
import RealtimeVoiceInterface from '@/components/modules/voice-engine/RealtimeVoiceInterface'
import AIFeedbackReport from '@/components/modules/reports/AIFeedbackReport'
import { AnimatedButton, GlassCard, LoadingSkeleton } from '@/components/shared/primitives'
import { api } from '@/lib/api'

type Step = 'select' | 'configure' | 'readiness' | 'session' | 'processing' | 'report'

const EVALUATION_AREAS: Record<InterviewMode, string[]> = {
  chatbot: ['Communication clarity', 'Technical depth', 'Real project experience'],
  mcq: ['Accuracy across categories', 'Speed under time pressure'],
  voice_agent: ['Spoken communication', 'Technical reasoning', 'Real project experience'],
}

export default function InterviewPracticePage() {
  const [step, setStep] = useState<Step>('select')
  const [mode, setMode] = useState<InterviewMode | null>(null)
  const [pendingConfig, setPendingConfig] = useState<PracticeConfigValues | null>(null)
  const [session, setSession] = useState<any>(null)
  const [report, setReport] = useState<any>(null)
  const [starting, setStarting] = useState(false)
  const [startError, setStartError] = useState('')
  const [processingAttempts, setProcessingAttempts] = useState(0)
  const [useRealtimeVoice, setUseRealtimeVoice] = useState(true)
  const [resumable, setResumable] = useState<any>(null)
  const [recovering, setRecovering] = useState(true)

  const STORAGE_KEY = 'practice_active_session'

  useEffect(() => {
    api.getPracticeHistory().then((items: any[]) => {
      const inProgress = items?.find(i => i.status === 'in_progress')
      if (inProgress) setResumable(inProgress)
    }).catch(() => {})

    // Mid-session refresh recovery — mirrors the recruiter interview page's
    // sessionStorage-cache-then-verify pattern. The cache is NEVER trusted
    // directly: it only carries a session id + which step the candidate was
    // on, and every field actually rendered comes from a fresh, verified
    // getPracticeSession() call, exactly like a normal resume.
    let cached: { sessionId?: string; step?: Step } | null = null
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY)
      cached = raw ? JSON.parse(raw) : null
    } catch {
      sessionStorage.removeItem(STORAGE_KEY)
    }
    if (!cached?.sessionId) { setRecovering(false); return }

    api.getPracticeSession(cached.sessionId)
      .then(async (s: any) => {
        if (s.status === 'completed') {
          // Never resume a completed session as active. If the report is
          // genuinely ready, show it; otherwise fall back to the normal
          // select screen rather than inventing a completed-looking state.
          sessionStorage.removeItem(STORAGE_KEY)
          try {
            const r = await api.getPracticeReport(s.id)
            const hasContent = r.ai_score != null || r.assessment_score != null || r.deep_analysis || r.experience_assessment
            if (r.status === 'completed' && hasContent) {
              setSession(s)
              setReport(r)
              setStep('report')
            }
          } catch { /* no report yet — leave step at 'select' */ }
        } else if (s.status === 'in_progress') {
          setSession(s)
          setMode(s.mode)
          if (cached!.step === 'processing') {
            setStep('processing')
            setProcessingAttempts(1)
          } else {
            setStep('session')
          }
        } else {
          sessionStorage.removeItem(STORAGE_KEY)
        }
      })
      .catch(() => { sessionStorage.removeItem(STORAGE_KEY) })
      .finally(() => setRecovering(false))
  }, [])

  // Keep the cache in sync with whatever's actually recoverable. Only
  // 'session' and 'processing' are ever cached — 'select'/'configure'/
  // 'readiness' have no server session yet (or none worth resuming into),
  // and 'report' means the session already reached its real terminal state.
  useEffect(() => {
    if (session?.id && (step === 'session' || step === 'processing')) {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ sessionId: session.id, step }))
    } else {
      sessionStorage.removeItem(STORAGE_KEY)
    }
  }, [session, step])

  const chooseMode = (m: InterviewMode) => { setMode(m); setStep('configure') }

  const collectConfig = (values: PracticeConfigValues) => { setPendingConfig(values); setStep('readiness') }

  const confirmStart = async () => {
    if (!mode || !pendingConfig) return
    setStarting(true)
    setStartError('')
    try {
      const s = await api.createPracticeSession({ mode, ...pendingConfig })
      setSession(s)
      setStep('session')
    } catch (err: any) {
      setStartError(err.message || 'Could not start the practice session.')
    } finally {
      setStarting(false)
    }
  }

  const resumeSession = async (sessionId: string) => {
    try {
      const s = await api.getPracticeSession(sessionId)
      setSession(s)
      setMode(s.mode)
      setStep('session')
    } catch {
      setResumable(null)
    }
  }

  const fetchReport = async (): Promise<boolean> => {
    if (!session) return false
    try {
      const r = await api.getPracticeReport(session.id)
      // A report is genuinely ready once the model has actually written something —
      // an empty shell (no score, no analysis) means finalize hasn't landed yet.
      const hasContent = r.ai_score != null || r.assessment_score != null || r.deep_analysis || r.experience_assessment
      if (r.status === 'completed' && hasContent) {
        setReport(r)
        setStep('report')
        return true
      }
      return false
    } catch {
      return false
    }
  }

  const handleComplete = async () => {
    setStep('processing')
    setProcessingAttempts(0)
    const ready = await fetchReport()
    if (!ready) setProcessingAttempts(1)
  }

  useEffect(() => {
    if (step !== 'processing' || processingAttempts === 0 || processingAttempts > 6) return
    const t = setTimeout(async () => {
      const ready = await fetchReport()
      if (!ready) setProcessingAttempts(a => a + 1)
    }, 1500)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [processingAttempts, step])

  const startOver = () => {
    sessionStorage.removeItem(STORAGE_KEY)
    setStep('select'); setMode(null); setPendingConfig(null); setSession(null); setReport(null); setStartError(''); setProcessingAttempts(0)
  }

  if (recovering) {
    return (
      <div style={{ minHeight: '100vh', background: '#0c0c0a', display: 'grid', placeItems: 'center' }}>
        <div style={{ color: 'rgba(255,255,255,.3)', fontSize: 13 }}>Restoring your session...</div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: '#0c0c0a', fontFamily: 'Syne, sans-serif', color: 'rgba(255,255,255,.88)' }}>
      <div style={{ height: 56, borderBottom: '1px solid rgba(255,255,255,.07)', display: 'flex', alignItems: 'center', padding: '0 28px', gap: 16 }}>
        <Link href="/candidate/dashboard" style={{ color: 'rgba(255,255,255,.4)', textDecoration: 'none', fontSize: 13 }}>← Dashboard</Link>
        <span style={{ color: 'rgba(255,255,255,.15)' }}>·</span>
        <span style={{ fontSize: 13, color: 'rgba(255,255,255,.6)', fontWeight: 600 }}>Interview Practice</span>
        <span style={{ flex: 1 }} />
        <Link href="/candidate/dashboard/practice/history" style={{ color: 'rgba(255,255,255,.4)', textDecoration: 'none', fontSize: 12.5 }}>Practice History →</Link>
      </div>

      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '40px 24px' }}>
        {step === 'select' && (
          <>
            {resumable && (
              <GlassCard style={{ maxWidth: 560, margin: '0 auto 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14 }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#fff' }}>Resume your {getModeDefinition(resumable.mode).title.toLowerCase()}?</div>
                  <div style={{ fontSize: 11.5, color: 'rgba(255,255,255,.4)', marginTop: 2 }}>{resumable.target_role} — in progress</div>
                </div>
                <AnimatedButton onClick={() => resumeSession(resumable.id)}>Resume →</AnimatedButton>
              </GlassCard>
            )}
            <ModeSelectionScreen
              eyebrow="AI Career Coach"
              heading="Practice Your Interview Skills"
              subheading="Same AI engines recruiters use — practice risk-free before the real thing."
              ctaLabel="Start Practice →"
              onSelect={chooseMode}
            />
          </>
        )}

        {step === 'configure' && mode && (
          <PracticeConfigForm mode={mode} onStart={collectConfig} starting={false} error="" onBack={() => setStep('select')} />
        )}

        {step === 'readiness' && mode && pendingConfig && (
          <ReadinessScreen
            mode={mode}
            title={pendingConfig.target_role}
            evaluationAreas={EVALUATION_AREAS[mode]}
            onStart={confirmStart}
            starting={starting}
            startError={startError}
          />
        )}

        {step === 'session' && session && mode === 'chatbot' && (
          <PracticeChatInterface sessionId={session.id} initialTranscript={session.transcript} interviewerName={session.interviewer_name} onComplete={handleComplete} />
        )}
        {step === 'session' && session && mode === 'mcq' && (
          <PracticeAssessmentInterface sessionId={session.id} initialQuestions={session.assessment_questions} initialIndex={session.assessment_current_index} onComplete={handleComplete} />
        )}
        {step === 'session' && session && mode === 'voice_agent' && useRealtimeVoice && (
          <RealtimeVoiceInterface
            wsPath={`/practice/sessions/${session.id}/voice/ws`}
            authToken={typeof window !== 'undefined' ? localStorage.getItem('token') : null}
            initialQuestion={session.transcript?.[session.transcript.length - 1]?.role === 'assistant' ? session.transcript[session.transcript.length - 1].content : undefined}
            interviewerName={session.interviewer_name}
            onCompleted={handleComplete}
            onFallback={() => setUseRealtimeVoice(false)}
          />
        )}
        {step === 'session' && session && mode === 'voice_agent' && !useRealtimeVoice && (
          <PracticeVoiceInterface sessionId={session.id} initialTranscript={session.transcript} interviewerName={session.interviewer_name} onComplete={handleComplete} />
        )}

        {step === 'processing' && (
          <div className="scale-in" style={{ maxWidth: 420, margin: '60px auto 0', textAlign: 'center' }}>
            <div style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 22, fontWeight: 600, marginBottom: 8 }}>Interview submitted</div>
            <div style={{ fontSize: 12.5, color: 'rgba(255,255,255,.4)', marginBottom: 20 }}>
              {processingAttempts > 6 ? 'Taking longer than usual — you can check back from your history.' : 'Your report is being prepared...'}
            </div>
            {processingAttempts <= 6 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxWidth: 280, margin: '0 auto' }}>
                <LoadingSkeleton height={12} /><LoadingSkeleton height={12} width="80%" /><LoadingSkeleton height={12} width="60%" />
              </div>
            ) : (
              <Link href="/candidate/dashboard/practice/history">
                <AnimatedButton>Go to Practice History →</AnimatedButton>
              </Link>
            )}
          </div>
        )}

        {step === 'report' && report && (
          <div className="scale-in" style={{ maxWidth: 640, margin: '0 auto' }}>
            <div style={{ textAlign: 'center', marginBottom: 24 }}>
              <div style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 26, fontWeight: 600, marginBottom: 6 }}>Session complete</div>
              <div style={{ fontSize: 12.5, color: 'rgba(255,255,255,.4)' }}>{report.target_role} · here's your real feedback</div>
            </div>
            <AIFeedbackReport data={report} />
            <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
              <AnimatedButton variant="secondary" onClick={startOver}>Practice Again</AnimatedButton>
              <Link href="/candidate/dashboard/practice/history" style={{ flex: 1 }}>
                <AnimatedButton fullWidth>View Practice History →</AnimatedButton>
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}