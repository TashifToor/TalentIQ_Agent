'use client'
import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import { api } from '@/lib/api'

type Candidate = {
  filename: string
  ai_score: number
  matched_skills?: string[]
  missing_skills?: string[]
  final_verdict?: string
  deep_analysis?: string
  is_shortlisted?: boolean
  trigger_interview?: boolean
  error?: string
}

const AVATAR_COLORS = ['#c5931f,#e2b04a', '#4f46e5,#818cf8', '#0b7c5e,#13c28e', '#ec4899,#f472b6', '#f59e0b,#fcd34d']

function initials(name: string) {
  return name.replace(/\.(pdf|PDF)$/, '').split(/[\s_-]+/).filter(Boolean).slice(0, 2).map(w => w[0]?.toUpperCase()).join('') || '??'
}

export default function HRDashboard() {
  const [userName, setUserName] = useState('HR Manager')
  const [userEmail, setUserEmail] = useState('')

  const [jobTitle, setJobTitle] = useState('')
  const [jobDescription, setJobDescription] = useState('')
  const [topN, setTopN] = useState(3)
  const [zipFile, setZipFile] = useState<File | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [bulkStatus, setBulkStatus] = useState('')
  const [candidates, setCandidates] = useState<Candidate[]>([])
  const [totalProcessed, setTotalProcessed] = useState(0)
  const [selected, setSelected] = useState(0)
  const [shortlisted, setShortlisted] = useState<Set<number>>(new Set())
  const [rejected, setRejected] = useState<Set<number>>(new Set())

  const [messages, setMessages] = useState([
    { role: 'bot', text: "Hi! I'm your HR Policy assistant. Ask me anything about your company policies, leave rules, benefits, or onboarding procedures." },
  ])
  const [chatInput, setChatInput] = useState('')
  const [typing, setTyping] = useState(false)

  useEffect(() => {
    api.me().then((u: any) => {
      setUserName(u?.name || u?.full_name || 'HR Manager')
      setUserEmail(u?.email || '')
    }).catch(() => {})
  }, [])

  const sendMessage = async (msg: string) => {
    if (!msg.trim()) return
    setMessages(m => [...m, { role: 'user', text: msg }])
    setChatInput('')
    setTyping(true)
    try {
      const res: any = await api.hrChat(msg)
      setMessages(m => [...m, { role: 'bot', text: res?.answer || 'No answer found.' }])
    } catch (e: any) {
      setMessages(m => [...m, { role: 'bot', text: `Error: ${e.message || 'Could not reach policy assistant.'}` }])
    } finally {
      setTyping(false)
    }
  }

  const runBulk = async () => {
    setError('')
    if (!jobDescription.trim()) {
      setError('Please paste a job description first.')
      return
    }
    if (!zipFile) {
      setError('Please select a ZIP file of candidate CVs.')
      fileInputRef.current?.click()
      return
    }
    setLoading(true)
    setBulkStatus(`Screening CVs in ${zipFile.name}...`)
    try {
      const fullJD = jobTitle ? `Job Title: ${jobTitle}\n\n${jobDescription}` : jobDescription
      const res: any = await api.bulkScreen(fullJD, topN, zipFile)
      const ranked: Candidate[] = res.all_results || res.top_candidates || []
      setCandidates(ranked)
      setTotalProcessed(res.total_cvs_processed || ranked.length)
      setSelected(0)
      setShortlisted(new Set())
      setRejected(new Set())
      setBulkStatus(`✓ Screening Complete · ${res.total_cvs_processed} CV(s) ranked`)
    } catch (e: any) {
      setError(e.message || 'Bulk screening failed.')
      setBulkStatus('')
    } finally {
      setLoading(false)
    }
  }

  const avgScore = candidates.length
    ? Math.round(candidates.reduce((sum, c) => sum + (c.ai_score || 0), 0) / candidates.length)
    : 0
  const shortlistedCount = candidates.filter(c => c.is_shortlisted).length

  const NAV_ITEMS = [
    { icon: '⊞', label: 'Dashboard', active: true },
    { icon: '📋', label: 'All Candidates', active: false, notif: candidates.length || undefined },
    { icon: '⚡', label: 'Bulk Screen', active: false },
    { icon: '🏢', label: 'Open Roles', active: false },
    { icon: '⭐', label: 'Shortlist', active: false },
    { icon: '💬', label: 'Policy Chatbot', active: false },
    { icon: '👥', label: 'Team', active: false },
  ]

  const selectedCandidate = candidates[selected]

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: '#0a0a08', fontFamily: 'Syne, sans-serif', color: 'rgba(255,255,255,.88)' }}>

      {/* SIDEBAR */}
      <div style={{ width: 224, flexShrink: 0, background: '#101010', borderRight: '1px solid rgba(255,255,255,.07)', display: 'flex', flexDirection: 'column' }}>
        <Link href="/" style={{ padding: '22px 18px', borderBottom: '1px solid rgba(255,255,255,.07)', display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none' }}>
          <div style={{ width: 28, height: 28, background: '#e2b04a', borderRadius: 7, display: 'grid', placeItems: 'center' }}><svg width="12" height="12" viewBox="0 0 16 16" fill="#0a0a08"><path d="M8 2C4.68 2 2 4.68 2 8c0 1.76.72 3.35 1.88 4.5L8 8.5l4.12 4A5.97 5.97 0 0014 8c0-3.32-2.68-6-6-6z" /></svg></div>
          <span style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 20, fontWeight: 600, color: 'rgba(255,255,255,.9)' }}>TalentIQ</span>
          <span style={{ fontSize: 10, fontWeight: 700, background: 'rgba(19,194,142,.12)', color: '#13c28e', padding: '3px 8px', borderRadius: 100, marginLeft: 'auto', border: '1px solid rgba(19,194,142,.18)', letterSpacing: '.06em' }}>HR</span>
        </Link>
        <div style={{ padding: '18px 14px 6px', fontSize: 10, fontWeight: 700, letterSpacing: '.12em', textTransform: 'uppercase', color: 'rgba(255,255,255,.25)' }}>Workspace</div>
        {NAV_ITEMS.map(n => (
          <button key={n.label} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 14px', borderRadius: 8, fontSize: 13, fontWeight: 500, color: n.active ? '#13c28e' : 'rgba(255,255,255,.45)', cursor: 'pointer', transition: 'all .2s', margin: '0 6px 2px', border: n.active ? '1px solid rgba(19,194,142,.12)' : '1px solid transparent', background: n.active ? 'rgba(19,194,142,.08)' : 'transparent', fontFamily: 'Syne, sans-serif', width: 'calc(100% - 12px)', textAlign: 'left' }}>
            <span style={{ fontSize: 14 }}>{n.icon}</span>{n.label}
            {!!n.notif && <span style={{ marginLeft: 'auto', width: 18, height: 18, borderRadius: '50%', background: 'rgba(239,68,68,.15)', color: '#ef4444', fontSize: 10, fontWeight: 700, display: 'grid', placeItems: 'center' }}>{n.notif}</span>}
          </button>
        ))}
        <div style={{ marginTop: 'auto', padding: 14, borderTop: '1px solid rgba(255,255,255,.07)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: 8, cursor: 'pointer' }}>
            <div style={{ width: 30, height: 30, borderRadius: '50%', background: 'linear-gradient(135deg,#0b7c5e,#13c28e)', display: 'grid', placeItems: 'center', fontSize: 11, fontWeight: 700, color: '#fff' }}>HR</div>
            <div><div style={{ fontSize: 13, fontWeight: 600 }}>{userName}</div><div style={{ fontSize: 11, color: 'rgba(255,255,255,.3)' }}>{userEmail}</div></div>
            <span style={{ fontSize: 10, fontWeight: 600, background: 'rgba(59,130,246,.12)', color: '#3b82f6', padding: '2px 6px', borderRadius: 100, marginLeft: 'auto', border: '1px solid rgba(59,130,246,.2)' }}>Trial</span>
          </div>
        </div>
      </div>

      {/* MAIN */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Topbar */}
        <div style={{ height: 60, borderBottom: '1px solid rgba(255,255,255,.07)', display: 'flex', alignItems: 'center', padding: '0 28px', justifyContent: 'space-between', flexShrink: 0 }}>
          <div><div style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 22, fontWeight: 600 }}>HR Dashboard</div><div style={{ fontSize: 12, color: 'rgba(255,255,255,.3)', marginTop: 1 }}>{jobTitle || 'No role selected'} · {totalProcessed} candidates reviewed</div></div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button style={{ fontSize: 12, fontWeight: 600, padding: '8px 16px', borderRadius: 8, border: '1px solid rgba(255,255,255,.12)', background: 'transparent', color: 'rgba(255,255,255,.5)', cursor: 'pointer', fontFamily: 'Syne, sans-serif' }}>Export Report</button>
          </div>
        </div>

        {/* 3-Panel Grid */}
        <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 1fr 340px', overflow: 'hidden' }}>

          {/* PANEL 1 — Stats + Upload */}
          <div className="dark-scroll" style={{ overflowY: 'auto', padding: 20, borderRight: '1px solid rgba(255,255,255,.07)' }}>
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 16 }}>Overview</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
              {[
                { v: String(totalProcessed), l: 'Total Screened' },
                { v: String(shortlistedCount), l: 'Shortlisted', t: totalProcessed ? `${Math.round((shortlistedCount / totalProcessed) * 100)}% pass rate` : '' },
                { v: String(avgScore || '—'), l: 'Avg. Score' },
                { v: String(candidates.length), l: 'Ranked' },
              ].map(s => (
                <div key={s.l} style={{ background: '#161614', border: '1px solid rgba(255,255,255,.07)', borderRadius: 10, padding: 14 }}>
                  <div style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 28, fontWeight: 600, marginBottom: 2 }}>{s.v}</div>
                  <div style={{ fontSize: 11, color: 'rgba(255,255,255,.3)', letterSpacing: '.04em' }}>{s.l}</div>
                  {s.t && <div style={{ fontSize: 11, color: '#22c55e', marginTop: 4 }}>{s.t}</div>}
                </div>
              ))}
            </div>

            {/* Upload zone */}
            <input ref={fileInputRef} type="file" accept=".zip" style={{ display: 'none' }}
              onChange={e => setZipFile(e.target.files?.[0] || null)} />
            <div onClick={() => fileInputRef.current?.click()} style={{ border: '2px dashed rgba(255,255,255,.12)', borderRadius: 10, padding: 20, textAlign: 'center', cursor: 'pointer', transition: 'all .25s', background: '#161614', marginBottom: 14 }}>
              <div style={{ fontSize: 24, marginBottom: 8 }}>{zipFile ? '📦' : '📂'}</div>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 3 }}>{zipFile ? zipFile.name : 'Select ZIP of CVs'}</div>
              {!zipFile && <div style={{ fontSize: 11, color: 'rgba(255,255,255,.3)' }}>ZIP file containing candidate PDFs (max 25)</div>}
            </div>

            <input value={jobTitle} onChange={e => setJobTitle(e.target.value)} placeholder="Job title (e.g. Senior Frontend Engineer)" style={{ width: '100%', background: '#161614', border: '1px solid rgba(255,255,255,.07)', borderRadius: 8, padding: '10px 12px', fontSize: 13, fontFamily: 'Syne, sans-serif', color: 'rgba(255,255,255,.8)', outline: 'none', marginBottom: 10 }} />
            <textarea value={jobDescription} onChange={e => setJobDescription(e.target.value)} placeholder="Paste job description or requirements…" style={{ width: '100%', background: '#161614', border: '1px solid rgba(255,255,255,.07)', borderRadius: 8, padding: '10px 12px', fontSize: 13, fontFamily: 'Syne, sans-serif', color: 'rgba(255,255,255,.8)', outline: 'none', resize: 'none', height: 80, lineHeight: 1.6, marginBottom: 10 }} />

            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <span style={{ fontSize: 12, color: 'rgba(255,255,255,.4)' }}>Top candidates needed:</span>
              <input type="number" min={1} max={25} value={topN} onChange={e => setTopN(Number(e.target.value) || 1)} style={{ width: 56, background: '#161614', border: '1px solid rgba(255,255,255,.07)', borderRadius: 6, padding: '6px 8px', fontSize: 13, color: 'rgba(255,255,255,.8)', outline: 'none', fontFamily: 'Syne, sans-serif' }} />
            </div>

            {error && <div style={{ fontSize: 12, color: '#ef4444', marginBottom: 10 }}>{error}</div>}

            <button onClick={runBulk} disabled={loading} style={{ width: '100%', background: loading ? 'rgba(19,194,142,.4)' : '#13c28e', color: '#fff', fontSize: 13, fontWeight: 700, fontFamily: 'Syne, sans-serif', padding: 11, borderRadius: 8, border: 'none', cursor: loading ? 'default' : 'pointer', letterSpacing: '.04em' }}>
              {bulkStatus || 'Run Bulk Screening'}
            </button>

            {candidates.length > 0 && (
              <div style={{ marginTop: 20 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,.4)', marginBottom: 8 }}>Score Distribution</div>
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 52 }}>
                  {candidates.slice(0, 10).map((c, i) => (
                    <div key={i} style={{ flex: 1, borderRadius: '3px 3px 0 0', height: `${Math.max(c.ai_score, 3)}%`, background: c.ai_score > 75 ? '#13c28e' : c.ai_score > 50 ? '#e2b04a' : 'rgba(239,68,68,.4)', transition: 'all .3s' }} />
                  ))}
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'rgba(255,255,255,.25)', marginTop: 4 }}>
                  <span>0</span><span>40</span><span>60</span><span>80</span><span>100</span>
                </div>
              </div>
            )}
          </div>

          {/* PANEL 2 — Candidate List */}
          <div className="dark-scroll" style={{ overflowY: 'auto', padding: 20, borderRight: '1px solid rgba(255,255,255,.07)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <span style={{ fontSize: 13, fontWeight: 600 }}>Ranked Candidates</span>
              <span style={{ fontSize: 11, color: 'rgba(255,255,255,.3)' }}>{candidates.length} total · sorted by score</span>
            </div>

            {candidates.length === 0 && (
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,.3)', textAlign: 'center', padding: '40px 0' }}>
                Upload a ZIP of CVs and a job description, then run bulk screening to see ranked candidates here.
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {candidates.map((c, i) => {
                const rank = i + 1
                const name = c.filename
                const av = initials(name)
                const color = AVATAR_COLORS[i % AVATAR_COLORS.length]
                const skills = [...(c.matched_skills || []), ...(c.missing_skills || [])].slice(0, 4)
                const matchedSet = new Set(c.matched_skills || [])
                return (
                  <div key={name + i} onClick={() => setSelected(i)} style={{ background: selected === i ? 'rgba(19,194,142,.04)' : '#161614', border: `1px solid ${selected === i ? 'rgba(19,194,142,.25)' : 'rgba(255,255,255,.07)'}`, borderRadius: 10, padding: '12px 14px', cursor: 'pointer', transition: 'all .2s', position: 'relative' }}>
                    {rank <= 3 && <div style={{ position: 'absolute', top: 10, left: -1, width: 22, height: 22, borderRadius: '0 6px 6px 0', display: 'grid', placeItems: 'center', fontSize: 10, fontWeight: 700, background: rank === 1 ? '#c5931f' : 'rgba(255,255,255,.1)', color: rank === 1 ? '#0a0a08' : 'rgba(255,255,255,.4)' }}>#{rank}</div>}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, paddingLeft: rank <= 3 ? 16 : 0, marginBottom: 8 }}>
                      <div style={{ width: 30, height: 30, borderRadius: '50%', background: `linear-gradient(135deg,${color})`, display: 'grid', placeItems: 'center', fontSize: 11, fontWeight: 700, color: '#fff', flexShrink: 0 }}>{av}</div>
                      <div style={{ flex: 1, minWidth: 0 }}><div style={{ fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{name}</div><div style={{ fontSize: 11, color: 'rgba(255,255,255,.3)' }}>{c.final_verdict || (c.error ? 'Error' : '—')}</div></div>
                      <div style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 22, fontWeight: 600, color: c.ai_score >= 80 ? '#13c28e' : c.ai_score >= 65 ? '#e2b04a' : '#ef4444' }}>{c.ai_score}</div>
                    </div>
                    {c.error ? (
                      <div style={{ fontSize: 11, color: '#ef4444', marginBottom: 10 }}>{c.error}</div>
                    ) : (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 10 }}>
                        {skills.map(s => (
                          <span key={s} style={{ fontSize: 10, padding: '3px 8px', borderRadius: 100, background: matchedSet.has(s) ? 'rgba(19,194,142,.1)' : '#1e1e1b', color: matchedSet.has(s) ? '#13c28e' : 'rgba(255,255,255,.3)', border: `1px solid ${matchedSet.has(s) ? 'rgba(19,194,142,.2)' : 'rgba(255,255,255,.06)'}` }}>{s}</span>
                        ))}
                      </div>
                    )}
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button onClick={e => { e.stopPropagation(); setShortlisted(s => new Set([...s, i])) }} style={{ flex: 1, fontSize: 11, fontWeight: 600, fontFamily: 'Syne, sans-serif', padding: 7, borderRadius: 6, cursor: 'pointer', background: shortlisted.has(i) ? 'rgba(19,194,142,.2)' : 'rgba(19,194,142,.12)', color: '#13c28e', border: '1px solid rgba(19,194,142,.2)', transition: 'all .2s' }}>
                        {shortlisted.has(i) ? '✓ Shortlisted' : '✓ Shortlist'}
                      </button>
                      <button onClick={e => { e.stopPropagation(); setRejected(r => new Set([...r, i])) }} style={{ flex: 1, fontSize: 11, fontWeight: 600, fontFamily: 'Syne, sans-serif', padding: 7, borderRadius: 6, cursor: 'pointer', background: rejected.has(i) ? 'rgba(239,68,68,.15)' : 'rgba(239,68,68,.08)', color: '#ef4444', border: '1px solid rgba(239,68,68,.15)', transition: 'all .2s' }}>
                        {rejected.has(i) ? '✗ Rejected' : '✗ Reject'}
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>

            {selectedCandidate?.deep_analysis && (
              <div style={{ marginTop: 16, background: '#161614', border: '1px solid rgba(255,255,255,.07)', borderRadius: 10, padding: 14 }}>
                <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 8 }}>Full Analysis · {selectedCandidate.filename}</div>
                <div style={{ fontSize: 12, color: 'rgba(255,255,255,.5)', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{selectedCandidate.deep_analysis}</div>
              </div>
            )}
          </div>

          {/* PANEL 3 — Policy Chatbot */}
          <div style={{ display: 'flex', flexDirection: 'column', padding: 20, overflow: 'hidden' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexShrink: 0 }}>
              <span style={{ fontSize: 13, fontWeight: 600 }}>HR Policy Chatbot</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: '#13c28e', fontWeight: 500 }}>
                <div className="live-pulse" style={{ width: 6, height: 6, borderRadius: '50%', background: '#13c28e' }} />Live
              </div>
            </div>

            {/* Messages */}
            <div className="dark-scroll" style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 10, paddingBottom: 8 }}>
              {messages.map((m, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start' }}>
                  {m.role === 'bot' && <div style={{ width: 24, height: 24, background: '#e2b04a', borderRadius: '50%', display: 'grid', placeItems: 'center', fontSize: 10, fontWeight: 700, color: '#0a0a08', flexShrink: 0 }}>IQ</div>}
                  <div style={{ maxWidth: '88%', padding: '10px 14px', borderRadius: 12, fontSize: 13, lineHeight: 1.6, background: m.role === 'bot' ? '#161614' : 'rgba(19,194,142,.12)', color: m.role === 'bot' ? 'rgba(255,255,255,.6)' : '#13c28e', border: `1px solid ${m.role === 'bot' ? 'rgba(255,255,255,.07)' : 'rgba(19,194,142,.18)'}`, borderBottomLeftRadius: m.role === 'bot' ? 4 : 12, borderBottomRightRadius: m.role === 'user' ? 4 : 12 }}
                    dangerouslySetInnerHTML={{ __html: m.text.replace(/\*\*(.*?)\*\*/g, '<strong style="color:rgba(255,255,255,.85)">$1</strong>') }}
                  />
                </div>
              ))}
              {typing && (
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                  <div style={{ width: 24, height: 24, background: '#e2b04a', borderRadius: '50%', display: 'grid', placeItems: 'center', fontSize: 10, fontWeight: 700, color: '#0a0a08' }}>IQ</div>
                  <div style={{ padding: '12px 16px', background: '#161614', border: '1px solid rgba(255,255,255,.07)', borderRadius: 12, borderBottomLeftRadius: 4, display: 'flex', gap: 4, alignItems: 'center' }}>
                    {[0, 1, 2].map(j => <div key={j} className={`dot-${j + 1}`} style={{ width: 5, height: 5, background: 'rgba(255,255,255,.3)', borderRadius: '50%' }} />)}
                  </div>
                </div>
              )}
            </div>

            {/* Suggestions */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 10, marginTop: 8, flexShrink: 0 }}>
              {["What's our leave policy?", 'Remote work rules?', 'Onboarding checklist', 'Health benefits?'].map(s => (
                <button key={s} onClick={() => sendMessage(s)} style={{ fontSize: 11, color: 'rgba(255,255,255,.4)', background: '#161614', border: '1px solid rgba(255,255,255,.08)', borderRadius: 100, padding: '4px 10px', cursor: 'pointer', transition: 'all .2s', fontFamily: 'Syne, sans-serif' }}>{s}</button>
              ))}
            </div>

            {/* Input */}
            <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
              <input value={chatInput} onChange={e => setChatInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && sendMessage(chatInput)} placeholder="Ask about HR policies…" style={{ flex: 1, background: '#161614', border: '1px solid rgba(255,255,255,.08)', borderRadius: 10, padding: '10px 14px', fontSize: 13, fontFamily: 'Syne, sans-serif', color: 'rgba(255,255,255,.8)', outline: 'none' }} />
              <button onClick={() => sendMessage(chatInput)} style={{ width: 36, height: 36, background: '#e2b04a', border: 'none', borderRadius: 8, display: 'grid', placeItems: 'center', cursor: 'pointer', flexShrink: 0 }}>
                <svg width="16" height="16" fill="none" stroke="#0a0a08" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 16 16"><path d="M14 8L2 3l3 5-3 5 12-5z" /></svg>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}