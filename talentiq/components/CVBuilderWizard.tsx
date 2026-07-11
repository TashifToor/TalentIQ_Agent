'use client'

import { useState, useRef } from 'react'
import { api } from '@/lib/api'

type Education = { degree: string; institution: string; start_year: string; end_year: string; details: string }
type Experience = { title: string; company: string; start_date: string; end_date: string; bullets: string[] }
type Project = { name: string; description: string; tech_stack: string }
type CVData = {
  full_name: string; email: string; phone: string; location: string; linkedin: string; github: string
  summary: string; skills: string[]
  education: Education[]; experience: Experience[]; projects: Project[]
}

const EMPTY_CV: CVData = {
  full_name: '', email: '', phone: '', location: '', linkedin: '', github: '',
  summary: '', skills: [], education: [], experience: [], projects: [],
}

const emptyEducation = (): Education => ({ degree: '', institution: '', start_year: '', end_year: '', details: '' })
const emptyExperience = (): Experience => ({ title: '', company: '', start_date: '', end_date: '', bullets: [''] })
const emptyProject = (): Project => ({ name: '', description: '', tech_stack: '' })

const gold = '#d4af6d'
const bg = '#0a0a08'
const panel = '#141412'
const border = 'rgba(255,255,255,.1)'
const textDim = 'rgba(245,242,235,.4)'
const textMain = '#f5f2eb'

const inputStyle: React.CSSProperties = {
  width: '100%', background: '#1e1e1b', border: `1px solid ${border}`, borderRadius: 8,
  padding: '9px 12px', fontSize: 13, color: textMain, outline: 'none', fontFamily: 'inherit',
  marginBottom: 10, boxSizing: 'border-box',
}
const labelStyle: React.CSSProperties = { fontSize: 11, color: textDim, marginBottom: 4, display: 'block', fontWeight: 500 }
const sectionTitle: React.CSSProperties = { fontFamily: "'Cormorant Garamond', serif", fontSize: 20, fontWeight: 600, color: textMain, marginBottom: 14 }

export default function CVBuilderWizard() {
  const [step, setStep] = useState(0) // 0=input, 1=details, 2=template+JD
  const [mode, setMode] = useState<'upload' | 'scratch' | null>(null)
  const [cv, setCv] = useState<CVData>(EMPTY_CV)
  const [parsing, setParsing] = useState(false)
  const [template, setTemplate] = useState<'modern' | 'classic'>('modern')
  const [jd, setJd] = useState('')
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState('')
  const [limitMsg, setLimitMsg] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  const isLoggedIn = typeof window !== 'undefined' && !!localStorage.getItem('token')

  const handleFileUpload = async (file: File) => {
    setParsing(true)
    setError('')
    try {
      const data = await api.parseCVForBuilder(file)
      setCv({ ...EMPTY_CV, ...data })
      setMode('upload')
      setStep(1)
    } catch (e: any) {
      setError(e.message || 'Could not read that CV. Try uploading again, or start from scratch.')
    } finally {
      setParsing(false)
    }
  }

  const startFromScratch = () => {
    setCv(EMPTY_CV)
    setMode('scratch')
    setStep(1)
  }

  const updateField = (field: keyof CVData, value: any) => setCv(prev => ({ ...prev, [field]: value }))

  const handleGenerate = async () => {
    setGenerating(true)
    setError('')
    setLimitMsg('')
    try {
      const blob = await api.generateCVBuilder({ cv_data: cv, template, job_description: jd.trim() || undefined })
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${(cv.full_name || 'resume').replace(/\s+/g, '_')}_CV.pdf`
      document.body.appendChild(a)
      a.click()
      a.remove()
      window.URL.revokeObjectURL(url)
    } catch (e: any) {
      if (e.code === 'ANON_LIMIT_REACHED' || e.code === 'FREE_LIMIT_REACHED') {
        setLimitMsg(e.message)
      } else {
        setError(e.message || 'Could not generate the PDF. Please try again.')
      }
    } finally {
      setGenerating(false)
    }
  }

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '24px 16px', fontFamily: 'Syne, sans-serif', color: textMain }}>

      {/* Progress */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 28 }}>
        {['Your Info', 'Details', 'Template & Generate'].map((label, i) => (
          <div key={i} style={{ flex: 1, textAlign: 'center' }}>
            <div style={{
              height: 3, borderRadius: 2, marginBottom: 6,
              background: i <= step ? gold : 'rgba(255,255,255,.08)',
            }} />
            <span style={{ fontSize: 10.5, color: i <= step ? gold : textDim }}>{label}</span>
          </div>
        ))}
      </div>

      {/* STEP 0: input mode */}
      {step === 0 && (
        <div>
          <h2 style={sectionTitle}>Let's build your CV</h2>
          <p style={{ fontSize: 13.5, color: textDim, marginBottom: 24 }}>
            Upload an existing CV to auto-fill everything, or start from a blank form.
          </p>
          <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
            <button
              onClick={() => fileRef.current?.click()}
              disabled={parsing}
              style={{
                flex: '1 1 260px', padding: '28px 20px', borderRadius: 14, cursor: 'pointer',
                background: panel, border: `1px solid ${border}`, color: textMain, textAlign: 'left',
                fontFamily: 'inherit',
              }}
            >
              <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 6 }}>📄 Upload existing CV</div>
              <div style={{ fontSize: 12.5, color: textDim }}>{parsing ? 'Reading your CV…' : 'PDF — we\'ll auto-fill your details'}</div>
            </button>
            <button
              onClick={startFromScratch}
              style={{
                flex: '1 1 260px', padding: '28px 20px', borderRadius: 14, cursor: 'pointer',
                background: panel, border: `1px solid ${border}`, color: textMain, textAlign: 'left',
                fontFamily: 'inherit',
              }}
            >
              <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 6 }}>✍️ Start from scratch</div>
              <div style={{ fontSize: 12.5, color: textDim }}>Fill in a blank form step by step</div>
            </button>
          </div>
          <input ref={fileRef} type="file" accept=".pdf" hidden
            onChange={e => e.target.files?.[0] && handleFileUpload(e.target.files[0])} />
          {error && <div style={{ fontSize: 12.5, color: '#ef4444', marginTop: 14 }}>{error}</div>}
        </div>
      )}

      {/* STEP 1: editable details */}
      {step === 1 && (
        <div>
          <h2 style={sectionTitle}>Your details</h2>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div>
              <label style={labelStyle}>Full name</label>
              <input style={inputStyle} value={cv.full_name} onChange={e => updateField('full_name', e.target.value)} />
            </div>
            <div>
              <label style={labelStyle}>Email</label>
              <input style={inputStyle} value={cv.email} onChange={e => updateField('email', e.target.value)} />
            </div>
            <div>
              <label style={labelStyle}>Phone</label>
              <input style={inputStyle} value={cv.phone} onChange={e => updateField('phone', e.target.value)} />
            </div>
            <div>
              <label style={labelStyle}>Location</label>
              <input style={inputStyle} value={cv.location} onChange={e => updateField('location', e.target.value)} />
            </div>
            <div>
              <label style={labelStyle}>LinkedIn</label>
              <input style={inputStyle} value={cv.linkedin} onChange={e => updateField('linkedin', e.target.value)} />
            </div>
            <div>
              <label style={labelStyle}>GitHub</label>
              <input style={inputStyle} value={cv.github} onChange={e => updateField('github', e.target.value)} />
            </div>
          </div>

          <label style={labelStyle}>Professional summary</label>
          <textarea style={{ ...inputStyle, minHeight: 70, resize: 'vertical' }}
            value={cv.summary} onChange={e => updateField('summary', e.target.value)} />

          <label style={labelStyle}>Skills (comma-separated)</label>
          <input style={inputStyle} value={cv.skills.join(', ')} autoComplete="off" autoCorrect="off" spellCheck={false}
            onChange={e => updateField('skills', e.target.value.split(',').map(s => s.trim()).filter(Boolean))} />

          {/* Experience */}
          <div style={{ marginTop: 20, marginBottom: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 13, fontWeight: 700 }}>Experience</span>
            <button onClick={() => updateField('experience', [...cv.experience, emptyExperience()])}
              style={{ fontSize: 11.5, color: gold, background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>+ Add role</button>
          </div>
          {cv.experience.map((exp, i) => (
            <div key={i} style={{ background: panel, border: `1px solid ${border}`, borderRadius: 10, padding: 12, marginBottom: 10 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <input style={inputStyle} placeholder="Job title" value={exp.title}
                  onChange={e => { const next = [...cv.experience]; next[i] = { ...exp, title: e.target.value }; updateField('experience', next) }} />
                <input style={inputStyle} placeholder="Company" value={exp.company}
                  onChange={e => { const next = [...cv.experience]; next[i] = { ...exp, company: e.target.value }; updateField('experience', next) }} />
                <input style={inputStyle} placeholder="Start (e.g. Jan 2023)" value={exp.start_date}
                  onChange={e => { const next = [...cv.experience]; next[i] = { ...exp, start_date: e.target.value }; updateField('experience', next) }} />
                <input style={inputStyle} placeholder="End (e.g. Present)" value={exp.end_date}
                  onChange={e => { const next = [...cv.experience]; next[i] = { ...exp, end_date: e.target.value }; updateField('experience', next) }} />
              </div>
              <label style={labelStyle}>Bullet points</label>
              {exp.bullets.map((b, bi) => (
                <input key={bi} style={inputStyle} placeholder="Achieved X by doing Y, resulting in Z" value={b}
                  onChange={e => { const next = [...cv.experience]; const bullets = [...exp.bullets]; bullets[bi] = e.target.value; next[i] = { ...exp, bullets }; updateField('experience', next) }} />
              ))}
              <div style={{ display: 'flex', gap: 12 }}>
                <button onClick={() => { const next = [...cv.experience]; next[i] = { ...exp, bullets: [...exp.bullets, ''] }; updateField('experience', next) }}
                  style={{ fontSize: 11, color: gold, background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>+ bullet</button>
                <button onClick={() => updateField('experience', cv.experience.filter((_, idx) => idx !== i))}
                  style={{ fontSize: 11, color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>remove role</button>
              </div>
            </div>
          ))}

          {/* Projects */}
          <div style={{ marginTop: 20, marginBottom: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 13, fontWeight: 700 }}>Projects</span>
            <button onClick={() => updateField('projects', [...cv.projects, emptyProject()])}
              style={{ fontSize: 11.5, color: gold, background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>+ Add project</button>
          </div>
          {cv.projects.map((proj, i) => (
            <div key={i} style={{ background: panel, border: `1px solid ${border}`, borderRadius: 10, padding: 12, marginBottom: 10 }}>
              <input style={inputStyle} placeholder="Project name" value={proj.name}
                onChange={e => { const next = [...cv.projects]; next[i] = { ...proj, name: e.target.value }; updateField('projects', next) }} />
              <input style={inputStyle} placeholder="Tech stack (e.g. FastAPI, React, PostgreSQL)" value={proj.tech_stack}
                onChange={e => { const next = [...cv.projects]; next[i] = { ...proj, tech_stack: e.target.value }; updateField('projects', next) }} />
              <textarea style={{ ...inputStyle, minHeight: 60, resize: 'vertical' }} placeholder="What did it do, what did you build/achieve?" value={proj.description}
                onChange={e => { const next = [...cv.projects]; next[i] = { ...proj, description: e.target.value }; updateField('projects', next) }} />
              <button onClick={() => updateField('projects', cv.projects.filter((_, idx) => idx !== i))}
                style={{ fontSize: 11, color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>remove</button>
            </div>
          ))}

          {/* Education */}
          <div style={{ marginTop: 20, marginBottom: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 13, fontWeight: 700 }}>Education</span>
            <button onClick={() => updateField('education', [...cv.education, emptyEducation()])}
              style={{ fontSize: 11.5, color: gold, background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>+ Add</button>
          </div>
          {cv.education.map((edu, i) => (
            <div key={i} style={{ background: panel, border: `1px solid ${border}`, borderRadius: 10, padding: 12, marginBottom: 10 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <input style={inputStyle} placeholder="Degree" value={edu.degree}
                  onChange={e => { const next = [...cv.education]; next[i] = { ...edu, degree: e.target.value }; updateField('education', next) }} />
                <input style={inputStyle} placeholder="Institution" value={edu.institution}
                  onChange={e => { const next = [...cv.education]; next[i] = { ...edu, institution: e.target.value }; updateField('education', next) }} />
                <input style={inputStyle} placeholder="Start year" value={edu.start_year}
                  onChange={e => { const next = [...cv.education]; next[i] = { ...edu, start_year: e.target.value }; updateField('education', next) }} />
                <input style={inputStyle} placeholder="End year" value={edu.end_year}
                  onChange={e => { const next = [...cv.education]; next[i] = { ...edu, end_year: e.target.value }; updateField('education', next) }} />
              </div>
              <button onClick={() => updateField('education', cv.education.filter((_, idx) => idx !== i))}
                style={{ fontSize: 11, color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>remove</button>
            </div>
          ))}

          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 24 }}>
            <button onClick={() => setStep(0)} style={{ fontSize: 13, color: textDim, background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>Back</button>
            <button onClick={() => setStep(2)} style={{ fontSize: 13, fontWeight: 700, padding: '10px 22px', borderRadius: 8, border: 'none', background: gold, color: '#0a0a08', cursor: 'pointer', fontFamily: 'inherit' }}>Continue</button>
          </div>
        </div>
      )}

      {/* STEP 2: template + JD + generate */}
      {step === 2 && (
        <div>
          <h2 style={sectionTitle}>Template & final touches</h2>

          <label style={labelStyle}>Choose a template</label>
          <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
            {(['modern', 'classic'] as const).map(t => (
              <button key={t} onClick={() => setTemplate(t)} style={{
                flex: 1, padding: '16px', borderRadius: 10, cursor: 'pointer', fontFamily: 'inherit',
                border: `1.5px solid ${template === t ? gold : border}`,
                background: template === t ? `${gold}18` : panel,
                color: template === t ? gold : textMain, textTransform: 'capitalize', fontWeight: 700, fontSize: 13,
              }}>{t}</button>
            ))}
          </div>

          <label style={labelStyle}>Target job description (optional — makes your CV ATS-friendly for this specific role)</label>
          <textarea style={{ ...inputStyle, minHeight: 100, resize: 'vertical' }}
            placeholder="Paste the job description here to tailor your CV's wording and keyword match…"
            value={jd} onChange={e => setJd(e.target.value)} />

          {error && <div style={{ fontSize: 12.5, color: '#ef4444', margin: '10px 0' }}>{error}</div>}
          {limitMsg && (
            <div style={{ fontSize: 12.5, color: gold, background: `${gold}12`, border: `1px solid ${gold}33`, borderRadius: 8, padding: 12, margin: '10px 0' }}>
              {limitMsg}{' '}
              {!isLoggedIn && <a href="/auth/login/candidate" style={{ color: gold, fontWeight: 700 }}>Sign up free →</a>}
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 20 }}>
            <button onClick={() => setStep(1)} style={{ fontSize: 13, color: textDim, background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>Back</button>
            <button onClick={handleGenerate} disabled={generating} style={{ fontSize: 13, fontWeight: 700, padding: '10px 22px', borderRadius: 8, border: 'none', background: gold, color: '#0a0a08', cursor: 'pointer', fontFamily: 'inherit' }}>
              {generating ? 'Generating…' : 'Generate & Download PDF'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}