'use client'
import { useState, useRef } from 'react'
import { GlassCard, AnimatedButton, GradientBadge } from '@/components/shared/primitives'
import { getModeDefinition, InterviewMode } from '@/components/modules/interview-engine/modeData'
import { api } from '@/lib/api'

const inputSt = { background: '#161614', border: '1px solid rgba(255,255,255,.08)', borderRadius: 8, padding: '11px 14px', fontSize: 13, fontFamily: 'Inter,sans-serif', color: 'rgba(255,255,255,.85)', outline: 'none', width: '100%' } as const

export interface PracticeConfigValues {
  target_role: string
  experience_level?: string
  difficulty?: string
  length_minutes: number
  skills_focus: string[]
  job_description?: string
  resume_text?: string
}

export default function PracticeConfigForm({
  mode, onStart, starting, error, onBack,
}: { mode: InterviewMode; onStart: (v: PracticeConfigValues) => void; starting: boolean; error: string; onBack: () => void }) {
  const m = getModeDefinition(mode)
  const [targetRole, setTargetRole] = useState('')
  const [experienceLevel, setExperienceLevel] = useState('')
  const [difficulty, setDifficulty] = useState('')
  const [lengthMinutes, setLengthMinutes] = useState(15)
  const [skillsFocus, setSkillsFocus] = useState('')
  const [jd, setJd] = useState('')
  const [resumeText, setResumeText] = useState('')
  const [resumeFileName, setResumeFileName] = useState('')
  const [uploadingResume, setUploadingResume] = useState(false)
  const [localError, setLocalError] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  const handleResumeFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (!f) return
    setUploadingResume(true)
    setLocalError('')
    try {
      const formData = new FormData()
      formData.append('file', f)
      const res = await api.uploadCV(formData)
      const extracted = typeof res === 'string' ? res : (res as any)?.cv_text || (res as any)?.text || ''
      setResumeText(extracted)
      setResumeFileName(f.name)
    } catch (err: any) {
      setLocalError(err.message || 'Could not read that file.')
    } finally {
      setUploadingResume(false)
    }
  }

  const handleStart = () => {
    if (!targetRole.trim()) { setLocalError('Target role is required.'); return }
    setLocalError('')
    onStart({
      target_role: targetRole.trim(),
      experience_level: experienceLevel || undefined,
      difficulty: difficulty || undefined,
      length_minutes: lengthMinutes,
      skills_focus: skillsFocus.split(',').map(s => s.trim()).filter(Boolean),
      job_description: jd.trim() || undefined,
      resume_text: resumeText || undefined,
    })
  }

  return (
    <div className="wizard-step-in" style={{ maxWidth: 900, margin: '0 auto' }}>
      <button onClick={onBack} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,.4)', cursor: 'pointer', fontSize: 12.5, marginBottom: 18 }}>← Choose a different mode</button>

      <div className="builder-2col">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, display: 'grid', placeItems: 'center', fontSize: 17, background: `${m.accent}18` }}>{m.icon}</div>
            <div style={{ fontSize: 17, fontWeight: 700, color: '#fff' }}>Configure your {m.title.replace('AI ', '')}</div>
          </div>

          <input placeholder="Target role — e.g. Backend Engineer" value={targetRole} onChange={e => setTargetRole(e.target.value)} className="premium-input" style={{ ...inputSt, marginBottom: 10 }} />

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
            <select value={experienceLevel} onChange={e => setExperienceLevel(e.target.value)} className="premium-input" style={inputSt}>
              <option value="">Experience level (optional)</option>
              <option value="junior">Junior</option>
              <option value="mid">Mid-level</option>
              <option value="senior">Senior</option>
            </select>
            <select value={difficulty} onChange={e => setDifficulty(e.target.value)} className="premium-input" style={inputSt}>
              <option value="">Difficulty (optional)</option>
              <option value="easy">Easy</option>
              <option value="medium">Medium</option>
              <option value="hard">Hard</option>
            </select>
          </div>

          <div style={{ marginBottom: 10 }}>
            <label style={{ fontSize: 11, color: 'rgba(255,255,255,.4)', display: 'block', marginBottom: 6 }}>Interview length</label>
            <div style={{ display: 'flex', gap: 8 }}>
              {[10, 15, 20, 30].map(min => (
                <button key={min} onClick={() => setLengthMinutes(min)} style={{
                  flex: 1, padding: '9px 0', borderRadius: 8, cursor: 'pointer', fontSize: 12.5, fontWeight: 700,
                  border: `1.5px solid ${lengthMinutes === min ? m.accent : 'rgba(255,255,255,.08)'}`,
                  background: lengthMinutes === min ? `${m.accent}18` : '#161614',
                  color: lengthMinutes === min ? m.accent : 'rgba(255,255,255,.5)',
                }}>{min} min</button>
              ))}
            </div>
          </div>

          <input placeholder="Skills to focus on — comma separated (e.g. FastAPI, PostgreSQL, system design)"
            value={skillsFocus} onChange={e => setSkillsFocus(e.target.value)} className="premium-input" style={{ ...inputSt, marginBottom: 10 }} />

          <textarea placeholder="Job description (optional) — practice against a real posting" value={jd} onChange={e => setJd(e.target.value)}
            className="premium-input" style={{ ...inputSt, minHeight: 90, resize: 'vertical', marginBottom: 10, fontFamily: 'Inter,sans-serif' }} />

          <div style={{ marginBottom: 10 }}>
            <input ref={fileRef} type="file" accept=".pdf,.docx,.doc" onChange={handleResumeFile} style={{ display: 'none' }} />
            <div onClick={() => fileRef.current?.click()} style={{
              border: `1.5px dashed ${resumeFileName ? 'rgba(19,194,142,.4)' : 'rgba(255,255,255,.12)'}`, borderRadius: 8, padding: '11px 14px',
              fontSize: 12, color: resumeFileName ? '#13c28e' : 'rgba(255,255,255,.4)', cursor: 'pointer', textAlign: 'center',
            }}>
              {uploadingResume ? 'Uploading...' : resumeFileName ? `✅ ${resumeFileName} — resume attached (optional)` : '📄 Attach resume (optional)'}
            </div>
          </div>

          {(localError || error) && <div className="shake" style={{ fontSize: 12, color: '#ef4444', marginBottom: 10 }}>{localError || error}</div>}
          <AnimatedButton onClick={handleStart} loading={starting} fullWidth>Continue →</AnimatedButton>
        </div>

        <GlassCard style={{ alignSelf: 'start' }}>
          <div style={{ fontSize: 10.5, fontWeight: 700, color: 'rgba(255,255,255,.35)', textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 12 }}>What to expect</div>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,.6)', lineHeight: 1.7, marginBottom: 12 }}>
            {mode === 'chatbot' && 'A text conversation with an AI interviewer — self-intro, then education, skills, and project deep-dives based on what you tell it.'}
            {mode === 'mcq' && `A set of multiple-choice questions across DSA, job-specific, problem-solving, teamwork, and HR categories, sized to your ${lengthMinutes}-minute length.`}
            {mode === 'voice_agent' && 'You speak your answers — tap to record, we transcribe with Whisper, and the AI responds. This is push-to-talk, not a real-time phone-call-style conversation: there\'s a short pause after each answer while it\'s transcribed, and the AI can\'t be interrupted mid-sentence yet.'}
          </div>
          {mode === 'voice_agent' && (
            <div style={{ marginBottom: 8 }}><GradientBadge label="Push-to-talk, not real-time" tone="neutral" icon="ℹ" /></div>
          )}
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,.35)' }}>You'll get a feedback report immediately after — real scores from this session, nothing pre-written.</div>
        </GlassCard>
      </div>
    </div>
  )
}