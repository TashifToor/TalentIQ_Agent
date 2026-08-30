'use client'
import { useState, useRef, useEffect, useMemo } from 'react'
import Link from 'next/link'
import { api, clearAuthState } from '@/lib/api'
import InterviewBuilderWizard from '@/components/interviews/InterviewBuilderWizard'
import CopilotPanel from '@/components/modules/copilot/CopilotPanel'
import TalentIntelligencePanel from '@/components/modules/talent-intelligence/TalentIntelligencePanel'
import TalentPoolPanel from '@/components/modules/talent-intelligence/TalentPoolPanel'
import AIFeedbackReport from '@/components/modules/reports/AIFeedbackReport'
import NotificationBell from '@/components/NotificationBell'
import NotificationToasts from '@/components/NotificationToasts'
import { NotificationProvider } from '@/components/NotificationProvider'
import ActivityTimeline from '@/components/ActivityTimeline'
import { useBrowserNotificationPermission } from '@/lib/useBrowserNotificationPermission'

type Candidate = {
  filename: string
  candidate_name?: string
  candidate_email?: string
  application_id?: string
  job_id?: string
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
type Section = 'dashboard' | 'candidates' | 'bulk' | 'talent-pool' | 'shortlist' | 'chatbot' | 'history' | 'open-roles' | 'settings' | 'profile' | 'activity'

const STEP_ICONS = ['📋', '💪', '⚠️', '✅']
const STEP_COLORS_C = ['#4f46e5', '#e2b04a', '#ef4444', '#13c28e']
const COLORS = ['#4f46e5', '#e2b04a', '#ef4444', '#13c28e']

function AnalysisCarousel({ text }: { text: string }) {
  const [active, setActive] = useState(0)
  const steps = (text || '').split(/\n(?=\*\*Step)/).filter(Boolean).map((block: string) => {
    const m = block.match(/^\*\*(.+?)\*\*/)
    return { heading: m ? m[1].replace(/^Step \d+:\s*/, '') : 'Analysis', body: block.replace(/^\*\*(.+?)\*\*/, '').replace(/^\n+/, '').trim() }
  })
  if (!steps.length) return <div style={{ fontSize: 12, color: '#7a7468' }}>No analysis available.</div>
  return (
    <div>
      <div style={{ display: 'flex', gap: 5, marginBottom: 10, flexWrap: 'wrap' }}>
        {steps.map((s, i) => (
          <button key={i} onClick={(e) => { e.stopPropagation(); setActive(i) }} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 10px', borderRadius: 100, fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'Inter,sans-serif', border: `1px solid ${active === i ? STEP_COLORS_C[i % 4] : '#9c9689'}`, background: active === i ? `${STEP_COLORS_C[i % 4]}18` : 'transparent', color: active === i ? STEP_COLORS_C[i % 4] : '#7a7468', transition: 'all .2s' }}>
            <span>{STEP_ICONS[i % 4]}</span> {s.heading}
          </button>
        ))}
      </div>
      <div style={{ padding: '14px 16px', background: 'rgba(10,10,9,.035)', borderRadius: 10, borderLeft: `3px solid ${STEP_COLORS_C[active % 4]}` }}>
        <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 6, color: '#1f1c17' }}>{steps[active]?.heading}</div>
        <p style={{ fontSize: 12, color: '#5c574c', lineHeight: 1.8, margin: 0, whiteSpace: 'pre-wrap' }}>{steps[active]?.body}</p>
      </div>
      <div style={{ display: 'flex', justifyContent: 'center', gap: 5, marginTop: 10 }}>
        {steps.map((_, i) => <div key={i} onClick={(e) => { e.stopPropagation(); setActive(i) }} style={{ width: active === i ? 18 : 5, height: 5, borderRadius: 3, background: active === i ? STEP_COLORS_C[i % 4] : '#9c9689', cursor: 'pointer', transition: 'all .3s' }} />)}
      </div>
    </div>
  )
}
const s = (base: object, ...rest: object[]) => Object.assign({}, base, ...rest)

function initials(name: string) {
  return name.replace(/\.(pdf|PDF)$/, '').split(/[\s_-]+/).filter(Boolean).slice(0, 2).map(w => w[0]?.toUpperCase()).join('') || '??'
}

// Buckets a real timestamp into a scannable date group. Falls back to "Earlier" rather than guessing.
function dateGroupFor(dateStr: string | null | undefined): string {
  if (!dateStr) return 'Earlier'
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return 'Earlier'
  const startOfDay = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate())
  const diffDays = Math.round((startOfDay(new Date()).getTime() - startOfDay(d).getTime()) / 86400000)
  if (diffDays <= 0) return 'Today'
  if (diffDays === 1) return 'Yesterday'
  if (diffDays <= 7) return 'This Week'
  return 'Earlier'
}
const HISTORY_GROUP_ORDER = ['Today', 'Yesterday', 'This Week', 'Earlier']
function groupByDate<T>(items: T[], getDate: (item: T) => string | null | undefined): { group: string; items: T[] }[] {
  const map = new Map<string, T[]>()
  for (const item of items) {
    const g = dateGroupFor(getDate(item))
    if (!map.has(g)) map.set(g, [])
    map.get(g)!.push(item)
  }
  return HISTORY_GROUP_ORDER.map(g => ({ group: g, items: map.get(g) || [] })).filter(g => g.items.length > 0)
}
function normalize(q: string) { return q.trim().toLowerCase().replace(/\s+/g, ' ') }

function ScoreChip({ score }: { score: number }) {
  const color = score >= 80 ? '#13c28e' : score >= 60 ? '#e2b04a' : '#ef4444'
  return <div style={{ fontFamily: "Inter, sans-serif", fontSize: 22, fontWeight: 600, color }}>{score}</div>
}

function SkillTags({ matched, missing }: { matched: string[], missing: string[] }) {
  const all = [...matched.slice(0, 3), ...missing.slice(0, 2)]
  const mset = new Set(matched)
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 8 }}>
      {all.map(sk => (
        <span key={sk} style={{
          fontSize: 10, padding: '3px 8px', borderRadius: 100,
          background: mset.has(sk) ? 'rgba(19,194,142,.1)' : '#f0eee6',
          color: mset.has(sk) ? '#13c28e' : '#7a7468',
          border: `1px solid ${mset.has(sk) ? 'rgba(19,194,142,.2)' : '#9c9689'}`
        }}>
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
  useBrowserNotificationPermission()
  const [section, setSection] = useState<Section>('dashboard')

  // Deep-link support so notification click-throughs (?section=candidates
  // etc.) actually land somewhere real instead of always the default tab.
  useEffect(() => {
    if (typeof window === 'undefined') return
    const s = new URLSearchParams(window.location.search).get('section') as Section | null
    const valid: Section[] = ['dashboard', 'candidates', 'bulk', 'talent-pool', 'shortlist', 'chatbot', 'history', 'open-roles', 'settings', 'profile', 'activity']
    if (s && valid.includes(s)) setSection(s)
  }, [])
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
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
  const [historyTab, setHistoryTab] = useState<'screenings' | 'interviews' | 'actions'>('screenings')
  const [scanHistory, setScanHistory] = useState<any[]>([])
  const [scanHistoryLoading, setScanHistoryLoading] = useState(false)
  const [interviewHistory, setInterviewHistory] = useState<any[]>([])
  const [interviewHistoryLoading, setInterviewHistoryLoading] = useState(false)
  const [scanHistorySelected, setScanHistorySelected] = useState<any>(null)
  const [interviewHistorySelected, setInterviewHistorySelected] = useState<any>(null)
  const [interviewReport, setInterviewReport] = useState<any>(null)
  const [interviewReportLoading, setInterviewReportLoading] = useState(false)
  const [historySearch, setHistorySearch] = useState('')
  const [historyVerdictFilter, setHistoryVerdictFilter] = useState<string | null>(null)
  const [historyDrawerOpen, setHistoryDrawerOpen] = useState(false)

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
  const [selectedRanking, setSelectedRanking] = useState<any>(null)
  const [showRanking, setShowRanking] = useState(false)
  const [showInterviewForm, setShowInterviewForm] = useState(false)
  const [copiedSlug, setCopiedSlug] = useState('')
  const [interviewError, setInterviewError] = useState('')

  // Policy docs state
  const [policyDocs, setPolicyDocs] = useState<{ filename: string, size_kb: number }[]>([])
  const [policyUploading, setPolicyUploading] = useState(false)
  const policyFileRef = useRef<HTMLInputElement>(null)

  // Chatbot state
  const [messages, setMessages] = useState([
    { role: 'bot', text: "Hi! I'm your HR Policy assistant. Ask me anything about company policies, leave, benefits, or onboarding." }
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
  const [showDeleteAccount, setShowDeleteAccount] = useState(false)
  const [deleteAccountPassword, setDeleteAccountPassword] = useState('')
  const [deleteAccountError, setDeleteAccountError] = useState('')
  const [deletingAccount, setDeletingAccount] = useState(false)

  const loadOrg = () => {
    setOrgLoading(true)
    api.getMyOrg().then((data: any) => {
      setOrg(data.organization)
      setOrgMembers(data.members || [])
    }).catch(() => { }).finally(() => setOrgLoading(false))
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

  const handleDeleteOrg = async () => {
    if (!confirm('Delete this workspace permanently? All teammates will be removed and you can create a new workspace afterward.')) return
    setOrgError('')
    try {
      await api.deleteOrg()
      setOrg(null)
      setOrgMembers([])
      loadOrg()
    } catch (e: any) {
      setOrgError(e.message || 'Could not delete workspace.')
    }
  }

  const handleDeleteAccount = async () => {
    if (!deleteAccountPassword) { setDeleteAccountError('Enter your password to confirm.'); return }
    setDeletingAccount(true)
    setDeleteAccountError('')
    try {
      await api.deleteAccount(deleteAccountPassword)
      clearAuthState()
      window.location.href = '/'
    } catch (e: any) {
      setDeleteAccountError(e.message || 'Could not delete account.')
    } finally {
      setDeletingAccount(false)
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
      .then((r: any) => setInterviewPostings(Array.isArray(r) ? r : []))
      .catch(() => setInterviewPostings([]))
      .finally(() => setInterviewPostingsLoading(false))
  }

  const openPosting = (posting: any) => {
    setSelectedPosting(posting)
    setSelectedReport(null)
    setSelectedRanking(null)
    setShowRanking(false)
    setInterviewCandidatesLoading(true)
    api.getInterviewCandidates(posting.id)
      .then((r: any) => setInterviewCandidates(Array.isArray(r) ? r : []))
      .catch(() => setInterviewCandidates([]))
      .finally(() => setInterviewCandidatesLoading(false))
  }

  const handleInterviewCreated = (posting: any) => {
    setShowInterviewForm(false)
    loadInterviewPostings()
    openPosting(posting)
  }

  const deleteInterviewPosting = async (postingId: string) => {
    if (!confirm('Delete this interview link permanently? All candidate transcripts and reports for it will be lost too.')) return
    try {
      await api.deleteInterviewPosting(postingId)
      if (selectedPosting?.id === postingId) { setSelectedPosting(null); setSelectedReport(null); setSelectedRanking(null) }
      loadInterviewPostings()
    } catch (e: any) {
      setInterviewError(e?.message || 'Could not delete interview link.')
    }
  }

  const copyInterviewLink = (link: string, slug: string) => {
    navigator.clipboard.writeText(link).then(() => {
      setCopiedSlug(slug)
      setTimeout(() => setCopiedSlug(''), 1800)
    })
  }

  useEffect(() => {
    api.me().then((u: any) => {
      setUserName(u?.name || u?.full_name || 'HR Manager')
      setUserEmail(u?.email || '')
    }).catch(() => { })
    setHistory(loadHistory())
    api.listPolicyDocs().then((r: any) => setPolicyDocs(r.documents || [])).catch(() => { })

    setDbJobsLoading(true)
    api.getHRJobs()
      .then((jobs: any) => setDbJobs(Array.isArray(jobs) ? jobs : []))
      .catch(() => setDbJobs([]))
      .finally(() => setDbJobsLoading(false))

    loadInterviewPostings()
    loadOrg()

    setScanHistoryLoading(true)
    api.getScanHistory()
      .then((r: any) => setScanHistory(Array.isArray(r) ? r : []))
      .catch(() => setScanHistory([]))
      .finally(() => setScanHistoryLoading(false))

    setInterviewHistoryLoading(true)
    api.getAllInterviewCandidates()
      .then((r: any) => setInterviewHistory(Array.isArray(r) ? r.filter((c: any) => c.status === 'completed') : []))
      .catch(() => setInterviewHistory([]))
      .finally(() => setInterviewHistoryLoading(false))
  }, [])

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages, typing])

  const handleLogout = () => {
    clearAuthState()
    window.location.replace('/auth/login/hr')
  }

  const uploadPolicyDoc = async (file: File) => {
    setPolicyUploading(true)
    try {
      await api.uploadPolicyDoc(file)
      const r: any = await api.listPolicyDocs()
      setPolicyDocs(r.documents || [])
    } catch (e: any) { alert(e.message || 'Upload failed') }
    finally { setPolicyUploading(false) }
  }

  const exportCSV = () => {
    if (!candidates.length) return
    const headers = ['Rank', 'Filename', 'Score', 'Verdict', 'Matched Skills', 'Missing Skills']
    const rows = candidates.map((c, i) => [
      i + 1, c.filename, c.ai_score, c.final_verdict || '',
      (c.matched_skills || []).join('; '), (c.missing_skills || []).join('; ')
    ])
    const csv = [headers, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url
    a.download = `${jobTitle || 'screening'}_${new Date().toLocaleDateString('en-GB').replace(/\//g, '-')}.csv`
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

  // ── Shortlist / Reject — persists to the real Application record when one exists (bulk-screened candidates) ──
  const markCandidate = (idx: number, status: 'shortlisted' | 'rejected') => {
    const c = candidates[idx]
    if (!c) return
    const entry: HistoryEntry = { ...c, status, jobTitle: jobTitle || 'Unknown Role', screenedAt: c.screenedAt || new Date().toLocaleString() }
    const updated = [...candidates]
    updated[idx] = { ...c, status }
    setCandidates(updated)
    // Save to history
    const newHistory = [entry, ...history.filter(h => !(h.filename === c.filename && h.jobTitle === entry.jobTitle))]
    setHistory(newHistory); saveHistory(newHistory)
    if (c.application_id) {
      api.updateApplication(c.application_id, status === 'shortlisted' ? 'shortlist' : 'reject').catch(() => {})
    }
  }

  const undoMark = (idx: number) => {
    const c = candidates[idx]
    const updated = [...candidates]; updated[idx] = { ...c, status: 'active' }; setCandidates(updated)
    if (c?.application_id) {
      api.updateApplication(c.application_id, 'reset').catch(() => {})
    }
  }

  // ── Move to Interview — reuses an existing interview posting's real public link, never a second interview system ──
  const [moveToInterviewFor, setMoveToInterviewFor] = useState<number | null>(null)
  const [moveEmailInput, setMoveEmailInput] = useState('')
  const [movePostingId, setMovePostingId] = useState('')
  const [moveResult, setMoveResult] = useState<{ idx: number; link: string; emailed: boolean } | null>(null)
  const [moveError, setMoveError] = useState('')
  const [moveLoading, setMoveLoading] = useState(false)

  const submitMoveToInterview = async (idx: number) => {
    const c = candidates[idx]
    if (!c?.application_id || !movePostingId) return
    setMoveLoading(true)
    setMoveError('')
    try {
      const res: any = await api.moveApplicationToInterview(c.application_id, movePostingId, moveEmailInput || c.candidate_email)
      setMoveResult({ idx, link: res.public_link, emailed: res.emailed })
      const updated = [...candidates]
      updated[idx] = { ...c, trigger_interview: true, candidate_email: res.candidate_email }
      setCandidates(updated)
      setMoveToInterviewFor(null)
    } catch (e: any) {
      setMoveError(e?.message || 'Could not move this candidate to interview.')
    } finally {
      setMoveLoading(false)
    }
  }

  // ── Chatbot ──
  const sendMessage = async (msg: string) => {
    if (!msg.trim()) return
    setMessages(m => [...m, { role: 'user', text: msg }]); setChatInput(''); setTyping(true)
    try {
      const res: any = await api.hrChat(msg)
      setMessages(m => [...m, { role: 'bot', text: res?.answer || 'No answer found.' }])
    } catch (e: any) {
      setMessages(m => [...m, { role: 'bot', text: `Error: ${e.message || 'Could not reach policy assistant.'}` }])
    } finally { setTyping(false) }
  }

  // ── Derived ──
  const activeCandidates = candidates.filter(c => !c.status || c.status === 'active')
  const shortlistedList = candidates.filter(c => c.status === 'shortlisted')
  const rejectedList = candidates.filter(c => c.status === 'rejected')
  const avgScore = candidates.length ? Math.round(candidates.reduce((s, c) => s + (c.ai_score || 0), 0) / candidates.length) : 0

  // ── Styles ──
  const base = { background: '#f7f5f0', fontFamily: 'Inter, sans-serif', color: '#1f1c17' }
  const card = { background: '#ffffff', border: '1px solid #e7e4da', borderRadius: 8, padding: 16 }
  const inputSt = { background: '#faf9f5', border: '1px solid #e7e4da', borderRadius: 8, padding: '10px 12px', fontSize: 13, fontFamily: 'Inter, sans-serif', color: '#1f1c17', outline: 'none', width: '100%' }

  // ── Nav ──
  const NAV = [
    { id: 'dashboard', icon: '', label: 'Dashboard' },
    { id: 'candidates', icon: '', label: 'All Candidates', badge: candidates.length || undefined },
    { id: 'bulk', icon: '', label: 'Bulk Screen' },
    { id: 'talent-pool', icon: '', label: 'Talent Pool' },
    { id: 'open-roles', icon: '', label: 'AI Interviewer', badge: interviewPostings.length || undefined },
    { id: 'shortlist', icon: '', label: 'Shortlist', badge: shortlistedList.length || undefined },
    { id: 'chatbot', icon: '', label: 'Policy Chatbot' },
    { id: 'history', icon: '', label: 'History', badge: history.length || undefined },
    { id: 'activity', icon: '', label: 'Activity' },
    { id: 'settings', icon: '', label: 'Settings' },
    { id: 'profile', icon: '', label: 'Profile' },
  ] as const

  // ══════════════ SECTION RENDERERS ══════════════

  const CandidateCard = ({ c, idx, showActions = true }: { c: Candidate, idx: number, showActions?: boolean }) => {
    const displayName = c.candidate_name || c.filename
    const av = initials(displayName)
    const color = COLORS[idx % COLORS.length]
    return (
      <div onClick={() => setSelectedKey(selectedKey === c.filename ? null : c.filename)}
        style={s(card, {
          cursor: 'pointer', transition: 'all .2s', marginBottom: 8,
          border: `1px solid ${selectedKey === c.filename ? 'rgba(19,194,142,.25)' : '#9c9689'}`,
          background: selectedKey === c.filename ? 'rgba(19,194,142,.06)' : '#ffffff', position: 'relative'
        })}>
        {idx < 3 && <div style={{ position: 'absolute', top: 10, left: -1, width: 22, height: 22, borderRadius: '0 6px 6px 0', display: 'grid', placeItems: 'center', fontSize: 10, fontWeight: 700, background: idx === 0 ? '#c5931f' : 'rgba(10,10,9,.09)', color: idx === 0 ? '#0a0a08' : '#7a7468' }}>#{idx + 1}</div>}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, paddingLeft: idx < 3 ? 16 : 0, marginBottom: 6 }}>
          <div style={{ width: 32, height: 32, borderRadius: '50%', background: `linear-gradient(135deg,${color})`, display: 'grid', placeItems: 'center', fontSize: 12, fontWeight: 700, color: '#fff', flexShrink: 0 }}>{av}</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.candidate_name || c.filename}</div>
            <div style={{ fontSize: 11, color: '#7a7468' }}>{c.final_verdict || '—'}</div>
          </div>
          <ScoreChip score={c.ai_score} />
        </div>
        {!c.error && <SkillTags matched={c.matched_skills || []} missing={c.missing_skills || []} />}
        {c.error && <div style={{ fontSize: 11, color: '#ef4444', marginBottom: 8 }}>{c.error}</div>}
        {showActions && !c.status || c.status === 'active' ? (
          <div style={{ display: 'flex', gap: 6 }}>
            <button onClick={e => { e.stopPropagation(); markCandidate(idx, 'shortlisted') }} style={{ flex: 1, fontSize: 11, fontWeight: 600, fontFamily: 'Inter,sans-serif', padding: 7, borderRadius: 6, cursor: 'pointer', background: 'rgba(19,194,142,.12)', color: '#13c28e', border: '1px solid rgba(19,194,142,.2)' }}>✓ Shortlist</button>
            <button onClick={e => { e.stopPropagation(); markCandidate(idx, 'rejected') }} style={{ flex: 1, fontSize: 11, fontWeight: 600, fontFamily: 'Inter,sans-serif', padding: 7, borderRadius: 6, cursor: 'pointer', background: 'rgba(239,68,68,.08)', color: '#ef4444', border: '1px solid rgba(239,68,68,.15)' }}>✗ Reject</button>
          </div>
        ) : showActions ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: c.status === 'shortlisted' ? '#13c28e' : '#ef4444' }}>{c.status === 'shortlisted' ? '✓ Shortlisted' : '✗ Rejected'}</span>
            <button onClick={e => { e.stopPropagation(); undoMark(idx) }} style={{ fontSize: 10, color: '#7a7468', background: 'transparent', border: '1px solid rgba(10,10,9,.1)', borderRadius: 6, padding: '4px 8px', cursor: 'pointer', fontFamily: 'Inter,sans-serif' }}>Undo</button>
          </div>
        ) : null}
        {showActions && c.status === 'shortlisted' && c.application_id && !c.trigger_interview && (
          <button onClick={e => { e.stopPropagation(); setMoveToInterviewFor(moveToInterviewFor === idx ? null : idx); setMoveEmailInput(c.candidate_email || ''); setMovePostingId(''); setMoveError('') }}
            style={{ width: '100%', marginTop: 6, fontSize: 11, fontWeight: 600, fontFamily: 'Inter,sans-serif', padding: 7, borderRadius: 6, cursor: 'pointer', background: 'rgba(124,58,237,.1)', color: '#a78bfa', border: '1px solid rgba(124,58,237,.2)' }}>
            → Move to Interview
          </button>
        )}
        {c.trigger_interview && (
          <div style={{ fontSize: 10.5, fontWeight: 600, color: '#a78bfa', marginTop: 6 }}>→ Sent to interview pipeline</div>
        )}
        {moveToInterviewFor === idx && (
          <div onClick={e => e.stopPropagation()} style={{ marginTop: 10, padding: 12, background: 'rgba(124,58,237,.05)', borderRadius: 8, border: '1px solid rgba(124,58,237,.15)' }}>
            <div style={{ fontSize: 10.5, fontWeight: 700, color: '#5c574c', marginBottom: 6 }}>Move to which interview posting?</div>
            <select value={movePostingId} onChange={e => setMovePostingId(e.target.value)} style={{ width: '100%', background: '#faf9f5', border: '1px solid rgba(10,10,9,.1)', borderRadius: 6, padding: '7px 8px', fontSize: 11.5, color: '#1f1c17', marginBottom: 8, fontFamily: 'Inter,sans-serif' }}>
              <option value="">Select a posting…</option>
              {interviewPostings.map((p: any) => <option key={p.id} value={p.id}>{p.title}</option>)}
            </select>
            {!c.candidate_email && (
              <input value={moveEmailInput} onChange={e => setMoveEmailInput(e.target.value)} placeholder="Candidate email (required — not on file)" style={{ width: '100%', background: '#faf9f5', border: '1px solid rgba(10,10,9,.1)', borderRadius: 6, padding: '7px 8px', fontSize: 11.5, color: '#1f1c17', marginBottom: 8, fontFamily: 'Inter,sans-serif', boxSizing: 'border-box' }} />
            )}
            {moveError && <div style={{ fontSize: 10.5, color: '#ef4444', marginBottom: 6 }}>{moveError}</div>}
            <button disabled={!movePostingId || (!c.candidate_email && !moveEmailInput) || moveLoading}
              onClick={() => submitMoveToInterview(idx)}
              style={{ width: '100%', fontSize: 11, fontWeight: 700, fontFamily: 'Inter,sans-serif', padding: 8, borderRadius: 6, border: 'none', cursor: 'pointer', background: '#7c3aed', color: '#fff', opacity: (!movePostingId || (!c.candidate_email && !moveEmailInput) || moveLoading) ? .5 : 1 }}>
              {moveLoading ? 'Sending…' : 'Send Interview Invite'}
            </button>
          </div>
        )}
        {moveResult?.idx === idx && (
          <div style={{ marginTop: 8, fontSize: 10.5, color: '#13c28e' }}>
            {moveResult.emailed ? '✓ Invite emailed to candidate.' : '✓ Posting linked.'} <a href={moveResult.link} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()} style={{ color: '#a78bfa' }}>Copy link</a>
          </div>
        )}
        {selectedKey === c.filename && c.deep_analysis && (
          <div style={{ marginTop: 10, padding: 12, background: 'rgba(10,10,9,.035)', borderRadius: 8, border: '1px solid rgba(10,10,9,.1)' }}>
            <AnalysisCarousel text={c.deep_analysis} />
          </div>
        )}
      </div>
    )
  }

  const renderDashboard = () => (
    <div className="copilot-layout-row" style={{ padding: 28, overflowY: 'auto', height: '100%', display: 'flex', gap: 20 }}>
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <div style={{ fontFamily: "'Space Grotesk', Inter, sans-serif", fontSize: 26, fontWeight: 600, marginBottom: 4 }}>HR Dashboard</div>
          <div style={{ fontSize: 12, color: '#7a7468' }}>Overview of your latest screening session</div>
        </div>
        {candidates.length > 0 && (
          <button onClick={exportCSV} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600, padding: '8px 16px', borderRadius: 8, border: '1px solid rgba(19,194,142,.2)', background: 'rgba(19,194,142,.08)', color: '#13c28e', cursor: 'pointer', fontFamily: 'Inter,sans-serif' }}>
            ⬇ Export CSV
          </button>
        )}
      </div>
      <div className="responsive-grid-4" style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 24 }}>
        {[
          { v: totalProcessed || '—', l: 'Total Screened' },
          { v: shortlistedList.length || '—', l: 'Shortlisted', sub: totalProcessed ? `${Math.round(shortlistedList.length / totalProcessed * 100)}% pass rate` : '' },
          { v: avgScore || '—', l: 'Avg. Score' },
          { v: rejectedList.length || '—', l: 'Rejected' },
        ].map(st => (
          <div key={st.l} style={card}>
            <div style={{ fontFamily: "Inter, sans-serif", fontSize: 32, fontWeight: 600, marginBottom: 2 }}>{st.v}</div>
            <div style={{ fontSize: 11, color: '#7a7468' }}>{st.l}</div>
            {st.sub && <div style={{ fontSize: 11, color: '#22c55e', marginTop: 3 }}>{st.sub}</div>}
          </div>
        ))}
      </div>
      {candidates.length > 0 && (
        <>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12 }}>ATS Score Distribution</div>
          <div style={s(card, { marginBottom: 24 })}>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 80, padding: '8px 4px 0' }}>
              {candidates.map((c, i) => (
                <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, cursor: 'pointer' }} onClick={() => setSection('candidates')}>
                  <span style={{ fontSize: 9, color: '#7a7468', fontWeight: 600 }}>{c.ai_score}</span>
                  <div title={c.filename} style={{ width: '100%', borderRadius: '3px 3px 0 0', height: `${Math.max(c.ai_score, 4)}%`, background: c.ai_score >= 80 ? '#13c28e' : c.ai_score >= 60 ? '#e2b04a' : 'rgba(239,68,68,.5)', transition: 'all .3s', minHeight: 4 }} />
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 }}>
              <span style={{ fontSize: 10, color: '#9c9689' }}>Lowest: {Math.min(...candidates.map(c => c.ai_score))}</span>
              <span style={{ fontSize: 10, color: '#9c9689' }}>Avg: {Math.round(candidates.reduce((s, c) => s + c.ai_score, 0) / candidates.length)}</span>
              <span style={{ fontSize: 10, color: '#9c9689' }}>Highest: {Math.max(...candidates.map(c => c.ai_score))}</span>
            </div>
          </div>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12 }}>Top Candidates</div>
          {candidates.slice(0, 3).map((c, i) => <CandidateCard key={i} c={c} idx={i} />)}
          <button onClick={() => setSection('candidates')} style={{ fontSize: 12, color: '#13c28e', background: 'transparent', border: '1px solid rgba(19,194,142,.2)', borderRadius: 8, padding: '8px 16px', cursor: 'pointer', fontFamily: 'Inter,sans-serif', marginTop: 4 }}>View all {candidates.length} candidates →</button>
        </>
      )}
      {candidates.length === 0 && (
        <div style={s(card, { textAlign: 'center', padding: 40 })}>

          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 6 }}>No screenings yet</div>
          <div style={{ fontSize: 12, color: '#7a7468', marginBottom: 16 }}>Upload a ZIP of CVs to get started</div>
          <button onClick={() => setSection('bulk')} style={{ fontSize: 13, fontWeight: 700, background: '#13c28e', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 20px', cursor: 'pointer', fontFamily: 'Inter,sans-serif' }}>Run Bulk Screening</button>
        </div>
      )}
    </div>
    <CopilotPanel
      context="hr_overview"
      hrOverview={{
        postings: interviewPostings.map((p: any) => ({ id: p.id, candidateCount: p.candidate_count || 0, isActive: !!p.is_active })),
        completedInterviews: interviewHistory.map((c: any) => ({ final_verdict: c.final_verdict, ai_score: c.ai_score, assessment_score: c.assessment_score })),
        bulkCandidates: candidates.map(c => ({ ai_score: c.ai_score, final_verdict: c.final_verdict })),
        orgMembersCount: org ? orgMembers.length : null,
        shortlistedCount: shortlistedList.length,
      }}
    />
    </div>
  )

  const renderBulk = () => (
    <div style={{ padding: 28, overflowY: 'auto', height: '100%', maxWidth: 640 }}>
      <div style={{ fontFamily: "'Space Grotesk', Inter, sans-serif", fontSize: 26, fontWeight: 600, marginBottom: 4 }}>Bulk Screening</div>
      <div style={{ fontSize: 12, color: '#7a7468', marginBottom: 24 }}>Upload CVs and a job description — AI ranks them all</div>
      <input ref={fileRef} type="file" accept=".zip,.pdf" style={{ display: 'none' }} onChange={e => setZipFile(e.target.files?.[0] || null)} />
      <div onClick={() => fileRef.current?.click()} style={s(card, { border: '2px dashed rgba(10,10,9,.14)', textAlign: 'center', padding: 28, cursor: 'pointer', marginBottom: 14 })}>
        <div style={{ fontSize: 28, marginBottom: 8 }}></div>
        <div style={{ fontSize: 13, fontWeight: 600 }}>{zipFile ? zipFile.name : 'Select ZIP of CVs or single PDF'}</div>
        {!zipFile && <div style={{ fontSize: 11, color: '#7a7468', marginTop: 4 }}>Max 25 CVs per ZIP</div>}
      </div>
      <input value={jobTitle} onChange={e => setJobTitle(e.target.value)} placeholder="Job title (e.g. Senior Frontend Engineer)" style={s(inputSt, { marginBottom: 10 })} />
      <textarea value={jobDescription} onChange={e => setJobDescription(e.target.value)} placeholder="Paste job description or requirements…" style={s(inputSt, { resize: 'none', height: 100, lineHeight: 1.6, marginBottom: 10 } as any)} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
        <span style={{ fontSize: 12, color: '#7a7468' }}>Top candidates needed:</span>
        <input type="number" min={1} max={25} value={topN} onChange={e => setTopN(Number(e.target.value) || 1)} style={{ width: 60, background: '#faf9f5', border: '1px solid rgba(10,10,9,.1)', borderRadius: 6, padding: '7px 10px', fontSize: 13, color: '#1f1c17', outline: 'none', fontFamily: 'Inter,sans-serif' }} />
      </div>
      {bulkError && <div style={{ fontSize: 12, color: '#ef4444', marginBottom: 10 }}>{bulkError}</div>}

      {/* Loading Animation */}
      {loading && (
        <div style={s(card, { marginBottom: 14, padding: 20 })}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
            <div style={{ position: 'relative', width: 40, height: 40, flexShrink: 0 }}>
              <svg viewBox="0 0 40 40" style={{ width: 40, height: 40, animation: 'spin 1.2s linear infinite' }}>
                <circle cx="20" cy="20" r="16" fill="none" stroke="#9c9689" strokeWidth="3" />
                <circle cx="20" cy="20" r="16" fill="none" stroke="#13c28e" strokeWidth="3" strokeDasharray="60 40" strokeLinecap="round" />
              </svg>
            </div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 2 }}>{bulkStatus}</div>
              {pollProgress.currentName && <div style={{ fontSize: 11, color: '#7a7468' }}>Analyzing: {pollProgress.currentName}</div>}
            </div>
          </div>
          {pollProgress.total === 0 && (
            <div style={{ marginTop: 4 }}>
              {BULK_ANIM_STEPS.map((step, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, opacity: i <= bulkAnimStep ? 1 : 0.2, transition: 'opacity 0.4s ease', fontSize: 11, color: i === bulkAnimStep ? '#e2b04a' : i < bulkAnimStep ? '#13c28e' : '#7a7468', marginBottom: 4 }}>
                  <div style={{ width: 5, height: 5, borderRadius: '50%', background: i === bulkAnimStep ? '#e2b04a' : i < bulkAnimStep ? '#13c28e' : '#9c9689', flexShrink: 0, transition: 'background 0.4s' }} />
                  {step}
                  {i < bulkAnimStep && <span style={{ marginLeft: 'auto', color: '#13c28e', fontSize: 10 }}>done</span>}
                  {i === bulkAnimStep && <span style={{ marginLeft: 'auto', fontSize: 10, animation: 'pulse 1s infinite' }}>...</span>}
                </div>
              ))}
              <div style={{ height: 2, background: 'rgba(10,10,9,.05)', borderRadius: 1, marginTop: 10, overflow: 'hidden' }}>
                <div style={{ height: '100%', background: 'linear-gradient(90deg,#b8860b,#e2b04a)', borderRadius: 1, width: `${Math.round(((bulkAnimStep + 1) / BULK_ANIM_STEPS.length) * 100)}%`, transition: 'width 0.6s ease' }} />
              </div>
            </div>
          )}
          {pollProgress.total > 0 && (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#7a7468', marginBottom: 6 }}>
                <span>Progress</span>
                <span>{pollProgress.current}/{pollProgress.total} CVs</span>
              </div>
              <div style={{ height: 6, background: 'rgba(10,10,9,.05)', borderRadius: 3, overflow: 'hidden' }}>
                <div style={{ height: '100%', background: 'linear-gradient(90deg,#0b7c5e,#13c28e)', borderRadius: 3, width: `${Math.round((pollProgress.current / pollProgress.total) * 100)}%`, transition: 'width .5s ease' }} />
              </div>
              <div style={{ display: 'flex', gap: 4, marginTop: 10 }}>
                {Array.from({ length: pollProgress.total }, (_, i) => (
                  <div key={i} style={{ flex: 1, height: 4, borderRadius: 2, background: i < pollProgress.current ? '#13c28e' : i === pollProgress.current ? '#e2b04a' : '#9c9689', transition: 'all .4s' }} />
                ))}
              </div>
            </>
          )}
        </div>
      )}

      <button onClick={runBulk} disabled={loading} style={{ width: '100%', background: loading ? 'rgba(19,194,142,.3)' : '#13c28e', color: '#fff', fontSize: 13, fontWeight: 700, fontFamily: 'Inter,sans-serif', padding: 12, borderRadius: 8, border: 'none', cursor: loading ? 'default' : 'pointer', letterSpacing: '.04em', opacity: loading ? 0.7 : 1 }}>
        {loading ? 'Screening in progress…' : bulkStatus ? bulkStatus : 'Run Bulk Screening'}
      </button>
      {bulkStatus && candidates.length > 0 && (
        <button onClick={() => setSection('candidates')} style={{ width: '100%', marginTop: 10, fontSize: 12, fontWeight: 600, color: '#13c28e', background: 'transparent', border: '1px solid rgba(19,194,142,.2)', borderRadius: 8, padding: 10, cursor: 'pointer', fontFamily: 'Inter,sans-serif' }}>
          View {candidates.length} Ranked Candidates →
        </button>
      )}
    </div>
  )

  const renderTalentPool = () => (
    <div style={{ padding: 28, overflowY: 'auto', height: '100%' }}>
      <div style={{ fontFamily: "'Space Grotesk', Inter, sans-serif", fontSize: 26, fontWeight: 600, marginBottom: 4 }}>Talent Pool</div>
      <div style={{ fontSize: 12, color: '#7a7468', marginBottom: 24 }}>Every screened candidate across all your screening jobs, in one searchable, filterable place</div>
      <TalentPoolPanel interviewPostings={interviewPostings.map((p: any) => ({ id: p.id, title: p.title }))} />
    </div>
  )

  const renderCandidates = (list: Candidate[], title: string, emptyMsg: string) => (
    <div style={{ padding: 28, overflowY: 'auto', height: '100%' }}>
      <div style={{ fontFamily: "'Space Grotesk', Inter, sans-serif", fontSize: 26, fontWeight: 600, marginBottom: 4 }}>{title}</div>
      <div style={{ fontSize: 12, color: '#7a7468', marginBottom: 20 }}>{list.length} candidates · sorted by score</div>
      {list.length === 0 ? (
        <div style={s(card, { textAlign: 'center', padding: 40, color: '#7a7468' })}>{emptyMsg}</div>
      ) : (
        <div style={{ maxWidth: 700 }}>{list.map((c, i) => <CandidateCard key={c.filename + i} c={c} idx={candidates.indexOf(c)} />)}</div>
      )}
    </div>
  )

  const renderHistory = () => {
    const search = normalize(historySearch)

    const filteredScan = scanHistory
      .filter((h: any) => !search || (h.role_title || '').toLowerCase().includes(search))
      .filter((h: any) => !historyVerdictFilter || h.final_verdict === historyVerdictFilter)

    const filteredInterviews = interviewHistory
      .filter((h: any) => !search || (h.candidate_name || '').toLowerCase().includes(search) || (h.posting_title || '').toLowerCase().includes(search))
      .filter((h: any) => !historyVerdictFilter || h.final_verdict === historyVerdictFilter)

    const filteredActions = history.filter((h: any) => !search || (h.filename || '').toLowerCase().includes(search) || (h.jobTitle || '').toLowerCase().includes(search))

    let verdictOptions: string[] = []
    if (historyTab === 'screenings') verdictOptions = Array.from(new Set(scanHistory.map((h: any) => h.final_verdict).filter(Boolean))) as string[]
    else if (historyTab === 'interviews') verdictOptions = Array.from(new Set(interviewHistory.map((h: any) => h.final_verdict).filter(Boolean))) as string[]
    verdictOptions = verdictOptions.slice(0, 6)

    const scanGroups = groupByDate(filteredScan, (h: any) => h.created_at)
    const interviewGroups = groupByDate(filteredInterviews, (h: any) => h.completed_at || h.created_at)
    const actionGroups = groupByDate(filteredActions, (h: any) => h.screenedAt)

    const selectScan = (h: any) => { setScanHistorySelected(h); setHistoryDrawerOpen(true) }
    const selectAction = (h: any) => { setHistorySelected(h); setHistoryDrawerOpen(true) }
    const selectInterview = async (h: any) => {
      setInterviewHistorySelected(h)
      setHistoryDrawerOpen(true)
      setInterviewReport(null)
      setInterviewReportLoading(true)
      try {
        setInterviewReport(await api.getInterviewSessionReport(h.id))
      } catch {
        setInterviewReport(null)
      } finally {
        setInterviewReportLoading(false)
      }
    }
    const closeDrawer = () => setHistoryDrawerOpen(false)

    return (
      <div className="hr-history-shell" style={{ display: 'flex', height: '100%', overflow: 'hidden' }}>
        <style jsx global>{`
          .hr-history-list { width: 340px; flex-shrink: 0; }
          .hr-history-detail { flex: 1; }
          .hr-history-back { display: none; }
          .hr-history-card { transition: transform .15s ease, border-color .15s ease; cursor: pointer; }
          .hr-history-card:hover { transform: translateY(-1px); }
          @keyframes hrFadeUp { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
          .hr-fade-up { animation: hrFadeUp .3s ease both; }
          @media (max-width: 880px) {
            .hr-history-list { width: 100%; }
            .hr-history-detail {
              position: fixed; inset: 0; z-index: 999; background: #f7f5f0;
              transform: translateX(100%); transition: transform .25s ease; overflow-y: auto;
            }
            .hr-history-detail.open { transform: translateX(0); }
            .hr-history-back { display: flex; }
          }
          @media (prefers-reduced-motion: reduce) {
            .hr-history-detail, .hr-history-card, .hr-fade-up { transition: none !important; animation: none !important; }
          }
        `}</style>

        <div className="hr-history-list" style={{ borderRight: '1px solid rgba(10,10,9,.1)', overflowY: 'auto', padding: 20 }}>
          <div style={{ fontFamily: "Inter, sans-serif", fontSize: 22, fontWeight: 600, marginBottom: 12 }}>History</div>
          <div style={{ display: 'flex', gap: 6, marginBottom: 14, flexWrap: 'wrap' }}>
            {([['screenings', 'Screenings'], ['interviews', 'AI Interviews'], ['actions', 'My Actions']] as const).map(([id, label]) => (
              <button key={id} onClick={() => { setHistoryTab(id); setHistorySearch(''); setHistoryVerdictFilter(null) }}
                style={{
                  fontSize: 11, fontWeight: 600, padding: '6px 10px', borderRadius: 100, cursor: 'pointer', fontFamily: 'Inter,sans-serif',
                  border: historyTab === id ? '1px solid rgba(19,194,142,.3)' : '1px solid rgba(10,10,9,.12)',
                  background: historyTab === id ? 'rgba(19,194,142,.1)' : 'transparent',
                  color: historyTab === id ? '#13c28e' : '#5c574c'
                }}>{label}</button>
            ))}
          </div>

          <div style={{ position: 'relative', marginBottom: 10 }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#7a7468" strokeWidth="2"
              style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)' }}>
              <circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3" />
            </svg>
            <input
              value={historySearch}
              onChange={e => setHistorySearch(e.target.value)}
              placeholder={historyTab === 'interviews' ? 'Search name or role…' : historyTab === 'actions' ? 'Search filename or role…' : 'Search by role…'}
              style={{
                width: '100%', background: '#faf9f5', border: '1px solid rgba(10,10,9,.1)', borderRadius: 8,
                padding: '8px 12px 8px 30px', fontSize: 12, color: '#1f1c17', outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box',
              }}
            />
          </div>

          {verdictOptions.length > 0 && (
            <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginBottom: 14 }}>
              <button onClick={() => setHistoryVerdictFilter(null)} style={{
                fontSize: 10, fontWeight: 600, padding: '4px 9px', borderRadius: 100, cursor: 'pointer', fontFamily: 'Inter,sans-serif',
                border: !historyVerdictFilter ? '1px solid #7a7468' : '1px solid rgba(10,10,9,.12)',
                background: !historyVerdictFilter ? 'rgba(10,10,9,.08)' : 'transparent',
                color: !historyVerdictFilter ? '#1f1c17' : '#7a7468',
              }}>All</button>
              {verdictOptions.map(v => (
                <button key={v} onClick={() => setHistoryVerdictFilter(v)} style={{
                  fontSize: 10, fontWeight: 600, padding: '4px 9px', borderRadius: 100, cursor: 'pointer', fontFamily: 'Inter,sans-serif',
                  border: historyVerdictFilter === v ? '1px solid rgba(19,194,142,.35)' : '1px solid rgba(10,10,9,.12)',
                  background: historyVerdictFilter === v ? 'rgba(19,194,142,.1)' : 'transparent',
                  color: historyVerdictFilter === v ? '#13c28e' : '#7a7468',
                }}>{v}</button>
              ))}
            </div>
          )}

          {historyTab === 'screenings' && (
            <>
              {scanHistoryLoading && <div style={{ fontSize: 12, color: '#7a7468' }}>Loading...</div>}
              {!scanHistoryLoading && scanHistory.length === 0 && (
                <div style={{ fontSize: 12, color: '#7a7468', textAlign: 'center', padding: '40px 0' }}>No screenings yet. Every CV you screen is saved here automatically.</div>
              )}
              {!scanHistoryLoading && scanHistory.length > 0 && filteredScan.length === 0 && (
                <div style={{ fontSize: 12, color: '#7a7468', textAlign: 'center', padding: '40px 0' }}>No matching screenings.<br />Try a different role name.</div>
              )}
              {scanGroups.map(({ group, items }) => (
                <div key={group} style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: '#9c9689', marginBottom: 8 }}>{group}</div>
                  {items.map((h: any) => (
                    <div key={h.id} className="hr-history-card hr-fade-up" onClick={() => selectScan(h)} style={s(card, { marginBottom: 8, border: `1px solid ${scanHistorySelected?.id === h.id ? 'rgba(19,194,142,.25)' : '#9c9689'}` })}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                        <span style={{ fontSize: 11, fontWeight: 600, color: h.is_shortlisted === 'True' ? '#13c28e' : '#7a7468' }}>{h.is_shortlisted === 'True' ? '✓ Shortlisted' : (h.final_verdict || 'Match Result')}</span>
                        <span style={{ marginLeft: 'auto', fontFamily: "Inter, sans-serif", fontSize: 18, fontWeight: 600, color: h.candidate_score >= 80 ? '#13c28e' : h.candidate_score >= 60 ? '#e2b04a' : '#ef4444' }}>{h.candidate_score}</span>
                      </div>
                      <div style={{ fontSize: 13, fontWeight: 600 }}>{h.role_title || 'Untitled Role'}</div>
                      <div style={{ fontSize: 10, color: '#9c9689', marginTop: 3 }}>{h.created_at ? new Date(h.created_at).toLocaleString() : ''}</div>
                    </div>
                  ))}
                </div>
              ))}
            </>
          )}

          {historyTab === 'interviews' && (
            <>
              {interviewHistoryLoading && <div style={{ fontSize: 12, color: '#7a7468' }}>Loading...</div>}
              {!interviewHistoryLoading && interviewHistory.length === 0 && (
                <div style={{ fontSize: 12, color: '#7a7468', textAlign: 'center', padding: '40px 0' }}>No completed AI interviews yet.</div>
              )}
              {!interviewHistoryLoading && interviewHistory.length > 0 && filteredInterviews.length === 0 && (
                <div style={{ fontSize: 12, color: '#7a7468', textAlign: 'center', padding: '40px 0' }}>No matching interviews.<br />Try a different candidate name or job title.</div>
              )}
              {interviewGroups.map(({ group, items }) => (
                <div key={group} style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: '#9c9689', marginBottom: 8 }}>{group}</div>
                  {items.map((h: any) => (
                    <div key={h.id} className="hr-history-card hr-fade-up" onClick={() => selectInterview(h)} style={s(card, { marginBottom: 8, border: `1px solid ${interviewHistorySelected?.id === h.id ? 'rgba(19,194,142,.25)' : '#9c9689'}` })}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                        <span style={{ fontSize: 11, fontWeight: 600, color: '#5c574c' }}>{h.final_verdict || 'AI Interview'}</span>
                        {h.ai_score != null && <span style={{ marginLeft: 'auto', fontFamily: "Inter, sans-serif", fontSize: 18, fontWeight: 600, color: h.ai_score >= 80 ? '#13c28e' : h.ai_score >= 60 ? '#e2b04a' : '#ef4444' }}>{h.ai_score}</span>}
                      </div>
                      <div style={{ fontSize: 13, fontWeight: 600 }}>{h.candidate_name}</div>
                      <div style={{ fontSize: 11, color: '#7a7468', marginTop: 2 }}>{h.posting_title}</div>
                      <div style={{ fontSize: 10, color: '#9c9689', marginTop: 3 }}>{h.completed_at ? new Date(h.completed_at).toLocaleString() : ''}</div>
                    </div>
                  ))}
                </div>
              ))}
            </>
          )}

          {historyTab === 'actions' && (
            <>
              <div style={{ fontSize: 11, color: '#7a7468', marginBottom: 12 }}>{history.length} candidates you shortlisted/rejected (saved on this device only)</div>
              {history.length === 0 ? (
                <div style={{ fontSize: 12, color: '#7a7468', textAlign: 'center', padding: '40px 0' }}>No history yet. Shortlist or reject candidates to save them here.</div>
              ) : filteredActions.length === 0 ? (
                <div style={{ fontSize: 12, color: '#7a7468', textAlign: 'center', padding: '40px 0' }}>No matching candidates.<br />Try a different filename or role.</div>
              ) : (
                actionGroups.map(({ group, items }) => (
                  <div key={group} style={{ marginBottom: 16 }}>
                    <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: '#9c9689', marginBottom: 8 }}>{group}</div>
                    {items.map((h: any, i: number) => (
                      <div key={i} className="hr-history-card hr-fade-up" onClick={() => selectAction(h)} style={s(card, { marginBottom: 8, border: `1px solid ${historySelected === h ? 'rgba(19,194,142,.25)' : '#9c9689'}` })}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                          <span style={{ fontSize: 11, fontWeight: 600, color: h.status === 'shortlisted' ? '#13c28e' : '#ef4444' }}>{h.status === 'shortlisted' ? '✓ Shortlisted' : '✗ Rejected'}</span>
                          <span style={{ marginLeft: 'auto', fontFamily: "Inter, sans-serif", fontSize: 18, fontWeight: 600, color: h.ai_score >= 80 ? '#13c28e' : h.ai_score >= 60 ? '#e2b04a' : '#ef4444' }}>{h.ai_score}</span>
                        </div>
                        <div style={{ fontSize: 13, fontWeight: 600 }}>{h.filename}</div>
                        <div style={{ fontSize: 11, color: '#7a7468', marginTop: 2 }}>{h.jobTitle}</div>
                        <div style={{ fontSize: 10, color: '#9c9689', marginTop: 3 }}>{h.screenedAt}</div>
                      </div>
                    ))}
                  </div>
                ))
              )}
              {history.length > 0 && (
                <button onClick={() => { if (confirm('Clear all history?')) { setHistory([]); saveHistory([]) } }} style={{ width: '100%', marginTop: 8, fontSize: 11, color: '#ef4444', background: 'transparent', border: '1px solid rgba(239,68,68,.15)', borderRadius: 8, padding: '8px', cursor: 'pointer', fontFamily: 'Inter,sans-serif' }}>Clear History</button>
              )}
            </>
          )}
        </div>

        <div className={`hr-history-detail${historyDrawerOpen ? ' open' : ''}`} style={{ overflowY: 'auto', padding: 28 }}>
          <button className="hr-history-back" onClick={closeDrawer} style={{ alignItems: 'center', gap: 6, background: 'rgba(10,10,9,.035)', border: '1px solid rgba(10,10,9,.1)', borderRadius: 8, padding: '7px 12px', color: '#3a352d', cursor: 'pointer', fontSize: 12, fontFamily: 'Inter,sans-serif', marginBottom: 18 }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 18l-6-6 6-6" /></svg>
            Back to list
          </button>

          {historyTab === 'screenings' && (
            !scanHistorySelected ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#9c9689', fontSize: 13 }}>Select a screening from history to view details</div>
            ) : (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
                  <div>
                    <div style={{ fontSize: 18, fontWeight: 600 }}>{scanHistorySelected.role_title}</div>
                    <div style={{ fontSize: 12, color: '#7a7468' }}>{scanHistorySelected.created_at ? new Date(scanHistorySelected.created_at).toLocaleString() : ''}</div>
                  </div>
                  <span style={{ marginLeft: 'auto', fontFamily: "Inter, sans-serif", fontSize: 36, fontWeight: 600, color: scanHistorySelected.candidate_score >= 80 ? '#13c28e' : scanHistorySelected.candidate_score >= 60 ? '#e2b04a' : '#ef4444' }}>{scanHistorySelected.candidate_score}</span>
                </div>
                <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
                  <div style={s(card, { flex: '1 1 200px' })}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: '#13c28e', marginBottom: 8 }}>Matched Skills</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>{(scanHistorySelected.matched_skills || []).map((sk: string) => <span key={sk} style={{ fontSize: 11, padding: '3px 8px', borderRadius: 100, background: 'rgba(19,194,142,.1)', color: '#13c28e', border: '1px solid rgba(19,194,142,.2)' }}>{sk}</span>)}</div>
                  </div>
                  <div style={s(card, { flex: '1 1 200px' })}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: '#ef4444', marginBottom: 8 }}>Missing Skills</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>{(scanHistorySelected.missing_skills || []).map((sk: string) => <span key={sk} style={{ fontSize: 11, padding: '3px 8px', borderRadius: 100, background: 'rgba(239,68,68,.08)', color: '#ef4444', border: '1px solid rgba(239,68,68,.15)' }}>{sk}</span>)}</div>
                  </div>
                </div>
                {scanHistorySelected.deep_analysis && (
                  <div style={card}>
                    <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 12 }}>Full Analysis</div>
                    <AnalysisCarousel text={scanHistorySelected.deep_analysis} />
                  </div>
                )}
              </>
            )
          )}

          {historyTab === 'interviews' && (
            !interviewHistorySelected ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#9c9689', fontSize: 13 }}>Select a candidate to view their interview report</div>
            ) : (
              <>
                <div style={{ marginBottom: 20 }}>
                  <div style={{ fontSize: 18, fontWeight: 600 }}>{interviewHistorySelected.candidate_name}</div>
                  <div style={{ fontSize: 12, color: '#7a7468' }}>{interviewHistorySelected.candidate_email} · {interviewHistorySelected.posting_title}</div>
                </div>
                {interviewReportLoading ? (
                  <div style={{ fontSize: 12, color: '#7a7468' }}>Loading report...</div>
                ) : interviewReport ? (
                  <AIFeedbackReport data={interviewReport} />
                ) : (
                  <div style={{ fontSize: 12, color: '#7a7468' }}>Could not load the full report for this session.</div>
                )}
              </>
            )
          )}

          {historyTab === 'actions' && (
            !historySelected ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#9c9689', fontSize: 13 }}>Select a candidate from history to view details</div>
            ) : (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
                  <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'linear-gradient(135deg,#0b7c5e,#13c28e)', display: 'grid', placeItems: 'center', fontSize: 15, fontWeight: 700, color: '#fff' }}>{initials(historySelected.filename)}</div>
                  <div>
                    <div style={{ fontSize: 18, fontWeight: 600 }}>{historySelected.filename}</div>
                    <div style={{ fontSize: 12, color: '#7a7468' }}>{historySelected.jobTitle} · {historySelected.screenedAt}</div>
                  </div>
                  <span style={{ marginLeft: 'auto', fontFamily: "Inter, sans-serif", fontSize: 36, fontWeight: 600, color: historySelected.ai_score >= 80 ? '#13c28e' : historySelected.ai_score >= 60 ? '#e2b04a' : '#ef4444' }}>{historySelected.ai_score}</span>
                </div>
                <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
                  <div style={s(card, { flex: '1 1 200px' })}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: '#13c28e', marginBottom: 8 }}>Matched Skills</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>{(historySelected.matched_skills || []).map(sk => <span key={sk} style={{ fontSize: 11, padding: '3px 8px', borderRadius: 100, background: 'rgba(19,194,142,.1)', color: '#13c28e', border: '1px solid rgba(19,194,142,.2)' }}>{sk}</span>)}</div>
                  </div>
                  <div style={s(card, { flex: '1 1 200px' })}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: '#ef4444', marginBottom: 8 }}>Missing Skills</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>{(historySelected.missing_skills || []).map(sk => <span key={sk} style={{ fontSize: 11, padding: '3px 8px', borderRadius: 100, background: 'rgba(239,68,68,.08)', color: '#ef4444', border: '1px solid rgba(239,68,68,.15)' }}>{sk}</span>)}</div>
                  </div>
                </div>
                {historySelected.deep_analysis && (
                  <div style={card}>
                    <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 12 }}>Full Analysis</div>
                    <AnalysisCarousel text={historySelected.deep_analysis} />
                  </div>
                )}
              </>
            )
          )}
        </div>
      </div>
    )
  }


  const renderChatbot = () => (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: 28, maxWidth: 700 }}>
      <div style={{ fontFamily: "'Space Grotesk', Inter, sans-serif", fontSize: 26, fontWeight: 600, marginBottom: 4 }}>Policy Chatbot</div>
      <div style={{ fontSize: 12, color: '#7a7468', marginBottom: 16 }}>Ask anything about your company HR policies</div>

      {/* Policy document upload */}
      <input ref={policyFileRef} type="file" accept=".pdf" style={{ display: 'none' }} onChange={e => e.target.files?.[0] && uploadPolicyDoc(e.target.files[0])} />
      <div style={s(card, { marginBottom: 16, padding: 12 })}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <span style={{ fontSize: 12, fontWeight: 600 }}>Policy Documents ({policyDocs.length})</span>
          <button onClick={() => policyFileRef.current?.click()} disabled={policyUploading} style={{ fontSize: 11, fontWeight: 600, padding: '5px 12px', borderRadius: 6, border: '1px solid rgba(19,194,142,.2)', background: 'rgba(19,194,142,.08)', color: '#13c28e', cursor: 'pointer', fontFamily: 'Inter,sans-serif' }}>
            {policyUploading ? 'Uploading…' : '+ Upload PDF'}
          </button>
        </div>
        {policyDocs.length === 0 ? (
          <div style={{ fontSize: 11, color: '#9c9689', textAlign: 'center', padding: '8px 0' }}>No documents yet — upload a PDF to power the chatbot</div>
        ) : (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
            {policyDocs.map(d => (
              <div key={d.filename} style={{ fontSize: 10, padding: '3px 10px', borderRadius: 100, background: 'rgba(10,10,9,.035)', color: '#7a7468', border: '1px solid rgba(10,10,9,.1)' }}>
                📄 {d.filename.replace(/^\d{8}_\d{6}_/, '')} ({d.size_kb}KB)
              </div>
            ))}
          </div>
        )}
      </div>
      <div style={s(card, { flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 10, padding: 16, marginBottom: 12 })}>
        {messages.map((m, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start' }}>
            {m.role === 'bot' && <div style={{ width: 26, height: 26, background: '#e2b04a', borderRadius: '50%', display: 'grid', placeItems: 'center', fontSize: 10, fontWeight: 700, color: '#0a0a08', flexShrink: 0 }}></div>}
            <div style={{
              maxWidth: '85%', padding: '10px 14px', borderRadius: 12, fontSize: 13, lineHeight: 1.6,
              background: m.role === 'bot' ? 'rgba(10,10,9,.05)' : 'rgba(19,194,142,.12)',
              color: m.role === 'bot' ? '#3a352d' : '#13c28e',
              border: `1px solid ${m.role === 'bot' ? 'rgba(10,10,9,.12)' : 'rgba(19,194,142,.18)'}`,
              borderBottomLeftRadius: m.role === 'bot' ? 4 : 12, borderBottomRightRadius: m.role === 'user' ? 4 : 12
            }}
              dangerouslySetInnerHTML={{ __html: m.text.replace(/\*\*(.*?)\*\*/g, '<strong style="color:#1f1c17">$1</strong>') }}
            />
          </div>
        ))}
        {typing && (
          <div style={{ display: 'flex', gap: 8 }}>
            <div style={{ width: 26, height: 26, background: '#e2b04a', borderRadius: '50%', display: 'grid', placeItems: 'center', fontSize: 10, fontWeight: 700, color: '#0a0a08' }}></div>
            <div style={{ padding: '12px 16px', background: 'rgba(10,10,9,.035)', border: '1px solid rgba(10,10,9,.1)', borderRadius: 12, display: 'flex', gap: 4, alignItems: 'center' }}>
              {[0, 1, 2].map(j => <div key={j} style={{ width: 5, height: 5, background: 'rgba(10,10,9,.16)', borderRadius: '50%', animation: `bounce ${0.6 + j * 0.15}s infinite alternate` }} />)}
            </div>
          </div>
        )}
        <div ref={chatEndRef} />
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 10 }}>
        {["What's our leave policy?", "Remote work rules?", "Onboarding checklist", "Health benefits?"].map(q => (
          <button key={q} onClick={() => sendMessage(q)} style={{ fontSize: 11, color: '#7a7468', background: '#f0eee6', border: '1px solid rgba(10,10,9,.1)', borderRadius: 100, padding: '4px 10px', cursor: 'pointer', fontFamily: 'Inter,sans-serif' }}>{q}</button>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <input value={chatInput} onChange={e => setChatInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && sendMessage(chatInput)} placeholder="Ask about HR policies…" style={s(inputSt, { flex: 1, width: 'auto' })} />
        <button onClick={() => sendMessage(chatInput)} style={{ width: 40, height: 40, background: '#e2b04a', border: 'none', borderRadius: 8, display: 'grid', placeItems: 'center', cursor: 'pointer', flexShrink: 0 }}>
          <svg width="16" height="16" fill="none" stroke="#0a0a08" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 16 16"><path d="M14 8L2 3l3 5-3 5 12-5z" /></svg>
        </button>
      </div>
    </div>
  )

  const renderSettings = () => (
    <div style={{ padding: 28, maxWidth: 560 }}>
      <div style={{ fontFamily: "'Space Grotesk', Inter, sans-serif", fontSize: 26, fontWeight: 600, marginBottom: 4 }}>Settings</div>
      <div style={{ fontSize: 12, color: '#7a7468', marginBottom: 24 }}>Manage your HR account preferences</div>
      <div style={s(card, { marginBottom: 12 })}>
        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12 }}>Account</div>
        <div style={{ fontSize: 12, color: '#7a7468', marginBottom: 4 }}>Name</div>
        <input defaultValue={userName} style={s(inputSt, { marginBottom: 10 })} />
        <div style={{ fontSize: 12, color: '#7a7468', marginBottom: 4 }}>Email</div>
        <input defaultValue={userEmail} disabled style={s(inputSt, { opacity: .5, cursor: 'not-allowed', marginBottom: 10 })} />
        <button style={{ fontSize: 12, fontWeight: 600, background: '#13c28e', color: '#fff', border: 'none', borderRadius: 8, padding: '9px 18px', cursor: 'pointer', fontFamily: 'Inter,sans-serif' }}>Save Changes</button>
      </div>
      <div style={s(card, { marginBottom: 12 })}>
        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Team Workspace</div>
        <div style={{ fontSize: 12, color: '#7a7468', marginBottom: 14 }}>Invite up to 5 teammates to share jobs and screening results.</div>
        {orgLoading ? (
          <div style={{ fontSize: 13, color: '#7a7468' }}>Loading...</div>
        ) : !org ? (
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <input value={newOrgName} onChange={e => setNewOrgName(e.target.value)} placeholder="Workspace name (e.g. your company)"
              style={s(inputSt, { flex: '1 1 220px', marginBottom: 0 })} />
            <button onClick={handleCreateOrg} disabled={creatingOrg}
              style={{ background: '#e2b04a', color: '#0a0a09', fontSize: 13, fontWeight: 700, padding: '9px 18px', borderRadius: 8, border: 'none', cursor: 'pointer', fontFamily: 'Inter,sans-serif', whiteSpace: 'nowrap' }}>
              {creatingOrg ? 'Creating...' : 'Create Workspace'}
            </button>
          </div>
        ) : (
          <div>
            {editingOrgName ? (
              <div style={{ display: 'flex', gap: 8, marginBottom: 4 }}>
                <input value={renameOrgValue} onChange={e => setRenameOrgValue(e.target.value)} autoFocus
                  style={s(inputSt, { flex: 1, padding: '6px 10px', fontSize: 13, marginBottom: 0 })} />
                <button onClick={handleRenameOrg} disabled={renamingOrg}
                  style={{ fontSize: 11.5, fontWeight: 700, color: '#13c28e', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'Inter,sans-serif' }}>Save</button>
                <button onClick={() => setEditingOrgName(false)}
                  style={{ fontSize: 11.5, color: '#7a7468', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'Inter,sans-serif' }}>Cancel</button>
              </div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{org.name}</div>
                {org.is_owner && (
                  <button onClick={() => { setRenameOrgValue(org.name); setEditingOrgName(true) }}
                    style={{ fontSize: 11, color: '#7a7468', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'Inter,sans-serif' }}>Rename</button>
                )}
              </div>
            )}
            <div style={{ fontSize: 11.5, color: '#7a7468', marginBottom: 14 }}>{org.seats_used} / {org.max_seats} seats used</div>
            {orgMembers.map((m: any) => (
              <div key={m.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderTop: '1px solid rgba(10,10,9,.1)' }}>
                <div>
                  <span style={{ fontSize: 13 }}>{m.name}</span>
                  <span style={{ fontSize: 11.5, color: '#7a7468', marginLeft: 8 }}>{m.email}</span>
                  {m.is_owner && <span style={{ fontSize: 10, color: '#e2b04a', marginLeft: 8, fontWeight: 700 }}>OWNER</span>}
                </div>
                {org.is_owner && !m.is_owner && (
                  <button onClick={() => handleRemoveMember(m.id)} style={{ fontSize: 11.5, color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'Inter,sans-serif' }}>Remove</button>
                )}
              </div>
            ))}
            {org.is_owner && org.seats_used < org.max_seats && (
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 16 }}>
                <input value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} placeholder="teammate@company.com"
                  style={s(inputSt, { flex: '1 1 220px', marginBottom: 0 })} />
                <button onClick={handleInvite} disabled={inviting}
                  style={{ background: 'transparent', border: '1px solid rgba(10,10,9,.14)', color: '#1f1c17', fontSize: 13, fontWeight: 600, padding: '9px 18px', borderRadius: 8, cursor: 'pointer', fontFamily: 'Inter,sans-serif', whiteSpace: 'nowrap' }}>
                  {inviting ? 'Sending...' : 'Send Invite'}
                </button>
              </div>
            )}
          </div>
        )}
        {orgMsg && <div style={{ fontSize: 12, color: '#13c28e', marginTop: 12 }}>{orgMsg}</div>}
        {orgError && <div style={{ fontSize: 12, color: '#ef4444', marginTop: 12 }}>{orgError}</div>}
        {org?.is_owner && (
          <button onClick={handleDeleteOrg} style={{ marginTop: 16, fontSize: 11.5, fontWeight: 600, color: '#ef4444', background: 'rgba(239,68,68,.06)', border: '1px solid rgba(239,68,68,.15)', borderRadius: 8, padding: '8px 14px', cursor: 'pointer', fontFamily: 'Inter,sans-serif' }}>
            Delete Workspace
          </button>
        )}
      </div>
      <div style={card}>
        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12 }}>Danger Zone</div>
        <button onClick={handleLogout} style={{ fontSize: 12, fontWeight: 600, background: 'rgba(239,68,68,.1)', color: '#ef4444', border: '1px solid rgba(239,68,68,.2)', borderRadius: 8, padding: '9px 18px', cursor: 'pointer', fontFamily: 'Inter,sans-serif', marginRight: 10 }}>Logout</button>
        <button onClick={() => setShowDeleteAccount(true)} style={{ fontSize: 12, fontWeight: 600, background: 'transparent', color: '#ef4444', border: '1px solid rgba(239,68,68,.35)', borderRadius: 8, padding: '9px 18px', cursor: 'pointer', fontFamily: 'Inter,sans-serif' }}>Delete Account</button>

        {showDeleteAccount && (
          <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid rgba(239,68,68,.15)' }}>
            <div style={{ fontSize: 12, color: '#5c574c', marginBottom: 10 }}>This permanently deletes your account, all screening history, job postings, and AI interview data. Enter your password to confirm.</div>
            <input type="password" placeholder="Password" value={deleteAccountPassword} onChange={e => setDeleteAccountPassword(e.target.value)} style={s(inputSt, { marginBottom: 10 })} />
            {deleteAccountError && <div style={{ fontSize: 12, color: '#ef4444', marginBottom: 10 }}>{deleteAccountError}</div>}
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={handleDeleteAccount} disabled={deletingAccount}
                style={{ fontSize: 12, fontWeight: 700, background: '#ef4444', color: '#fff', border: 'none', borderRadius: 8, padding: '9px 18px', cursor: deletingAccount ? 'default' : 'pointer', opacity: deletingAccount ? 0.6 : 1, fontFamily: 'Inter,sans-serif' }}>
                {deletingAccount ? 'Deleting...' : 'Permanently Delete My Account'}
              </button>
              <button onClick={() => { setShowDeleteAccount(false); setDeleteAccountPassword(''); setDeleteAccountError('') }}
                style={{ fontSize: 12, color: '#7a7468', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'Inter,sans-serif' }}>Cancel</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )

  const renderProfile = () => (
    <div style={{ padding: 28, maxWidth: 560 }}>
      <div style={{ fontFamily: "'Space Grotesk', Inter, sans-serif", fontSize: 26, fontWeight: 600, marginBottom: 24 }}>Profile</div>
      <div style={s(card, { display: 'flex', alignItems: 'center', gap: 16, marginBottom: 16 })}>
        <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'linear-gradient(135deg,#0b7c5e,#13c28e)', display: 'grid', placeItems: 'center', fontSize: 20, fontWeight: 700, color: '#fff', flexShrink: 0 }}>HR</div>
        <div>
          <div style={{ fontSize: 18, fontWeight: 600 }}>{userName}</div>
          <div style={{ fontSize: 13, color: '#7a7468' }}>{userEmail}</div>
          <span style={{ fontSize: 10, fontWeight: 600, background: 'rgba(59,130,246,.12)', color: '#3b82f6', padding: '3px 8px', borderRadius: 100, border: '1px solid rgba(59,130,246,.2)', display: 'inline-block', marginTop: 6 }}>Trial Plan</span>
        </div>
      </div>
      <div style={card}>
        <div style={{ fontSize: 12, fontWeight: 600, color: '#7a7468', marginBottom: 12 }}>Activity</div>
        {[
          { l: 'Total Screenings', v: String(totalProcessed) },
          { l: 'Candidates Shortlisted', v: String(history.filter(h => h.status === 'shortlisted').length) },
          { l: 'Candidates Rejected', v: String(history.filter(h => h.status === 'rejected').length) },
        ].map(r => (
          <div key={r.l} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid rgba(10,10,9,.1)' }}>
            <span style={{ fontSize: 13, color: '#5c574c' }}>{r.l}</span>
            <span style={{ fontSize: 13, fontWeight: 600 }}>{r.v}</span>
          </div>
        ))}
      </div>
    </div>
  )

  const renderInterviewer = () => (
    <div style={{ padding: 28, overflowY: 'auto', height: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
        <div>
          <div style={{ fontFamily: "'Space Grotesk', Inter, sans-serif", fontSize: 26, fontWeight: 600, marginBottom: 4 }}>AI Interviewer</div>
          <div style={{ fontSize: 12, color: '#7a7468' }}>Paste a JD, get a shareable link, let candidates interview themselves</div>
        </div>
        {!showInterviewForm && (
          <button onClick={() => setShowInterviewForm(true)}
            style={{ padding: '10px 18px', borderRadius: 8, border: 'none', background: '#e2b04a', color: '#0a0a08', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'Inter,sans-serif' }}>
            + New Interview Link
          </button>
        )}
      </div>

      {showInterviewForm && (
        <div style={{ marginTop: 24, marginBottom: 24 }}>
          <InterviewBuilderWizard onCreated={handleInterviewCreated} onCancel={() => setShowInterviewForm(false)} />
        </div>
      )}

      {interviewPostingsLoading && <div style={{ fontSize: 13, color: '#7a7468', marginTop: 20 }}>Loading...</div>}
      {!interviewPostingsLoading && interviewPostings.length === 0 && !showInterviewForm && (
        <div style={s(card, { textAlign: 'center', padding: 40, color: '#7a7468', marginTop: 20 })}>
          No interview links yet. Create one to start screening candidates conversationally.
        </div>
      )}

      {interviewPostings.length > 0 && (
        <div className={`interview-master-detail${selectedPosting ? ' has-detail' : ''}`} style={{ display: 'flex', gap: 20, height: 'calc(100% - 100px)', overflow: 'hidden', marginTop: showInterviewForm ? 0 : 12 }}>
          {/* Posting list */}
          <div className="interview-master" style={{ width: 300, flexShrink: 0, overflowY: 'auto' }}>
            {interviewPostings.map((p: any) => (
              <div key={p.id} onClick={() => openPosting(p)}
                style={s(card, {
                  marginBottom: 8, cursor: 'pointer',
                  border: `1px solid ${selectedPosting?.id === p.id ? 'rgba(226,176,74,.4)' : 'rgba(10,10,9,.1)'}`,
                  background: selectedPosting?.id === p.id ? 'rgba(226,176,74,.12)' : '#ffffff'
                })}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>{p.title}</div>
                  <span style={{
                    fontSize: 9, fontWeight: 700, padding: '2px 7px', borderRadius: 100,
                    background: p.is_active ? 'rgba(19,194,142,.12)' : '#9c9689',
                    color: p.is_active ? '#13c28e' : '#7a7468'
                  }}>{p.is_active ? 'ACTIVE' : 'PAUSED'}</span>
                </div>
                {p.company && <div style={{ fontSize: 11, color: '#7a7468', marginBottom: 2 }}>{p.company}</div>}
                <div style={{ fontSize: 11, color: '#7a7468', marginBottom: 6 }}>Interviewer: {p.interviewer_name} · {p.candidate_count} candidate{p.candidate_count === 1 ? '' : 's'} interviewed</div>
                <div style={{ display: 'flex', gap: 5, marginBottom: 8 }}>
                  {p.mode === 'chatbot' && <span style={{ fontSize: 9.5, fontWeight: 700, padding: '2px 7px', borderRadius: 100, background: 'rgba(226,176,74,.1)', color: '#e2b04a' }}>💬 CHATBOT</span>}
                  {p.mode === 'mcq' && <span style={{ fontSize: 9.5, fontWeight: 700, padding: '2px 7px', borderRadius: 100, background: 'rgba(19,194,142,.1)', color: '#13c28e' }}>📝 MCQ ×{p.assessment_question_count}</span>}
                  {p.mode === 'voice_agent' && <span style={{ fontSize: 9.5, fontWeight: 700, padding: '2px 7px', borderRadius: 100, background: 'rgba(139,92,246,.12)', color: '#a78bfa' }}>🎙 VOICE AGENT</span>}
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button onClick={(e) => { e.stopPropagation(); copyInterviewLink(p.public_link, p.public_slug) }}
                    style={{ flex: 1, padding: '6px 10px', borderRadius: 6, border: '1px solid rgba(10,10,9,.1)', background: 'transparent', color: '#3a352d', fontSize: 11, cursor: 'pointer', fontFamily: 'Inter,sans-serif' }}>
                    {copiedSlug === p.public_slug ? '✓ Copied' : 'Copy Public Link'}
                  </button>
                  <button onClick={(e) => { e.stopPropagation(); deleteInterviewPosting(p.id) }}
                    style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid rgba(239,68,68,.2)', background: 'rgba(239,68,68,.06)', color: '#ef4444', fontSize: 11, cursor: 'pointer', fontFamily: 'Inter,sans-serif' }}>
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Candidates / report */}
          <div className="interview-detail" style={{ flex: 1, overflowY: 'auto' }}>
            <button onClick={() => setSelectedPosting(null)} className="interview-mobile-back" style={{ display: 'none', background: 'none', border: 'none', color: '#7a7468', fontSize: 12, cursor: 'pointer', marginBottom: 14, padding: 0, fontFamily: 'Inter,sans-serif' }}>← All interview links</button>
            {!selectedPosting ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#9c9689', fontSize: 13 }}>
                Select an interview link to see candidates
              </div>
            ) : selectedReport ? (
              <div>
                <button onClick={() => { setSelectedReport(null); setSelectedRanking(null) }} style={{ background: 'none', border: 'none', color: '#7a7468', fontSize: 12, cursor: 'pointer', marginBottom: 14, padding: 0, fontFamily: 'Inter,sans-serif' }}>← Back to candidates</button>
                <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 16 }}>
                  <div>
                    <div style={{ fontSize: 18, fontWeight: 600 }}>{selectedReport.candidate_name}</div>
                    <div style={{ fontSize: 12, color: '#7a7468' }}>{selectedReport.candidate_email}</div>
                  </div>
                  {selectedReport.ai_score != null && (
                    <div style={{
                      marginLeft: 'auto', fontFamily: "Inter, sans-serif", fontSize: 32, fontWeight: 600,
                      color: selectedReport.ai_score >= 80 ? '#13c28e' : selectedReport.ai_score >= 60 ? '#e2b04a' : '#ef4444'
                    }}>{selectedReport.ai_score}</div>
                  )}
                  {selectedReport.ai_score == null && selectedReport.assessment_score != null && (
                    <div style={{
                      marginLeft: 'auto', fontFamily: "Inter, sans-serif", fontSize: 32, fontWeight: 600,
                      color: selectedReport.assessment_score >= 80 ? '#13c28e' : selectedReport.assessment_score >= 60 ? '#e2b04a' : '#ef4444'
                    }}>{selectedReport.assessment_score}%</div>
                  )}
                </div>
                {selectedReport.final_verdict && (
                  <div style={{
                    display: 'inline-block', fontSize: 11, fontWeight: 700, padding: '4px 12px', borderRadius: 100, marginBottom: 16,
                    background: 'rgba(10,10,9,.05)', color: '#3a352d'
                  }}>{selectedReport.final_verdict}</div>
                )}
                {selectedRanking && (
                  <div style={s(card, { marginBottom: 14 })}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                      <span style={{ fontSize: 13 }}>📄</span>
                      <div style={{ fontSize: 12, fontWeight: 700, color: '#3a352d' }}>Resume Intelligence</div>
                    </div>
                    {selectedRanking.resume_available ? (
                      <>
                        <div style={{ display: 'flex', gap: 20, marginBottom: 10 }}>
                          {selectedRanking.ats_score != null && (
                            <div>
                              <div style={{ fontSize: 20, fontWeight: 700, color: selectedRanking.ats_score >= 70 ? '#13c28e' : selectedRanking.ats_score >= 45 ? '#e2b04a' : '#ef4444' }}>{selectedRanking.ats_score}</div>
                              <div style={{ fontSize: 9, color: '#7a7468' }}>ATS SCORE</div>
                            </div>
                          )}
                          {selectedRanking.skill_match_pct != null && (
                            <div>
                              <div style={{ fontSize: 20, fontWeight: 700, color: selectedRanking.skill_match_pct >= 70 ? '#13c28e' : selectedRanking.skill_match_pct >= 45 ? '#e2b04a' : '#ef4444' }}>{selectedRanking.skill_match_pct}%</div>
                              <div style={{ fontSize: 9, color: '#7a7468' }}>SKILL MATCH</div>
                            </div>
                          )}
                          {selectedRanking.fit_score != null && (
                            <div>
                              <div style={{ fontSize: 20, fontWeight: 700, color: '#a78bfa' }}>{selectedRanking.fit_score}</div>
                              <div style={{ fontSize: 9, color: '#7a7468' }}>OVERALL FIT</div>
                            </div>
                          )}
                        </div>
                        {selectedRanking.matched_skills.length > 0 && (
                          <div style={{ fontSize: 11, color: '#13c28e', marginBottom: 4 }}>✓ Matched: {selectedRanking.matched_skills.join(', ')}</div>
                        )}
                        {selectedRanking.missing_skills.length > 0 && (
                          <div style={{ fontSize: 11, color: '#ef4444', marginBottom: 4 }}>Missing: {selectedRanking.missing_skills.join(', ')}</div>
                        )}
                        {selectedRanking.resume_role_title && (
                          <div style={{ fontSize: 10, color: '#7a7468', marginTop: 6 }}>From candidate&apos;s most recent CV scan (against &ldquo;{selectedRanking.resume_role_title}&rdquo;) — may not be scanned against this exact posting.</div>
                        )}
                      </>
                    ) : (
                      <div style={{ fontSize: 11.5, color: '#7a7468' }}>No linked candidate account or CV scan found for this candidate.</div>
                    )}
                  </div>
                )}
                {selectedReport.status !== 'completed' && (
                  <div style={s(card, { marginBottom: 14, color: '#e2b04a', fontSize: 12 })}>Still in progress — candidate hasn't finished yet.</div>
                )}
                {selectedReport.assessment_score != null && (
                  <div style={s(card, { marginBottom: 14 })}>
                    <div style={{ display: 'flex', alignItems: 'center', marginBottom: 10 }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: '#7a7468' }}>MCQ Assessment</div>
                      <div style={{ marginLeft: 'auto', fontSize: 16, fontWeight: 700, color: selectedReport.assessment_score >= 80 ? '#13c28e' : selectedReport.assessment_score >= 60 ? '#e2b04a' : '#ef4444' }}>{selectedReport.assessment_score}%</div>
                    </div>
                    {selectedReport.assessment_breakdown && (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: (selectedReport.assessment_flags || []).length ? 12 : 0 }}>
                        {Object.entries(selectedReport.assessment_breakdown).map(([topic, stat]: any) => (
                          <div key={topic} style={{ fontSize: 10.5, padding: '4px 9px', borderRadius: 100, background: 'rgba(10,10,9,.035)', color: '#5c574c' }}>
                            {topic}: {stat.correct}/{stat.total}
                          </div>
                        ))}
                      </div>
                    )}
                    {(selectedReport.assessment_flags || []).length > 0 && (
                      <div>
                        <div style={{ fontSize: 11, fontWeight: 600, color: '#ef4444', marginBottom: 6 }}>⚠ Proctoring Flags ({selectedReport.assessment_flags.length})</div>
                        {selectedReport.assessment_flags.map((f: any, i: number) => (
                          <div key={i} style={{ fontSize: 11, color: '#5c574c', marginBottom: 3 }}>
                            {f.type.replace(/_/g, ' ')} — {f.at ? new Date(f.at).toLocaleTimeString() : ''}
                          </div>
                        ))}
                      </div>
                    )}
                    {(selectedReport.assessment_photos || []).length > 0 && (
                      <div style={{ marginTop: 12 }}>
                        <div style={{ fontSize: 11, fontWeight: 600, color: '#7a7468', marginBottom: 8 }}>Proctoring Snapshots ({selectedReport.assessment_photos.length})</div>
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                          {selectedReport.assessment_photos.map((p: string, i: number) => (
                            <img key={i} src={api.getProctoringPhotoUrl(selectedReport.id, p)} alt={`Snapshot ${i + 1}`}
                              style={{ width: 60, height: 60, objectFit: 'cover', borderRadius: 6, border: '1px solid rgba(10,10,9,.1)' }} />
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
                {selectedReport.experience_assessment && (
                  <div style={s(card, { marginBottom: 14 })}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: '#7a7468', marginBottom: 6 }}>Experience Assessment</div>
                    <div style={{ fontSize: 13, color: '#3a352d', lineHeight: 1.7 }}>{selectedReport.experience_assessment}</div>
                  </div>
                )}
                {selectedReport.deep_analysis && (
                  <div style={s(card, { marginBottom: 14 })}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: '#7a7468', marginBottom: 6 }}>Deep Analysis</div>
                    <div style={{ fontSize: 13, color: '#3a352d', lineHeight: 1.7 }}>{selectedReport.deep_analysis}</div>
                  </div>
                )}
                <div style={s(card, {})}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: '#7a7468', marginBottom: 10 }}>Full Transcript</div>
                  {(selectedReport.transcript || []).map((t: any, i: number) => (
                    <div key={i} style={{ marginBottom: 10 }}>
                      <div style={{ fontSize: 10, fontWeight: 700, color: t.role === 'assistant' ? '#e2b04a' : '#13c28e', marginBottom: 2 }}>
                        {t.role === 'assistant' ? 'AI Interviewer' : selectedReport.candidate_name}
                      </div>
                      <div style={{ fontSize: 12, color: '#3a352d', lineHeight: 1.6 }}>{t.content}</div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 4 }}>
                  <div>
                    <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 4 }}>{selectedPosting.title}</div>
                    <div style={{ fontSize: 12, color: '#7a7468' }}>{selectedPosting.public_link}</div>
                  </div>
                  {!interviewCandidatesLoading && interviewCandidates.length > 0 && (
                    <button onClick={() => setShowRanking(v => !v)} style={{
                      flexShrink: 0, fontSize: 12, fontWeight: 700, padding: '9px 16px', borderRadius: 9, cursor: 'pointer',
                      fontFamily: 'Inter,sans-serif', border: 'none',
                      background: showRanking ? '#9c9689' : 'linear-gradient(135deg,#7c3aed,#a78bfa)',
                      color: showRanking ? '#3a352d' : '#fff',
                    }}>
                      {showRanking ? '← Candidate List' : 'Talent Intelligence Ranking'}
                    </button>
                  )}
                </div>
                <div style={{ marginBottom: 20 }} />
                {showRanking ? (
                  <TalentIntelligencePanel
                    postingId={selectedPosting.id}
                    onOpenCandidate={(candidate) => {
                      setSelectedRanking(candidate)
                      api.getInterviewSessionReport(candidate.id).then(setSelectedReport)
                    }}
                  />
                ) : (
                <>
                {interviewCandidatesLoading && <div style={{ fontSize: 13, color: '#7a7468' }}>Loading...</div>}
                {!interviewCandidatesLoading && interviewCandidates.length === 0 && (
                  <div style={s(card, { textAlign: 'center', padding: 30, color: '#7a7468' })}>
                    No candidates yet. Share the public link to start getting interviews.
                  </div>
                )}
                {interviewCandidates.map((c: any) => (
                  <div key={c.id} onClick={() => { if (c.status === 'completed') { setSelectedRanking(null); api.getInterviewSessionReport(c.id).then(setSelectedReport) } }}
                    style={s(card, { marginBottom: 8, cursor: c.status === 'completed' ? 'pointer' : 'default' })}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ width: 30, height: 30, borderRadius: '50%', background: 'linear-gradient(135deg,#0b7c5e,#13c28e)', display: 'grid', placeItems: 'center', fontSize: 11, fontWeight: 700, color: '#fff' }}>
                        {initials(c.candidate_name)}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <div style={{ fontSize: 13, fontWeight: 600 }}>{c.candidate_name}</div>
                          {c.proctoring_flag_count > 0 && (
                            <span title={`${c.proctoring_flag_count} proctoring flag(s)`} style={{ fontSize: 9.5, fontWeight: 700, padding: '1px 6px', borderRadius: 100, background: 'rgba(239,68,68,.12)', color: '#ef4444' }}>⚠ {c.proctoring_flag_count}</span>
                          )}
                        </div>
                        <div style={{ fontSize: 11, color: '#7a7468' }}>
                          {c.status === 'completed' ? (c.final_verdict || 'Completed') : 'In progress...'}
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                        {c.ai_score != null && (
                          <div style={{ textAlign: 'center' }}>
                            <div style={{ fontFamily: "Inter, sans-serif", fontSize: 20, fontWeight: 600, color: c.ai_score >= 80 ? '#13c28e' : c.ai_score >= 60 ? '#e2b04a' : '#ef4444' }}>{c.ai_score}</div>
                            <div style={{ fontSize: 8.5, color: '#9c9689' }}>INTERVIEW</div>
                          </div>
                        )}
                        {c.assessment_score != null && (
                          <div style={{ textAlign: 'center' }}>
                            <div style={{ fontFamily: "Inter, sans-serif", fontSize: 20, fontWeight: 600, color: c.assessment_score >= 80 ? '#13c28e' : c.assessment_score >= 60 ? '#e2b04a' : '#ef4444' }}>{c.assessment_score}%</div>
                            <div style={{ fontSize: 8.5, color: '#9c9689' }}>MCQ</div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
                </>
                )}
              </>
            )}
          </div>

          {selectedReport && (
            <CopilotPanel
              context="candidate_review"
              report={selectedReport}
              candidateName={selectedReport.candidate_name}
              peers={interviewCandidates.map((c: any) => ({ id: c.id, name: c.candidate_name, score: c.ai_score ?? c.assessment_score ?? null }))}
            />
          )}
        </div>
      )}
    </div>
  )

  const renderSection = () => {
    switch (section) {
      case 'dashboard': return renderDashboard()
      case 'bulk': return renderBulk()
      case 'talent-pool': return renderTalentPool()
      case 'candidates': return renderCandidates(activeCandidates, 'All Candidates', 'Run a bulk screening to see candidates here.')
      case 'shortlist': return renderCandidates(shortlistedList, 'Shortlisted', 'No candidates shortlisted yet. Go to All Candidates and shortlist the ones you like.')
      case 'chatbot': return renderChatbot()
      case 'history': return renderHistory()
      case 'open-roles': return renderInterviewer()
      case 'settings': return renderSettings()
      case 'profile': return renderProfile()
      case 'activity': return <ActivityTimeline role="hr" />
      default: return renderDashboard()
    }
  }

  return (
    <NotificationProvider>
    <div style={s(base, { display: 'flex', height: '100vh', overflow: 'hidden' })} className="app-shell">
      <style dangerouslySetInnerHTML={{ __html: `@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}} @keyframes bounce{from{transform:translateY(0)}to{transform:translateY(-4px)}} @keyframes pulse{0%,100%{opacity:.35}50%{opacity:.8}}` }} />

      {/* Mobile top bar — hamburger only, hidden on laptop/desktop via CSS */}
      <div className="app-mobile-topbar">
        <button onClick={() => setMobileNavOpen(true)} aria-label="Open menu" style={{ background: 'transparent', border: '1px solid rgba(255,255,255,.12)', borderRadius: 8, padding: 8, cursor: 'pointer', display: 'flex' }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,.85)" strokeWidth="2" strokeLinecap="round"><path d="M4 6h16M4 12h16M4 18h16" /></svg>
        </button>
        <span style={{ fontFamily: "Inter, sans-serif", fontSize: 18, fontWeight: 600, color: 'rgba(255,255,255,.9)', flex: 1 }}>Talent <span style={{ fontSize: 9, fontWeight: 700, background: 'rgba(19,194,142,.12)', color: '#13c28e', padding: '2px 7px', borderRadius: 100, marginLeft: 4, border: '1px solid rgba(19,194,142,.18)' }}>HR</span></span>
        <NotificationBell role="hr" />
      </div>

      {/* Backdrop — mobile/tablet drawer only */}
      <div className={`app-sidebar-backdrop${mobileNavOpen ? ' open' : ''}`} onClick={() => setMobileNavOpen(false)} />

      {/* SIDEBAR */}
      <div className={`app-sidebar${mobileNavOpen ? ' open' : ''}`} style={{ width: 224, flexShrink: 0, background: '#0c0c0b', borderRight: '1px solid rgba(255,255,255,.05)', display: 'flex', flexDirection: 'column' }}>
        <Link href="/" style={{ padding: '22px 20px', borderBottom: '1px solid rgba(255,255,255,.05)', display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none' }}>
          <div style={{ width: 28, height: 28, background: '#e2b04a', borderRadius: 7, display: 'grid', placeItems: 'center' }}>
            <svg width="12" height="12" viewBox="0 0 16 16" fill="#0a0a08"><path d="M8 2C4.68 2 2 4.68 2 8c0 1.76.72 3.35 1.88 4.5L8 8.5l4.12 4A5.97 5.97 0 0014 8c0-3.32-2.68-6-6-6z" /></svg>
          </div>
          <span style={{ fontFamily: "Inter, sans-serif", fontSize: 20, fontWeight: 600, color: 'rgba(255,255,255,.9)' }}>Talent</span>
          <span style={{ fontSize: 10, fontWeight: 700, background: 'rgba(19,194,142,.12)', color: '#13c28e', padding: '3px 8px', borderRadius: 100, marginLeft: 'auto', border: '1px solid rgba(19,194,142,.18)' }}>HR</span>
          <button onClick={(e) => { e.preventDefault(); setMobileNavOpen(false) }} aria-label="Close menu" className="app-sidebar-close" style={{ background: 'transparent', border: 'none', color: 'rgba(255,255,255,.5)', cursor: 'pointer', padding: 4 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12" /></svg>
          </button>
        </Link>
        <div style={{ padding: '20px 16px 6px', fontSize: 9, fontWeight: 700, letterSpacing: '.14em', textTransform: 'uppercase', color: 'rgba(255,255,255,.18)' }}>Workspace</div>
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {NAV.map(n => (
            <button key={n.id} onClick={() => { setSection(n.id as Section); setMobileNavOpen(false) }}
              style={{
                display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', borderRadius: 6, fontSize: 13, fontWeight: 500, letterSpacing: '.01em',
                color: section === n.id ? 'rgba(255,255,255,.88)' : 'rgba(255,255,255,.38)', cursor: 'pointer', transition: 'all .15s',
                margin: '0 6px 2px', border: section === n.id ? '1px solid rgba(255,255,255,.08)' : '1px solid transparent',
                background: section === n.id ? 'rgba(255,255,255,.04)' : 'transparent',
                fontFamily: 'Inter,sans-serif', width: 'calc(100% - 12px)', textAlign: 'left', minHeight: 40
              }}>
              {n.label}
              {'badge' in n && n.badge ? <span style={{ marginLeft: 'auto', minWidth: 18, height: 18, borderRadius: 9, background: 'rgba(19,194,142,.15)', color: '#13c28e', fontSize: 10, fontWeight: 700, display: 'grid', placeItems: 'center', padding: '0 4px' }}>{n.badge}</span> : null}
            </button>
          ))}
        </div>
        <div style={{ padding: 14, borderTop: '1px solid rgba(255,255,255,.07)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: 8 }}>
            <div style={{ width: 30, height: 30, borderRadius: '50%', background: 'linear-gradient(135deg,#0b7c5e,#13c28e)', display: 'grid', placeItems: 'center', fontSize: 11, fontWeight: 700, color: '#fff', flexShrink: 0 }}>HR</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{userName}</div>
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,.3)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{userEmail}</div>
            </div>
          </div>
          <button onClick={handleLogout} style={{ width: '100%', marginTop: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '10px', borderRadius: 8, border: '1px solid rgba(239,68,68,.15)', background: 'rgba(239,68,68,.06)', color: '#ef4444', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'Inter,sans-serif', minHeight: 40 }}>
            <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9" /></svg>
            Logout
          </button>
        </div>
      </div>

      {/* MAIN CONTENT */}
      <div className="app-main" style={{ flex: 1, overflowY: section === 'history' || section === 'chatbot' ? 'hidden' : 'auto', background: '#0a0a09', minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        <div className="hr-desktop-header" style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', padding: '14px 28px 0' }}>
          <NotificationBell role="hr" />
        </div>
        <div style={{ flex: 1, overflowY: section === 'history' || section === 'chatbot' ? 'hidden' : 'auto' }}>
          {renderSection()}
        </div>
      </div>
      <NotificationToasts />
    </div>
    </NotificationProvider>
  )
}