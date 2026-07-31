'use client'
import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import { api } from '@/lib/api'

type Candidate = {
  filename: string
  candidate_name?: string
  ai_score: number
  matched_skills?: string[]
  missing_skills?: string[]
  final_verdict?: string
  deep_analysis?: string
  is_shortlisted?: boolean
  trigger_interview?: boolean
  error?: string
  status?: 'active' | 'shortlisted' | 'rejected'
  jobTitle?: string
  screenedAt?: string
}

type HistoryEntry = Candidate & { jobTitle: string; screenedAt: string }
type Section = 'dashboard' | 'candidates' | 'bulk' | 'shortlist' | 'chatbot' | 'history' | 'open-roles' | 'settings' | 'profile'

const STEP_ICONS = ['📋', '💪', '⚠️', '✅']
const STEP_COLORS_C = ['#4f46e5', '#e2b04a', '#ef4444', '#13c28e']
const COLORS = ['#4f46e5', '#e2b04a', '#ef4444', '#13c28e']

function AnalysisCarousel({ text }: { text: string }) {
  const [active, setActive] = useState(0)
  const steps = (text || '').split(/\n(?=\*\*Step)/).filter(Boolean).map((block: string) => {
    const m = block.match(/^\*\*(.+?)\*\*/)
    return { heading: m ? m[1].replace(/^Step \d+:\s*/, '') : 'Analysis', body: block.replace(/^\*\*(.+?)\*\*/, '').replace(/^\n+/, '').trim() }
  })
  if (!steps.length) return <div style={{ fontSize:12, color:'rgba(255,255,255,.35)' }}>No analysis available.</div>
  return (
    <div>
      <div style={{ display:'flex', gap:5, marginBottom:10, flexWrap:'wrap' }}>
        {steps.map((s,i) => (
          <button key={i} onClick={(e)=>{e.stopPropagation(); setActive(i)}} style={{ display:'flex', alignItems:'center', gap:5, padding:'5px 10px', borderRadius:100, fontSize:11, fontWeight:600, cursor:'pointer', fontFamily:'Inter,sans-serif', border:`1px solid ${active===i?STEP_COLORS_C[i%4]:'rgba(255,255,255,.08)'}`, background:active===i?`${STEP_COLORS_C[i%4]}18`:'transparent', color:active===i?STEP_COLORS_C[i%4]:'rgba(255,255,255,.3)', transition:'all .2s' }}>
            <span>{STEP_ICONS[i%4]}</span> {s.heading}
          </button>
        ))}
      </div>
      <div style={{ padding:'14px 16px', background:'rgba(255,255,255,.02)', borderRadius:10, borderLeft:`3px solid ${STEP_COLORS_C[active%4]}` }}>
        <div style={{ fontSize:12, fontWeight:600, marginBottom:6, color:'rgba(255,255,255,.8)' }}>{steps[active]?.heading}</div>
        <p style={{ fontSize:12, color:'rgba(255,255,255,.45)', lineHeight:1.8, margin:0, whiteSpace:'pre-wrap' }}>{steps[active]?.body}</p>
      </div>
      <div style={{ display:'flex', justifyContent:'center', gap:5, marginTop:10 }}>
        {steps.map((_,i) => <div key={i} onClick={(e)=>{e.stopPropagation(); setActive(i)}} style={{ width:active===i?18:5, height:5, borderRadius:3, background:active===i?STEP_COLORS_C[i%4]:'rgba(255,255,255,.1)', cursor:'pointer', transition:'all .3s' }} />)}
      </div>
    </div>
  )
}
const s = (base: object, ...rest: object[]) => Object.assign({}, base, ...rest)

function initials(name: string) {
  return name.replace(/\.(pdf|PDF)$/,'').split(/[\s_-]+/).filter(Boolean).slice(0,2).map(w=>w[0]?.toUpperCase()).join('')||'??'
}

function ScoreChip({ score }: { score: number }) {
  const color = score >= 80 ? '#13c28e' : score >= 60 ? '#e2b04a' : '#ef4444'
  return <div style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:22, fontWeight:600, color }}>{score}</div>
}

function SkillTags({ matched, missing }: { matched: string[], missing: string[] }) {
  const all = [...matched.slice(0,3), ...missing.slice(0,2)]
  const mset = new Set(matched)
  return (
    <div style={{ display:'flex', flexWrap:'wrap', gap:4, marginBottom:8 }}>
      {all.map(sk => (
        <span key={sk} style={{ fontSize:10, padding:'3px 8px', borderRadius:100,
          background: mset.has(sk) ? 'rgba(19,194,142,.1)' : '#1e1e1b',
          color: mset.has(sk) ? '#13c28e' : 'rgba(255,255,255,.3)',
          border:`1px solid ${mset.has(sk) ? 'rgba(19,194,142,.2)' : 'rgba(255,255,255,.06)'}` }}>
          {sk}
        </span>
      ))}
    </div>
  )
}

const STORAGE_KEY = 'talentiq_hr_history'

function loadHistory(): HistoryEntry[] {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]') } catch { return [] }
}
function saveHistory(h: HistoryEntry[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(h))
}

export default function HRDashboard() {
  const [section, setSection] = useState<Section>('dashboard')
  const [userName, setUserName] = useState('HR Manager')
  const [userEmail, setUserEmail] = useState('')

  // Bulk screening state
  const [jobTitle, setJobTitle] = useState('')
  const [jobDescription, setJobDescription] = useState('')
  const [topN, setTopN] = useState(3)
  const [zipFile, setZipFile] = useState<File | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const [loading, setLoading] = useState(false)
  const [bulkError, setBulkError] = useState('')
  const [bulkStatus, setBulkStatus] = useState('')
  const [candidates, setCandidates] = useState<Candidate[]>([])
  const [totalProcessed, setTotalProcessed] = useState(0)
  const [selectedKey, setSelectedKey] = useState<string | null>(null)

  // History (persisted)
  const [history, setHistory] = useState<HistoryEntry[]>([])
  const [historySelected, setHistorySelected] = useState<HistoryEntry | null>(null)
  const [historyTab, setHistoryTab] = useState<'screenings'|'interviews'|'actions'>('screenings')
  const [scanHistory, setScanHistory] = useState<any[]>([])
  const [scanHistoryLoading, setScanHistoryLoading] = useState(false)
  const [interviewHistory, setInterviewHistory] = useState<any[]>([])
  const [interviewHistoryLoading, setInterviewHistoryLoading] = useState(false)
  const [scanHistorySelected, setScanHistorySelected] = useState<any>(null)
  const [interviewHistorySelected, setInterviewHistorySelected] = useState<any>(null)

  // DB jobs state
  const [dbJobs, setDbJobs] = useState<any[]>([])
  const [dbJobsLoading, setDbJobsLoading] = useState(false)
  const [selectedJob, setSelectedJob] = useState<any>(null)

  // AI Interviewer state
  const [interviewPostings, setInterviewPostings] = useState<any[]>([])
  const [interviewPostingsLoading, setInterviewPostingsLoading] = useState(false)
  const [selectedPosting, setSelectedPosting] = useState<any>(null)
  const [interviewCandidates, setInterviewCandidates] = useState<any[]>([])
  const [interviewCandidatesLoading, setInterviewCandidatesLoading] = useState(false)
  const [selectedReport, setSelectedReport] = useState<any>(null)
  const [showInterviewForm, setShowInterviewForm] = useState(false)
  const [iTitle, setITitle] = useState('')
  const [iCompany, setICompany] = useState('')
  const [iJD, setIJD] = useState('')
  const [iExtraQuestions, setIExtraQuestions] = useState('')
  const [iInterviewerName, setIInterviewerName] = useState('')
  const [iSaving, setISaving] = useState(false)
  const [iError, setIError] = useState('')
  const [copiedSlug, setCopiedSlug] = useState('')

  // Policy docs state
  const [policyDocs, setPolicyDocs] = useState<{filename:string, size_kb:number}[]>([])
  const [policyUploading, setPolicyUploading] = useState(false)
  const policyFileRef = useRef<HTMLInputElement>(null)

  // Chatbot state
  const [messages, setMessages] = useState([
    { role:'bot', text:"Hi! I'm your HR Policy assistant. Ask me anything about company policies, leave, benefits, or onboarding." }
  ])
  const [chatInput, setChatInput] = useState('')
  const [typing, setTyping] = useState(false)
  const chatEndRef = useRef<HTMLDivElement>(null)

  // Team Workspace state
  const [org, setOrg] = useState<any>(null)
  const [orgMembers, setOrgMembers] = useState<any[]>([])
  const [orgLoading, setOrgLoading] = useState(true)
  const [newOrgName, setNewOrgName] = useState('')
  const [creatingOrg, setCreatingOrg] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviting, setInviting] = useState(false)
  const [orgMsg, setOrgMsg] = useState('')
  const [orgError, setOrgError] = useState('')
  const [editingOrgName, setEditingOrgName] = useState(false)
  const [renameOrgValue, setRenameOrgValue] = useState('')
  const [renamingOrg, setRenamingOrg] = useState(false)

  const loadOrg = () => {
    setOrgLoading(true)
    api.getMyOrg().then((data: any) => {
      setOrg(data.organization)
      setOrgMembers(data.members || [])
    }).catch(() => {}).finally(() => setOrgLoading(false))
  }

  const handleCreateOrg = async () => {
    if (!newOrgName.trim()) return
    setCreatingOrg(true)
    setOrgError('')
    try {
      await api.createOrg(newOrgName.trim())
      loadOrg()
    } catch (e: any) {
      setOrgError(e.message || 'Could not create workspace.')
    } finally {
      setCreatingOrg(false)
    }
  }

  const handleRenameOrg = async () => {
    if (!renameOrgValue.trim()) return
    setRenamingOrg(true)
    setOrgError('')
    try {
      await api.renameOrg(renameOrgValue.trim())
      setEditingOrgName(false)
      loadOrg()
    } catch (e: any) {
      setOrgError(e.message || 'Could not rename workspace.')
    } finally {
      setRenamingOrg(false)
    }
  }

  const handleInvite = async () => {
    if (!inviteEmail.trim()) return
    setInviting(true)
    setOrgMsg('')
    setOrgError('')
    try {
      const res: any = await api.inviteTeammate(inviteEmail.trim())
      setOrgMsg(res.message)
      setInviteEmail('')
    } catch (e: any) {
      setOrgError(e.message || 'Could not send invite.')
    } finally {
      setInviting(false)
    }
  }

  const handleRemoveMember = async (memberId: number) => {
    try {
      await api.removeMember(memberId)
      loadOrg()
    } catch (e: any) {
      setOrgError(e.message || 'Could not remove teammate.')
    }
  }

  const loadInterviewPostings = () => {
    setInterviewPostingsLoading(true)
    api.getInterviewPostings()
      .then((r:any) => setInterviewPostings(Array.isArray(r) ? r : []))
      .catch(() => setInterviewPostings([]))
      .finally(() => setInterviewPostingsLoading(false))
  }

  const openPosting = (posting:any) => {
    setSelectedPosting(posting)
    setSelectedReport(null)
    setInterviewCandidatesLoading(true)
    api.getInterviewCandidates(posting.id)
      .then((r:any) => setInterviewCandidates(Array.isArray(r) ? r : []))
      .catch(() => setInterviewCandidates([]))
      .finally(() => setInterviewCandidatesLoading(false))
  }

  const createInterviewPosting = async () => {
    if (!iTitle.trim() || !iJD.trim()) { setIError('Role title and job description are required.'); return }
    setISaving(true)
    setIError('')
    try {
      const extra = iExtraQuestions.split('\n').map(q=>q.trim()).filter(Boolean)
      const posting = await api.createInterviewPosting({ title: iTitle.trim(), company: iCompany.trim() || undefined, job_description: iJD.trim(), extra_questions: extra, interviewer_name: iInterviewerName.trim() || undefined })
      setShowInterviewForm(false)
      setITitle(''); setICompany(''); setIJD(''); setIExtraQuestions(''); setIInterviewerName('')
      loadInterviewPostings()
      openPosting(posting)
    } catch (e:any) {
      setIError(e?.message || 'Could not create interview posting.')
    } finally {
      setISaving(false)
    }
  }

  const deleteInterviewPosting = async (postingId:string) => {
    if (!confirm('Delete this interview link permanently? All candidate transcripts and reports for it will be lost too.')) return
    try {
      await api.deleteInterviewPosting(postingId)
      if (selectedPosting?.id === postingId) { setSelectedPosting(null); setSelectedReport(null) }
      loadInterviewPostings()
    } catch (e:any) {
      setIError(e?.message || 'Could not delete interview link.')
    }
  }

  const copyInterviewLink = (link:string, slug:string) => {
    navigator.clipboard.writeText(link).then(() => {
      setCopiedSlug(slug)
      setTimeout(()=>setCopiedSlug(''), 1800)
    })
  }

  useEffect(() => {
    api.me().then((u:any) => {
      setUserName(u?.name || u?.full_name || 'HR Manager')
      setUserEmail(u?.email || '')
    }).catch(()=>{})
    setHistory(loadHistory())
    api.listPolicyDocs().then((r:any) => setPolicyDocs(r.documents || [])).catch(()=>{})

    setDbJobsLoading(true)
    api.getHRJobs()
      .then((jobs:any) => setDbJobs(Array.isArray(jobs) ? jobs : []))
      .catch(() => setDbJobs([]))
      .finally(() => setDbJobsLoading(false))

    loadInterviewPostings()
    loadOrg()

    setScanHistoryLoading(true)
    api.getScanHistory()
      .then((r:any) => setScanHistory(Array.isArray(r) ? r : []))
      .catch(() => setScanHistory([]))
      .finally(() => setScanHistoryLoading(false))

    setInterviewHistoryLoading(true)
    api.getAllInterviewCandidates()
      .then((r:any) => setInterviewHistory(Array.isArray(r) ? r.filter((c:any) => c.status === 'completed') : []))
      .catch(() => setInterviewHistory([]))
      .finally(() => setInterviewHistoryLoading(false))
  }, [])

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior:'smooth' }) }, [messages, typing])

  const handleLogout = () => {
    localStorage.removeItem('token'); localStorage.removeItem('role')
    document.cookie='token=; path=/; max-age=0'; document.cookie='role=; path=/; max-age=0'
    window.location.replace('/auth/login/hr')
  }

  const uploadPolicyDoc = async (file: File) => {
    setPolicyUploading(true)
    try {
      await api.uploadPolicyDoc(file)
      const r:any = await api.listPolicyDocs()
      setPolicyDocs(r.documents || [])
    } catch(e:any) { alert(e.message || 'Upload failed') }
    finally { setPolicyUploading(false) }
  }

  const exportCSV = () => {
    if (!candidates.length) return
    const headers = ['Rank','Filename','Score','Verdict','Matched Skills','Missing Skills']
    const rows = candidates.map((c,i) => [
      i+1, c.filename, c.ai_score, c.final_verdict||'',
      (c.matched_skills||[]).join('; '), (c.missing_skills||[]).join('; ')
    ])
    const csv = [headers,...rows].map(r=>r.map(v=>`"${String(v).replace(/"/g,'""')}"`).join(',')).join('\n')
    const blob = new Blob([csv],{type:'text/csv'})
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href=url
    a.download=`${jobTitle||'screening'}_${new Date().toLocaleDateString('en-GB').replace(/\//g,'-')}.csv`
    a.click(); URL.revokeObjectURL(url)
  }

  // ── Bulk screening (async + polling) ──
  const [pollProgress, setPollProgress] = useState({ current: 0, total: 0, currentName: '' })
  const [bulkAnimStep, setBulkAnimStep] = useState(0)

  const BULK_ANIM_STEPS = [
    'Uploading CVs…',
    'Parsing resumes…',
    'Creating text chunks…',
    'Building vector embeddings…',
    'Storing in FAISS index…',
    'Retrieving relevant context…',
    'Reasoning with LLaMA 3.3…',
    'Ranking candidates…',
  ]

  const runBulk = async () => {
    setBulkError('')
    if (!jobDescription.trim()) { setBulkError('Paste a job description first.'); return }
    if (!zipFile) { setBulkError('Select a ZIP or PDF file first.'); fileRef.current?.click(); return }
    setLoading(true)
    setBulkStatus('Uploading CVs…')
    setPollProgress({ current: 0, total: 0, currentName: '' })
    setBulkAnimStep(0)

    // Cycles a fun step checklist (matching the candidate-side scan animation)
    // while we're waiting on the upload + task kickoff — cleared the moment
    // real per-CV progress numbers start coming in from the poll below.
    const animInterval = setInterval(() => {
      setBulkAnimStep(s => s < BULK_ANIM_STEPS.length - 1 ? s + 1 : s)
    }, 900)

    try {
      const jd = jobTitle ? `Job Title: ${jobTitle}\n\n${jobDescription}` : jobDescription
      const res: any = await api.bulkScreen(jd, topN, zipFile)
      const taskId: string = res.task_id
      const totalCvs: number = res.total_cvs || 0
      setPollProgress(p => ({ ...p, total: totalCvs }))
      setBulkStatus(`Screening started — ${totalCvs} CV(s) in queue…`)
      clearInterval(animInterval)

      // Poll every 2s until done
      await new Promise<void>((resolve, reject) => {
        const interval = setInterval(async () => {
          try {
            const status: any = await api.pollBulkStatus(taskId)
            if (status.state === 'progress') {
              setPollProgress({ current: status.current || 0, total: status.total || totalCvs, currentName: status.current_name || '' })
              setBulkStatus(status.status || 'Processing…')
            } else if (status.state === 'success') {
              clearInterval(interval)
              const ranked: Candidate[] = (status.all_results || status.top_candidates || []).map((c: Candidate) => ({ ...c, status: 'active', jobTitle, screenedAt: new Date().toLocaleString() }))
              setCandidates(ranked)
              setTotalProcessed(status.total_cvs_processed || ranked.length)
              setSelectedKey(null)
              setBulkStatus(`✓ Complete · ${status.total_cvs_processed} CV(s) ranked`)
              setPollProgress({ current: 0, total: 0, currentName: '' })
              resolve()
            } else if (status.state === 'failure') {
              clearInterval(interval)
              reject(new Error(status.error || 'Screening failed'))
            }
          } catch (e) { clearInterval(interval); reject(e) }
        }, 2000)
      })
    } catch (e: any) {
      clearInterval(animInterval)
      setBulkError(e.message || 'Bulk screening failed.')
      setBulkStatus('')
    } finally {
      setLoading(false)
    }
  }

  // ── Shortlist / Reject ──
  const markCandidate = (idx: number, status: 'shortlisted' | 'rejected') => {
    const c = candidates[idx]
    if (!c) return
    const entry: HistoryEntry = { ...c, status, jobTitle: jobTitle||'Unknown Role', screenedAt: c.screenedAt || new Date().toLocaleString() }
    const updated = [...candidates]
    updated[idx] = { ...c, status }
    setCandidates(updated)
    // Save to history
    const newHistory = [entry, ...history.filter(h => !(h.filename === c.filename && h.jobTitle === entry.jobTitle))]
    setHistory(newHistory); saveHistory(newHistory)
  }

  const undoMark = (idx: number) => {
    const updated = [...candidates]; updated[idx] = { ...candidates[idx], status:'active' }; setCandidates(updated)
  }

  // ── Chatbot ──
  const sendMessage = async (msg: string) => {
    if (!msg.trim()) return
    setMessages(m => [...m, { role:'user', text:msg }]); setChatInput(''); setTyping(true)
    try {
      const res:any = await api.hrChat(msg)
      setMessages(m => [...m, { role:'bot', text: res?.answer||'No answer found.' }])
    } catch(e:any) {
      setMessages(m => [...m, { role:'bot', text:`Error: ${e.message||'Could not reach policy assistant.'}` }])
    } finally { setTyping(false) }
  }

  // ── Derived ──
  const activeCandidates = candidates.filter(c => !c.status || c.status === 'active')
  const shortlistedList = candidates.filter(c => c.status === 'shortlisted')
  const rejectedList = candidates.filter(c => c.status === 'rejected')
  const avgScore = candidates.length ? Math.round(candidates.reduce((s,c)=>s+(c.ai_score||0),0)/candidates.length) : 0

  // ── Styles ──
  const base = { background:'#0a0a08', fontFamily:'Inter, sans-serif', color:'rgba(255,255,255,.88)' }
  const card = { background:'#111110', border:'1px solid rgba(255,255,255,.06)', borderRadius:8, padding:16 }
  const inputSt = { background:'#111110', border:'1px solid rgba(255,255,255,.06)', borderRadius:8, padding:'10px 12px', fontSize:13, fontFamily:'Inter, sans-serif', color:'rgba(255,255,255,.8)', outline:'none', width:'100%' }

  // ── Nav ──
  const NAV = [
    { id:'dashboard', icon:'', label:'Dashboard' },
    { id:'candidates', icon:'', label:'All Candidates', badge: candidates.length||undefined },
    { id:'bulk', icon:'', label:'Bulk Screen' },
    { id:'open-roles', icon:'', label:'AI Interviewer', badge: interviewPostings.length||undefined },
    { id:'shortlist', icon:'', label:'Shortlist', badge: shortlistedList.length||undefined },
    { id:'chatbot', icon:'', label:'Policy Chatbot' },
    { id:'history', icon:'', label:'History', badge: history.length||undefined },
    { id:'settings', icon:'', label:'Settings' },
    { id:'profile', icon:'', label:'Profile' },
  ] as const

  // ══════════════ SECTION RENDERERS ══════════════

  const CandidateCard = ({ c, idx, showActions=true }: { c:Candidate, idx:number, showActions?:boolean }) => {
    const displayName = c.candidate_name || c.filename
    const av = initials(displayName)
    const color = COLORS[idx%COLORS.length]
    return (
      <div onClick={()=>setSelectedKey(selectedKey===c.filename?null:c.filename)}
        style={s(card, { cursor:'pointer', transition:'all .2s', marginBottom:8,
          border:`1px solid ${selectedKey===c.filename?'rgba(19,194,142,.25)':'rgba(255,255,255,.07)'}`,
          background: selectedKey===c.filename?'rgba(19,194,142,.03)':'#161614', position:'relative' })}>
        {idx < 3 && <div style={{ position:'absolute', top:10, left:-1, width:22, height:22, borderRadius:'0 6px 6px 0', display:'grid', placeItems:'center', fontSize:10, fontWeight:700, background: idx===0?'#c5931f':'rgba(255,255,255,.1)', color: idx===0?'#0a0a08':'rgba(255,255,255,.4)' }}>#{idx+1}</div>}
        <div style={{ display:'flex', alignItems:'center', gap:10, paddingLeft: idx<3?16:0, marginBottom:6 }}>
          <div style={{ width:32, height:32, borderRadius:'50%', background:`linear-gradient(135deg,${color})`, display:'grid', placeItems:'center', fontSize:12, fontWeight:700, color:'#fff', flexShrink:0 }}>{av}</div>
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ fontSize:13, fontWeight:600, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{c.candidate_name || c.filename}</div>
            <div style={{ fontSize:11, color:'rgba(255,255,255,.3)' }}>{c.final_verdict||'—'}</div>
          </div>
          <ScoreChip score={c.ai_score} />
        </div>
        {!c.error && <SkillTags matched={c.matched_skills||[]} missing={c.missing_skills||[]} />}
        {c.error && <div style={{ fontSize:11, color:'#ef4444', marginBottom:8 }}>{c.error}</div>}
        {showActions && !c.status || c.status==='active' ? (
          <div style={{ display:'flex', gap:6 }}>
            <button onClick={e=>{e.stopPropagation();markCandidate(idx,'shortlisted')}} style={{ flex:1, fontSize:11, fontWeight:600, fontFamily:'Inter,sans-serif', padding:7, borderRadius:6, cursor:'pointer', background:'rgba(19,194,142,.12)', color:'#13c28e', border:'1px solid rgba(19,194,142,.2)' }}>✓ Shortlist</button>
            <button onClick={e=>{e.stopPropagation();markCandidate(idx,'rejected')}} style={{ flex:1, fontSize:11, fontWeight:600, fontFamily:'Inter,sans-serif', padding:7, borderRadius:6, cursor:'pointer', background:'rgba(239,68,68,.08)', color:'#ef4444', border:'1px solid rgba(239,68,68,.15)' }}>✗ Reject</button>
          </div>
        ) : showActions ? (
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
            <span style={{ fontSize:11, fontWeight:600, color: c.status==='shortlisted'?'#13c28e':'#ef4444' }}>{c.status==='shortlisted'?'✓ Shortlisted':'✗ Rejected'}</span>
            <button onClick={e=>{e.stopPropagation();undoMark(idx)}} style={{ fontSize:10, color:'rgba(255,255,255,.3)', background:'transparent', border:'1px solid rgba(255,255,255,.08)', borderRadius:6, padding:'4px 8px', cursor:'pointer', fontFamily:'Inter,sans-serif' }}>Undo</button>
          </div>
        ) : null}
        {selectedKey===c.filename && c.deep_analysis && (
          <div style={{ marginTop:10, padding:12, background:'rgba(255,255,255,.02)', borderRadius:8, border:'1px solid rgba(255,255,255,.05)' }}>
            <AnalysisCarousel text={c.deep_analysis} />
          </div>
        )}
      </div>
    )
  }

  const renderDashboard = () => (
    <div style={{ padding:28, overflowY:'auto', height:'100%' }}>
      <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:24 }}>
        <div>
          <div style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:26, fontWeight:600, marginBottom:4 }}>HR Dashboard</div>
          <div style={{ fontSize:12, color:'rgba(255,255,255,.3)' }}>Overview of your latest screening session</div>
        </div>
        {candidates.length > 0 && (
          <button onClick={exportCSV} style={{ display:'flex', alignItems:'center', gap:6, fontSize:12, fontWeight:600, padding:'8px 16px', borderRadius:8, border:'1px solid rgba(19,194,142,.2)', background:'rgba(19,194,142,.08)', color:'#13c28e', cursor:'pointer', fontFamily:'Inter,sans-serif' }}>
            ⬇ Export CSV
          </button>
        )}
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:12, marginBottom:24 }}>
        {[
          { v: totalProcessed||'—', l:'Total Screened' },
          { v: shortlistedList.length||'—', l:'Shortlisted', sub: totalProcessed ? `${Math.round(shortlistedList.length/totalProcessed*100)}% pass rate` : '' },
          { v: avgScore||'—', l:'Avg. Score' },
          { v: rejectedList.length||'—', l:'Rejected' },
        ].map(st=>(
          <div key={st.l} style={card}>
            <div style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:32, fontWeight:600, marginBottom:2 }}>{st.v}</div>
            <div style={{ fontSize:11, color:'rgba(255,255,255,.3)' }}>{st.l}</div>
            {st.sub && <div style={{ fontSize:11, color:'#22c55e', marginTop:3 }}>{st.sub}</div>}
          </div>
        ))}
      </div>
      {candidates.length > 0 && (
        <>
          <div style={{ fontSize:13, fontWeight:600, marginBottom:12 }}>ATS Score Distribution</div>
          <div style={s(card, { marginBottom:24 })}>
            <div style={{ display:'flex', alignItems:'flex-end', gap:6, height:80, padding:'8px 4px 0' }}>
              {candidates.map((c,i)=>(
                <div key={i} style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', gap:4, cursor:'pointer' }} onClick={()=>setSection('candidates')}>
                  <span style={{ fontSize:9, color:'rgba(255,255,255,.4)', fontWeight:600 }}>{c.ai_score}</span>
                  <div title={c.filename} style={{ width:'100%', borderRadius:'3px 3px 0 0', height:`${Math.max(c.ai_score,4)}%`, background: c.ai_score>=80?'#13c28e':c.ai_score>=60?'#e2b04a':'rgba(239,68,68,.5)', transition:'all .3s', minHeight:4 }} />
                </div>
              ))}
            </div>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginTop:10 }}>
              <span style={{ fontSize:10, color:'rgba(255,255,255,.2)' }}>Lowest: {Math.min(...candidates.map(c=>c.ai_score))}</span>
              <span style={{ fontSize:10, color:'rgba(255,255,255,.2)' }}>Avg: {Math.round(candidates.reduce((s,c)=>s+c.ai_score,0)/candidates.length)}</span>
              <span style={{ fontSize:10, color:'rgba(255,255,255,.2)' }}>Highest: {Math.max(...candidates.map(c=>c.ai_score))}</span>
            </div>
          </div>
          <div style={{ fontSize:13, fontWeight:600, marginBottom:12 }}>Top Candidates</div>
          {candidates.slice(0,3).map((c,i)=><CandidateCard key={i} c={c} idx={i} />)}
          <button onClick={()=>setSection('candidates')} style={{ fontSize:12, color:'#13c28e', background:'transparent', border:'1px solid rgba(19,194,142,.2)', borderRadius:8, padding:'8px 16px', cursor:'pointer', fontFamily:'Inter,sans-serif', marginTop:4 }}>View all {candidates.length} candidates →</button>
        </>
      )}
      {candidates.length===0 && (
        <div style={s(card, { textAlign:'center', padding:40 })}>
          
          <div style={{ fontSize:14, fontWeight:600, marginBottom:6 }}>No screenings yet</div>
          <div style={{ fontSize:12, color:'rgba(255,255,255,.3)', marginBottom:16 }}>Upload a ZIP of CVs to get started</div>
          <button onClick={()=>setSection('bulk')} style={{ fontSize:13, fontWeight:700, background:'#13c28e', color:'#fff', border:'none', borderRadius:8, padding:'10px 20px', cursor:'pointer', fontFamily:'Inter,sans-serif' }}>Run Bulk Screening</button>
        </div>
      )}
    </div>
  )

  const renderBulk = () => (
    <div style={{ padding:28, overflowY:'auto', height:'100%', maxWidth:640 }}>
      <div style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:26, fontWeight:600, marginBottom:4 }}>Bulk Screening</div>
      <div style={{ fontSize:12, color:'rgba(255,255,255,.3)', marginBottom:24 }}>Upload CVs and a job description — AI ranks them all</div>
      <input ref={fileRef} type="file" accept=".zip,.pdf" style={{ display:'none' }} onChange={e=>setZipFile(e.target.files?.[0]||null)} />
      <div onClick={()=>fileRef.current?.click()} style={s(card, { border:'2px dashed rgba(255,255,255,.12)', textAlign:'center', padding:28, cursor:'pointer', marginBottom:14 })}>
        <div style={{ fontSize:28, marginBottom:8 }}></div>
        <div style={{ fontSize:13, fontWeight:600 }}>{zipFile?zipFile.name:'Select ZIP of CVs or single PDF'}</div>
        {!zipFile && <div style={{ fontSize:11, color:'rgba(255,255,255,.3)', marginTop:4 }}>Max 25 CVs per ZIP</div>}
      </div>
      <input value={jobTitle} onChange={e=>setJobTitle(e.target.value)} placeholder="Job title (e.g. Senior Frontend Engineer)" style={s(inputSt, { marginBottom:10 })} />
      <textarea value={jobDescription} onChange={e=>setJobDescription(e.target.value)} placeholder="Paste job description or requirements…" style={s(inputSt, { resize:'none', height:100, lineHeight:1.6, marginBottom:10 } as any)} />
      <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:14 }}>
        <span style={{ fontSize:12, color:'rgba(255,255,255,.4)' }}>Top candidates needed:</span>
        <input type="number" min={1} max={25} value={topN} onChange={e=>setTopN(Number(e.target.value)||1)} style={{ width:60, background:'#161614', border:'1px solid rgba(255,255,255,.07)', borderRadius:6, padding:'7px 10px', fontSize:13, color:'rgba(255,255,255,.8)', outline:'none', fontFamily:'Inter,sans-serif' }} />
      </div>
      {bulkError && <div style={{ fontSize:12, color:'#ef4444', marginBottom:10 }}>{bulkError}</div>}

      {/* Loading Animation */}
      {loading && (
        <div style={s(card, { marginBottom:14, padding:20 })}>
          <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:14 }}>
            <div style={{ position:'relative', width:40, height:40, flexShrink:0 }}>
              <svg viewBox="0 0 40 40" style={{ width:40, height:40, animation:'spin 1.2s linear infinite' }}>
                <circle cx="20" cy="20" r="16" fill="none" stroke="rgba(255,255,255,.07)" strokeWidth="3"/>
                <circle cx="20" cy="20" r="16" fill="none" stroke="#13c28e" strokeWidth="3" strokeDasharray="60 40" strokeLinecap="round"/>
              </svg>
            </div>
            <div>
              <div style={{ fontSize:13, fontWeight:600, marginBottom:2 }}>{bulkStatus}</div>
              {pollProgress.currentName && <div style={{ fontSize:11, color:'rgba(255,255,255,.35)' }}>Analyzing: {pollProgress.currentName}</div>}
            </div>
          </div>
          {pollProgress.total === 0 && (
            <div style={{ marginTop:4 }}>
              {BULK_ANIM_STEPS.map((step, i) => (
                <div key={i} style={{ display:'flex', alignItems:'center', gap:8, opacity: i <= bulkAnimStep ? 1 : 0.2, transition:'opacity 0.4s ease', fontSize:11, color: i === bulkAnimStep ? '#e2b04a' : i < bulkAnimStep ? '#13c28e' : 'rgba(255,255,255,.3)', marginBottom:4 }}>
                  <div style={{ width:5, height:5, borderRadius:'50%', background: i === bulkAnimStep ? '#e2b04a' : i < bulkAnimStep ? '#13c28e' : 'rgba(255,255,255,.15)', flexShrink:0, transition:'background 0.4s' }} />
                  {step}
                  {i < bulkAnimStep && <span style={{ marginLeft:'auto', color:'#13c28e', fontSize:10 }}>done</span>}
                  {i === bulkAnimStep && <span style={{ marginLeft:'auto', fontSize:10, animation:'pulse 1s infinite' }}>...</span>}
                </div>
              ))}
              <div style={{ height:2, background:'rgba(255,255,255,.06)', borderRadius:1, marginTop:10, overflow:'hidden' }}>
                <div style={{ height:'100%', background:'linear-gradient(90deg,#b8860b,#e2b04a)', borderRadius:1, width:`${Math.round(((bulkAnimStep + 1) / BULK_ANIM_STEPS.length) * 100)}%`, transition:'width 0.6s ease' }} />
              </div>
            </div>
          )}
          {pollProgress.total > 0 && (
            <>
              <div style={{ display:'flex', justifyContent:'space-between', fontSize:11, color:'rgba(255,255,255,.3)', marginBottom:6 }}>
                <span>Progress</span>
                <span>{pollProgress.current}/{pollProgress.total} CVs</span>
              </div>
              <div style={{ height:6, background:'rgba(255,255,255,.06)', borderRadius:3, overflow:'hidden' }}>
                <div style={{ height:'100%', background:'linear-gradient(90deg,#0b7c5e,#13c28e)', borderRadius:3, width:`${Math.round((pollProgress.current/pollProgress.total)*100)}%`, transition:'width .5s ease' }}/>
              </div>
              <div style={{ display:'flex', gap:4, marginTop:10 }}>
                {Array.from({ length: pollProgress.total }, (_,i) => (
                  <div key={i} style={{ flex:1, height:4, borderRadius:2, background: i < pollProgress.current ? '#13c28e' : i === pollProgress.current ? '#e2b04a' : 'rgba(255,255,255,.06)', transition:'all .4s' }}/>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      <button onClick={runBulk} disabled={loading} style={{ width:'100%', background: loading?'rgba(19,194,142,.3)':'#13c28e', color:'#fff', fontSize:13, fontWeight:700, fontFamily:'Inter,sans-serif', padding:12, borderRadius:8, border:'none', cursor: loading?'default':'pointer', letterSpacing:'.04em', opacity: loading ? 0.7 : 1 }}>
        {loading ? 'Screening in progress…' : bulkStatus ? bulkStatus : 'Run Bulk Screening'}
      </button>
      {bulkStatus && candidates.length>0 && (
        <button onClick={()=>setSection('candidates')} style={{ width:'100%', marginTop:10, fontSize:12, fontWeight:600, color:'#13c28e', background:'transparent', border:'1px solid rgba(19,194,142,.2)', borderRadius:8, padding:10, cursor:'pointer', fontFamily:'Inter,sans-serif' }}>
          View {candidates.length} Ranked Candidates →
        </button>
      )}
    </div>
  )

  const renderCandidates = (list: Candidate[], title: string, emptyMsg: string) => (
    <div style={{ padding:28, overflowY:'auto', height:'100%' }}>
      <div style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:26, fontWeight:600, marginBottom:4 }}>{title}</div>
      <div style={{ fontSize:12, color:'rgba(255,255,255,.3)', marginBottom:20 }}>{list.length} candidates · sorted by score</div>
      {list.length===0 ? (
        <div style={s(card, { textAlign:'center', padding:40, color:'rgba(255,255,255,.3)' })}>{emptyMsg}</div>
      ) : (
        <div style={{ maxWidth:700 }}>{list.map((c,i)=><CandidateCard key={c.filename+i} c={c} idx={candidates.indexOf(c)} />)}</div>
      )}
    </div>
  )

  const renderHistory = () => (
    <div style={{ display:'flex', height:'100%', overflow:'hidden' }}>
      <div style={{ width:320, borderRight:'1px solid rgba(255,255,255,.07)', overflowY:'auto', padding:20 }}>
        <div style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:22, fontWeight:600, marginBottom:12 }}>History</div>
        <div style={{ display:'flex', gap:6, marginBottom:16, flexWrap:'wrap' }}>
          {([['screenings','Screenings'],['interviews','AI Interviews'],['actions','My Actions']] as const).map(([id,label]) => (
            <button key={id} onClick={()=>setHistoryTab(id)}
              style={{ fontSize:11, fontWeight:600, padding:'6px 10px', borderRadius:100, cursor:'pointer', fontFamily:'Inter,sans-serif',
                border: historyTab===id ? '1px solid rgba(19,194,142,.3)' : '1px solid rgba(255,255,255,.08)',
                background: historyTab===id ? 'rgba(19,194,142,.1)' : 'transparent',
                color: historyTab===id ? '#13c28e' : 'rgba(255,255,255,.5)' }}>{label}</button>
          ))}
        </div>

        {historyTab==='screenings' && (
          <>
            {scanHistoryLoading && <div style={{ fontSize:12, color:'rgba(255,255,255,.3)' }}>Loading...</div>}
            {!scanHistoryLoading && scanHistory.length===0 && (
              <div style={{ fontSize:12, color:'rgba(255,255,255,.3)', textAlign:'center', padding:'40px 0' }}>No screenings yet. Every CV you screen is saved here automatically.</div>
            )}
            {scanHistory.map((h:any) => (
              <div key={h.id} onClick={()=>setScanHistorySelected(h)} style={s(card, { cursor:'pointer', marginBottom:8, border:`1px solid ${scanHistorySelected?.id===h.id?'rgba(19,194,142,.25)':'rgba(255,255,255,.07)'}` })}>
                <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:4 }}>
                  <span style={{ fontSize:11, fontWeight:600, color: h.is_shortlisted==='True'?'#13c28e':'rgba(255,255,255,.4)' }}>{h.is_shortlisted==='True'?'✓ Shortlisted':h.final_verdict}</span>
                  <span style={{ marginLeft:'auto', fontFamily:"'Cormorant Garamond',serif", fontSize:18, fontWeight:600, color: h.candidate_score>=80?'#13c28e':h.candidate_score>=60?'#e2b04a':'#ef4444' }}>{h.candidate_score}</span>
                </div>
                <div style={{ fontSize:13, fontWeight:600 }}>{h.role_title}</div>
                <div style={{ fontSize:10, color:'rgba(255,255,255,.2)', marginTop:3 }}>{h.created_at ? new Date(h.created_at).toLocaleString() : ''}</div>
              </div>
            ))}
          </>
        )}

        {historyTab==='interviews' && (
          <>
            {interviewHistoryLoading && <div style={{ fontSize:12, color:'rgba(255,255,255,.3)' }}>Loading...</div>}
            {!interviewHistoryLoading && interviewHistory.length===0 && (
              <div style={{ fontSize:12, color:'rgba(255,255,255,.3)', textAlign:'center', padding:'40px 0' }}>No completed AI interviews yet.</div>
            )}
            {interviewHistory.map((h:any) => (
              <div key={h.id} onClick={()=>setInterviewHistorySelected(h)} style={s(card, { cursor:'pointer', marginBottom:8, border:`1px solid ${interviewHistorySelected?.id===h.id?'rgba(19,194,142,.25)':'rgba(255,255,255,.07)'}` })}>
                <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:4 }}>
                  <span style={{ fontSize:11, fontWeight:600, color:'rgba(255,255,255,.5)' }}>{h.final_verdict}</span>
                  {h.ai_score != null && <span style={{ marginLeft:'auto', fontFamily:"'Cormorant Garamond',serif", fontSize:18, fontWeight:600, color: h.ai_score>=80?'#13c28e':h.ai_score>=60?'#e2b04a':'#ef4444' }}>{h.ai_score}</span>}
                </div>
                <div style={{ fontSize:13, fontWeight:600 }}>{h.candidate_name}</div>
                <div style={{ fontSize:11, color:'rgba(255,255,255,.3)', marginTop:2 }}>{h.posting_title}</div>
                <div style={{ fontSize:10, color:'rgba(255,255,255,.2)', marginTop:3 }}>{h.completed_at ? new Date(h.completed_at).toLocaleString() : ''}</div>
              </div>
            ))}
          </>
        )}

        {historyTab==='actions' && (
          <>
            <div style={{ fontSize:11, color:'rgba(255,255,255,.3)', marginBottom:12 }}>{history.length} candidates you shortlisted/rejected (saved on this device only)</div>
            {history.length===0 ? (
              <div style={{ fontSize:12, color:'rgba(255,255,255,.3)', textAlign:'center', padding:'40px 0' }}>No history yet. Shortlist or reject candidates to save them here.</div>
            ) : history.map((h,i)=>(
              <div key={i} onClick={()=>setHistorySelected(h)} style={s(card, { cursor:'pointer', marginBottom:8, border:`1px solid ${historySelected===h?'rgba(19,194,142,.25)':'rgba(255,255,255,.07)'}` })}>
                <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:4 }}>
                  <span style={{ fontSize:11, fontWeight:600, color: h.status==='shortlisted'?'#13c28e':'#ef4444' }}>{h.status==='shortlisted'?'✓ Shortlisted':'✗ Rejected'}</span>
                  <span style={{ marginLeft:'auto', fontFamily:"'Cormorant Garamond',serif", fontSize:18, fontWeight:600, color: h.ai_score>=80?'#13c28e':h.ai_score>=60?'#e2b04a':'#ef4444' }}>{h.ai_score}</span>
                </div>
                <div style={{ fontSize:13, fontWeight:600 }}>{h.filename}</div>
                <div style={{ fontSize:11, color:'rgba(255,255,255,.3)', marginTop:2 }}>{h.jobTitle}</div>
                <div style={{ fontSize:10, color:'rgba(255,255,255,.2)', marginTop:3 }}>{h.screenedAt}</div>
              </div>
            ))}
            {history.length>0 && (
              <button onClick={()=>{if(confirm('Clear all history?')){setHistory([]);saveHistory([])}}} style={{ width:'100%', marginTop:8, fontSize:11, color:'#ef4444', background:'transparent', border:'1px solid rgba(239,68,68,.15)', borderRadius:8, padding:'8px', cursor:'pointer', fontFamily:'Inter,sans-serif' }}>Clear History</button>
            )}
          </>
        )}
      </div>

      <div style={{ flex:1, overflowY:'auto', padding:28 }}>
        {historyTab==='screenings' && (
          !scanHistorySelected ? (
            <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100%', color:'rgba(255,255,255,.2)', fontSize:13 }}>Select a screening from history to view details</div>
          ) : (
            <>
              <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:20 }}>
                <div>
                  <div style={{ fontSize:18, fontWeight:600 }}>{scanHistorySelected.role_title}</div>
                  <div style={{ fontSize:12, color:'rgba(255,255,255,.3)' }}>{scanHistorySelected.created_at ? new Date(scanHistorySelected.created_at).toLocaleString() : ''}</div>
                </div>
                <span style={{ marginLeft:'auto', fontFamily:"'Cormorant Garamond',serif", fontSize:36, fontWeight:600, color: scanHistorySelected.candidate_score>=80?'#13c28e':scanHistorySelected.candidate_score>=60?'#e2b04a':'#ef4444' }}>{scanHistorySelected.candidate_score}</span>
              </div>
              <div style={{ display:'flex', gap:10, marginBottom:20 }}>
                <div style={s(card, { flex:1 })}>
                  <div style={{ fontSize:11, fontWeight:600, color:'#13c28e', marginBottom:8 }}>Matched Skills</div>
                  <div style={{ display:'flex', flexWrap:'wrap', gap:5 }}>{(scanHistorySelected.matched_skills||[]).map((sk:string)=><span key={sk} style={{ fontSize:11, padding:'3px 8px', borderRadius:100, background:'rgba(19,194,142,.1)', color:'#13c28e', border:'1px solid rgba(19,194,142,.2)' }}>{sk}</span>)}</div>
                </div>
                <div style={s(card, { flex:1 })}>
                  <div style={{ fontSize:11, fontWeight:600, color:'#ef4444', marginBottom:8 }}>Missing Skills</div>
                  <div style={{ display:'flex', flexWrap:'wrap', gap:5 }}>{(scanHistorySelected.missing_skills||[]).map((sk:string)=><span key={sk} style={{ fontSize:11, padding:'3px 8px', borderRadius:100, background:'rgba(239,68,68,.08)', color:'#ef4444', border:'1px solid rgba(239,68,68,.15)' }}>{sk}</span>)}</div>
                </div>
              </div>
              {scanHistorySelected.deep_analysis && (
                <div style={card}>
                  <div style={{ fontSize:12, fontWeight:600, marginBottom:12 }}>Full Analysis</div>
                  <AnalysisCarousel text={scanHistorySelected.deep_analysis} />
                </div>
              )}
            </>
          )
        )}

        {historyTab==='interviews' && (
          !interviewHistorySelected ? (
            <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100%', color:'rgba(255,255,255,.2)', fontSize:13 }}>Select a candidate to view their interview report</div>
          ) : (
            <>
              <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:20 }}>
                <div>
                  <div style={{ fontSize:18, fontWeight:600 }}>{interviewHistorySelected.candidate_name}</div>
                  <div style={{ fontSize:12, color:'rgba(255,255,255,.3)' }}>{interviewHistorySelected.candidate_email} · {interviewHistorySelected.posting_title}</div>
                </div>
                {interviewHistorySelected.ai_score != null && (
                  <span style={{ marginLeft:'auto', fontFamily:"'Cormorant Garamond',serif", fontSize:36, fontWeight:600, color: interviewHistorySelected.ai_score>=80?'#13c28e':interviewHistorySelected.ai_score>=60?'#e2b04a':'#ef4444' }}>{interviewHistorySelected.ai_score}</span>
                )}
              </div>
              {interviewHistorySelected.final_verdict && (
                <div style={{ display:'inline-block', fontSize:11, fontWeight:700, padding:'4px 12px', borderRadius:100, marginBottom:16, background:'rgba(255,255,255,.06)', color:'rgba(255,255,255,.7)' }}>{interviewHistorySelected.final_verdict}</div>
              )}
              {interviewHistorySelected.experience_assessment && (
                <div style={s(card, { marginBottom:14 })}>
                  <div style={{ fontSize:12, fontWeight:600, color:'rgba(255,255,255,.4)', marginBottom:6 }}>Experience Assessment</div>
                  <div style={{ fontSize:13, color:'rgba(255,255,255,.6)', lineHeight:1.7 }}>{interviewHistorySelected.experience_assessment}</div>
                </div>
              )}
              {interviewHistorySelected.deep_analysis && (
                <div style={card}>
                  <div style={{ fontSize:12, fontWeight:600, marginBottom:12 }}>Deep Analysis</div>
                  <div style={{ fontSize:13, color:'rgba(255,255,255,.6)', lineHeight:1.7 }}>{interviewHistorySelected.deep_analysis}</div>
                </div>
              )}
            </>
          )
        )}

        {historyTab==='actions' && (
          !historySelected ? (
            <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100%', color:'rgba(255,255,255,.2)', fontSize:13 }}>Select a candidate from history to view details</div>
          ) : (
            <>
              <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:20 }}>
                <div style={{ width:44, height:44, borderRadius:'50%', background:'linear-gradient(135deg,#0b7c5e,#13c28e)', display:'grid', placeItems:'center', fontSize:15, fontWeight:700, color:'#fff' }}>{initials(historySelected.filename)}</div>
                <div>
                  <div style={{ fontSize:18, fontWeight:600 }}>{historySelected.filename}</div>
                  <div style={{ fontSize:12, color:'rgba(255,255,255,.3)' }}>{historySelected.jobTitle} · {historySelected.screenedAt}</div>
                </div>
                <span style={{ marginLeft:'auto', fontFamily:"'Cormorant Garamond',serif", fontSize:36, fontWeight:600, color: historySelected.ai_score>=80?'#13c28e':historySelected.ai_score>=60?'#e2b04a':'#ef4444' }}>{historySelected.ai_score}</span>
              </div>
              <div style={{ display:'flex', gap:10, marginBottom:20 }}>
                <div style={s(card, { flex:1 })}>
                  <div style={{ fontSize:11, fontWeight:600, color:'#13c28e', marginBottom:8 }}>Matched Skills</div>
                  <div style={{ display:'flex', flexWrap:'wrap', gap:5 }}>{(historySelected.matched_skills||[]).map(sk=><span key={sk} style={{ fontSize:11, padding:'3px 8px', borderRadius:100, background:'rgba(19,194,142,.1)', color:'#13c28e', border:'1px solid rgba(19,194,142,.2)' }}>{sk}</span>)}</div>
                </div>
                <div style={s(card, { flex:1 })}>
                  <div style={{ fontSize:11, fontWeight:600, color:'#ef4444', marginBottom:8 }}>Missing Skills</div>
                  <div style={{ display:'flex', flexWrap:'wrap', gap:5 }}>{(historySelected.missing_skills||[]).map(sk=><span key={sk} style={{ fontSize:11, padding:'3px 8px', borderRadius:100, background:'rgba(239,68,68,.08)', color:'#ef4444', border:'1px solid rgba(239,68,68,.15)' }}>{sk}</span>)}</div>
                </div>
              </div>
              {historySelected.deep_analysis && (
                <div style={card}>
                  <div style={{ fontSize:12, fontWeight:600, marginBottom:12 }}>Full Analysis</div>
                  <AnalysisCarousel text={historySelected.deep_analysis} />
                </div>
              )}
            </>
          )
        )}
      </div>
    </div>
  )

  const renderChatbot = () => (
    <div style={{ display:'flex', flexDirection:'column', height:'100%', padding:28, maxWidth:700 }}>
      <div style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:26, fontWeight:600, marginBottom:4 }}>Policy Chatbot</div>
      <div style={{ fontSize:12, color:'rgba(255,255,255,.3)', marginBottom:16 }}>Ask anything about your company HR policies</div>

      {/* Policy document upload */}
      <input ref={policyFileRef} type="file" accept=".pdf" style={{ display:'none' }} onChange={e=>e.target.files?.[0]&&uploadPolicyDoc(e.target.files[0])} />
      <div style={s(card, { marginBottom:16, padding:12 })}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:8 }}>
          <span style={{ fontSize:12, fontWeight:600 }}>Policy Documents ({policyDocs.length})</span>
          <button onClick={()=>policyFileRef.current?.click()} disabled={policyUploading} style={{ fontSize:11, fontWeight:600, padding:'5px 12px', borderRadius:6, border:'1px solid rgba(19,194,142,.2)', background:'rgba(19,194,142,.08)', color:'#13c28e', cursor:'pointer', fontFamily:'Inter,sans-serif' }}>
            {policyUploading ? 'Uploading…' : '+ Upload PDF'}
          </button>
        </div>
        {policyDocs.length === 0 ? (
          <div style={{ fontSize:11, color:'rgba(255,255,255,.25)', textAlign:'center', padding:'8px 0' }}>No documents yet — upload a PDF to power the chatbot</div>
        ) : (
          <div style={{ display:'flex', flexWrap:'wrap', gap:5 }}>
            {policyDocs.map(d => (
              <div key={d.filename} style={{ fontSize:10, padding:'3px 10px', borderRadius:100, background:'rgba(255,255,255,.05)', color:'rgba(255,255,255,.4)', border:'1px solid rgba(255,255,255,.07)' }}>
                📄 {d.filename.replace(/^\d{8}_\d{6}_/, '')} ({d.size_kb}KB)
              </div>
            ))}
          </div>
        )}
      </div>
      <div style={s(card, { flex:1, overflowY:'auto', display:'flex', flexDirection:'column', gap:10, padding:16, marginBottom:12 })}>
        {messages.map((m,i)=>(
          <div key={i} style={{ display:'flex', alignItems:'flex-start', gap:8, justifyContent: m.role==='user'?'flex-end':'flex-start' }}>
            {m.role==='bot' && <div style={{ width:26, height:26, background:'#e2b04a', borderRadius:'50%', display:'grid', placeItems:'center', fontSize:10, fontWeight:700, color:'#0a0a08', flexShrink:0 }}></div>}
            <div style={{ maxWidth:'85%', padding:'10px 14px', borderRadius:12, fontSize:13, lineHeight:1.6,
              background: m.role==='bot'?'rgba(255,255,255,.04)':'rgba(19,194,142,.12)',
              color: m.role==='bot'?'rgba(255,255,255,.65)':'#13c28e',
              border:`1px solid ${m.role==='bot'?'rgba(255,255,255,.07)':'rgba(19,194,142,.18)'}`,
              borderBottomLeftRadius: m.role==='bot'?4:12, borderBottomRightRadius: m.role==='user'?4:12 }}
              dangerouslySetInnerHTML={{ __html: m.text.replace(/\*\*(.*?)\*\*/g,'<strong style="color:rgba(255,255,255,.85)">$1</strong>') }}
            />
          </div>
        ))}
        {typing && (
          <div style={{ display:'flex', gap:8 }}>
            <div style={{ width:26, height:26, background:'#e2b04a', borderRadius:'50%', display:'grid', placeItems:'center', fontSize:10, fontWeight:700, color:'#0a0a08' }}></div>
            <div style={{ padding:'12px 16px', background:'rgba(255,255,255,.04)', border:'1px solid rgba(255,255,255,.07)', borderRadius:12, display:'flex', gap:4, alignItems:'center' }}>
              {[0,1,2].map(j=><div key={j} style={{ width:5, height:5, background:'rgba(255,255,255,.3)', borderRadius:'50%', animation:`bounce ${0.6+j*0.15}s infinite alternate` }} />)}
            </div>
          </div>
        )}
        <div ref={chatEndRef} />
      </div>
      <div style={{ display:'flex', flexWrap:'wrap', gap:5, marginBottom:10 }}>
        {["What's our leave policy?","Remote work rules?","Onboarding checklist","Health benefits?"].map(q=>(
          <button key={q} onClick={()=>sendMessage(q)} style={{ fontSize:11, color:'rgba(255,255,255,.4)', background:'#161614', border:'1px solid rgba(255,255,255,.08)', borderRadius:100, padding:'4px 10px', cursor:'pointer', fontFamily:'Inter,sans-serif' }}>{q}</button>
        ))}
      </div>
      <div style={{ display:'flex', gap:8 }}>
        <input value={chatInput} onChange={e=>setChatInput(e.target.value)} onKeyDown={e=>e.key==='Enter'&&sendMessage(chatInput)} placeholder="Ask about HR policies…" style={s(inputSt, { flex:1, width:'auto' })} />
        <button onClick={()=>sendMessage(chatInput)} style={{ width:40, height:40, background:'#e2b04a', border:'none', borderRadius:8, display:'grid', placeItems:'center', cursor:'pointer', flexShrink:0 }}>
          <svg width="16" height="16" fill="none" stroke="#0a0a08" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 16 16"><path d="M14 8L2 3l3 5-3 5 12-5z"/></svg>
        </button>
      </div>
    </div>
  )

  const renderSettings = () => (
    <div style={{ padding:28, maxWidth:560 }}>
      <div style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:26, fontWeight:600, marginBottom:4 }}>Settings</div>
      <div style={{ fontSize:12, color:'rgba(255,255,255,.3)', marginBottom:24 }}>Manage your HR account preferences</div>
      <div style={s(card, { marginBottom:12 })}>
        <div style={{ fontSize:13, fontWeight:600, marginBottom:12 }}>Account</div>
        <div style={{ fontSize:12, color:'rgba(255,255,255,.4)', marginBottom:4 }}>Name</div>
        <input defaultValue={userName} style={s(inputSt, { marginBottom:10 })} />
        <div style={{ fontSize:12, color:'rgba(255,255,255,.4)', marginBottom:4 }}>Email</div>
        <input defaultValue={userEmail} disabled style={s(inputSt, { opacity:.5, cursor:'not-allowed', marginBottom:10 })} />
        <button style={{ fontSize:12, fontWeight:600, background:'#13c28e', color:'#fff', border:'none', borderRadius:8, padding:'9px 18px', cursor:'pointer', fontFamily:'Inter,sans-serif' }}>Save Changes</button>
      </div>
      <div style={s(card, { marginBottom:12 })}>
        <div style={{ fontSize:13, fontWeight:600, marginBottom:4 }}>Team Workspace</div>
        <div style={{ fontSize:12, color:'rgba(255,255,255,.3)', marginBottom:14 }}>Invite up to 5 teammates to share jobs and screening results.</div>
        {orgLoading ? (
          <div style={{ fontSize:13, color:'rgba(255,255,255,.3)' }}>Loading...</div>
        ) : !org ? (
          <div style={{ display:'flex', gap:10, flexWrap:'wrap' }}>
            <input value={newOrgName} onChange={e=>setNewOrgName(e.target.value)} placeholder="Workspace name (e.g. your company)"
              style={s(inputSt, { flex:'1 1 220px', marginBottom:0 })} />
            <button onClick={handleCreateOrg} disabled={creatingOrg}
              style={{ background:'#e2b04a', color:'#0a0a09', fontSize:13, fontWeight:700, padding:'9px 18px', borderRadius:8, border:'none', cursor:'pointer', fontFamily:'Inter,sans-serif', whiteSpace:'nowrap' }}>
              {creatingOrg ? 'Creating...' : 'Create Workspace'}
            </button>
          </div>
        ) : (
          <div>
            {editingOrgName ? (
              <div style={{ display:'flex', gap:8, marginBottom:4 }}>
                <input value={renameOrgValue} onChange={e=>setRenameOrgValue(e.target.value)} autoFocus
                  style={s(inputSt, { flex:1, padding:'6px 10px', fontSize:13, marginBottom:0 })} />
                <button onClick={handleRenameOrg} disabled={renamingOrg}
                  style={{ fontSize:11.5, fontWeight:700, color:'#13c28e', background:'none', border:'none', cursor:'pointer', fontFamily:'Inter,sans-serif' }}>Save</button>
                <button onClick={()=>setEditingOrgName(false)}
                  style={{ fontSize:11.5, color:'rgba(255,255,255,.4)', background:'none', border:'none', cursor:'pointer', fontFamily:'Inter,sans-serif' }}>Cancel</button>
              </div>
            ) : (
              <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:4 }}>
                <div style={{ fontSize:13, fontWeight:600 }}>{org.name}</div>
                {org.is_owner && (
                  <button onClick={()=>{setRenameOrgValue(org.name); setEditingOrgName(true)}}
                    style={{ fontSize:11, color:'rgba(255,255,255,.35)', background:'none', border:'none', cursor:'pointer', fontFamily:'Inter,sans-serif' }}>Rename</button>
                )}
              </div>
            )}
            <div style={{ fontSize:11.5, color:'rgba(255,255,255,.3)', marginBottom:14 }}>{org.seats_used} / {org.max_seats} seats used</div>
            {orgMembers.map((m:any) => (
              <div key={m.id} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'8px 0', borderTop:'1px solid rgba(255,255,255,.06)' }}>
                <div>
                  <span style={{ fontSize:13 }}>{m.name}</span>
                  <span style={{ fontSize:11.5, color:'rgba(255,255,255,.3)', marginLeft:8 }}>{m.email}</span>
                  {m.is_owner && <span style={{ fontSize:10, color:'#e2b04a', marginLeft:8, fontWeight:700 }}>OWNER</span>}
                </div>
                {org.is_owner && !m.is_owner && (
                  <button onClick={()=>handleRemoveMember(m.id)} style={{ fontSize:11.5, color:'#ef4444', background:'none', border:'none', cursor:'pointer', fontFamily:'Inter,sans-serif' }}>Remove</button>
                )}
              </div>
            ))}
            {org.is_owner && org.seats_used < org.max_seats && (
              <div style={{ display:'flex', gap:10, flexWrap:'wrap', marginTop:16 }}>
                <input value={inviteEmail} onChange={e=>setInviteEmail(e.target.value)} placeholder="teammate@company.com"
                  style={s(inputSt, { flex:'1 1 220px', marginBottom:0 })} />
                <button onClick={handleInvite} disabled={inviting}
                  style={{ background:'transparent', border:'1px solid rgba(255,255,255,.15)', color:'rgba(255,255,255,.85)', fontSize:13, fontWeight:600, padding:'9px 18px', borderRadius:8, cursor:'pointer', fontFamily:'Inter,sans-serif', whiteSpace:'nowrap' }}>
                  {inviting ? 'Sending...' : 'Send Invite'}
                </button>
              </div>
            )}
          </div>
        )}
        {orgMsg && <div style={{ fontSize:12, color:'#13c28e', marginTop:12 }}>{orgMsg}</div>}
        {orgError && <div style={{ fontSize:12, color:'#ef4444', marginTop:12 }}>{orgError}</div>}
      </div>
      <div style={card}>
        <div style={{ fontSize:13, fontWeight:600, marginBottom:12 }}>Danger Zone</div>
        <button onClick={handleLogout} style={{ fontSize:12, fontWeight:600, background:'rgba(239,68,68,.1)', color:'#ef4444', border:'1px solid rgba(239,68,68,.2)', borderRadius:8, padding:'9px 18px', cursor:'pointer', fontFamily:'Inter,sans-serif' }}>Logout</button>
      </div>
    </div>
  )

  const renderProfile = () => (
    <div style={{ padding:28, maxWidth:560 }}>
      <div style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:26, fontWeight:600, marginBottom:24 }}>Profile</div>
      <div style={s(card, { display:'flex', alignItems:'center', gap:16, marginBottom:16 })}>
        <div style={{ width:56, height:56, borderRadius:'50%', background:'linear-gradient(135deg,#0b7c5e,#13c28e)', display:'grid', placeItems:'center', fontSize:20, fontWeight:700, color:'#fff', flexShrink:0 }}>HR</div>
        <div>
          <div style={{ fontSize:18, fontWeight:600 }}>{userName}</div>
          <div style={{ fontSize:13, color:'rgba(255,255,255,.35)' }}>{userEmail}</div>
          <span style={{ fontSize:10, fontWeight:600, background:'rgba(59,130,246,.12)', color:'#3b82f6', padding:'3px 8px', borderRadius:100, border:'1px solid rgba(59,130,246,.2)', display:'inline-block', marginTop:6 }}>Trial Plan</span>
        </div>
      </div>
      <div style={card}>
        <div style={{ fontSize:12, fontWeight:600, color:'rgba(255,255,255,.4)', marginBottom:12 }}>Activity</div>
        {[
          { l:'Total Screenings', v: String(totalProcessed) },
          { l:'Candidates Shortlisted', v: String(history.filter(h=>h.status==='shortlisted').length) },
          { l:'Candidates Rejected', v: String(history.filter(h=>h.status==='rejected').length) },
        ].map(r=>(
          <div key={r.l} style={{ display:'flex', justifyContent:'space-between', padding:'10px 0', borderBottom:'1px solid rgba(255,255,255,.05)' }}>
            <span style={{ fontSize:13, color:'rgba(255,255,255,.5)' }}>{r.l}</span>
            <span style={{ fontSize:13, fontWeight:600 }}>{r.v}</span>
          </div>
        ))}
      </div>
    </div>
  )

  const renderInterviewer = () => (
    <div style={{ padding:28, overflowY:'auto', height:'100%' }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:4 }}>
        <div>
          <div style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:26, fontWeight:600, marginBottom:4 }}>AI Interviewer</div>
          <div style={{ fontSize:12, color:'rgba(255,255,255,.3)' }}>Paste a JD, get a shareable link, let candidates interview themselves</div>
        </div>
        <button onClick={()=>{ setShowInterviewForm(v=>!v); setIError('') }}
          style={{ padding:'10px 18px', borderRadius:8, border:'none', background:'#e2b04a', color:'#0a0a08', fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:'Inter,sans-serif' }}>
          {showInterviewForm ? 'Cancel' : '+ New Interview Link'}
        </button>
      </div>

      {showInterviewForm && (
        <div style={s(card, { marginTop:20, marginBottom:24 })}>
          <div style={{ fontSize:13, fontWeight:600, marginBottom:14 }}>New AI Interview</div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:10 }}>
            <input placeholder="Role title (e.g. Backend Engineer)" value={iTitle} onChange={e=>setITitle(e.target.value)} style={inputSt} />
            <input placeholder="Company (optional)" value={iCompany} onChange={e=>setICompany(e.target.value)} style={inputSt} />
          </div>
          <input placeholder="Interviewer name (optional — e.g. Kelly, Alex). Leave blank for a random one."
            value={iInterviewerName} onChange={e=>setIInterviewerName(e.target.value)} style={s(inputSt, { marginBottom:10 })} />
          <textarea placeholder="Paste the full job description here..." value={iJD} onChange={e=>setIJD(e.target.value)}
            style={s(inputSt, { minHeight:130, resize:'vertical', marginBottom:10, fontFamily:'Inter,sans-serif' })} />
          <textarea placeholder={"Extra questions HR wants covered (optional, one per line)\ne.g. Are you willing to relocate to Lahore?\nWhat's your notice period?"}
            value={iExtraQuestions} onChange={e=>setIExtraQuestions(e.target.value)}
            style={s(inputSt, { minHeight:70, resize:'vertical', marginBottom:10, fontFamily:'Inter,sans-serif' })} />
          {iError && <div style={{ fontSize:12, color:'#ef4444', marginBottom:10 }}>{iError}</div>}
          <button onClick={createInterviewPosting} disabled={iSaving}
            style={{ padding:'10px 20px', borderRadius:8, border:'none', background:'#13c28e', color:'#0a0a08', fontSize:13, fontWeight:700, cursor: iSaving?'default':'pointer', opacity: iSaving ? 0.6 : 1, fontFamily:'Inter,sans-serif' }}>
            {iSaving ? 'Creating...' : 'Continue → Generate Link'}
          </button>
        </div>
      )}

      {interviewPostingsLoading && <div style={{ fontSize:13, color:'rgba(255,255,255,.3)', marginTop:20 }}>Loading...</div>}
      {!interviewPostingsLoading && interviewPostings.length === 0 && !showInterviewForm && (
        <div style={s(card, { textAlign:'center', padding:40, color:'rgba(255,255,255,.3)', marginTop:20 })}>
          No interview links yet. Create one to start screening candidates conversationally.
        </div>
      )}

      {interviewPostings.length > 0 && (
        <div style={{ display:'flex', gap:20, height:'calc(100% - 100px)', overflow:'hidden', marginTop: showInterviewForm ? 0 : 12 }}>
          {/* Posting list */}
          <div style={{ width:300, flexShrink:0, overflowY:'auto' }}>
            {interviewPostings.map((p:any) => (
              <div key={p.id} onClick={()=>openPosting(p)}
                style={s(card, { marginBottom:8, cursor:'pointer',
                  border:`1px solid ${selectedPosting?.id===p.id?'rgba(255,255,255,.15)':'rgba(255,255,255,.06)'}`,
                  background: selectedPosting?.id===p.id?'#161614':'#111110' })}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
                  <div style={{ fontSize:13, fontWeight:600, marginBottom:4 }}>{p.title}</div>
                  <span style={{ fontSize:9, fontWeight:700, padding:'2px 7px', borderRadius:100,
                    background: p.is_active ? 'rgba(19,194,142,.12)' : 'rgba(255,255,255,.06)',
                    color: p.is_active ? '#13c28e' : 'rgba(255,255,255,.35)' }}>{p.is_active ? 'ACTIVE' : 'PAUSED'}</span>
                </div>
                {p.company && <div style={{ fontSize:11, color:'rgba(255,255,255,.3)', marginBottom:2 }}>{p.company}</div>}
                <div style={{ fontSize:11, color:'rgba(255,255,255,.3)', marginBottom:8 }}>Interviewer: {p.interviewer_name} · {p.candidate_count} candidate{p.candidate_count===1?'':'s'} interviewed</div>
                <div style={{ display:'flex', gap:6 }}>
                  <button onClick={(e)=>{e.stopPropagation(); copyInterviewLink(p.public_link, p.public_slug)}}
                    style={{ flex:1, padding:'6px 10px', borderRadius:6, border:'1px solid rgba(255,255,255,.1)', background:'transparent', color:'rgba(255,255,255,.6)', fontSize:11, cursor:'pointer', fontFamily:'Inter,sans-serif' }}>
                    {copiedSlug===p.public_slug ? '✓ Copied' : 'Copy Public Link'}
                  </button>
                  <button onClick={(e)=>{e.stopPropagation(); deleteInterviewPosting(p.id)}}
                    style={{ padding:'6px 10px', borderRadius:6, border:'1px solid rgba(239,68,68,.2)', background:'rgba(239,68,68,.06)', color:'#ef4444', fontSize:11, cursor:'pointer', fontFamily:'Inter,sans-serif' }}>
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Candidates / report */}
          <div style={{ flex:1, overflowY:'auto' }}>
            {!selectedPosting ? (
              <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100%', color:'rgba(255,255,255,.2)', fontSize:13 }}>
                Select an interview link to see candidates
              </div>
            ) : selectedReport ? (
              <div>
                <button onClick={()=>setSelectedReport(null)} style={{ background:'none', border:'none', color:'rgba(255,255,255,.4)', fontSize:12, cursor:'pointer', marginBottom:14, padding:0, fontFamily:'Inter,sans-serif' }}>← Back to candidates</button>
                <div style={{ display:'flex', alignItems:'center', gap:14, marginBottom:16 }}>
                  <div>
                    <div style={{ fontSize:18, fontWeight:600 }}>{selectedReport.candidate_name}</div>
                    <div style={{ fontSize:12, color:'rgba(255,255,255,.3)' }}>{selectedReport.candidate_email}</div>
                  </div>
                  {selectedReport.ai_score != null && (
                    <div style={{ marginLeft:'auto', fontFamily:"'Cormorant Garamond',serif", fontSize:32, fontWeight:600,
                      color: selectedReport.ai_score>=80?'#13c28e':selectedReport.ai_score>=60?'#e2b04a':'#ef4444' }}>{selectedReport.ai_score}</div>
                  )}
                </div>
                {selectedReport.final_verdict && (
                  <div style={{ display:'inline-block', fontSize:11, fontWeight:700, padding:'4px 12px', borderRadius:100, marginBottom:16,
                    background:'rgba(255,255,255,.06)', color:'rgba(255,255,255,.7)' }}>{selectedReport.final_verdict}</div>
                )}
                {selectedReport.status !== 'completed' && (
                  <div style={s(card, { marginBottom:14, color:'#e2b04a', fontSize:12 })}>Interview still in progress — candidate hasn't finished yet.</div>
                )}
                {selectedReport.experience_assessment && (
                  <div style={s(card, { marginBottom:14 })}>
                    <div style={{ fontSize:12, fontWeight:600, color:'rgba(255,255,255,.4)', marginBottom:6 }}>Experience Assessment</div>
                    <div style={{ fontSize:13, color:'rgba(255,255,255,.6)', lineHeight:1.7 }}>{selectedReport.experience_assessment}</div>
                  </div>
                )}
                {selectedReport.deep_analysis && (
                  <div style={s(card, { marginBottom:14 })}>
                    <div style={{ fontSize:12, fontWeight:600, color:'rgba(255,255,255,.4)', marginBottom:6 }}>Deep Analysis</div>
                    <div style={{ fontSize:13, color:'rgba(255,255,255,.6)', lineHeight:1.7 }}>{selectedReport.deep_analysis}</div>
                  </div>
                )}
                <div style={s(card, {})}>
                  <div style={{ fontSize:12, fontWeight:600, color:'rgba(255,255,255,.4)', marginBottom:10 }}>Full Transcript</div>
                  {(selectedReport.transcript || []).map((t:any, i:number) => (
                    <div key={i} style={{ marginBottom:10 }}>
                      <div style={{ fontSize:10, fontWeight:700, color: t.role==='assistant' ? '#e2b04a' : '#13c28e', marginBottom:2 }}>
                        {t.role==='assistant' ? 'AI Interviewer' : selectedReport.candidate_name}
                      </div>
                      <div style={{ fontSize:12, color:'rgba(255,255,255,.6)', lineHeight:1.6 }}>{t.content}</div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <>
                <div style={{ fontSize:18, fontWeight:600, marginBottom:4 }}>{selectedPosting.title}</div>
                <div style={{ fontSize:12, color:'rgba(255,255,255,.3)', marginBottom:20 }}>{selectedPosting.public_link}</div>
                {interviewCandidatesLoading && <div style={{ fontSize:13, color:'rgba(255,255,255,.3)' }}>Loading...</div>}
                {!interviewCandidatesLoading && interviewCandidates.length === 0 && (
                  <div style={s(card, { textAlign:'center', padding:30, color:'rgba(255,255,255,.3)' })}>
                    No candidates yet. Share the public link to start getting interviews.
                  </div>
                )}
                {interviewCandidates.map((c:any) => (
                  <div key={c.id} onClick={()=>{ if (c.status==='completed') api.getInterviewSessionReport(c.id).then(setSelectedReport) }}
                    style={s(card, { marginBottom:8, cursor: c.status==='completed' ? 'pointer' : 'default' })}>
                    <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                      <div style={{ width:30, height:30, borderRadius:'50%', background:'linear-gradient(135deg,#0b7c5e,#13c28e)', display:'grid', placeItems:'center', fontSize:11, fontWeight:700, color:'#fff' }}>
                        {initials(c.candidate_name)}
                      </div>
                      <div style={{ flex:1 }}>
                        <div style={{ fontSize:13, fontWeight:600 }}>{c.candidate_name}</div>
                        <div style={{ fontSize:11, color:'rgba(255,255,255,.3)' }}>
                          {c.status==='completed' ? (c.final_verdict || 'Completed') : 'In progress...'}
                        </div>
                      </div>
                      {c.ai_score != null && (
                        <div style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:22, fontWeight:600, color: c.ai_score>=80?'#13c28e':c.ai_score>=60?'#e2b04a':'#ef4444' }}>{c.ai_score}</div>
                      )}
                    </div>
                  </div>
                ))}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )

  const renderSection = () => {
    switch(section) {
      case 'dashboard': return renderDashboard()
      case 'bulk': return renderBulk()
      case 'candidates': return renderCandidates(activeCandidates, 'All Candidates', 'Run a bulk screening to see candidates here.')
      case 'shortlist': return renderCandidates(shortlistedList, 'Shortlisted', 'No candidates shortlisted yet. Go to All Candidates and shortlist the ones you like.')
      case 'chatbot': return renderChatbot()
      case 'history': return renderHistory()
      case 'open-roles': return renderInterviewer()
      case 'settings': return renderSettings()
      case 'profile': return renderProfile()
      default: return renderDashboard()
    }
  }

  return (
    <div style={s(base, { display:'flex', height:'100vh', overflow:'hidden' })}>
      <style dangerouslySetInnerHTML={{ __html: `@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}} @keyframes bounce{from{transform:translateY(0)}to{transform:translateY(-4px)}} @keyframes pulse{0%,100%{opacity:.35}50%{opacity:.8}}` }} />
      {/* SIDEBAR */}
      <div style={{ width:224, flexShrink:0, background:'#0c0c0b', borderRight:'1px solid rgba(255,255,255,.05)', display:'flex', flexDirection:'column' }}>
        <Link href="/" style={{ padding:'22px 20px', borderBottom:'1px solid rgba(255,255,255,.05)', display:'flex', alignItems:'center', gap:10, textDecoration:'none' }}>
          <div style={{ width:28, height:28, background:'#e2b04a', borderRadius:7, display:'grid', placeItems:'center' }}>
            <svg width="12" height="12" viewBox="0 0 16 16" fill="#0a0a08"><path d="M8 2C4.68 2 2 4.68 2 8c0 1.76.72 3.35 1.88 4.5L8 8.5l4.12 4A5.97 5.97 0 0014 8c0-3.32-2.68-6-6-6z"/></svg>
          </div>
          <span style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:20, fontWeight:600, color:'rgba(255,255,255,.9)' }}>Talent</span>
          <span style={{ fontSize:10, fontWeight:700, background:'rgba(19,194,142,.12)', color:'#13c28e', padding:'3px 8px', borderRadius:100, marginLeft:'auto', border:'1px solid rgba(19,194,142,.18)' }}>HR</span>
        </Link>
        <div style={{ padding:'20px 16px 6px', fontSize:9, fontWeight:700, letterSpacing:'.14em', textTransform:'uppercase', color:'rgba(255,255,255,.18)' }}>Workspace</div>
        <div style={{ flex:1, overflowY:'auto' }}>
          {NAV.map(n=>(
            <button key={n.id} onClick={()=>setSection(n.id as Section)}
              style={{ display:'flex', alignItems:'center', gap:10, padding:'8px 16px', borderRadius:6, fontSize:12, fontWeight:500, letterSpacing:'.01em',
                color: section===n.id?'rgba(255,255,255,.88)':'rgba(255,255,255,.38)', cursor:'pointer', transition:'all .15s',
                margin:'0 6px 2px', border: section===n.id?'1px solid rgba(255,255,255,.08)':'1px solid transparent',
                background: section===n.id?'rgba(255,255,255,.04)':'transparent',
                fontFamily:'Inter,sans-serif', width:'calc(100% - 12px)', textAlign:'left' }}>
              {n.label}
              {'badge' in n && n.badge ? <span style={{ marginLeft:'auto', minWidth:18, height:18, borderRadius:9, background:'rgba(19,194,142,.15)', color:'#13c28e', fontSize:10, fontWeight:700, display:'grid', placeItems:'center', padding:'0 4px' }}>{n.badge}</span> : null}
            </button>
          ))}
        </div>
        <div style={{ padding:14, borderTop:'1px solid rgba(255,255,255,.07)' }}>
          <div style={{ display:'flex', alignItems:'center', gap:10, padding:'8px 10px', borderRadius:8 }}>
            <div style={{ width:30, height:30, borderRadius:'50%', background:'linear-gradient(135deg,#0b7c5e,#13c28e)', display:'grid', placeItems:'center', fontSize:11, fontWeight:700, color:'#fff', flexShrink:0 }}>HR</div>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ fontSize:12, fontWeight:600, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{userName}</div>
              <div style={{ fontSize:10, color:'rgba(255,255,255,.3)', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{userEmail}</div>
            </div>
          </div>
          <button onClick={handleLogout} style={{ width:'100%', marginTop:6, display:'flex', alignItems:'center', justifyContent:'center', gap:8, padding:'8px', borderRadius:8, border:'1px solid rgba(239,68,68,.15)', background:'rgba(239,68,68,.06)', color:'#ef4444', fontSize:12, fontWeight:600, cursor:'pointer', fontFamily:'Inter,sans-serif' }}>
            <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9"/></svg>
            Logout
          </button>
        </div>
      </div>

      {/* MAIN CONTENT */}
      <div style={{ flex:1, overflowY: section==='history'||section==='chatbot'?'hidden':'auto', background:'#0a0a09' }}>
        {renderSection()}
      </div>
    </div>
  )
}