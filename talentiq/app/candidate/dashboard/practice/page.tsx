'use client'
import { useState } from 'react'
import Link from 'next/link'
import ModeSelectionScreen from '@/components/modules/interview-engine/ModeSelectionScreen'
import { InterviewMode } from '@/components/modules/interview-engine/modeData'
import PracticeConfigForm, { PracticeConfigValues } from '@/components/modules/practice/PracticeConfigForm'
import PracticeChatInterface from '@/components/modules/practice/PracticeChatInterface'
import PracticeAssessmentInterface from '@/components/modules/practice/PracticeAssessmentInterface'
import PracticeVoiceInterface from '@/components/modules/practice/PracticeVoiceInterface'
import AIFeedbackReport from '@/components/modules/reports/AIFeedbackReport'
import { AnimatedButton, GlassCard } from '@/components/shared/primitives'
import { api } from '@/lib/api'

type Step = 'select' | 'configure' | 'session' | 'report'

export default function InterviewPracticePage() {
  const [step, setStep] = useState<Step>('select')
  const [mode, setMode] = useState<InterviewMode | null>(null)
  const [session, setSession] = useState<any>(null)   // PracticeSessionStateResponse
  const [report, setReport] = useState<any>(null)      // PracticeReportResponse
  const [starting, setStarting] = useState(false)
  const [startError, setStartError] = useState('')
  const [reportLoading, setReportLoading] = useState(false)

  const chooseMode = (m: InterviewMode) => { setMode(m); setStep('configure') }

  const startSession = async (values: PracticeConfigValues) => {
    if (!mode) return
    setStarting(true)
    setStartError('')
    try {
      const s = await api.createPracticeSession({ mode, ...values })
      setSession(s)
      setStep('session')
    } catch (err: any) {
      setStartError(err.message || 'Could not start the practice session.')
    } finally {
      setStarting(false)
    }
  }

  const handleComplete = async () => {
    if (!session) return
    setReportLoading(true)
    try {
      const r = await api.getPracticeReport(session.id)
      setReport(r)
      setStep('report')
    } catch {
      // Session did complete server-side even if the report fetch hiccups —
      // let them retry from here rather than losing the finished session.
      setStep('report')
    } finally {
      setReportLoading(false)
    }
  }

  const startOver = () => { setStep('select'); setMode(null); setSession(null); setReport(null); setStartError('') }

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
          <ModeSelectionScreen
            eyebrow="AI Career Coach"
            heading="Practice Your Interview Skills"
            subheading="Same AI engines recruiters use — practice risk-free before the real thing."
            ctaLabel="Start Practice →"
            onSelect={chooseMode}
          />
        )}

        {step === 'configure' && mode && (
          <PracticeConfigForm mode={mode} onStart={startSession} starting={starting} error={startError} onBack={() => setStep('select')} />
        )}

        {step === 'session' && session && mode === 'chatbot' && (
          <PracticeChatInterface sessionId={session.id} initialTranscript={session.transcript} interviewerName={session.interviewer_name} onComplete={handleComplete} />
        )}
        {step === 'session' && session && mode === 'mcq' && (
          <PracticeAssessmentInterface sessionId={session.id} initialQuestions={session.assessment_questions} initialIndex={session.assessment_current_index} onComplete={handleComplete} />
        )}
        {step === 'session' && session && mode === 'voice_agent' && (
          <PracticeVoiceInterface sessionId={session.id} initialTranscript={session.transcript} interviewerName={session.interviewer_name} onComplete={handleComplete} />
        )}

        {step === 'session' && reportLoading && (
          <div style={{ textAlign: 'center', marginTop: 20, fontSize: 12.5, color: 'rgba(255,255,255,.35)' }}>Wrapping up your session...</div>
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