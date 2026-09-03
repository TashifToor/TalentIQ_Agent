'use client'

import { useState, useRef, useEffect } from 'react'
import { api } from '@/lib/api'
import AIResumeAssistant from './AIResumeAssistant'

type Education = { degree: string; institution: string; start_year: string; end_year: string; details: string }
type Experience = { title: string; company: string; start_date: string; end_date: string; bullets: string[] }
type Project = { name: string; description: string; tech_stack: string }
type SkillGroup = { category: string; items: string[] }
type CVData = {
  full_name: string; role_title: string; email: string; phone: string; location: string; linkedin: string; github: string
  summary: string; skills: string[]; skill_groups: SkillGroup[]
  education: Education[]; experience: Experience[]; projects: Project[]; achievements: string[]
  photo_base64?: string | null
}

const EMPTY_CV: CVData = {
  full_name: '', role_title: '', email: '', phone: '', location: '', linkedin: '', github: '',
  summary: '', skills: [], skill_groups: [], education: [], experience: [], projects: [], achievements: [], photo_base64: null,
}

const emptyEducation = (): Education => ({ degree: '', institution: '', start_year: '', end_year: '', details: '' })
const emptyExperience = (): Experience => ({ title: '', company: '', start_date: '', end_date: '', bullets: [''] })
const emptyProject = (): Project => ({ name: '', description: '', tech_stack: '' })

// Theme is a runtime choice (the `light` prop), not a fixed constant — this
// component is shared by the light Candidate dashboard AND the still-dark
// public marketing page (app/cv-builder/page.tsx), so these can't be
// module-level consts the way they used to be.
function getTheme(light?: boolean) {
  const gold = light ? '#e2b04a' : '#d4af6d'
  const panel = light ? '#ffffff' : '#141412'
  const border = light ? '#e7e4da' : 'rgba(255,255,255,.1)'
  const textDim = light ? '#7a7468' : 'rgba(245,242,235,.4)'
  const textMain = light ? '#1f1c17' : '#f5f2eb'
  const inputStyle: React.CSSProperties = {
    width: '100%', background: light ? '#faf9f5' : '#1e1e1b', border: `1px solid ${border}`, borderRadius: 8,
    padding: '9px 12px', fontSize: 13, color: textMain, outline: 'none', fontFamily: 'inherit',
    marginBottom: 10, boxSizing: 'border-box',
  }
  const labelStyle: React.CSSProperties = { fontSize: 11, color: textDim, marginBottom: 4, display: 'block', fontWeight: 500 }
  const sectionTitle: React.CSSProperties = { fontFamily: "'Space Grotesk', Inter, sans-serif", fontSize: 20, fontWeight: 600, color: textMain, marginBottom: 14 }
  return { gold, panel, border, textDim, textMain, inputStyle, labelStyle, sectionTitle }
}

// Mirrors core/cv_pdf_renderer.py style configs — used for gallery cards + live preview
const TEMPLATES: Record<string, { label: string; font: string; accent: string; atsSafe: boolean; layout: 'single' | 'sidebar' | 'decorative' }> = {
  modern: { label: 'Modern', font: "'Helvetica', Arial, sans-serif", accent: '#1f4e5f', atsSafe: true, layout: 'single' },
  classic: { label: 'Classic', font: "'Georgia', 'Times New Roman', serif", accent: '#1a1a1a', atsSafe: true, layout: 'single' },
  minimal: { label: 'Minimal', font: "'Helvetica', Arial, sans-serif", accent: '#888888', atsSafe: true, layout: 'single' },
  banded: { label: 'Banded', font: "'Helvetica', Arial, sans-serif", accent: '#4a4a4a', atsSafe: true, layout: 'single' },
  elegant: { label: 'Elegant', font: "'Georgia', serif", accent: '#7a6a58', atsSafe: true, layout: 'single' },
  bold: { label: 'Bold', font: "'Helvetica', Arial, sans-serif", accent: '#000000', atsSafe: true, layout: 'single' },
  compact: { label: 'Compact', font: "'Helvetica', Arial, sans-serif", accent: '#2f5d8a', atsSafe: true, layout: 'single' },
  executive: { label: 'Executive', font: "'Helvetica', Arial, sans-serif", accent: '#1a2332', atsSafe: true, layout: 'single' },
  professional: { label: 'Professional', font: "'Georgia', serif", accent: '#1a1a1a', atsSafe: true, layout: 'single' },
  'visual-sidebar': { label: 'Visual — Sidebar', font: "'Helvetica', Arial, sans-serif", accent: '#a97155', atsSafe: false, layout: 'sidebar' },
  'visual-decorative': { label: 'Visual — Elegant Portrait', font: "'Georgia', serif", accent: '#2a2a2a', atsSafe: false, layout: 'decorative' },
}
const TEMPLATE_ORDER = Object.keys(TEMPLATES)

// Mirrors schemas/cv_builder.py BASIC_COLORS
const BASIC_COLORS: Record<string, string> = {
  black: '#1a1a1a', gray: '#555555', red: '#c0392b', orange: '#d2691e',
  yellow: '#c98a0a', green: '#2e7d32', teal: '#147a72', blue: '#2f5d8a',
  navy: '#1a2f5c', purple: '#6c3fa0', pink: '#c2185b', brown: '#6b4226',
}
const COLOR_ORDER = Object.keys(BASIC_COLORS)

// Optional — lets a parent page (e.g. the Job Readiness panel) read the resume
// currently being built without the wizard needing to know anything about it.
type CVBuilderWizardProps = {
  onCvStateChange?: (state: { cv: CVData; template: string; accentColor: string | null }) => void
  // Bump `version` with a new `cv` to push an externally-produced CVData
  // (e.g. the Job Readiness panel's "Optimize Resume for This Job" result)
  // back into the editable wizard — the candidate keeps editing from there.
  externalCvUpdate?: { version: number; cv: CVData } | null
  light?: boolean   // opt-in — default keeps the original dark theme (the public marketing page's usage is unaffected)
}

export default function CVBuilderWizard({ onCvStateChange, externalCvUpdate, light }: CVBuilderWizardProps = {}) {
  const { gold, panel, border, textDim, textMain, inputStyle, labelStyle, sectionTitle } = getTheme(light)
  const [step, setStep] = useState(0) // 0=input, 1=template gallery, 2=edit+preview, 3=JD+generate
  const [cv, setCv] = useState<CVData>(EMPTY_CV)
  const [handoffFocus, setHandoffFocus] = useState<string | null>(null)

  // Cross-page handoff from CV Optimizer / Candidate Screening's "Improve My
  // CV" — reads the CVData they already had (from the same /cv-builder/parse
  // upload those pages reuse) so the candidate lands here pre-loaded on the
  // editor step instead of starting over, plus a suggested first action for
  // AIResumeAssistant to open automatically.
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem('talentiq_cv_handoff')
      if (!raw) return
      sessionStorage.removeItem('talentiq_cv_handoff')
      const payload = JSON.parse(raw)
      if (payload?.cv && Date.now() - (payload.timestamp || 0) < 5 * 60 * 1000) {
        setCv(payload.cv)
        setStep(2)
        if (payload.focus) setHandoffFocus(payload.focus)
        if (payload.jd) setJd(payload.jd)
      }
    } catch {
      // no handoff pending — normal fresh-start flow, nothing to do
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  const [parsing, setParsing] = useState(false)
  const [template, setTemplate] = useState<string>('professional') // centered name by default — matches common ATS resume convention
  const [accentColor, setAccentColor] = useState<string | null>(null)
  const [jd, setJd] = useState('')
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState('')
  const [limitMsg, setLimitMsg] = useState('')
  const [activeTab, setActiveTab] = useState<'info' | 'summary' | 'experience' | 'education' | 'projects' | 'skills' | 'achievements' | 'photo'>('info')
  const fileRef = useRef<HTMLInputElement>(null)
  const photoRef = useRef<HTMLInputElement>(null)

  const isLoggedIn = typeof window !== 'undefined' && !!localStorage.getItem('token')

  useEffect(() => {
    onCvStateChange?.({ cv, template, accentColor })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cv, template, accentColor])

  const lastAppliedExternalVersion = useRef<number>(-1)
  useEffect(() => {
    if (externalCvUpdate && externalCvUpdate.version !== lastAppliedExternalVersion.current) {
      lastAppliedExternalVersion.current = externalCvUpdate.version
      setCv(externalCvUpdate.cv)
    }
  }, [externalCvUpdate])

  const handleFileUpload = async (file: File) => {
    setParsing(true)
    setError('')
    try {
      const data = await api.parseCVForBuilder(file)
      setCv({ ...EMPTY_CV, ...data })
      setStep(1)
    } catch (e: any) {
      setError(e.message || 'Could not read that CV. Try uploading again, or start from scratch.')
    } finally {
      setParsing(false)
    }
  }

  const startFromScratch = () => {
    setCv(EMPTY_CV)
    setStep(1)
  }

  const updateField = (field: keyof CVData, value: any) => setCv(prev => ({ ...prev, [field]: value }))

  const handlePhotoUpload = (file: File) => {
    const reader = new FileReader()
    reader.onload = () => updateField('photo_base64', reader.result as string)
    reader.readAsDataURL(file)
  }

  const handleGenerate = async () => {
    setGenerating(true)
    setError('')
    setLimitMsg('')
    try {
      const cleanCv = { ...cv, achievements: cv.achievements.map(a => a.trim()).filter(Boolean) }
      const blob = await api.generateCVBuilder({ cv_data: cleanCv, template, accent_color: accentColor || undefined, job_description: jd.trim() || undefined })
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${(cv.full_name || 'resume').replace(/\s+/g, '_')}_CV.pdf`
      document.body.appendChild(a)
      a.click()
      a.remove()
      window.URL.revokeObjectURL(url)
      setJd('') // clear the JD field after a successful download — next generate starts fresh
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

  const tCfg = TEMPLATES[template]

  return (
    <div style={{ maxWidth: step === 2 ? 1100 : 720, margin: '0 auto', padding: '24px 16px', fontFamily: 'Inter, sans-serif', color: textMain }}>

      {/* Progress */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 28 }}>
        {['Your Info', 'Template', 'Edit & Preview', 'Generate'].map((label, i) => (
          <div key={i} style={{ flex: 1, textAlign: 'center' }}>
            <div style={{ height: 3, borderRadius: 2, marginBottom: 6, background: i <= step ? gold : (light ? 'rgba(10,10,9,.09)' : 'rgba(255,255,255,.08)') }} />
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
            <button onClick={() => fileRef.current?.click()} disabled={parsing} style={{ flex: '1 1 260px', padding: '28px 20px', borderRadius: 14, cursor: 'pointer', background: panel, border: `1px solid ${border}`, color: textMain, textAlign: 'left', fontFamily: 'inherit' }}>
              <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 6 }}>Upload existing CV</div>
              <div style={{ fontSize: 12.5, color: textDim }}>{parsing ? 'Reading your CV…' : "PDF — we'll auto-fill your details"}</div>
            </button>
            <button onClick={startFromScratch} style={{ flex: '1 1 260px', padding: '28px 20px', borderRadius: 14, cursor: 'pointer', background: panel, border: `1px solid ${border}`, color: textMain, textAlign: 'left', fontFamily: 'inherit' }}>
              <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 6 }}>Start from scratch</div>
              <div style={{ fontSize: 12.5, color: textDim }}>Fill in a blank form step by step</div>
            </button>
          </div>
          <input ref={fileRef} type="file" accept=".pdf" hidden onChange={e => e.target.files?.[0] && handleFileUpload(e.target.files[0])} />
          {error && <div style={{ fontSize: 12.5, color: '#ef4444', marginTop: 14 }}>{error}</div>}
        </div>
      )}

      {/* STEP 1: template gallery */}
      {step === 1 && (
        <div>
          <h2 style={sectionTitle}>Choose a template</h2>
          <p style={{ fontSize: 13, color: textDim, marginBottom: 18 }}>
            8 ATS-safe templates (recommended for automated screening) + 2 visual templates (best for LinkedIn/portfolio, not ATS-optimized).
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 12 }}>
            {TEMPLATE_ORDER.map(key => {
              const cfg = TEMPLATES[key]
              const selected = template === key
              return (
                <button key={key} onClick={() => setTemplate(key)} style={{
                  padding: 0, borderRadius: 10, overflow: 'hidden', cursor: 'pointer', fontFamily: 'inherit',
                  border: `2px solid ${selected ? gold : border}`, background: panel, textAlign: 'left',
                }}>
                  <div style={{ height: 70, background: cfg.accent, display: 'flex', flexDirection: cfg.layout === 'single' ? 'column' : 'row' }}>
                    {cfg.layout !== 'single' && <div style={{ width: '35%', background: light ? 'rgba(10,10,9,.12)' : 'rgba(255,255,255,.15)' }} />}
                  </div>
                  <div style={{ padding: '8px 10px' }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: selected ? gold : textMain, fontFamily: cfg.font }}>{cfg.label}</div>
                    <div style={{ fontSize: 9.5, color: cfg.atsSafe ? '#13c28e' : '#e2a04a', marginTop: 2 }}>{cfg.atsSafe ? 'ATS-safe' : 'Visual only'}</div>
                  </div>
                </button>
              )
            })}
          </div>

          {TEMPLATES[template].atsSafe && (
            <div style={{ marginTop: 20 }}>
              <label style={labelStyle}>Accent color (optional — overrides this template's default color)</label>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button onClick={() => setAccentColor(null)} style={{
                  width: 30, height: 30, borderRadius: '50%', cursor: 'pointer',
                  border: accentColor === null ? `2px solid ${gold}` : '2px solid transparent',
                  background: 'repeating-conic-gradient(#999 0% 25%, #ccc 0% 50%)', backgroundSize: '10px 10px',
                }} title="Default" />
                {COLOR_ORDER.map(key => (
                  <button key={key} onClick={() => setAccentColor(key)} title={key} style={{
                    width: 30, height: 30, borderRadius: '50%', cursor: 'pointer', background: BASIC_COLORS[key],
                    border: accentColor === key ? `2px solid ${gold}` : '2px solid transparent',
                  }} />
                ))}
              </div>
            </div>
          )}

          <div style={{ marginTop: 20 }}>
            <label style={labelStyle}>Photo (optional)</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              {cv.photo_base64 && <img src={cv.photo_base64} alt="preview" style={{ width: 48, height: 48, borderRadius: '50%', objectFit: 'cover' }} />}
              <button onClick={() => photoRef.current?.click()} style={{ fontSize: 12, color: gold, background: 'none', border: `1px solid ${border}`, borderRadius: 8, padding: '8px 14px', cursor: 'pointer', fontFamily: 'inherit' }}>
                {cv.photo_base64 ? 'Change photo' : 'Upload photo'}
              </button>
              <input ref={photoRef} type="file" accept="image/*" hidden onChange={e => e.target.files?.[0] && handlePhotoUpload(e.target.files[0])} />
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 24 }}>
            <button onClick={() => setStep(0)} style={{ fontSize: 13, color: textDim, background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>Back</button>
            <button onClick={() => setStep(2)} style={{ fontSize: 13, fontWeight: 700, padding: '10px 22px', borderRadius: 8, border: 'none', background: gold, color: '#0a0a08', cursor: 'pointer', fontFamily: 'inherit' }}>Continue</button>
          </div>
        </div>
      )}

      {/* STEP 2: split-screen edit + live preview */}
      {step === 2 && (
        <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start', flexWrap: 'wrap' }}>
          {/* Left: section-tabbed form */}
          <div style={{ flex: '1 1 380px', minWidth: 320 }}>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 16 }}>
              {(['info', 'summary', 'experience', 'education', 'projects', 'skills', 'achievements', 'photo'] as const).map(tab => (
                <button key={tab} onClick={() => setActiveTab(tab)} style={{
                  fontSize: 11, padding: '6px 12px', borderRadius: 100, cursor: 'pointer', fontFamily: 'inherit', textTransform: 'capitalize',
                  border: `1px solid ${activeTab === tab ? gold : border}`, background: activeTab === tab ? `${gold}18` : 'transparent',
                  color: activeTab === tab ? gold : textDim,
                }}>{tab}</button>
              ))}
            </div>

            {activeTab === 'info' && (
              <div className="resume-builder-cols" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div style={{ gridColumn: '1 / -1' }}><label style={labelStyle}>Professional headline (e.g. "Python Developer | AI & Backend Engineer")</label><input style={inputStyle} value={cv.role_title} onChange={e => updateField('role_title', e.target.value)} /></div>
                <div><label style={labelStyle}>Full name</label><input style={inputStyle} value={cv.full_name} onChange={e => updateField('full_name', e.target.value)} /></div>
                <div><label style={labelStyle}>Email</label><input style={inputStyle} value={cv.email} onChange={e => updateField('email', e.target.value)} /></div>
                <div><label style={labelStyle}>Phone</label><input style={inputStyle} value={cv.phone} onChange={e => updateField('phone', e.target.value)} /></div>
                <div><label style={labelStyle}>Location</label><input style={inputStyle} value={cv.location} onChange={e => updateField('location', e.target.value)} /></div>
                <div><label style={labelStyle}>LinkedIn</label><input style={inputStyle} value={cv.linkedin} onChange={e => updateField('linkedin', e.target.value)} /></div>
                <div><label style={labelStyle}>GitHub</label><input style={inputStyle} value={cv.github} onChange={e => updateField('github', e.target.value)} /></div>
              </div>
            )}

            {activeTab === 'summary' && (
              <div>
                <label style={labelStyle}>Professional summary</label>
                <textarea style={{ ...inputStyle, minHeight: 100, resize: 'vertical' }} value={cv.summary} onChange={e => updateField('summary', e.target.value)} />
              </div>
            )}

            {activeTab === 'photo' && (
              <div>
                <label style={labelStyle}>Photo (optional — shown on all templates)</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  {cv.photo_base64 && <img src={cv.photo_base64} alt="preview" style={{ width: 64, height: 64, borderRadius: '50%', objectFit: 'cover' }} />}
                  <button onClick={() => photoRef.current?.click()} style={{ fontSize: 12, color: gold, background: 'none', border: `1px solid ${border}`, borderRadius: 8, padding: '8px 14px', cursor: 'pointer', fontFamily: 'inherit' }}>
                    {cv.photo_base64 ? 'Change photo' : 'Upload photo'}
                  </button>
                  {cv.photo_base64 && <button onClick={() => updateField('photo_base64', null)} style={{ fontSize: 12, color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>Remove</button>}
                  <input ref={photoRef} type="file" accept="image/*" hidden onChange={e => e.target.files?.[0] && handlePhotoUpload(e.target.files[0])} />
                </div>
              </div>
            )}

            {activeTab === 'skills' && (
              <div>
                <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
                  <button onClick={() => updateField('skill_groups', [])} style={{ fontSize: 11, padding: '5px 10px', borderRadius: 100, cursor: 'pointer', fontFamily: 'inherit', border: `1px solid ${cv.skill_groups.length === 0 ? gold : border}`, background: cv.skill_groups.length === 0 ? `${gold}18` : 'transparent', color: cv.skill_groups.length === 0 ? gold : textDim }}>Simple list</button>
                  <button onClick={() => cv.skill_groups.length === 0 && updateField('skill_groups', [{ category: '', items: [] }])} style={{ fontSize: 11, padding: '5px 10px', borderRadius: 100, cursor: 'pointer', fontFamily: 'inherit', border: `1px solid ${cv.skill_groups.length > 0 ? gold : border}`, background: cv.skill_groups.length > 0 ? `${gold}18` : 'transparent', color: cv.skill_groups.length > 0 ? gold : textDim }}>Categorized (e.g. Languages, Databases)</button>
                </div>

                {cv.skill_groups.length === 0 ? (
                  <div>
                    <label style={labelStyle}>Skills (comma-separated)</label>
                    <input style={inputStyle} value={cv.skills.join(', ')} autoComplete="off" autoCorrect="off" spellCheck={false}
                      onChange={e => updateField('skills', e.target.value.split(',').map(s => s.trim()).filter(Boolean))} />
                  </div>
                ) : (
                  <div>
                    {cv.skill_groups.map((g, i) => (
                      <div key={i} style={{ background: panel, border: `1px solid ${border}`, borderRadius: 10, padding: 12, marginBottom: 10 }}>
                        <input style={inputStyle} placeholder="Category (e.g. Languages & Frameworks)" value={g.category}
                          onChange={e => { const next = [...cv.skill_groups]; next[i] = { ...g, category: e.target.value }; updateField('skill_groups', next) }} />
                        <input style={inputStyle} placeholder="Items (comma-separated)" value={g.items.join(', ')} autoComplete="off"
                          onChange={e => { const next = [...cv.skill_groups]; next[i] = { ...g, items: e.target.value.split(',').map(s => s.trim()).filter(Boolean) }; updateField('skill_groups', next) }} />
                        <button onClick={() => updateField('skill_groups', cv.skill_groups.filter((_, idx) => idx !== i))} style={{ fontSize: 11, color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>remove category</button>
                      </div>
                    ))}
                    <button onClick={() => updateField('skill_groups', [...cv.skill_groups, { category: '', items: [] }])} style={{ fontSize: 11.5, color: gold, background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>+ Add category</button>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'achievements' && (
              <div>
                <label style={labelStyle}>Achievements, certifications, awards (one per line)</label>
                <textarea style={{ ...inputStyle, minHeight: 100, resize: 'vertical' }}
                  value={cv.achievements.join('\n')}
                  onChange={e => updateField('achievements', e.target.value.split('\n'))}
                  placeholder={"Web Developer Certification — CodeCelix, Nov 2025\nTop Performer Award — NCEAC Cohort 3"} />
              </div>
            )}

            {activeTab === 'experience' && (
              <div>
                <button onClick={() => updateField('experience', [...cv.experience, emptyExperience()])} style={{ fontSize: 11.5, color: gold, background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', marginBottom: 10 }}>+ Add role</button>
                {cv.experience.map((exp, i) => (
                  <div key={i} style={{ background: panel, border: `1px solid ${border}`, borderRadius: 10, padding: 12, marginBottom: 10 }}>
                    <div className="resume-builder-cols" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                      <input style={inputStyle} placeholder="Job title" value={exp.title} onChange={e => { const next = [...cv.experience]; next[i] = { ...exp, title: e.target.value }; updateField('experience', next) }} />
                      <input style={inputStyle} placeholder="Company" value={exp.company} onChange={e => { const next = [...cv.experience]; next[i] = { ...exp, company: e.target.value }; updateField('experience', next) }} />
                      <input style={inputStyle} placeholder="Start" value={exp.start_date} onChange={e => { const next = [...cv.experience]; next[i] = { ...exp, start_date: e.target.value }; updateField('experience', next) }} />
                      <input style={inputStyle} placeholder="End" value={exp.end_date} onChange={e => { const next = [...cv.experience]; next[i] = { ...exp, end_date: e.target.value }; updateField('experience', next) }} />
                    </div>
                    {exp.bullets.map((b, bi) => (
                      <input key={bi} style={inputStyle} placeholder="Achievement bullet" value={b} onChange={e => { const next = [...cv.experience]; const bullets = [...exp.bullets]; bullets[bi] = e.target.value; next[i] = { ...exp, bullets }; updateField('experience', next) }} />
                    ))}
                    <div style={{ display: 'flex', gap: 12 }}>
                      <button onClick={() => { const next = [...cv.experience]; next[i] = { ...exp, bullets: [...exp.bullets, ''] }; updateField('experience', next) }} style={{ fontSize: 11, color: gold, background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>+ bullet</button>
                      <button onClick={() => updateField('experience', cv.experience.filter((_, idx) => idx !== i))} style={{ fontSize: 11, color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>remove</button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {activeTab === 'projects' && (
              <div>
                <button onClick={() => updateField('projects', [...cv.projects, emptyProject()])} style={{ fontSize: 11.5, color: gold, background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', marginBottom: 10 }}>+ Add project</button>
                {cv.projects.map((proj, i) => (
                  <div key={i} style={{ background: panel, border: `1px solid ${border}`, borderRadius: 10, padding: 12, marginBottom: 10 }}>
                    <input style={inputStyle} placeholder="Project name" value={proj.name} onChange={e => { const next = [...cv.projects]; next[i] = { ...proj, name: e.target.value }; updateField('projects', next) }} />
                    <input style={inputStyle} placeholder="Tech stack" value={proj.tech_stack} onChange={e => { const next = [...cv.projects]; next[i] = { ...proj, tech_stack: e.target.value }; updateField('projects', next) }} />
                    <textarea style={{ ...inputStyle, minHeight: 60, resize: 'vertical' }} placeholder="Description" value={proj.description} onChange={e => { const next = [...cv.projects]; next[i] = { ...proj, description: e.target.value }; updateField('projects', next) }} />
                    <button onClick={() => updateField('projects', cv.projects.filter((_, idx) => idx !== i))} style={{ fontSize: 11, color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>remove</button>
                  </div>
                ))}
              </div>
            )}

            {activeTab === 'education' && (
              <div>
                <button onClick={() => updateField('education', [...cv.education, emptyEducation()])} style={{ fontSize: 11.5, color: gold, background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', marginBottom: 10 }}>+ Add</button>
                {cv.education.map((edu, i) => (
                  <div key={i} style={{ background: panel, border: `1px solid ${border}`, borderRadius: 10, padding: 12, marginBottom: 10 }}>
                    <div className="resume-builder-cols" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                      <input style={inputStyle} placeholder="Degree" value={edu.degree} onChange={e => { const next = [...cv.education]; next[i] = { ...edu, degree: e.target.value }; updateField('education', next) }} />
                      <input style={inputStyle} placeholder="Institution" value={edu.institution} onChange={e => { const next = [...cv.education]; next[i] = { ...edu, institution: e.target.value }; updateField('education', next) }} />
                      <input style={inputStyle} placeholder="Start year" value={edu.start_year} onChange={e => { const next = [...cv.education]; next[i] = { ...edu, start_year: e.target.value }; updateField('education', next) }} />
                      <input style={inputStyle} placeholder="End year" value={edu.end_year} onChange={e => { const next = [...cv.education]; next[i] = { ...edu, end_year: e.target.value }; updateField('education', next) }} />
                    </div>
                    <button onClick={() => updateField('education', cv.education.filter((_, idx) => idx !== i))} style={{ fontSize: 11, color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>remove</button>
                  </div>
                ))}
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 20 }}>
              <button onClick={() => setStep(1)} style={{ fontSize: 13, color: textDim, background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>Back</button>
              <button onClick={() => setStep(3)} style={{ fontSize: 13, fontWeight: 700, padding: '10px 22px', borderRadius: 8, border: 'none', background: gold, color: '#0a0a08', cursor: 'pointer', fontFamily: 'inherit' }}>Continue</button>
            </div>
          </div>

          {/* Right: LIVE PREVIEW — updates instantly as cv state changes, no API call */}
          <div style={{ flex: '1 1 380px', minWidth: 320, position: 'sticky', top: 16 }}>
            <div style={{ fontSize: 11, color: textDim, marginBottom: 8 }}>Live preview — {tCfg.label} {!tCfg.atsSafe && '(visual only)'}</div>
            <LivePreview cv={cv} template={template} accentColor={accentColor} />
          </div>

          {/* Far right: AI Resume Assistant — real 3rd column on desktop,
              collapsible drawer/bottom-sheet on tablet/mobile (see globals.css) */}
          <AIResumeAssistant cv={cv} onCvChange={setCv} jobDescription={jd} template={template} suggestedFocus={handoffFocus} light={light} />
        </div>
      )}

      {/* STEP 3: JD + generate */}
      {step === 3 && (
        <div>
          <h2 style={sectionTitle}>Almost done</h2>
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
            <button onClick={() => setStep(2)} style={{ fontSize: 13, color: textDim, background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>Back</button>
            <button onClick={handleGenerate} disabled={generating} style={{ fontSize: 13, fontWeight: 700, padding: '10px 22px', borderRadius: 8, border: 'none', background: gold, color: '#0a0a08', cursor: 'pointer', fontFamily: 'inherit' }}>
              {generating ? 'Generating…' : jd.trim() ? 'Optimize for JD & Download' : 'Skip & Download PDF'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Approximate live preview — mirrors the ReportLab templates' fonts/colors/
// layout closely enough to guide editing, updates instantly from React state
// (no backend call). The actual downloaded PDF is still rendered server-side
// for pixel-accurate, ATS-safe text output.
// ---------------------------------------------------------------------------
function LivePreview({ cv, template, accentColor }: { cv: CVData; template: string; accentColor: string | null }) {
  const baseCfg = TEMPLATES[template]
  const cfg = accentColor ? { ...baseCfg, accent: BASIC_COLORS[accentColor] || baseCfg.accent } : baseCfg
  const wrap: React.CSSProperties = {
    background: '#fff', color: '#222', fontFamily: cfg.font, fontSize: 11.5, lineHeight: 1.5,
    borderRadius: 8, padding: 24, minHeight: 500, maxHeight: 640, overflowY: 'auto',
    boxShadow: '0 8px 30px rgba(0,0,0,.4)',
  }

  const Heading = ({ children }: { children: React.ReactNode }) => (
    <div style={{ fontWeight: 700, fontSize: 12.5, color: cfg.accent, marginTop: 14, marginBottom: 4, borderBottom: `1px solid ${cfg.accent}55`, paddingBottom: 2 }}>{children}</div>
  )

  const SkillsBlock = ({ bodyFontSize = 10.5 }: { bodyFontSize?: number }) => {
    if (cv.skill_groups.length > 0) {
      return <>{cv.skill_groups.filter(g => g.items.length).map((g, i) => (
        <div key={i} style={{ fontSize: bodyFontSize, marginBottom: 2 }}><b>{g.category}:</b> {g.items.join(', ')}</div>
      ))}</>
    }
    if (cv.skills.length > 0) return <div style={{ fontSize: bodyFontSize }}>{cv.skills.join(', ')}</div>
    return null
  }

  const Body = () => (
    <>
      {cv.summary && <><Heading>Summary</Heading><p style={{ margin: 0 }}>{cv.summary}</p></>}
      {(cv.skills.length > 0 || cv.skill_groups.length > 0) && <><Heading>Skills</Heading><SkillsBlock /></>}
      {cv.experience.length > 0 && (
        <>
          <Heading>Experience</Heading>
          {cv.experience.map((exp, i) => (
            <div key={i} style={{ marginBottom: 8 }}>
              <div style={{ fontWeight: 700 }}>{exp.title || 'Role'} — {exp.company || 'Company'}</div>
              <div style={{ fontSize: 10, color: '#777', fontStyle: 'italic' }}>{[exp.start_date, exp.end_date].filter(Boolean).join(' – ')}</div>
              {exp.bullets.filter(Boolean).map((b, bi) => <div key={bi} style={{ fontSize: 10.5 }}>• {b}</div>)}
            </div>
          ))}
        </>
      )}
      {cv.projects.length > 0 && (
        <>
          <Heading>Projects</Heading>
          {cv.projects.map((p, i) => (
            <div key={i} style={{ marginBottom: 6 }}>
              <div style={{ fontWeight: 700 }}>{p.name || 'Project'}</div>
              {p.tech_stack && <div style={{ fontSize: 10, color: '#777', fontStyle: 'italic' }}>{p.tech_stack}</div>}
              {p.description && <div style={{ fontSize: 10.5 }}>{p.description}</div>}
            </div>
          ))}
        </>
      )}
      {cv.education.length > 0 && (
        <>
          <Heading>Education</Heading>
          {cv.education.map((edu, i) => (
            <div key={i} style={{ marginBottom: 4 }}>
              <div style={{ fontWeight: 700 }}>{edu.degree || 'Degree'}</div>
              <div style={{ fontSize: 10, color: '#777' }}>{edu.institution} {edu.start_year && `(${edu.start_year} – ${edu.end_year})`}</div>
            </div>
          ))}
        </>
      )}
      {cv.achievements.filter(Boolean).length > 0 && (
        <>
          <Heading>Achievements</Heading>
          {cv.achievements.filter(Boolean).map((a, i) => <div key={i} style={{ fontSize: 10.5 }}>• {a}</div>)}
        </>
      )}
    </>
  )

  if (cfg.layout === 'single') {
    return (
      <div style={wrap}>
        <div style={{ textAlign: template === 'classic' || template === 'professional' ? 'center' : 'left', display: 'flex', alignItems: 'center', gap: 12, flexDirection: (template === 'classic' || template === 'professional') ? 'column' : 'row' }}>
          {cv.photo_base64 && <img src={cv.photo_base64} style={{ width: 44, height: 44, borderRadius: '50%', objectFit: 'cover' }} />}
          <div>
            <div style={{ fontWeight: 700, fontSize: 20, color: cfg.accent }}>{cv.full_name || 'Your Name'}</div>
            {cv.role_title && <div style={{ fontSize: 11.5, color: '#555' }}>{cv.role_title}</div>}
            <div style={{ fontSize: 10, color: '#555' }}>{[cv.email, cv.phone, cv.location, cv.linkedin, cv.github].filter(Boolean).join(' | ')}</div>
          </div>
        </div>
        <Body />
      </div>
    )
  }

  return (
    <div style={wrap}>
      <div style={{ textAlign: template === 'visual-decorative' ? 'center' : 'left', marginBottom: 10 }}>
        {cv.photo_base64 && <img src={cv.photo_base64} style={{ width: 60, height: 60, borderRadius: '50%', objectFit: 'cover', marginBottom: 6 }} />}
        <div style={{ fontWeight: 700, fontSize: 22, color: cfg.accent }}>{cv.full_name || 'Your Name'}</div>
        {cv.role_title && <div style={{ fontSize: 12, color: '#666' }}>{cv.role_title}</div>}
      </div>
      <div style={{ display: 'flex', gap: 16 }}>
        <div style={{ flex: '0 0 32%' }}>
          <Heading>Contact</Heading>
          <div style={{ fontSize: 10 }}>{cv.email}</div>
          <div style={{ fontSize: 10 }}>{cv.phone}</div>
          <div style={{ fontSize: 10 }}>{cv.location}</div>
          {(cv.skills.length > 0 || cv.skill_groups.length > 0) && (
            <>
              <Heading>Skills</Heading>
              <SkillsBlock bodyFontSize={10} />
            </>
          )}
          {cv.achievements.filter(Boolean).length > 0 && (
            <>
              <Heading>Certifications</Heading>
              {cv.achievements.filter(Boolean).map((a, i) => <div key={i} style={{ fontSize: 10 }}>• {a}</div>)}
            </>
          )}
        </div>
        <div style={{ flex: 1, borderLeft: '1px solid #ddd', paddingLeft: 14 }}>
          <Body />
        </div>
      </div>
    </div>
  )
}