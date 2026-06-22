'use client'
import { useState } from 'react'
import Link from 'next/link'
import { api } from '@/lib/api'

const CANDIDATES = [
  { av: 'AR', color: '#c5931f,#e2b04a', name: 'Aisha Rao', role: 'Frontend Dev · 4 YOE', score: 91, rank: 1, skills: ['React', 'TypeScript', 'Node.js', 'Docker'], matched: [true, true, true, false] },
  { av: 'MK', color: '#4f46e5,#818cf8', name: 'Maaz Khan', role: 'Full-Stack · 3 YOE', score: 87, rank: 2, skills: ['React', 'Node.js', 'Docker', 'K8s'], matched: [true, true, true, false] },
  { av: 'SC', color: '#0b7c5e,#13c28e', name: 'Sara Chen', role: 'Backend Dev · 5 YOE', score: 79, rank: 3, skills: ['Node.js', 'Docker', 'React', 'AWS'], matched: [true, true, false, false] },
  { av: 'LB', color: '#ec4899,#f472b6', name: 'Lila Brown', role: 'Frontend Dev · 2 YOE', score: 71, rank: 4, skills: ['React', 'TypeScript', 'CSS'], matched: [true, false, false] },
  { av: 'JA', color: '#f59e0b,#fcd34d', name: 'Junaid Ahmed', role: 'Frontend Dev · 1 YOE', score: 54, rank: 5, skills: ['React', 'HTML/CSS'], matched: [true, false] },
]

const CHAT_RESPONSES: Record<string, string> = {
  leave: 'According to your HR policy document, employees receive **21 days of annual leave** per year, accrued monthly. Unused leave up to 10 days can be carried forward. Sick leave is separate — 10 days per year with a medical certificate required after 3 consecutive days.',
  remote: 'Your remote work policy allows **up to 3 days work-from-home** per week for permanent employees. Full remote is available for roles approved by department heads. All remote staff must be available during core hours (10am–4pm) in their local timezone.',
  onboard: 'The standard onboarding checklist includes: (1) IT setup on day 1, (2) HR documentation by end of week 1, (3) Department orientation in week 1, (4) Buddy system for first 30 days, (5) 30/60/90 day check-ins with manager.',
  health: 'The company provides **comprehensive medical coverage** for employees and immediate family. Coverage includes inpatient, outpatient, dental, and vision. Employees are enrolled automatically from day 1 of employment.',
}

function getReply(msg: string) {
  const m = msg.toLowerCase()
  if (m.includes('leave') || m.includes('vacation')) return CHAT_RESPONSES.leave
  if (m.includes('remote') || m.includes('wfh') || m.includes('work from home')) return CHAT_RESPONSES.remote
  if (m.includes('onboard') || m.includes('checklist')) return CHAT_RESPONSES.onboard
  if (m.includes('health') || m.includes('benefit') || m.includes('medical')) return CHAT_RESPONSES.health
  return "Based on your policy documents, I don't have a specific answer for that. Would you like me to search for something more specific in the uploaded documents?"
}

export default function HRDashboard() {
  const [selected, setSelected] = useState(0)
  const [bulkStatus, setBulkStatus] = useState('')
  const [messages, setMessages] = useState([
    { role: 'bot', text: 'Hi! I\'m your HR Policy assistant. Ask me anything about your company policies, leave rules, benefits, or onboarding procedures.' },
    { role: 'bot', text: 'I have access to your uploaded documents. What would you like to know?' },
  ])
  const [chatInput, setChatInput] = useState('')
  const [typing, setTyping] = useState(false)
  const [shortlisted, setShortlisted] = useState<Set<number>>(new Set())
  const [rejected, setRejected] = useState<Set<number>>(new Set())

  const sendMessage = async (msg: string) => {
    if (!msg.trim()) return
    setMessages(m => [...m, { role: 'user', text: msg }])
    setChatInput('')
    setTyping(true)
    await new Promise(r => setTimeout(r, 1200))
    setTyping(false)
    setMessages(m => [...m, { role: 'bot', text: getReply(msg) }])
  }

  const runBulk = async () => {
    setBulkStatus('Screening 18 CVs...')
    await new Promise(r => setTimeout(r, 2200))
    setBulkStatus('✓ Screening Complete · 18 candidates ranked')
  }

  const NAV_ITEMS = [
    { icon: '⊞', label: 'Dashboard', active: true }, { icon: '📋', label: 'All Candidates', active: false, notif: 3 },
    { icon: '⚡', label: 'Bulk Screen', active: false }, { icon: '🏢', label: 'Open Roles', active: false },
    { icon: '⭐', label: 'Shortlist', active: false }, { icon: '💬', label: 'Policy Chatbot', active: false }, { icon: '👥', label: 'Team', active: false },
  ]

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
            {n.notif && <span style={{ marginLeft: 'auto', width: 18, height: 18, borderRadius: '50%', background: 'rgba(239,68,68,.15)', color: '#ef4444', fontSize: 10, fontWeight: 700, display: 'grid', placeItems: 'center' }}>{n.notif}</span>}
          </button>
        ))}
        <div style={{ marginTop: 'auto', padding: 14, borderTop: '1px solid rgba(255,255,255,.07)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: 8, cursor: 'pointer' }}>
            <div style={{ width: 30, height: 30, borderRadius: '50%', background: 'linear-gradient(135deg,#0b7c5e,#13c28e)', display: 'grid', placeItems: 'center', fontSize: 11, fontWeight: 700, color: '#fff' }}>HR</div>
            <div><div style={{ fontSize: 13, fontWeight: 600 }}>HR Manager</div><div style={{ fontSize: 11, color: 'rgba(255,255,255,.3)' }}>hr@company.com</div></div>
            <span style={{ fontSize: 10, fontWeight: 600, background: 'rgba(59,130,246,.12)', color: '#3b82f6', padding: '2px 6px', borderRadius: 100, marginLeft: 'auto', border: '1px solid rgba(59,130,246,.2)' }}>Trial</span>
          </div>
        </div>
      </div>

      {/* MAIN */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Topbar */}
        <div style={{ height: 60, borderBottom: '1px solid rgba(255,255,255,.07)', display: 'flex', alignItems: 'center', padding: '0 28px', justifyContent: 'space-between', flexShrink: 0 }}>
          <div><div style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 22, fontWeight: 600 }}>HR Dashboard</div><div style={{ fontSize: 12, color: 'rgba(255,255,255,.3)', marginTop: 1 }}>Senior Frontend Engineer · 18 candidates reviewed</div></div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button style={{ fontSize: 12, fontWeight: 600, padding: '8px 16px', borderRadius: 8, border: '1px solid rgba(255,255,255,.12)', background: 'transparent', color: 'rgba(255,255,255,.5)', cursor: 'pointer', fontFamily: 'Syne, sans-serif' }}>Export Report</button>
            <button onClick={runBulk} style={{ fontSize: 12, fontWeight: 700, background: '#13c28e', color: '#fff', padding: '8px 16px', borderRadius: 8, border: 'none', cursor: 'pointer', fontFamily: 'Syne, sans-serif' }}>+ Upload CVs</button>
          </div>
        </div>

        {/* 3-Panel Grid */}
        <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 1fr 340px', overflow: 'hidden' }}>

          {/* PANEL 1 — Stats + Upload */}
          <div className="dark-scroll" style={{ overflowY: 'auto', padding: 20, borderRight: '1px solid rgba(255,255,255,.07)' }}>
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 16 }}>Overview</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
              {[{ v: '42', l: 'Total Screened', t: '↑ 8 this week', tc: '#22c55e' }, { v: '12', l: 'Shortlisted', t: '28% pass rate', tc: '#22c55e' }, { v: '84', l: 'Avg. Score', t: '↑ from 79', tc: '#e2b04a' }, { v: '2.1s', l: 'Avg. Analysis', t: '', tc: '' }].map(s => (
                <div key={s.l} style={{ background: '#161614', border: '1px solid rgba(255,255,255,.07)', borderRadius: 10, padding: 14 }}>
                  <div style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 28, fontWeight: 600, marginBottom: 2 }}>{s.v}</div>
                  <div style={{ fontSize: 11, color: 'rgba(255,255,255,.3)', letterSpacing: '.04em' }}>{s.l}</div>
                  {s.t && <div style={{ fontSize: 11, color: s.tc, marginTop: 4 }}>{s.t}</div>}
                </div>
              ))}
            </div>

            {/* Upload zone */}
            <div onClick={runBulk} style={{ border: '2px dashed rgba(255,255,255,.12)', borderRadius: 10, padding: 20, textAlign: 'center', cursor: 'pointer', transition: 'all .25s', background: '#161614', marginBottom: 14 }}>
              <div style={{ fontSize: 24, marginBottom: 8 }}>{bulkStatus.startsWith('✓') ? '✅' : '📂'}</div>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 3 }}>{bulkStatus || 'Upload CVs in bulk'}</div>
              {!bulkStatus && <div style={{ fontSize: 11, color: 'rgba(255,255,255,.3)' }}>Drop up to 50 PDFs at once</div>}
            </div>

            <input placeholder="Job title (e.g. Senior Frontend Engineer)" style={{ width: '100%', background: '#161614', border: '1px solid rgba(255,255,255,.07)', borderRadius: 8, padding: '10px 12px', fontSize: 13, fontFamily: 'Syne, sans-serif', color: 'rgba(255,255,255,.8)', outline: 'none', marginBottom: 10 }} />
            <textarea placeholder="Paste job description or requirements…" style={{ width: '100%', background: '#161614', border: '1px solid rgba(255,255,255,.07)', borderRadius: 8, padding: '10px 12px', fontSize: 13, fontFamily: 'Syne, sans-serif', color: 'rgba(255,255,255,.8)', outline: 'none', resize: 'none', height: 80, lineHeight: 1.6, marginBottom: 10 }} />
            <button onClick={runBulk} style={{ width: '100%', background: '#13c28e', color: '#fff', fontSize: 13, fontWeight: 700, fontFamily: 'Syne, sans-serif', padding: 11, borderRadius: 8, border: 'none', cursor: 'pointer', letterSpacing: '.04em' }}>
              {bulkStatus || 'Run Bulk Screening'}
            </button>

            {/* Mini chart */}
            <div style={{ marginTop: 20 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,.4)', marginBottom: 8 }}>Score Distribution</div>
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 52 }}>
                {[30, 45, 60, 80, 100, 85, 55].map((h, i) => (
                  <div key={i} style={{ flex: 1, borderRadius: '3px 3px 0 0', height: `${h}%`, background: h > 75 ? '#13c28e' : h > 50 ? '#e2b04a' : 'rgba(239,68,68,.4)', transition: 'all .3s' }} />
                ))}
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'rgba(255,255,255,.25)', marginTop: 4 }}>
                <span>0</span><span>40</span><span>60</span><span>80</span><span>100</span>
              </div>
            </div>
          </div>

          {/* PANEL 2 — Candidate List */}
          <div className="dark-scroll" style={{ overflowY: 'auto', padding: 20, borderRight: '1px solid rgba(255,255,255,.07)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <span style={{ fontSize: 13, fontWeight: 600 }}>Ranked Candidates</span>
              <span style={{ fontSize: 11, color: 'rgba(255,255,255,.3)' }}>18 total · sorted by score</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {CANDIDATES.map((c, i) => (
                <div key={c.name} onClick={() => setSelected(i)} style={{ background: selected === i ? 'rgba(19,194,142,.04)' : '#161614', border: `1px solid ${selected === i ? 'rgba(19,194,142,.25)' : 'rgba(255,255,255,.07)'}`, borderRadius: 10, padding: '12px 14px', cursor: 'pointer', transition: 'all .2s', position: 'relative' }}>
                  {c.rank <= 3 && <div style={{ position: 'absolute', top: 10, left: -1, width: 22, height: 22, borderRadius: '0 6px 6px 0', display: 'grid', placeItems: 'center', fontSize: 10, fontWeight: 700, background: c.rank === 1 ? '#c5931f' : 'rgba(255,255,255,.1)', color: c.rank === 1 ? '#0a0a08' : 'rgba(255,255,255,.4)' }}>#{c.rank}</div>}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, paddingLeft: c.rank <= 3 ? 16 : 0, marginBottom: 8 }}>
                    <div style={{ width: 30, height: 30, borderRadius: '50%', background: `linear-gradient(135deg,${c.color})`, display: 'grid', placeItems: 'center', fontSize: 11, fontWeight: 700, color: '#fff', flexShrink: 0 }}>{c.av}</div>
                    <div style={{ flex: 1 }}><div style={{ fontSize: 13, fontWeight: 600 }}>{c.name}</div><div style={{ fontSize: 11, color: 'rgba(255,255,255,.3)' }}>{c.role}</div></div>
                    <div style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 22, fontWeight: 600, color: c.score >= 80 ? '#13c28e' : c.score >= 65 ? '#e2b04a' : '#ef4444' }}>{c.score}</div>
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 10 }}>
                    {c.skills.map((s, j) => (
                      <span key={s} style={{ fontSize: 10, padding: '3px 8px', borderRadius: 100, background: c.matched[j] ? 'rgba(19,194,142,.1)' : '#1e1e1b', color: c.matched[j] ? '#13c28e' : 'rgba(255,255,255,.3)', border: `1px solid ${c.matched[j] ? 'rgba(19,194,142,.2)' : 'rgba(255,255,255,.06)'}` }}>{s}</span>
                    ))}
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button onClick={e => { e.stopPropagation(); setShortlisted(s => new Set([...s, i])) }} style={{ flex: 1, fontSize: 11, fontWeight: 600, fontFamily: 'Syne, sans-serif', padding: 7, borderRadius: 6, cursor: 'pointer', background: shortlisted.has(i) ? 'rgba(19,194,142,.2)' : 'rgba(19,194,142,.12)', color: '#13c28e', border: '1px solid rgba(19,194,142,.2)', transition: 'all .2s' }}>
                      {shortlisted.has(i) ? '✓ Shortlisted' : '✓ Shortlist'}
                    </button>
                    <button onClick={e => { e.stopPropagation(); setRejected(r => new Set([...r, i])) }} style={{ flex: 1, fontSize: 11, fontWeight: 600, fontFamily: 'Syne, sans-serif', padding: 7, borderRadius: 6, cursor: 'pointer', background: rejected.has(i) ? 'rgba(239,68,68,.15)' : 'rgba(239,68,68,.08)', color: '#ef4444', border: '1px solid rgba(239,68,68,.15)', transition: 'all .2s' }}>
                      {rejected.has(i) ? '✗ Rejected' : '✗ Reject'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
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
