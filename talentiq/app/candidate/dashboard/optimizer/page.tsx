'use client'
import { useState, useRef } from 'react'
import Link from 'next/link'
import { api } from '@/lib/api'

export default function CVOptimizer() {
  const [step, setStep] = useState<'upload' | 'analyzing' | 'result'>('upload')
  const [jd, setJd] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [cvText, setCvText] = useState('')
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
      const formData = new FormData()
      formData.append('file', f)
      const res = await api.uploadCV(formData)
      let extracted = ''
      if (typeof res === 'string') extracted = res
      else if (res && typeof res === 'object') {
        const data = res as any
        extracted = data.cv_text || data.text || data.extracted_text || data.content || ''
      }
      if (!extracted) setError('Upload succeeded but no CV text was returned. Try re-uploading.')
      setCvText(extracted)
    } catch (err: any) {
      setError(err.message || 'Upload failed')
      setFile(null)
    } finally {
      setUploading(false)
    }
  }

  const runOptimize = async () => {
    if (!file || !cvText) { setError('Upload your CV first.'); return }
    if (!jd.trim()) { setError('Paste a job description first.'); return }
    setError('')
    setStep('analyzing')
    try {
      const data = await api.screenCandidate(jd, cvText)
      setResult(data)
      setStep('result')
    } catch (err: any) {
      setError(err.message || 'Could not analyze your CV — please try again.')
      setStep('upload')
    }
  }

  const score = result?.metrics?.candidate_score ?? null
  const matched: string[] = result?.metrics?.matched_skills || []
  const missing: string[] = result?.metrics?.missing_skills || []
  const analysis: string = result?.deep_analysis || ''

  return (
    <div style={{ minHeight: '100vh', background: '#0c0c0a', fontFamily: 'Syne, sans-serif', color: 'rgba(255,255,255,.88)' }}>
      {/* Topbar */}
      <div style={{ height: 56, borderBottom: '1px solid rgba(255,255,255,.07)', display: 'flex', alignItems: 'center', padding: '0 28px', gap: 16 }}>
        <Link href="/candidate/dashboard" style={{ color: 'rgba(255,255,255,.4)', textDecoration: 'none', fontSize: 13 }}>← Dashboard</Link>
        <span style={{ color: 'rgba(255,255,255,.15)' }}>·</span>
        <span style={{ fontSize: 13, color: 'rgba(255,255,255,.6)', fontWeight: 600 }}>CV Optimizer</span>
      </div>

      <div style={{ maxWidth: 800, margin: '0 auto', padding: '40px 24px' }}>
        <div style={{ marginBottom: 40 }}>
          <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.14em', textTransform: 'uppercase', color: '#e2b04a', marginBottom: 12 }}>AI-Powered</p>
          <h1 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 'clamp(32px,4vw,48px)', fontWeight: 600, letterSpacing: '-.5px', marginBottom: 12 }}>
            CV Optimizer
          </h1>
          <p style={{ fontSize: 15, color: 'rgba(255,255,255,.4)', lineHeight: 1.7 }}>
            Upload your CV and a job description — we'll show you your real match score, and exactly which skills are missing.
          </p>
        </div>

        {step === 'upload' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ background: '#111110', border: '1px solid rgba(255,255,255,.08)', borderRadius: 14, padding: 24 }}>
              <div style={{ fontSize: 12, fontWeight: 600, letterSpacing: '.08em', textTransform: 'uppercase', color: 'rgba(255,255,255,.3)', marginBottom: 12 }}>Your CV</div>
              <input ref={fileRef} type="file" accept=".pdf,.docx,.doc" onChange={handleFileChange} style={{ display: 'none' }} />
              <div onClick={handlePickFile}
                style={{ border: `2px dashed ${file ? 'rgba(19,194,142,.4)' : 'rgba(255,255,255,.12)'}`, borderRadius: 10, padding: 32, textAlign: 'center', cursor: 'pointer', background: '#161614', transition: 'all .25s' }}
                onMouseOver={e => { if (!file) { (e.currentTarget as HTMLElement).style.borderColor = 'rgba(226,176,74,.4)'; (e.currentTarget as HTMLElement).style.background = 'rgba(226,176,74,.03)' } }}
                onMouseOut={e => { if (!file) { (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,.12)'; (e.currentTarget as HTMLElement).style.background = '#161614' } }}>
                <div style={{ fontSize: 36, marginBottom: 12 }}>{uploading ? '⏳' : file ? '✅' : '📄'}</div>
                <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>
                  {uploading ? 'Uploading...' : file ? file.name : 'Click to upload your CV'}
                </div>
                <div style={{ fontSize: 12, color: 'rgba(255,255,255,.3)' }}>PDF or DOCX · Max 10MB</div>
              </div>
            </div>

            <div style={{ background: '#111110', border: '1px solid rgba(255,255,255,.08)', borderRadius: 14, padding: 24 }}>
              <div style={{ fontSize: 12, fontWeight: 600, letterSpacing: '.08em', textTransform: 'uppercase', color: 'rgba(255,255,255,.3)', marginBottom: 12 }}>Target Job Description</div>
              <textarea
                value={jd} onChange={e => setJd(e.target.value)}
                placeholder="Paste the job description here. The more detailed, the better our analysis..."
                style={{ width: '100%', background: '#161614', border: '1px solid rgba(255,255,255,.08)', borderRadius: 10, padding: 14, fontSize: 13, fontFamily: 'Syne, sans-serif', color: 'rgba(255,255,255,.8)', outline: 'none', resize: 'none', lineHeight: 1.7, minHeight: 140 }}
              />
            </div>

            {error && <div style={{ fontSize: 13, color: '#ef4444' }}>{error}</div>}

            <button onClick={runOptimize} disabled={uploading} style={{ background: '#e2b04a', color: '#0a0a09', fontWeight: 700, fontSize: 15, padding: '14px', borderRadius: 10, border: 'none', cursor: uploading ? 'default' : 'pointer', opacity: uploading ? 0.6 : 1, fontFamily: 'Syne, sans-serif', letterSpacing: '.03em', transition: 'all .25s' }}
              onMouseOver={e => { (e.currentTarget as HTMLElement).style.background = '#f5d87a'; (e.currentTarget as HTMLElement).style.transform = 'translateY(-1px)' }}
              onMouseOut={e => { (e.currentTarget as HTMLElement).style.background = '#e2b04a'; (e.currentTarget as HTMLElement).style.transform = 'none' }}>
              ✨ Analyze My CV
            </button>
          </div>
        )}

        {step === 'analyzing' && (
          <div style={{ textAlign: 'center', padding: '60px 0' }}>
            <div style={{ width: 60, height: 60, border: '4px solid rgba(226,176,74,.2)', borderTopColor: '#e2b04a', borderRadius: '50%', animation: 'spin .8s linear infinite', margin: '0 auto 24px' }} />
            <h3 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 24, marginBottom: 8 }}>Analyzing your CV...</h3>
            <p style={{ fontSize: 14, color: 'rgba(255,255,255,.35)' }}>Comparing against the job description. Finding gaps and opportunities.</p>
            <style dangerouslySetInnerHTML={{ __html: `@keyframes spin { to { transform: rotate(360deg) } }` }} />
          </div>
        )}

        {step === 'result' && result && (
          <div>
            {/* Real match score */}
            <div style={{ background: '#111110', border: '1px solid rgba(255,255,255,.08)', borderRadius: 14, padding: 24, marginBottom: 24, display: 'flex', alignItems: 'center', gap: 24 }}>
              <div style={{ textAlign: 'center', flexShrink: 0 }}>
                <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 48, fontWeight: 600, color: score >= 70 ? '#13c28e' : score >= 45 ? '#e2b04a' : '#ef4444', lineHeight: 1 }}>{score}</div>
                <div style={{ fontSize: 12, color: 'rgba(255,255,255,.35)', marginTop: 4 }}>Match score</div>
              </div>
              <div style={{ flex: 1, paddingLeft: 12 }}>
                <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 6 }}>{result?.metrics?.final_verdict || 'Analysis complete'}</div>
                <div style={{ fontSize: 13, color: 'rgba(255,255,255,.4)', lineHeight: 1.6 }}>
                  {missing.length > 0 ? `Closing ${missing.length} skill gap${missing.length > 1 ? 's' : ''} below would strengthen your match.` : 'Your CV already covers the key skills in this JD.'}
                </div>
              </div>
            </div>

            {/* Missing skills — the real, actionable gaps */}
            {missing.length > 0 && (
              <div style={{ background: '#111110', border: '1px solid rgba(239,68,68,.2)', borderRadius: 12, padding: 20, marginBottom: 12 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#ef4444', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '.04em' }}>Missing skills — add these if you have them</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {missing.map(sk => (
                    <span key={sk} style={{ fontSize: 12.5, fontWeight: 600, padding: '6px 12px', borderRadius: 100, background: 'rgba(239,68,68,.1)', color: '#f87171', border: '1px solid rgba(239,68,68,.25)' }}>{sk}</span>
                  ))}
                </div>
              </div>
            )}

            {/* Matched skills */}
            {matched.length > 0 && (
              <div style={{ background: '#111110', border: '1px solid rgba(19,194,142,.2)', borderRadius: 12, padding: 20, marginBottom: 12 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#13c28e', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '.04em' }}>Skills you already have</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {matched.map(sk => (
                    <span key={sk} style={{ fontSize: 12.5, fontWeight: 600, padding: '6px 12px', borderRadius: 100, background: 'rgba(19,194,142,.1)', color: '#34d399', border: '1px solid rgba(19,194,142,.25)' }}>{sk}</span>
                  ))}
                </div>
              </div>
            )}

            {/* AI's written analysis, verbatim from the model */}
            {analysis && (
              <div style={{ background: '#111110', border: '1px solid rgba(255,255,255,.08)', borderRadius: 12, padding: 20, marginBottom: 20 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,.4)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '.04em' }}>AI Analysis</div>
                <div style={{ fontSize: 13.5, color: 'rgba(255,255,255,.65)', lineHeight: 1.75, whiteSpace: 'pre-wrap' }}>{analysis}</div>
              </div>
            )}

            <button onClick={() => { setStep('upload'); setResult(null); setFile(null); setCvText('') }} style={{ width: '100%', background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.1)', color: 'rgba(255,255,255,.5)', fontWeight: 600, fontSize: 14, padding: '13px', borderRadius: 10, cursor: 'pointer', fontFamily: 'Syne, sans-serif', transition: 'all .2s' }}>
              ← Analyze Another CV
            </button>
          </div>
        )}
      </div>
    </div>
  )
}