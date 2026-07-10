'use client'
import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import UpgradeModal from '@/components/UpgradeModal'
import { api, ApiError } from '@/lib/api'

const ICONS: Record<string, JSX.Element> = {
  dashboard: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg>,
  scan: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M9 13h6M9 17h6"/></svg>,
  history: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/></svg>,
  profile: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7"/></svg>,
  settings: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.6-1.1 1.7 1.7 0 0 0-.3-1.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.9.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.9-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.9V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg>,
}

const NAV = [
  { key: 'dashboard', label: 'Dashboard', href: '/candidate/dashboard' },
  { key: 'scan', label: 'Scan CV', href: '/candidate/dashboard#scan-area' },
  { key: 'cv-builder', label: 'CV Builder', href: '/candidate/dashboard/cv-builder' },
  { key: 'history', label: 'History', href: '/candidate/dashboard/history' },
  { key: 'profile', label: 'My Profile', href: '/candidate/dashboard/profile' },
  { key: 'settings', label: 'Settings', href: '/candidate/dashboard/settings' },
]

export default function CandidateDashboard() {
  const [activeNav, setActiveNav] = useState('dashboard')
  const [user, setUser] = useState<{ name?: string; email?: string } | null>(null)
  const [showUpgrade, setShowUpgrade] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [cvText, setCvText] = useState('')
  const [uploading, setUploading] = useState(false)
  const [scanning, setScanning] = useState(false)
  const [scanStep, setScanStep] = useState(-1)
  const [result, setResult] = useState<any>(null)
  const [error, setError] = useState('')
  const [activeTab, setActiveTab] = useState('skills')
  const [jd, setJd] = useState('')
  const [scansLeft, setScansLeft] = useState(3)
  const [history, setHistory] = useState<any[]>([])
  const fileRef = useRef<HTMLInputElement>(null)

  const SCAN_STEPS = [
    'Parsing your CV...',
    'Creating text chunks...',
    'Building vector embeddings...',
    'Storing in FAISS index...',
    'Retrieving relevant context...',
    'Reasoning with LLaMA 3.3...',
    'Generating score & analysis...',
  ]

  useEffect(() => {
    api.me().then((u: any) => {
      setUser({ name: u?.name || u?.full_name, email: u?.email })
      if (typeof u?.scans_remaining === 'number') setScansLeft(u.scans_remaining)
    }).catch(() => {})
  }, [])

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
      console.log('Upload response:', res)
      let extracted = ''
      if (typeof res === 'string') {
        extracted = res
      } else if (res && typeof res === 'object') {
        const data = res as any
        extracted = data.cv_text || data.text || data.extracted_text || data.content || ''
      }
      if (!extracted) {
        setError('Upload succeeded but no CV text was returned — check console log and share the response shape.')
      }
      setCvText(extracted)
    } catch (err: any) {
      setError(err.message || 'Upload failed')
      setFile(null)
    } finally {
      setUploading(false)
    }
  }

  const handleScan = async () => {
    if (!file) { setError('Upload a CV first.'); return }
    if (!cvText) { setError('CV text not extracted yet — try re-uploading.'); return }
    if (!jd.trim()) { setError('Paste a job description first.'); return }
    if (scansLeft <= 0) { setShowUpgrade(true); return }

    setError('')
    setScanning(true)
    setScanStep(0)

    // Cycle through steps while API call runs
    const stepInterval = setInterval(() => {
      setScanStep(s => s < SCAN_STEPS.length - 1 ? s + 1 : s)
    }, 900)

    try {
      const data = await api.screenCandidate(jd, cvText)
      clearInterval(stepInterval)
      setScanStep(SCAN_STEPS.length - 1)
      await new Promise(r => setTimeout(r, 400)) // brief pause on last step
      console.log('Scan response:', data)
      setResult(data)
      if (typeof data.scans_remaining === 'number') setScansLeft(data.scans_remaining)
      else setScansLeft(s => Math.max(0, s - 1))
      const score = data?.metrics?.candidate_score ?? 0
      setHistory(h => [{
        score,
        role: (jd.match(/Job Title:\s*(.+)/i)?.[1] || jd.split('\n')[0])?.trim().slice(0, 60) || 'Untitled Role',
        skills: (data?.metrics?.matched_skills || []).slice(0, 3).join(', '),
        date: 'Just now',
        color: score >= 80 ? '#13c28e' : score >= 50 ? '#e2b04a' : '#ef4444',
      }, ...h])
    } catch (err: any) {
      clearInterval(stepInterval)
      if (err instanceof ApiError && err.code === 'FREE_LIMIT_REACHED') {
        setScansLeft(0)
        setShowUpgrade(true)
      } else {
        setError(err.message || 'Scan failed. Try again.')
      }
    } finally {
      setScanning(false)
      setScanStep(-1)
    }
  }

  const handleNavClick = (item: typeof NAV[number]) => {
    setActiveNav(item.key)
    const hashIndex = item.href.indexOf('#')
    if (hashIndex !== -1) {
      const id = item.href.slice(hashIndex)
      setTimeout(() => {
        document.querySelector(id)?.scrollIntoView({ behavior: 'smooth' })
      }, 50)
    }
  }

  const S = { sidebar: { width: 220, flexShrink: 0, background: '#111110', borderRight: '1px solid rgba(255,255,255,.07)', display: 'flex', flexDirection: 'column' as const } }

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: '#0c0c0a', fontFamily: 'Syne, sans-serif', color: 'rgba(255,255,255,.88)' }}>
      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@500;600&family=Syne:wght@400;500;600;700&display=swap');

        @keyframes fadeUp { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes ringDraw { from { stroke-dashoffset: 339; } }
        @keyframes barGrow { from { width: 0; } }
        @keyframes pulse { 0%, 100% { opacity: .35; } 50% { opacity: .8; } }
        @keyframes spin { to { transform: rotate(360deg); } }

        .fade-up { animation: fadeUp .45s ease both; }
        .fade-in { animation: fadeIn .3s ease both; }
        .ring-anim { animation: ringDraw 1.1s cubic-bezier(.4,0,.2,1) both; }
        .bar-anim { width: var(--bw); animation: barGrow 1s cubic-bezier(.4,0,.2,1) both; }
        .pulse-dot { animation: pulse 1.4s ease-in-out infinite; }
        .spinner { animation: spin .8s linear infinite; }
        .nav-btn { transition: background .2s, color .2s, border-color .2s; }
        .nav-btn:hover { background: rgba(255,255,255,.04); color: rgba(255,255,255,.7); }
        .history-row { transition: background .2s, transform .2s; }
        .history-row:hover { background: #1b1b18; transform: translateX(2px); }
        .dropzone { transition: border-color .25s, background .25s, transform .15s; }
        .dropzone:hover { transform: translateY(-1px); }
        .tab-btn { transition: color .2s, border-color .2s; }
      `}</style>

      {showUpgrade && <UpgradeModal role="candidate" onClose={() => setShowUpgrade(false)} />}

      {/* SIDEBAR */}
      <div style={S.sidebar}>
        <Link href="/" style={{ padding: '22px 18px', borderBottom: '1px solid rgba(255,255,255,.07)', display: 'flex', alignItems: 'center', gap: 10, fontFamily: "'Cormorant Garamond',serif", fontSize: 20, fontWeight: 600, color: 'rgba(255,255,255,.9)', textDecoration: 'none' }}>
          <div style={{ width: 28, height: 28, background: '#e2b04a', borderRadius: 7, display: 'grid', placeItems: 'center' }}><svg width="12" height="12" viewBox="0 0 16 16" fill="#0a0a09"><path d="M8 2C4.68 2 2 4.68 2 8c0 1.76.72 3.35 1.88 4.5L8 8.5l4.12 4A5.97 5.97 0 0014 8c0-3.32-2.68-6-6-6z" /></svg></div>
          TalentIQ
        </Link>
        <div style={{ padding: '18px 12px 6px', fontSize: 10, fontWeight: 700, letterSpacing: '.12em', textTransform: 'uppercase', color: 'rgba(255,255,255,.25)' }}>Menu</div>
        {NAV.map(n => {
          const active = activeNav === n.key
          return (
            <Link key={n.key} href={n.href} onClick={() => handleNavClick(n)} className="nav-btn" style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 14px', borderRadius: 8, fontSize: 13, fontWeight: 500, color: active ? '#e2b04a' : 'rgba(255,255,255,.45)', cursor: 'pointer', margin: '0 6px 2px', border: active ? '1px solid rgba(226,176,74,.15)' : '1px solid transparent', background: active ? 'rgba(226,176,74,.1)' : 'transparent', fontFamily: 'Syne, sans-serif', width: 'calc(100% - 12px)', textAlign: 'left', textDecoration: 'none' }}>
              <span style={{ display: 'flex' }}>{ICONS[n.key]}</span>{n.label}
            </Link>
          )
        })}
        <div style={{ marginTop: 'auto', padding: '14px', borderTop: '1px solid rgba(255,255,255,.07)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: 8 }}>
            <div style={{ width: 30, height: 30, borderRadius: '50%', background: 'linear-gradient(135deg,#c5931f,#e2b04a)', display: 'grid', placeItems: 'center', fontSize: 11, fontWeight: 700, color: '#0a0a09', flexShrink: 0 }}>
              {(user?.name || 'U').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()}
            </div>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{user?.name || 'Loading…'}</div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,.3)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{user?.email || ''}</div>
            </div>
            <button
              onClick={() => {
                localStorage.removeItem('token')
                localStorage.removeItem('role')
                document.cookie = 'token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;'
                window.location.replace('/auth/login/candidate')
              }}
              title="Log out"
              style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,.35)', cursor: 'pointer', flexShrink: 0, display: 'flex', padding: 4 }}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="M16 17l5-5-5-5"/><path d="M21 12H9"/></svg>
            </button>
          </div>
        </div>
      </div>

      {/* MAIN */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Topbar */}
        <div style={{ height: 60, borderBottom: '1px solid rgba(255,255,255,.07)', display: 'flex', alignItems: 'center', padding: '0 28px', justifyContent: 'space-between', flexShrink: 0 }}>
          <div><div style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 22, fontWeight: 600 }}>My Dashboard</div><div style={{ fontSize: 12, color: 'rgba(255,255,255,.3)', marginTop: 1 }}>Welcome back — {3 - scansLeft} scans used</div></div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#161614', border: '1px solid rgba(255,255,255,.07)', borderRadius: 8, padding: '6px 12px', fontSize: 12, color: 'rgba(255,255,255,.5)' }}>
              <strong style={{ color: '#e2b04a' }}>{scansLeft}</strong>&nbsp;free scan{scansLeft === 1 ? '' : 's'} remaining
            </div>
            <button onClick={() => setShowUpgrade(true)} style={{ fontSize: 12, fontWeight: 700, background: '#e2b04a', color: '#0a0a09', padding: '8px 16px', borderRadius: 8, border: 'none', cursor: 'pointer', fontFamily: 'Syne, sans-serif', letterSpacing: '.03em' }}>
              Upgrade to Pro — $9/mo
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="dark-scroll" style={{ flex: 1, overflowY: 'auto', padding: 28, display: 'flex', flexDirection: 'column', gap: 20 }}>

          {/* Scan Area */}
          <div id="scan-area" style={{ background: '#111110', border: '1px solid rgba(255,255,255,.07)', borderRadius: 12, padding: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <div><div style={{ fontSize: 14, fontWeight: 600, letterSpacing: '-.2px' }}>Scan Your CV</div><div style={{ fontSize: 12, color: 'rgba(255,255,255,.3)', marginTop: 2 }}>Upload a CV and paste a job description to get your match score</div></div>
              <span style={{ fontSize: 12, color: 'rgba(255,255,255,.3)' }}>{scansLeft} free scan{scansLeft === 1 ? '' : 's'} left</span>
            </div>

            {error && (
              <div className="fade-in" style={{ background: 'rgba(239,68,68,.08)', border: '1px solid rgba(239,68,68,.2)', color: '#ef4444', fontSize: 12, padding: '10px 14px', borderRadius: 8, marginBottom: 16 }}>
                {error}
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <input ref={fileRef} type="file" accept=".pdf,.doc,.docx" onChange={handleFileChange} style={{ display: 'none' }} />
              <div onClick={handlePickFile} className="dropzone" style={{ border: `2px dashed ${file ? 'rgba(19,194,142,.4)' : 'rgba(255,255,255,.12)'}`, borderRadius: 10, padding: 28, textAlign: 'center', cursor: 'pointer', background: file ? 'rgba(19,194,142,.04)' : '#161614' }}>
                <div style={{ marginBottom: 10, display: 'flex', justifyContent: 'center' }}>
                  {uploading ? (
                    <svg className="spinner" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#e2b04a" strokeWidth="2"><circle cx="12" cy="12" r="9" strokeOpacity=".2"/><path d="M21 12a9 9 0 0 0-9-9"/></svg>
                  ) : file ? (
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#13c28e" strokeWidth="1.8"><circle cx="12" cy="12" r="9"/><path d="M8 12.5l2.5 2.5L16 9"/></svg>
                  ) : (
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,.4)" strokeWidth="1.6"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/></svg>
                  )}
                </div>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,.85)', marginBottom: 4 }}>
                  {uploading ? 'Uploading…' : file ? file.name : 'Drop your CV here'}
                </div>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,.3)' }}>
                  {uploading ? 'Please wait' : file ? 'Ready to analyze' : 'or click to browse · PDF or DOCX'}
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,.3)', letterSpacing: '.06em', textTransform: 'uppercase' }}>Job Description</div>
                <textarea value={jd} onChange={e => setJd(e.target.value)} placeholder={"Paste the job description here…\n\ne.g. 'We're looking for a Senior React Developer with 4+ years…'"} style={{ flex: 1, background: '#161614', border: '1px solid rgba(255,255,255,.08)', borderRadius: 10, padding: 14, fontSize: 13, fontFamily: 'Syne, sans-serif', color: 'rgba(255,255,255,.8)', outline: 'none', resize: 'none', lineHeight: 1.6, minHeight: 100 }} />
                <button onClick={handleScan} disabled={scanning || uploading} style={{ width: '100%', background: scanning ? 'rgba(226,176,74,.15)' : '#e2b04a', color: scanning ? '#e2b04a' : '#0a0a09', fontSize: 14, fontWeight: 700, fontFamily: 'Syne, sans-serif', padding: 13, borderRadius: 10, border: scanning ? '1px solid rgba(226,176,74,.3)' : 'none', cursor: scanning ? 'default' : 'pointer', letterSpacing: '.04em' }}>
                  {scanning ? SCAN_STEPS[scanStep] || 'Analyzing...' : result ? 'Analysis Complete — Scan Again' : 'Analyze Match'}
                </button>
                {scanning && (
                  <div style={{ marginTop: 12 }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {SCAN_STEPS.map((step, i) => (
                        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, opacity: i <= scanStep ? 1 : 0.2, transition: 'opacity 0.4s ease', fontSize: 11, color: i === scanStep ? '#e2b04a' : i < scanStep ? '#13c28e' : 'rgba(255,255,255,.3)' }}>
                          <div style={{ width: 5, height: 5, borderRadius: '50%', background: i === scanStep ? '#e2b04a' : i < scanStep ? '#13c28e' : 'rgba(255,255,255,.15)', flexShrink: 0, transition: 'background 0.4s' }} />
                          <span style={{ fontFamily: 'Syne, sans-serif' }}>{step}</span>
                          {i < scanStep && <span style={{ marginLeft: 'auto', color: '#13c28e', fontSize: 10 }}>done</span>}
                          {i === scanStep && <span style={{ marginLeft: 'auto', fontSize: 10, animation: 'pulse 1s infinite' }}>...</span>}
                        </div>
                      ))}
                    </div>
                    <div style={{ marginTop: 10, height: 2, background: 'rgba(255,255,255,.06)', borderRadius: 1 }}>
                      <div style={{ height: '100%', background: 'linear-gradient(90deg,#b8860b,#e2b04a)', borderRadius: 1, width: `${Math.round(((scanStep + 1) / SCAN_STEPS.length) * 100)}%`, transition: 'width 0.6s ease' }} />
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Results */}
          {result && (
            <div className="fade-up" style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: 20, alignItems: 'start' }}>
              {/* Score Ring */}
              <div style={{ background: '#111110', border: '1px solid rgba(255,255,255,.07)', borderRadius: 12, padding: 24, display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: 200 }}>
                <svg width="0" height="0"><defs><linearGradient id="rg" x1="0" y1="0" x2="1" y2="0"><stop offset="0%" stopColor="#c5931f" /><stop offset="100%" stopColor="#13c28e" /></linearGradient></defs></svg>
                <div style={{ position: 'relative', width: 120, height: 120, marginBottom: 16 }}>
                  <svg width="120" height="120" viewBox="0 0 120 120" style={{ transform: 'rotate(-90deg)' }}>
                    <circle cx="60" cy="60" r="54" fill="none" stroke="#1e1e1b" strokeWidth="10" />
                    <circle className="ring-anim" cx="60" cy="60" r="54" fill="none" stroke="url(#rg)" strokeWidth="10" strokeLinecap="round" strokeDasharray="339" strokeDashoffset={339 - (339 * (result.metrics?.candidate_score ?? 0)) / 100} />
                  </svg>
                  <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                    <span style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 38, fontWeight: 600, lineHeight: 1 }}>{result.metrics?.candidate_score ?? 0}</span>
                    <small style={{ fontSize: 11, color: 'rgba(255,255,255,.4)', marginTop: 2 }}>/ 100</small>
                  </div>
                </div>
                <div style={{ background: 'rgba(19,194,142,.12)', color: '#13c28e', fontSize: 12, fontWeight: 600, padding: '5px 14px', borderRadius: 100, border: '1px solid rgba(19,194,142,.2)', marginBottom: 12, textAlign: 'center' }}>{result.metrics?.final_verdict || 'Match Result'}</div>
                <div style={{ fontSize: 12, color: 'rgba(255,255,255,.35)', textAlign: 'center', lineHeight: 1.5, marginBottom: 14 }}>You match {result.metrics?.candidate_score ?? 0}% of<br />this role's requirements</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, width: '100%' }}>
                  {result.flags?.is_shortlisted && (
                    <div style={{ fontSize: 11, color: '#13c28e', background: 'rgba(19,194,142,.08)', border: '1px solid rgba(19,194,142,.18)', borderRadius: 6, padding: '5px 10px', textAlign: 'center' }}>Shortlisted</div>
                  )}
                  {result.flags?.trigger_interview && (
                    <div style={{ fontSize: 11, color: '#e2b04a', background: 'rgba(226,176,74,.08)', border: '1px solid rgba(226,176,74,.18)', borderRadius: 6, padding: '5px 10px', textAlign: 'center' }}>Interview Recommended</div>
                  )}
                  {result.flags?.has_min_experience === false && (
                    <div style={{ fontSize: 11, color: 'rgba(255,255,255,.4)', background: '#161614', border: '1px solid rgba(255,255,255,.08)', borderRadius: 6, padding: '5px 10px', textAlign: 'center' }}>Below Minimum Experience</div>
                  )}
                </div>
              </div>

              {/* Analysis Panel */}
              <div style={{ background: '#111110', border: '1px solid rgba(255,255,255,.07)', borderRadius: 12, padding: 24 }}>
                <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid rgba(255,255,255,.07)', marginBottom: 20 }}>
                  {['skills', 'gaps', 'recos'].map(t => (
                    <button key={t} onClick={() => setActiveTab(t)} className="tab-btn" style={{ padding: '8px 16px', fontSize: 13, fontWeight: 500, color: activeTab === t ? '#e2b04a' : 'rgba(255,255,255,.3)', cursor: 'pointer', borderBottom: `2px solid ${activeTab === t ? '#e2b04a' : 'transparent'}`, marginBottom: -1, border: 'none', borderTop: 'none', borderLeft: 'none', borderRight: 'none', background: 'none', fontFamily: 'Syne, sans-serif' }}>
                      {t === 'skills' ? 'Skills' : t === 'gaps' ? 'Skill Gaps' : 'Suggestions'}
                    </button>
                  ))}
                </div>

                {activeTab === 'skills' && (
                  (result.metrics?.matched_skills?.length ?? 0) === 0 ? (
                    <div style={{ fontSize: 12, color: 'rgba(255,255,255,.3)', textAlign: 'center', padding: '20px 0' }}>No matched skills found.</div>
                  ) : (result.metrics?.matched_skills || []).map((s: string, i: number) => (
                    <div key={s} className="fade-up" style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: '#161614', borderRadius: 8, border: '1px solid rgba(255,255,255,.06)', marginBottom: 8, animationDelay: `${i * 50}ms` }}>
                      <div style={{ width: 20, height: 20, borderRadius: '50%', background: 'rgba(19,194,142,.12)', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#13c28e" strokeWidth="3"><path d="M5 12l5 5L20 7"/></svg>
                      </div>
                      <span style={{ fontSize: 13, color: 'rgba(255,255,255,.75)' }}>{s}</span>
                    </div>
                  ))
                )}

                {activeTab === 'gaps' && (
                  (result.metrics?.missing_skills?.length ?? 0) === 0 ? (
                    <div style={{ fontSize: 12, color: 'rgba(255,255,255,.3)', textAlign: 'center', padding: '20px 0' }}>No skill gaps found — strong match.</div>
                  ) : (result.metrics?.missing_skills || []).map((s: string, i: number) => (
                    <div key={s} className="fade-up" style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: '#161614', borderRadius: 8, border: '1px solid rgba(255,255,255,.06)', marginBottom: 8, animationDelay: `${i * 50}ms` }}>
                      <div style={{ width: 20, height: 20, borderRadius: '50%', background: 'rgba(239,68,68,.1)', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="3"><path d="M6 6l12 12M18 6L6 18"/></svg>
                      </div>
                      <span style={{ fontSize: 13, color: 'rgba(255,255,255,.7)', flex: 1 }}>{s}</span>
                      <span style={{ fontSize: 11, padding: '3px 8px', borderRadius: 100, background: 'rgba(239,68,68,.1)', color: '#ef4444' }}>Missing</span>
                    </div>
                  ))
                )}

                {activeTab === 'recos' && (
                  <div className="fade-up" style={{ fontSize: 13, color: 'rgba(255,255,255,.65)', lineHeight: 1.8, whiteSpace: 'pre-wrap' }}>
                    {(result.deep_analysis || 'No suggestions available.')
                      .split(/\n(?=\*\*)/)
                      .filter(Boolean)
                      .map((block: string, i: number) => {
                        const headingMatch = block.match(/^\*\*(.+?)\*\*/)
                        const heading = headingMatch ? headingMatch[1] : null
                        const body = heading ? block.replace(/^\*\*(.+?)\*\*/, '').trim() : block.trim()
                        return (
                          <div key={i} style={{ marginBottom: 16, padding: '12px 14px', background: '#161614', borderRadius: 8, borderLeft: '3px solid #e2b04a' }}>
                            {heading && <h5 style={{ fontSize: 13, fontWeight: 600, marginBottom: 6, color: 'rgba(255,255,255,.85)' }}>{heading}</h5>}
                            <p style={{ fontSize: 12, color: 'rgba(255,255,255,.45)', lineHeight: 1.7, margin: 0 }}>{body.replace(/^\n+/, '')}</p>
                          </div>
                        )
                      })}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* History */}
          <div id="history" style={{ background: '#111110', border: '1px solid rgba(255,255,255,.07)', borderRadius: 12, padding: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 600 }}>Recent Scans</div>
              {history.length > 0 && (
                <button onClick={() => setHistory([])} style={{ fontSize: 11, color: 'rgba(255,255,255,.3)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'Syne, sans-serif' }}>Clear</button>
              )}
            </div>
            {history.length === 0 ? (
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,.3)', textAlign: 'center', padding: '20px 0' }}>No scans yet — run your first analysis above.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {history.map((h, i) => (
                  <div key={i} className="history-row fade-up" style={{ display: 'flex', alignItems: 'center', gap: 14, background: '#161614', border: '1px solid rgba(255,255,255,.06)', borderRadius: 10, padding: '14px 18px', cursor: 'pointer', animationDelay: `${i * 50}ms` }}>
                    <div style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 24, fontWeight: 600, color: h.color, width: 40, textAlign: 'center' }}>{h.score}</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 2 }}>{h.role}</div>
                      <div style={{ fontSize: 12, color: 'rgba(255,255,255,.3)' }}>{h.skills}</div>
                    </div>
                    <div style={{ fontSize: 11, color: 'rgba(255,255,255,.3)' }}>{h.date}</div>
                    <div style={{ color: 'rgba(255,255,255,.3)', fontSize: 16 }}>›</div>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  )
}