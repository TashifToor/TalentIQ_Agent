'use client'
import { useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { api } from '@/lib/api'
import IntelligenceCarousel from '@/components/IntelligenceCarousel'
import { useTheme } from '@/lib/theme-provider'

type Step = 'upload' | 'analyzing' | 'result'

function cvDataToText(cv: any): string {
  const lines: string[] = []
  lines.push(cv.full_name || '')
  if (cv.role_title) lines.push(cv.role_title)
  const allSkills = (cv.skill_groups || []).length ? cv.skill_groups.flatMap((g: any) => g.items) : (cv.skills || [])
  if (cv.summary) lines.push('\nSUMMARY\n' + cv.summary)
  if (allSkills.length) lines.push('\nSKILLS\n' + allSkills.join(', '))
  if ((cv.experience || []).length) {
    lines.push('\nEXPERIENCE')
    cv.experience.forEach((e: any) => {
      lines.push(`${e.title} at ${e.company} (${e.start_date} - ${e.end_date || 'Present'})`)
        ; (e.bullets || []).filter(Boolean).forEach((b: string) => lines.push('- ' + b))
    })
  }
  if ((cv.projects || []).length) {
    lines.push('\nPROJECTS')
    cv.projects.forEach((p: any) => lines.push(`${p.name}: ${p.description} [${p.tech_stack}]`))
  }
  return lines.join('\n')
}

const CHECKLIST = ['Reading experience', 'Comparing role requirements', 'Evaluating skills', 'Preparing recommendations']

function AnalyzingState() {
  const [step, setStep] = useState(0)
  useState(() => { const t = setInterval(() => setStep(s => Math.min(CHECKLIST.length - 1, s + 1)), 900); return () => clearInterval(t) })
  return (
    <div style={{ padding: '50px 0', maxWidth: 360, margin: '0 auto' }}>
      <h3 style={{ fontFamily: 'Inter, sans-serif', fontSize: 20, marginBottom: 22, textAlign: 'center', color: 'var(--dash-text)' }}>Analyzing your CV…</h3>
      {CHECKLIST.map((label, i) => (
        <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12, fontSize: 13, color: i < step ? '#34d399' : i === step ? '#e2b04a' : 'var(--dash-text-muted)' }}>
          <span style={{ width: 16, textAlign: 'center' }}>{i < step ? '✓' : i === step ? '●' : '○'}</span>
          {label}
        </div>
      ))}
    </div>
  )
}

export default function CVOptimizer() {
  const router = useRouter()
  const { theme } = useTheme()
  const [step, setStep] = useState<Step>('upload')
  const [jd, setJd] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [cvData, setCvData] = useState<any>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<any>(null)
  const [scoreHistory, setScoreHistory] = useState<number[]>([])
  const fileRef = useRef<HTMLInputElement>(null)

  const handlePickFile = () => fileRef.current?.click()

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (!f) return
    setError('')
    setFile(f)
    setUploading(true)
    try {
      const data = await api.parseCVForBuilder(f)
      setCvData(data)
    } catch (err: any) {
      setError(err.message || 'Upload failed — could not read your CV.')
      setFile(null)
    } finally {
      setUploading(false)
    }
  }

  const runAnalysis = async () => {
    if (!cvData) { setError('Upload your CV first.'); return }
    if (!jd.trim()) { setError('Paste a job description first.'); return }
    setError('')
    setStep('analyzing')
    try {
      const data = await api.optimizeCandidateCv(cvDataToText(cvData), jd.trim())
      setResult(data)
      setScoreHistory(h => [...h, data.overall_score])
      setStep('result')
    } catch (err: any) {
      setError(err.message || "Analysis couldn't be completed.")
      setStep('upload')
    }
  }

  const handleImproveCv = () => {
    if (!cvData) return
    try {
      sessionStorage.setItem('talentiq_cv_handoff', JSON.stringify({ cv: cvData, focus: 'summary', jd: jd.trim(), timestamp: Date.now() }))
    } catch { }
    router.push('/candidate/dashboard/cv-builder')
  }

  const handlePractice = () => router.push('/candidate/dashboard/practice')

  return (
    <div style={{ minHeight: '100vh', background: 'var(--dash-bg)', fontFamily: 'Inter, sans-serif', color: 'var(--dash-text)' }}>
      <div style={{ height: 56, borderBottom: '1px solid var(--dash-border-soft)', display: 'flex', alignItems: 'center', padding: '0 28px', gap: 16 }}>
        <Link href="/candidate/dashboard" style={{ color: 'var(--dash-text-muted)', textDecoration: 'none', fontSize: 13 }}>← Dashboard</Link>
        <span style={{ color: 'var(--dash-text-faint)' }}>·</span>
        <span style={{ fontSize: 13, color: 'var(--dash-text)', fontWeight: 600 }}>CV Optimizer</span>
      </div>

      <div style={{ maxWidth: 900, margin: '0 auto', padding: '40px 24px 60px' }}>
        {step !== 'result' && (
          <div style={{ marginBottom: 32 }}>
            <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.14em', textTransform: 'uppercase', color: '#e2b04a', marginBottom: 12 }}>Improve your CV for this job</p>
            <h1 style={{ fontFamily: 'Inter, sans-serif', fontSize: 'clamp(28px,4vw,42px)', fontWeight: 600, letterSpacing: '-.5px', marginBottom: 10 }}>CV Optimizer</h1>
            <p style={{ fontSize: 14, color: 'var(--dash-text-muted)', lineHeight: 1.7, maxWidth: 560 }}>
              Upload your CV and a job description — see your real fit, close the gaps, and re-check your progress as you improve.
            </p>
          </div>
        )}

        {step === 'upload' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 640 }}>
            <div style={{ background: 'var(--dash-surface)', border: '1px solid var(--dash-border-soft)', borderRadius: 14, padding: 24 }}>
              <div style={{ fontSize: 12, fontWeight: 600, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--dash-text-muted)', marginBottom: 12 }}>Your CV</div>
              <input ref={fileRef} type="file" accept=".pdf,.docx,.doc" onChange={handleFileChange} style={{ display: 'none' }} />
              <div onClick={handlePickFile}
                style={{ border: `2px dashed ${cvData ? 'rgba(19,194,142,.4)' : 'var(--dash-overlay-14)'}`, borderRadius: 10, padding: 32, textAlign: 'center', cursor: 'pointer', background: 'var(--dash-surface-2)' }}>
                <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4, color: 'var(--dash-text)' }}>
                  {uploading ? 'Uploading…' : file ? file.name : 'Click to upload your CV'}
                </div>
                <div style={{ fontSize: 12, color: 'var(--dash-text-muted)' }}>PDF or DOCX · Max 10MB</div>
              </div>
            </div>

            <div style={{ background: 'var(--dash-surface)', border: '1px solid var(--dash-border-soft)', borderRadius: 14, padding: 24 }}>
              <div style={{ fontSize: 12, fontWeight: 600, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--dash-text-muted)', marginBottom: 12 }}>Target Job Description</div>
              <textarea value={jd} onChange={e => setJd(e.target.value)} placeholder="Paste the job description here…"
                style={{ width: '100%', background: 'var(--dash-surface-2)', border: '1px solid var(--dash-border-soft)', borderRadius: 10, padding: 14, fontSize: 13, fontFamily: 'inherit', color: 'var(--dash-text)', outline: 'none', resize: 'none', lineHeight: 1.7, minHeight: 140, boxSizing: 'border-box' }} />
            </div>

            {error && <div style={{ fontSize: 13, color: '#ef4444' }}>{error}</div>}

            <button onClick={runAnalysis} disabled={uploading} style={{ background: '#e2b04a', color: '#0a0a09', fontWeight: 700, fontSize: 15, padding: '14px', borderRadius: 10, border: 'none', cursor: uploading ? 'default' : 'pointer', opacity: uploading ? 0.6 : 1, fontFamily: 'inherit' }}>
              Analyze My CV
            </button>
          </div>
        )}

        {step === 'analyzing' && <AnalyzingState />}

        {step === 'result' && result && (
          <div>
            <IntelligenceCarousel mode="optimizer" result={result} scoreHistory={scoreHistory} onImproveCv={handleImproveCv} onPracticeTopics={handlePractice} light={theme === 'light'} />

            <div style={{ marginTop: 28, padding: 20, background: 'var(--dash-surface)', border: '1px solid var(--dash-border-soft)', borderRadius: 14 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--dash-text)', marginBottom: 10 }}>Want to tailor this CV specifically for another job?</div>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <button onClick={() => { setStep('upload'); setResult(null) }} style={{ background: 'var(--dash-overlay-035)', border: '1px solid var(--dash-border-soft)', color: 'var(--dash-text)', fontWeight: 600, fontSize: 13, padding: '10px 18px', borderRadius: 8, cursor: 'pointer', fontFamily: 'inherit' }}>
                  Analyze Again
                </button>
                <button onClick={handleImproveCv} style={{ background: '#e2b04a', color: '#0a0a09', fontWeight: 700, fontSize: 13, padding: '10px 18px', borderRadius: 8, border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>
                  Improve My CV
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}