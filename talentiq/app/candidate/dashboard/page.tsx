'use client'
import { useState, useRef } from 'react'
import Link from 'next/link'
import UpgradeModal from '@/components/UpgradeModal'
import { api } from '@/lib/api'

const NAV = [
  { icon: '⊞', label: 'Dashboard', active: true },
  { icon: '📄', label: 'Scan CV', active: false },
  { icon: '🕐', label: 'History', active: false },
  { icon: '👤', label: 'My Profile', active: false },
  { icon: '⚙️', label: 'Settings', active: false },
]

const HISTORY = [
  { score: 91, role: 'Senior Frontend Engineer — NovaCorp', skills: 'React, TypeScript, Node.js', date: 'Today', color: '#13c28e' },
  { score: 74, role: 'Full-Stack Developer — BuildFast', skills: 'Python, Django, React', date: 'Yesterday', color: '#e2b04a' },
  { score: 52, role: 'DevOps Engineer — CloudBase', skills: 'Kubernetes, Docker, AWS', date: '3 days ago', color: '#ef4444' },
]

export default function CandidateDashboard() {
  const [showUpgrade, setShowUpgrade] = useState(false)
  const [cvUploaded, setCvUploaded] = useState(false)
  const [scanning, setScanning] = useState(false)
  const [result, setResult] = useState<any>(null)
  const [activeTab, setActiveTab] = useState('skills')
  const [jd, setJd] = useState('')
  const [scansLeft] = useState(1)
  const fileRef = useRef<HTMLInputElement>(null)

  const handleUpload = () => { setCvUploaded(true) }

  const handleScan = async () => {
    if (scansLeft <= 0) { setShowUpgrade(true); return }
    setScanning(true)
    await new Promise(r => setTimeout(r, 2000))
    setResult({
      score: 85, label: 'Strong Match',
      skills: [{ n: 'React / Next.js', w: 95, gold: true }, { n: 'TypeScript', w: 88, gold: true }, { n: 'Node.js', w: 76, gold: false }, { n: 'PostgreSQL', w: 65, gold: false }, { n: 'Docker', w: 30, gold: false }, { n: 'Kubernetes', w: 10, gold: false }],
      gaps: [{ s: 'React & Next.js', status: 'match' }, { s: 'TypeScript', status: 'match' }, { s: 'Node.js Backend', status: 'partial' }, { s: 'Docker & Containerization', status: 'missing' }, { s: 'Kubernetes / Orchestration', status: 'missing' }],
      recos: [{ t: 'Learn Docker fundamentals', d: 'This role requires containerization experience. A 10-hour Docker course would address this gap directly.' }, { t: 'Add backend project to portfolio', d: 'Your Node.js skills appear theoretical. A deployed full-stack project would strengthen your application.' }, { t: 'Highlight TypeScript experience', d: 'Your TypeScript score is strong but your CV does not emphasize it. Add specific TypeScript projects.' }],
    })
    setScanning(false)
  }

  const S = { sidebar: { width: 220, flexShrink: 0, background: '#111110', borderRight: '1px solid rgba(255,255,255,.07)', display: 'flex', flexDirection: 'column' as const } }

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: '#0c0c0a', fontFamily: 'Syne, sans-serif', color: 'rgba(255,255,255,.88)' }}>
      {showUpgrade && <UpgradeModal role="candidate" onClose={() => setShowUpgrade(false)} />}

      {/* SIDEBAR */}
      <div style={S.sidebar}>
        <Link href="/" style={{ padding: '22px 18px', borderBottom: '1px solid rgba(255,255,255,.07)', display: 'flex', alignItems: 'center', gap: 10, fontFamily: "'Cormorant Garamond',serif", fontSize: 20, fontWeight: 600, color: 'rgba(255,255,255,.9)', textDecoration: 'none' }}>
          <div style={{ width: 28, height: 28, background: '#e2b04a', borderRadius: 7, display: 'grid', placeItems: 'center' }}><svg width="12" height="12" viewBox="0 0 16 16" fill="#0a0a09"><path d="M8 2C4.68 2 2 4.68 2 8c0 1.76.72 3.35 1.88 4.5L8 8.5l4.12 4A5.97 5.97 0 0014 8c0-3.32-2.68-6-6-6z" /></svg></div>
          TalentIQ
        </Link>
        <div style={{ padding: '18px 12px 6px', fontSize: 10, fontWeight: 700, letterSpacing: '.12em', textTransform: 'uppercase', color: 'rgba(255,255,255,.25)' }}>Menu</div>
        {NAV.map(n => (
          <button key={n.label} className={n.active ? 'sidebar-link-active' : ''} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 14px', borderRadius: 8, fontSize: 13, fontWeight: 500, color: n.active ? '#e2b04a' : 'rgba(255,255,255,.45)', cursor: 'pointer', transition: 'all .2s', margin: '0 6px 2px', border: n.active ? '1px solid rgba(226,176,74,.15)' : '1px solid transparent', background: n.active ? 'rgba(226,176,74,.1)' : 'transparent', fontFamily: 'Syne, sans-serif', width: 'calc(100% - 12px)', textAlign: 'left' }}>
            <span style={{ fontSize: 15 }}>{n.icon}</span>{n.label}
          </button>
        ))}
        <div style={{ marginTop: 'auto', padding: '14px', borderTop: '1px solid rgba(255,255,255,.07)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: 8, cursor: 'pointer' }}>
            <div style={{ width: 30, height: 30, borderRadius: '50%', background: 'linear-gradient(135deg,#c5931f,#e2b04a)', display: 'grid', placeItems: 'center', fontSize: 11, fontWeight: 700, color: '#0a0a09' }}>YU</div>
            <div><div style={{ fontSize: 13, fontWeight: 600 }}>Your Name</div><div style={{ fontSize: 11, color: 'rgba(255,255,255,.3)' }}>candidate@email.com</div></div>
            <span style={{ fontSize: 10, fontWeight: 700, background: 'rgba(226,176,74,.15)', color: '#e2b04a', padding: '2px 7px', borderRadius: 100, marginLeft: 'auto', border: '1px solid rgba(226,176,74,.2)' }}>Free</span>
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
              <strong style={{ color: '#e2b04a' }}>{scansLeft}</strong>&nbsp;free scan remaining
            </div>
            <button onClick={() => setShowUpgrade(true)} style={{ fontSize: 12, fontWeight: 700, background: '#e2b04a', color: '#0a0a09', padding: '8px 16px', borderRadius: 8, border: 'none', cursor: 'pointer', fontFamily: 'Syne, sans-serif', letterSpacing: '.03em' }}>
              Upgrade to Pro — $9/mo
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="dark-scroll" style={{ flex: 1, overflowY: 'auto', padding: 28, display: 'flex', flexDirection: 'column', gap: 20 }}>

          {/* Scan Area */}
          <div style={{ background: '#111110', border: '1px solid rgba(255,255,255,.07)', borderRadius: 12, padding: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <div><div style={{ fontSize: 14, fontWeight: 600, letterSpacing: '-.2px' }}>Scan Your CV</div><div style={{ fontSize: 12, color: 'rgba(255,255,255,.3)', marginTop: 2 }}>Upload a CV and paste a job description to get your match score</div></div>
              <span style={{ fontSize: 12, color: 'rgba(255,255,255,.3)' }}>{scansLeft} free scan left</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div onClick={handleUpload} style={{ border: `2px dashed ${cvUploaded ? 'rgba(19,194,142,.4)' : 'rgba(255,255,255,.12)'}`, borderRadius: 10, padding: 28, textAlign: 'center', cursor: 'pointer', transition: 'all .25s', background: cvUploaded ? 'rgba(19,194,142,.04)' : '#161614' }}>
                <div style={{ fontSize: 32, marginBottom: 10 }}>{cvUploaded ? '✅' : '📄'}</div>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,.85)', marginBottom: 4 }}>{cvUploaded ? 'CV_Uploaded.pdf' : 'Drop your CV here'}</div>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,.3)' }}>{cvUploaded ? 'Ready to analyze' : 'or click to browse · PDF or DOCX'}</div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,.3)', letterSpacing: '.06em', textTransform: 'uppercase' }}>Job Description</div>
                <textarea value={jd} onChange={e => setJd(e.target.value)} placeholder={"Paste the job description here…\n\ne.g. 'We're looking for a Senior React Developer with 4+ years…'"} style={{ flex: 1, background: '#161614', border: '1px solid rgba(255,255,255,.08)', borderRadius: 10, padding: 14, fontSize: 13, fontFamily: 'Syne, sans-serif', color: 'rgba(255,255,255,.8)', outline: 'none', resize: 'none', lineHeight: 1.6, minHeight: 100 }} />
                <button onClick={handleScan} disabled={scanning} style={{ width: '100%', background: scanning ? '#b8860b' : '#e2b04a', color: '#0a0a09', fontSize: 14, fontWeight: 700, fontFamily: 'Syne, sans-serif', padding: 13, borderRadius: 10, border: 'none', cursor: scanning ? 'wait' : 'pointer', transition: 'all .25s', letterSpacing: '.04em' }}>
                  {scanning ? '⏳ Analyzing...' : result ? '✓ Analysis Complete — Scan Again' : '⚡ Analyze Match'}
                </button>
              </div>
            </div>
          </div>

          {/* Results */}
          {result && (
            <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: 20, alignItems: 'start' }}>
              {/* Score Ring */}
              <div style={{ background: '#111110', border: '1px solid rgba(255,255,255,.07)', borderRadius: 12, padding: 24, display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: 200 }}>
                <svg width="0" height="0"><defs><linearGradient id="rg" x1="0" y1="0" x2="1" y2="0"><stop offset="0%" stopColor="#c5931f" /><stop offset="100%" stopColor="#13c28e" /></linearGradient></defs></svg>
                <div style={{ position: 'relative', width: 120, height: 120, marginBottom: 16 }}>
                  <svg width="120" height="120" viewBox="0 0 120 120" style={{ transform: 'rotate(-90deg)' }}>
                    <circle cx="60" cy="60" r="54" fill="none" stroke="#1e1e1b" strokeWidth="10" />
                    <circle className="ring-anim" cx="60" cy="60" r="54" fill="none" stroke="url(#rg)" strokeWidth="10" strokeLinecap="round" strokeDasharray="339" strokeDashoffset="51" />
                  </svg>
                  <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                    <span style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 38, fontWeight: 600, lineHeight: 1 }}>{result.score}</span>
                    <small style={{ fontSize: 11, color: 'rgba(255,255,255,.4)', marginTop: 2 }}>/ 100</small>
                  </div>
                </div>
                <div style={{ background: 'rgba(19,194,142,.12)', color: '#13c28e', fontSize: 12, fontWeight: 600, padding: '5px 14px', borderRadius: 100, border: '1px solid rgba(19,194,142,.2)', marginBottom: 12 }}>{result.label}</div>
                <div style={{ fontSize: 12, color: 'rgba(255,255,255,.35)', textAlign: 'center', lineHeight: 1.5 }}>You match {result.score}% of<br />this role's requirements</div>
              </div>

              {/* Analysis Panel */}
              <div style={{ background: '#111110', border: '1px solid rgba(255,255,255,.07)', borderRadius: 12, padding: 24 }}>
                <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid rgba(255,255,255,.07)', marginBottom: 20 }}>
                  {['skills', 'gaps', 'recos'].map(t => (
                    <button key={t} onClick={() => setActiveTab(t)} style={{ padding: '8px 16px', fontSize: 13, fontWeight: 500, color: activeTab === t ? '#e2b04a' : 'rgba(255,255,255,.3)', cursor: 'pointer', borderBottom: `2px solid ${activeTab === t ? '#e2b04a' : 'transparent'}`, marginBottom: -1, transition: 'all .2s', border: 'none', background: 'none', fontFamily: 'Syne, sans-serif' }}>
                      {t === 'skills' ? 'Skills' : t === 'gaps' ? 'Skill Gaps' : 'Suggestions'}
                    </button>
                  ))}
                </div>

                {activeTab === 'skills' && result.skills.map((s: any) => (
                  <div key={s.n} style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
                    <span style={{ fontSize: 13, color: 'rgba(255,255,255,.5)', width: 140, flexShrink: 0 }}>{s.n}</span>
                    <div style={{ flex: 1, height: 6, background: '#1e1e1b', borderRadius: 3, overflow: 'hidden' }}>
                      <div className="bar-anim" style={{ height: '100%', borderRadius: 3, background: s.gold ? 'linear-gradient(90deg,#c5931f,#e2b04a)' : s.w < 40 ? '#ef4444' : 'linear-gradient(90deg,#0b7c5e,#13c28e)', '--bw': `${s.w}%` } as React.CSSProperties} />
                    </div>
                    <span style={{ fontSize: 12, color: 'rgba(255,255,255,.4)', width: 32, textAlign: 'right' }}>{s.w}%</span>
                  </div>
                ))}

                {activeTab === 'gaps' && result.gaps.map((g: any) => {
                  const c = g.status === 'match' ? { bg: 'rgba(34,197,94,.12)', col: '#22c55e', label: 'Matched', icon: '✓' } : g.status === 'partial' ? { bg: 'rgba(234,179,8,.12)', col: '#eab308', label: 'Partial', icon: '~' } : { bg: 'rgba(239,68,68,.1)', col: '#ef4444', label: 'Missing', icon: '✗' }
                  return (
                    <div key={g.s} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: '#161614', borderRadius: 8, border: '1px solid rgba(255,255,255,.06)', marginBottom: 8 }}>
                      <div style={{ width: 24, height: 24, borderRadius: '50%', background: c.bg, display: 'grid', placeItems: 'center', fontSize: 11, color: c.col, flexShrink: 0 }}>{c.icon}</div>
                      <span style={{ fontSize: 13, color: 'rgba(255,255,255,.7)', flex: 1 }}>{g.s}</span>
                      <span style={{ fontSize: 11, padding: '3px 8px', borderRadius: 100, background: c.bg, color: c.col }}>{c.label}</span>
                    </div>
                  )
                })}

                {activeTab === 'recos' && result.recos.map((r: any, i: number) => (
                  <div key={i} style={{ padding: '12px 14px', background: '#161614', borderRadius: 8, marginBottom: 8, borderLeft: `3px solid ${i === 2 ? '#13c28e' : '#e2b04a'}` }}>
                    <h5 style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>{r.t}</h5>
                    <p style={{ fontSize: 12, color: 'rgba(255,255,255,.4)', lineHeight: 1.6 }}>{r.d}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* History */}
          <div style={{ background: '#111110', border: '1px solid rgba(255,255,255,.07)', borderRadius: 12, padding: 24 }}>
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 16 }}>Recent Scans</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {HISTORY.map((h, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 14, background: '#161614', border: '1px solid rgba(255,255,255,.06)', borderRadius: 10, padding: '14px 18px', cursor: 'pointer', transition: 'all .2s' }}>
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
          </div>

        </div>
      </div>
    </div>
  )
}
