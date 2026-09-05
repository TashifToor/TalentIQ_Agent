'use client'
import { useState } from 'react'
import { api } from '@/lib/api'
import { StepHeader, AnimatedButton } from '@/components/shared/primitives'
import { useTheme } from '@/lib/theme-provider'
import { BuilderFormData, DEFAULT_FORM_DATA, parseBankText } from '@/components/modules/interview-engine/formData'
import { getModeDefinition, InterviewMode } from '@/components/modules/interview-engine/modeData'
import ModeSelectionScreen from '@/components/modules/interview-engine/ModeSelectionScreen'
import CopilotPanel from '@/components/modules/copilot/CopilotPanel'
import ChatConfig from './chat/ChatConfig'
import AssessmentConfig from './assessment/AssessmentConfig'
import VoiceConfig from './voice/VoiceConfig'
import AIReviewStep from './AIReviewStep'
import FinalReviewStep from './FinalReviewStep'
import LinkGeneratedStep from './LinkGeneratedStep'

type WizardStep = 'select' | 'configure' | 'ai_review' | 'final_review'
const STEP_ORDER: WizardStep[] = ['select', 'configure', 'ai_review', 'final_review']

export default function InterviewBuilderWizard({
  onCreated, onCancel,
}: { onCreated: (posting: any) => void; onCancel: () => void }) {
  const { theme } = useTheme()
  const light = theme === 'light'
  const [step, setStep] = useState<WizardStep>('select')
  const [data, setData] = useState<BuilderFormData>(DEFAULT_FORM_DATA)
  const [configError, setConfigError] = useState('')
  const [saving, setSaving] = useState(false)
  const [genError, setGenError] = useState('')
  const [createdPosting, setCreatedPosting] = useState<any>(null)

  const patch = (p: Partial<BuilderFormData>) => setData(prev => ({ ...prev, ...p }))

  const stepIndex = STEP_ORDER.indexOf(step)
  const goBack = () => {
    setConfigError('')
    if (stepIndex > 0) setStep(STEP_ORDER[stepIndex - 1])
    else onCancel()
  }

  const selectMode = (mode: InterviewMode) => {
    patch({ mode })
    setStep('configure')
  }

  const validateConfigure = (): boolean => {
    if (!data.title.trim() || !data.jd.trim()) {
      setConfigError('Role title and job description are required.')
      return false
    }
    if (data.mode === 'mcq') {
      if (data.assessmentSource === 'ai') {
        const total = Object.values(data.assessmentCounts).reduce((a, b) => a + b, 0)
        if (total < 10 || total > 50) {
          setConfigError(`Total questions across categories must be 10–50 (currently ${total}).`)
          return false
        }
      } else {
        const bank = parseBankText(data.assessmentBankText)
        if (bank.length < 10) {
          setConfigError(`Question bank needs at least 10 valid questions (found ${bank.length}). Check the format.`)
          return false
        }
      }
    }
    setConfigError('')
    return true
  }

  const continueFromConfigure = () => {
    if (validateConfigure()) setStep('ai_review')
  }

  const generate = async () => {
    setSaving(true)
    setGenError('')
    try {
      const extra = data.extraQuestions.split('\n').map(q => q.trim()).filter(Boolean)
      const bank = data.mode === 'mcq' && data.assessmentSource === 'bank' ? parseBankText(data.assessmentBankText) : undefined
      const posting = await api.createInterviewPosting({
        title: data.title.trim(), company: data.company.trim() || undefined, job_description: data.jd.trim(),
        extra_questions: extra, interviewer_name: data.interviewerName.trim() || undefined,
        mode: data.mode,
        assessment_source: data.mode === 'mcq' ? data.assessmentSource : undefined,
        assessment_count_dsa: data.mode === 'mcq' && data.assessmentSource === 'ai' ? data.assessmentCounts.dsa : undefined,
        assessment_count_job_desc: data.mode === 'mcq' && data.assessmentSource === 'ai' ? data.assessmentCounts.job_desc : undefined,
        assessment_count_problem_solving: data.mode === 'mcq' && data.assessmentSource === 'ai' ? data.assessmentCounts.problem_solving : undefined,
        assessment_count_teamwork: data.mode === 'mcq' && data.assessmentSource === 'ai' ? data.assessmentCounts.teamwork : undefined,
        assessment_count_hr: data.mode === 'mcq' && data.assessmentSource === 'ai' ? data.assessmentCounts.hr : undefined,
        assessment_seconds_per_question: data.mode === 'mcq' ? data.secondsPerQuestion : undefined,
        notify_hr_on_completion: data.notifyOnCompletion,
        assessment_bank: bank,
      })
      setCreatedPosting(posting)
    } catch (e: any) {
      setGenError(e?.message || 'Could not create interview posting.')
    } finally {
      setSaving(false)
    }
  }

  if (createdPosting) {
    return <LinkGeneratedStep posting={createdPosting} onDone={() => onCreated(createdPosting)} />
  }

  if (step === 'select') {
    // ModeSelectionScreen is theme-reactive (follows the active global theme) —
    // this wrapper just needs to match, so it can't be a permanently-dark surface.
    return (
      <div style={{ background: light ? 'var(--dash-bg)' : '#111110', border: `1px solid ${light ? 'var(--dash-border)' : 'rgba(255,255,255,.06)'}`, borderRadius: 16, padding: 24 }}>
        <ModeSelectionScreen onSelect={selectMode} sidePanel={<CopilotPanel context="job_creation" defaultCollapsed />} />
      </div>
    )
  }

  const mode = getModeDefinition(data.mode)
  const titles: Record<WizardStep, { title: string; subtitle?: string }> = {
    select: { title: '' },
    configure: { title: `Configure — ${mode.title}`, subtitle: mode.tagline },
    ai_review: { title: 'AI Review', subtitle: 'A quick sanity-check before you generate the link.' },
    final_review: { title: 'Final Review', subtitle: 'Confirm the details, then generate the shareable link.' },
  }

  return (
    <div key={step} className="wizard-step-in">
      <StepHeader title={titles[step].title} subtitle={titles[step].subtitle} step={stepIndex + 1} totalSteps={STEP_ORDER.length} onBack={goBack} light />

      {step === 'configure' && (
        <div className="builder-with-copilot">
          <div style={{ flex: 1 }}>
            {data.mode === 'chatbot' && <ChatConfig data={data} onChange={patch} />}
            {data.mode === 'mcq' && <AssessmentConfig data={data} onChange={patch} />}
            {data.mode === 'voice_agent' && <VoiceConfig data={data} onChange={patch} />}
            {configError && <div className="shake" style={{ fontSize: 12, color: '#ef4444', marginTop: 14 }}>{configError}</div>}
            <div style={{ marginTop: 20, maxWidth: 260 }}>
              <AnimatedButton onClick={continueFromConfigure} fullWidth>Continue to AI Review →</AnimatedButton>
            </div>
          </div>
          <CopilotPanel context="interview_builder" jd={data.jd} />
        </div>
      )}

      {step === 'ai_review' && (
        <>
          <AIReviewStep data={data} />
          <div style={{ marginTop: 20, maxWidth: 260 }}>
            <AnimatedButton onClick={() => setStep('final_review')} fullWidth>Continue →</AnimatedButton>
          </div>
        </>
      )}

      {step === 'final_review' && (
        <FinalReviewStep data={data} onChange={patch} onGenerate={generate} saving={saving} error={genError} />
      )}
    </div>
  )
}