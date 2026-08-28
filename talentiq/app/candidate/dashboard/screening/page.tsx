'use client'
import { useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { api } from '@/lib/api'
import IntelligenceCarousel from '@/components/IntelligenceCarousel'

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

const CHECKLIST = ['Reading your CV', 'Checking ATS signals', 'Assessing role fit', 'Preparing recruiter view']

function AnalyzingState() {
    const [step, setStep] = useState(0)
    useState(() => { const t = setInterval(() => setStep(s => Math.min(CHECKLIST.length - 1, s + 1)), 900); return () => clearInterval(t) })
    return (
        <div style={{ padding: '50px 0', maxWidth: 360, margin: '0 auto' }}>
            <h3 style={{ fontFamily: 'Inter, sans-serif', fontSize: 20, marginBottom: 22, textAlign: 'center', color: '#fff' }}>Screening your CV…</h3>
            {CHECKLIST.map((label, i) => (
                <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12, fontSize: 13, color: i < step ? '#34d399' : i === step ? '#e2b04a' : 'rgba(255,255,255,.3)' }}>
                    <span style={{ width: 16, textAlign: 'center' }}>{i < step ? '✓' : i === step ? '●' : '○'}</span>
                    {label}
                </div>
            ))}
        </div>
    )
}

export default function CandidateScreening() {
    const router = useRouter()
    const [step, setStep] = useState<Step>('upload')
    const [jd, setJd] = useState('')
    const [file, setFile] = useState<File | null>(null)
    const [cvData, setCvData] = useState<any>(null)
    const [uploading, setUploading] = useState(false)
    const [error, setError] = useState('')
    const [result, setResult] = useState<any>(null)
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
        setError('')
        setStep('analyzing')
        try {
            const data = await api.screenCandidateCv(cvDataToText(cvData), jd.trim() || undefined)
            setResult(data)
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
        <div style={{ minHeight: '100vh', background: '#0c0c0a', fontFamily: 'Inter, sans-serif', color: 'rgba(255,255,255,.88)' }}>
            <div style={{ height: 56, borderBottom: '1px solid rgba(255,255,255,.07)', display: 'flex', alignItems: 'center', padding: '0 28px', gap: 16 }}>
                <Link href="/candidate/dashboard" style={{ color: 'rgba(255,255,255,.4)', textDecoration: 'none', fontSize: 13 }}>← Dashboard</Link>
                <span style={{ color: 'rgba(255,255,255,.15)' }}>·</span>
                <span style={{ fontSize: 13, color: 'rgba(255,255,255,.6)', fontWeight: 600 }}>CV Screening</span>
            </div>

            <div style={{ maxWidth: 900, margin: '0 auto', padding: '40px 24px 60px' }}>
                {step !== 'result' && (
                    <div style={{ marginBottom: 32 }}>
                        <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.14em', textTransform: 'uppercase', color: '#a78bfa', marginBottom: 12 }}>Understand / Prepare</p>
                        <h1 style={{ fontFamily: 'Inter, sans-serif', fontSize: 'clamp(28px,4vw,42px)', fontWeight: 600, letterSpacing: '-.5px', marginBottom: 10 }}>CV Screening</h1>
                        <p style={{ fontSize: 14, color: 'rgba(255,255,255,.4)', lineHeight: 1.7, maxWidth: 560 }}>
                            See how a recruiter or ATS would actually evaluate your CV — strengths, concerns, and how ready you are for an interview.
                        </p>
                    </div>
                )}

                {step === 'upload' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 640 }}>
                        <div style={{ background: '#111110', border: '1px solid rgba(255,255,255,.08)', borderRadius: 14, padding: 24 }}>
                            <div style={{ fontSize: 12, fontWeight: 600, letterSpacing: '.08em', textTransform: 'uppercase', color: 'rgba(255,255,255,.3)', marginBottom: 12 }}>Your CV</div>
                            <input ref={fileRef} type="file" accept=".pdf,.docx,.doc" onChange={handleFileChange} style={{ display: 'none' }} />
                            <div onClick={handlePickFile}
                                style={{ border: `2px dashed ${cvData ? 'rgba(19,194,142,.4)' : 'rgba(255,255,255,.12)'}`, borderRadius: 10, padding: 32, textAlign: 'center', cursor: 'pointer', background: '#161614' }}>
                                <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4, color: '#fff' }}>
                                    {uploading ? 'Uploading…' : file ? file.name : 'Click to upload your CV'}
                                </div>
                                <div style={{ fontSize: 12, color: 'rgba(255,255,255,.3)' }}>PDF or DOCX · Max 10MB</div>
                            </div>
                        </div>

                        <div style={{ background: '#111110', border: '1px solid rgba(255,255,255,.08)', borderRadius: 14, padding: 24 }}>
                            <div style={{ fontSize: 12, fontWeight: 600, letterSpacing: '.08em', textTransform: 'uppercase', color: 'rgba(255,255,255,.3)', marginBottom: 6 }}>Job Description <span style={{ textTransform: 'none', color: 'rgba(255,255,255,.25)', fontWeight: 400 }}>(optional)</span></div>
                            <textarea value={jd} onChange={e => setJd(e.target.value)} placeholder="Paste a job description for a role-specific screening, or leave blank for a general CV/ATS check…"
                                style={{ width: '100%', background: '#161614', border: '1px solid rgba(255,255,255,.08)', borderRadius: 10, padding: 14, fontSize: 13, fontFamily: 'inherit', color: 'rgba(255,255,255,.8)', outline: 'none', resize: 'none', lineHeight: 1.7, minHeight: 110, boxSizing: 'border-box' }} />
                        </div>

                        {error && <div style={{ fontSize: 13, color: '#ef4444' }}>{error}</div>}

                        <button onClick={runAnalysis} disabled={uploading} style={{ background: '#a78bfa', color: '#0a0a09', fontWeight: 700, fontSize: 15, padding: '14px', borderRadius: 10, border: 'none', cursor: uploading ? 'default' : 'pointer', opacity: uploading ? 0.6 : 1, fontFamily: 'inherit' }}>
                            Screen My CV
                        </button>
                    </div>
                )}

                {step === 'analyzing' && <AnalyzingState />}

                {step === 'result' && result && (
                    <div>
                        <IntelligenceCarousel mode="screening" result={result} onImproveCv={handleImproveCv} onPracticeTopics={handlePractice} />

                        <div style={{ marginTop: 28, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                            <button onClick={() => { setStep('upload'); setResult(null) }} style={{ background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.1)', color: 'rgba(255,255,255,.7)', fontWeight: 600, fontSize: 13, padding: '10px 18px', borderRadius: 8, cursor: 'pointer', fontFamily: 'inherit' }}>
                                Analyze Another Role
                            </button>
                            <button onClick={() => router.push('/candidate/dashboard/optimizer')} style={{ background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.1)', color: 'rgba(255,255,255,.7)', fontWeight: 600, fontSize: 13, padding: '10px 18px', borderRadius: 8, cursor: 'pointer', fontFamily: 'inherit' }}>
                                Tailor Resume
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}