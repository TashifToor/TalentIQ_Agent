'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { api } from '@/lib/api'
import { GlassCard } from '@/components/shared/primitives'
import ActivityEventModal, { ManualEventDraft } from '@/components/ActivityEventModal'

type ActivityItem = {
    id: string
    type: string
    title: string
    description?: string | null
    occurred_at: string
    related_type?: string | null
    related_id?: string | null
    action_url?: string | null
    source: 'system' | 'manual'
    status?: string | null
    has_time: boolean
    event_id?: string | null
    created_by_name?: string | null
    is_own: boolean
}

const gold = '#e2b04a'

const TYPE_ICON: Record<string, JSX.Element> = {
    application_received: <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />,
    new_application: <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />,
    interview_invitation: <><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M8 2v4M16 2v4M3 10h18" /></>,
    interview_completed: <><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M8 2v4M16 2v4M3 10h18" /></>,
    application_accepted: <path d="M20 6L9 17l-5-5" />,
    candidate_accepted: <path d="M20 6L9 17l-5-5" />,
    application_rejected: <path d="M18 6L6 18M6 6l12 12" />,
    candidate_rejected: <path d="M18 6L6 18M6 6l12 12" />,
    practice_session: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 3" /></>,
    ats_screening_completed: <path d="M9 11l3 3L22 4M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" />,
    ai_screening_completed: <path d="M9 11l3 3L22 4M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" />,
    screening_failed: <><circle cx="12" cy="12" r="10" /><path d="M12 8v4M12 16h.01" /></>,
    job_created: <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />,
    // Manual planner types
    practice: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 3" /></>,
    resume: <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />,
    interview: <><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M8 2v4M16 2v4M3 10h18" /></>,
    screening: <path d="M9 11l3 3L22 4M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" />,
    application: <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />,
    follow_up: <><path d="M3 12a9 9 0 1 0 3-6.7" /><path d="M3 4v5h5" /></>,
    career_goal: <><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="5" /><circle cx="12" cy="12" r="1" /></>,
    meeting: <><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" /></>,
    interview_scheduled: <><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M8 2v4M16 2v4M3 10h18" /></>,
    candidate_review: <path d="M9 11l3 3L22 4M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" />,
    screening_deadline: <><circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" /></>,
    team_meeting: <><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" /></>,
    job_deadline: <><circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" /></>,
    selected: <path d="M20 6L9 17l-5-5" />,
    rejected: <path d="M18 6L6 18M6 6l12 12" />,
    other: <><circle cx="12" cy="12" r="9" /><path d="M12 8v4M12 16h.01" /></>,
}
function iconFor(type: string) {
    return TYPE_ICON[type] || <><circle cx="12" cy="12" r="9" /><path d="M12 8v4M12 16h.01" /></>
}

// Restrained, existing-token category colors for calendar dots/icons — lets a date's
// dots hint at what kind of activity happened without introducing new colors.
const CATEGORY_COLOR: Record<string, string> = {
    practice_session: '#a78bfa', practice: '#a78bfa',
    application_received: '#4f46e5', new_application: '#4f46e5', job_created: '#4f46e5', application: '#4f46e5', job_deadline: '#4f46e5',
    ats_screening_completed: '#13c28e', ai_screening_completed: '#13c28e', screening: '#13c28e', screening_deadline: '#13c28e', candidate_review: '#13c28e',
    screening_failed: '#ef4444', rejected: '#ef4444',
    interview_invitation: '#e2b04a', interview_completed: '#e2b04a', interview: '#e2b04a', interview_scheduled: '#e2b04a',
    application_accepted: '#13c28e', candidate_accepted: '#13c28e', selected: '#13c28e',
    application_rejected: '#ef4444', candidate_rejected: '#ef4444',
    resume: '#4f46e5', follow_up: '#a78bfa', career_goal: '#e2b04a', meeting: '#4f46e5', team_meeting: '#4f46e5',
}
function colorFor(type: string) { return CATEGORY_COLOR[type] || gold }

const CANDIDATE_FILTERS = [
    { key: 'all', label: 'All' },
    { key: 'applications', label: 'Applications', match: (t: string) => t === 'application_received' || t === 'application' },
    { key: 'interviews', label: 'Interviews', match: (t: string) => ['interview_invitation', 'interview_completed', 'interview'].includes(t) },
    { key: 'practice', label: 'Practice', match: (t: string) => t === 'practice_session' || t === 'practice' },
    { key: 'decisions', label: 'Decisions', match: (t: string) => t === 'application_accepted' || t === 'application_rejected' },
    { key: 'planned', label: 'My Plan', match: (t: string) => false }, // special-cased below via source
]
const HR_FILTERS = [
    { key: 'all', label: 'All' },
    { key: 'candidates', label: 'Candidates', match: (t: string) => t === 'new_application' },
    { key: 'interviews', label: 'Interviews', match: (t: string) => ['interview_completed', 'interview_scheduled'].includes(t) },
    { key: 'screening', label: 'Screening', match: (t: string) => ['ats_screening_completed', 'ai_screening_completed', 'screening_failed', 'screening_deadline', 'candidate_review'].includes(t) },
    { key: 'decisions', label: 'Decisions', match: (t: string) => ['candidate_accepted', 'candidate_rejected', 'selected', 'rejected'].includes(t) },
    { key: 'jobs', label: 'Jobs', match: (t: string) => t === 'job_created' },
    { key: 'planned', label: 'My Plan', match: (t: string) => false },
]

const CANDIDATE_SUMMARY_LABELS: [string, string][] = [
    ['applications', 'Applications'], ['interviews', 'Interviews'], ['practice_sessions', 'Practice Sessions'], ['planned_activities', 'Upcoming Plans'],
]
const HR_SUMMARY_LABELS: [string, string][] = [
    ['candidates', 'Candidates'], ['interviews', 'Interviews'], ['decisions', 'Decisions'], ['planned_activities', 'Upcoming Plans'],
]

const STATUS_LABEL: Record<string, string> = { planned: 'Planned', completed: 'Completed', cancelled: 'Cancelled' }

function fmtDateKey(d: Date) { return d.toISOString().slice(0, 10) }
function fmtMonthYear(d: Date) { return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) }
function startOfMonth(d: Date) { return new Date(d.getFullYear(), d.getMonth(), 1) }
function endOfMonth(d: Date) { return new Date(d.getFullYear(), d.getMonth() + 1, 0) }

export default function ActivityTimeline({ role, light }: { role: 'hr' | 'candidate'; light?: boolean }) {
    const router = useRouter()
    const [month, setMonth] = useState(() => startOfMonth(new Date()))
    const [activities, setActivities] = useState<ActivityItem[]>([])
    const [summary, setSummary] = useState<Record<string, number>>({})
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')
    const [selectedDate, setSelectedDate] = useState<Date>(new Date())
    const [dateExplicitlySelected, setDateExplicitlySelected] = useState(false)
    const [search, setSearch] = useState('')
    const [filter, setFilter] = useState('all')
    const [detail, setDetail] = useState<ActivityItem | null>(null)
    const [modalOpen, setModalOpen] = useState(false)
    const [editingDraft, setEditingDraft] = useState<ManualEventDraft | null>(null)
    const [pendingDate, setPendingDate] = useState(fmtDateKey(new Date()))
    const [busyId, setBusyId] = useState<string | null>(null)
    const [reloadKey, setReloadKey] = useState(0)

    const t = light
        ? { text: '#1f1c17', dim: '#7a7468', faint: '#9c9689', border: '#e7e4da', inputBg: '#faf9f5', panelBg: '#ffffff', hoverBg: '#f0eee6', muted: 'rgba(10,10,9,.045)' }
        : { text: 'rgba(255,255,255,.92)', dim: 'rgba(255,255,255,.4)', faint: 'rgba(255,255,255,.15)', border: 'rgba(255,255,255,.09)', inputBg: '#1a1a17', panelBg: '#141412', hoverBg: 'rgba(255,255,255,.05)', muted: 'rgba(255,255,255,.05)' }

    const filters = role === 'hr' ? HR_FILTERS : CANDIDATE_FILTERS
    const summaryLabels = role === 'hr' ? HR_SUMMARY_LABELS : CANDIDATE_SUMMARY_LABELS

    const loadActivities = () => {
        let cancelled = false
        setLoading(true)
        setError('')
        api.getActivities(fmtDateKey(startOfMonth(month)), fmtDateKey(endOfMonth(month)))
            .then(res => {
                if (cancelled) return
                setActivities(res.activities || [])
                setSummary(res.summary || {})
            })
            .catch(e => { if (!cancelled) setError(e.message || 'Could not load activity.') })
            .finally(() => { if (!cancelled) setLoading(false) })
        return () => { cancelled = true }
    }

    useEffect(() => loadActivities(), [month, reloadKey])

    const activeFilterFn = filters.find(f => f.key === filter)?.match

    const filtered = useMemo(() => {
        let list = activities
        if (filter === 'planned') list = list.filter(a => a.source === 'manual')
        else if (activeFilterFn) list = list.filter(a => activeFilterFn(a.type))
        if (search.trim()) {
            const q = search.trim().toLowerCase()
            list = list.filter(a => a.title.toLowerCase().includes(q) || (a.description || '').toLowerCase().includes(q) || a.type.toLowerCase().includes(q))
        }
        return list
    }, [activities, activeFilterFn, filter, search])

    const byDateKey = useMemo(() => {
        const map: Record<string, ActivityItem[]> = {}
        for (const a of filtered) {
            const key = a.occurred_at.slice(0, 10)
            if (!map[key]) map[key] = []
            map[key].push(a)
        }
        return map
    }, [filtered])

    const selectedKey = fmtDateKey(selectedDate)
    const dayActivities = (byDateKey[selectedKey] || []).sort((a, b) => a.occurred_at.localeCompare(b.occurred_at))

    const groupedByMonth = useMemo(() => {
        const dateKeys = Object.keys(byDateKey).sort((a, b) => b.localeCompare(a))
        return dateKeys.map(key => ({
            key,
            date: new Date(key + 'T00:00:00'),
            items: [...byDateKey[key]].sort((a, b) => a.occurred_at.localeCompare(b.occurred_at)),
        }))
    }, [byDateKey])

    // ── Calendar grid (Monday-start, 6 rows) ──
    const gridStart = new Date(startOfMonth(month))
    const leadingBlank = (gridStart.getDay() + 6) % 7 // Mon=0
    gridStart.setDate(gridStart.getDate() - leadingBlank)
    const cells: Date[] = []
    for (let i = 0; i < 42; i++) {
        const d = new Date(gridStart)
        d.setDate(gridStart.getDate() + i)
        cells.push(d)
    }
    const todayKey = fmtDateKey(new Date())

    const goToday = () => { const tt = new Date(); setMonth(startOfMonth(tt)); setSelectedDate(tt); setDateExplicitlySelected(false) }
    const goPrevMonth = () => { setMonth(m => new Date(m.getFullYear(), m.getMonth() - 1, 1)); setDateExplicitlySelected(false) }
    const goNextMonth = () => { setMonth(m => new Date(m.getFullYear(), m.getMonth() + 1, 1)); setDateExplicitlySelected(false) }

    const handleActivityAction = (a: ActivityItem) => {
        if (a.action_url) router.push(a.action_url)
    }

    const openCreate = (dateKey?: string) => {
        setEditingDraft(null)
        setDetail(null)
        setPendingDate(dateKey || selectedKey)
        setModalOpen(true)
    }

    const openEdit = (a: ActivityItem) => {
        if (a.source !== 'manual' || !a.event_id || !a.is_own) return
        const occ = new Date(a.occurred_at)
        const hasRealLink = !!a.related_type && a.related_type !== 'activity_event'
        setEditingDraft({
            id: a.event_id,
            activity_type: a.type,
            title: a.title,
            event_date: a.occurred_at.slice(0, 10),
            event_time: a.has_time ? occ.toISOString().slice(11, 16) : '',
            notes: a.description || '',
            company: '', role: '', location_or_link: '',
            reminder_offset_minutes: null,
            related_type: hasRealLink ? a.related_type : null,
            related_id: hasRealLink ? a.related_id : null,
            related_label: hasRealLink ? a.description || a.title : null,
        })
        setDetail(null)
        setModalOpen(true)
    }

    const setStatus = async (a: ActivityItem, status: 'planned' | 'completed' | 'cancelled') => {
        if (!a.event_id) return
        setBusyId(a.event_id)
        try {
            await api.updateActivityEventStatus(a.event_id, status)
            setReloadKey(k => k + 1)
            setDetail(null)
        } catch (e) {
            // Leave the item as-is; the person can retry.
        } finally {
            setBusyId(null)
        }
    }

    const deleteEvent = async (a: ActivityItem) => {
        if (!a.event_id) return
        setBusyId(a.event_id)
        try {
            await api.deleteActivityEvent(a.event_id)
            setReloadKey(k => k + 1)
            setDetail(null)
        } catch (e) {
            // no-op — item stays, person can retry
        } finally {
            setBusyId(null)
        }
    }

    const statusDotStyle = (a: ActivityItem): React.CSSProperties => {
        const color = colorFor(a.type)
        if (a.source !== 'manual' || a.status === 'completed') return { width: 4, height: 4, borderRadius: 2, background: color }
        if (a.status === 'cancelled') return { width: 4, height: 4, borderRadius: 2, background: color, opacity: .3 }
        // planned — outline ring, not filled, so "hasn't happened yet" reads at a glance
        return { width: 4, height: 4, borderRadius: 2, background: 'transparent', border: `1px solid ${color}` }
    }

    const renderSourceBadge = (a: ActivityItem) => (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <span style={{
                fontSize: 9, fontWeight: 700, letterSpacing: '.03em', textTransform: 'uppercase', padding: '2px 6px', borderRadius: 100,
                background: a.source === 'manual' ? 'rgba(167,139,250,.12)' : 'rgba(226,176,74,.1)',
                color: a.source === 'manual' ? '#a78bfa' : gold, flexShrink: 0,
            }}>
                {a.source === 'manual' ? 'Personal Plan' : 'TalentIQ Activity'}
            </span>
            {a.source === 'manual' && !a.is_own && a.created_by_name && (
                <span style={{ fontSize: 10.5, color: t.dim }}>by {a.created_by_name}</span>
            )}
        </span>
    )

    const renderStatusBadge = (a: ActivityItem) => {
        if (a.source !== 'manual' || !a.status) return null
        const color = a.status === 'completed' ? '#13c28e' : a.status === 'cancelled' ? t.faint : gold
        return (
            <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '.03em', textTransform: 'uppercase', color, flexShrink: 0 }}>
                {STATUS_LABEL[a.status]}
            </span>
        )
    }

    return (
        <div className="activity-timeline" style={{ maxWidth: 1120, margin: '0 auto', padding: '24px 24px 60px' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 18, flexWrap: 'wrap' }}>
                <div>
                    <div style={{ fontFamily: "'Space Grotesk', Inter, sans-serif", fontSize: 22, fontWeight: 700, color: t.text }}>Activity & Planner</div>
                    <div style={{ fontSize: 12.5, color: t.dim, marginTop: 2 }}>
                        {role === 'hr' ? 'Recruitment activity and your own reminders, chronologically.' : 'Your TalentIQ journey, organized by date.'}
                    </div>
                </div>
                <button onClick={() => openCreate()} style={{
                    fontSize: 12.5, fontWeight: 700, color: '#0a0a08', background: gold, border: 'none', borderRadius: 8,
                    padding: '10px 16px', cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0,
                }}>+ Add Activity</button>
            </div>

            {/* Summary strip — only real counts, all-time */}
            <GlassCard light={light} style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 10.5, fontWeight: 700, color: t.dim, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 12 }}>
                    {role === 'hr' ? 'Recruitment Activity' : 'Your Activity'}
                </div>
                <div className="responsive-grid-4" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14 }}>
                    {summaryLabels.map(([key, label]) => (
                        <div key={key}>
                            <div style={{ fontSize: 22, fontWeight: 700, color: gold }}>{summary[key] ?? 0}</div>
                            <div style={{ fontSize: 11, color: t.dim, marginTop: 2 }}>{label}</div>
                        </div>
                    ))}
                </div>
            </GlassCard>

            {/* Search + filters */}
            <div style={{ display: 'flex', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
                <input
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder={role === 'hr' ? 'Search candidate, role, company…' : 'Search company, role, activity…'}
                    style={{ flex: '1 1 220px', minWidth: 0, background: t.inputBg, border: `1px solid ${t.border}`, borderRadius: 8, padding: '9px 12px', fontSize: 13, color: t.text, outline: 'none' }}
                />
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {filters.map(f => (
                        <button key={f.key} onClick={() => setFilter(f.key)} style={{
                            fontSize: 12, fontWeight: 600, padding: '8px 13px', borderRadius: 100, cursor: 'pointer', fontFamily: 'inherit',
                            border: `1px solid ${filter === f.key ? gold : t.border}`, background: filter === f.key ? 'rgba(226,176,74,.1)' : 'transparent',
                            color: filter === f.key ? gold : t.dim, minHeight: 36,
                        }}>{f.label}</button>
                    ))}
                </div>
            </div>

            <div className="activity-layout" style={{ display: 'flex', gap: 18, alignItems: 'flex-start' }}>
                {/* Calendar */}
                <GlassCard light={light} className="activity-calendar" style={{ flex: '1 1 380px', minWidth: 300 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                        <button onClick={goPrevMonth} aria-label="Previous month" style={{ background: 'transparent', border: `1px solid ${t.border}`, borderRadius: 7, width: 30, height: 30, color: t.dim, cursor: 'pointer' }}>‹</button>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <span style={{ fontSize: 14, fontWeight: 700, color: t.text }}>{fmtMonthYear(month)}</span>
                            <button onClick={goToday} style={{ fontSize: 11, fontWeight: 600, color: gold, background: 'rgba(226,176,74,.1)', border: `1px solid ${gold}40`, borderRadius: 100, padding: '4px 10px', cursor: 'pointer' }}>Today</button>
                        </div>
                        <button onClick={goNextMonth} aria-label="Next month" style={{ background: 'transparent', border: `1px solid ${t.border}`, borderRadius: 7, width: 30, height: 30, color: t.dim, cursor: 'pointer' }}>›</button>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 4, marginBottom: 6 }}>
                        {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(d => (
                            <div key={d} style={{ fontSize: 10, fontWeight: 700, color: t.dim, textAlign: 'center', textTransform: 'uppercase' }}>{d}</div>
                        ))}
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 4 }}>
                        {cells.map((d, i) => {
                            const key = fmtDateKey(d)
                            const inMonth = d.getMonth() === month.getMonth()
                            const dayItems = byDateKey[key] || []
                            const count = dayItems.length
                            const isToday = key === todayKey
                            const isSelected = dateExplicitlySelected && key === selectedKey
                            return (
                                <button key={i} onClick={() => { setSelectedDate(d); setDateExplicitlySelected(true) }} disabled={!inMonth} style={{
                                    aspectRatio: '1', minHeight: 40, border: isSelected ? `1px solid ${gold}` : `1px solid transparent`,
                                    borderRadius: 8, background: isSelected ? 'rgba(226,176,74,.12)' : isToday ? t.muted : 'transparent',
                                    color: !inMonth ? t.faint : t.text, cursor: inMonth ? 'pointer' : 'default',
                                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 3, fontFamily: 'inherit',
                                }}>
                                    <span style={{ fontSize: 12, fontWeight: isToday ? 800 : 500 }}>{d.getDate()}</span>
                                    {inMonth && count > 0 && (
                                        count <= 3 ? (
                                            <span style={{ display: 'flex', gap: 2 }}>
                                                {dayItems.slice(0, 3).map((it, j) => <span key={j} style={statusDotStyle(it)} />)}
                                            </span>
                                        ) : (
                                            <span style={{ fontSize: 8.5, fontWeight: 700, color: gold }}>+{count}</span>
                                        )
                                    )}
                                </button>
                            )
                        })}
                    </div>
                </GlassCard>

                {/* Day panel: compact date-grouped activity log by default (spreadsheet-
                    style, most recent date first); narrows to one date once clicked. */}
                <GlassCard light={light} className="activity-day-panel" style={{ flex: '1 1 340px', minWidth: 300, maxHeight: 520, overflowY: 'auto' }}>
                    {dateExplicitlySelected ? (
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 }}>
                            <div style={{ fontSize: 14, fontWeight: 700, color: t.text }}>
                                {selectedDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}
                            </div>
                            <button onClick={() => setDateExplicitlySelected(false)} style={{ fontSize: 11, fontWeight: 600, color: gold, background: 'transparent', border: 'none', cursor: 'pointer', padding: 0 }}>Show all ✕</button>
                        </div>
                    ) : (
                        <div style={{ fontSize: 14, fontWeight: 700, color: t.text, marginBottom: 2 }}>{fmtMonthYear(month)}</div>
                    )}
                    <div style={{ fontSize: 11.5, color: t.dim, marginBottom: 14 }}>
                        {dateExplicitlySelected
                            ? `${dayActivities.length} ${dayActivities.length === 1 ? 'activity' : 'activities'}`
                            : `${filtered.length} ${filtered.length === 1 ? 'activity' : 'activities'} this month`}
                    </div>

                    {loading && <div style={{ fontSize: 12.5, color: t.dim, padding: '12px 0' }}>Loading…</div>}
                    {error && <div style={{ fontSize: 12.5, color: '#f87171', padding: '12px 0' }}>{error}</div>}
                    {!loading && !error && (dateExplicitlySelected ? dayActivities.length === 0 : groupedByMonth.length === 0) && (
                        <div style={{ fontSize: 12.5, color: t.dim, padding: '20px 0', textAlign: 'center' }}>
                            {dateExplicitlySelected ? 'No activities planned for this day.' : 'No activity yet'}<br />
                            {!dateExplicitlySelected && (
                                <span style={{ fontSize: 11 }}>{role === 'hr' ? 'Recruitment activity will appear here as it happens.' : 'Your TalentIQ activity will appear here as you apply, interview, practice, and make progress.'}</span>
                            )}
                            <div style={{ marginTop: 14 }}>
                                <button onClick={() => openCreate(dateExplicitlySelected ? selectedKey : undefined)} style={{
                                    fontSize: 12, fontWeight: 700, color: gold, background: 'rgba(226,176,74,.1)', border: `1px solid ${gold}40`,
                                    borderRadius: 100, padding: '7px 14px', cursor: 'pointer', fontFamily: 'inherit',
                                }}>+ Add Activity</button>
                            </div>
                        </div>
                    )}

                    {dateExplicitlySelected ? (
                        <div style={{ position: 'relative' }}>
                            {dayActivities.map((a, i) => (
                                <div key={a.id} style={{ display: 'flex', gap: 12, position: 'relative', paddingBottom: i < dayActivities.length - 1 ? 18 : 0 }}>
                                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
                                        <span style={{ width: 26, height: 26, borderRadius: 8, background: t.muted, display: 'flex', alignItems: 'center', justifyContent: 'center', color: colorFor(a.type), flexShrink: 0, opacity: a.status === 'cancelled' ? .4 : 1 }}>
                                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">{iconFor(a.type)}</svg>
                                        </span>
                                        {i < dayActivities.length - 1 && <span style={{ width: 1, flex: 1, background: t.border, marginTop: 4 }} />}
                                    </div>
                                    <button onClick={() => setDetail(a)} style={{ flex: 1, minWidth: 0, textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', padding: 0, opacity: a.status === 'cancelled' ? .5 : 1 }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                            <span style={{ fontSize: 11, color: t.dim }}>{a.has_time ? new Date(a.occurred_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) : 'All day'}</span>
                                            {renderSourceBadge(a)}
                                            {renderStatusBadge(a)}
                                        </div>
                                        <div style={{ fontSize: 13, fontWeight: 700, color: t.text, marginTop: 3, textDecoration: a.status === 'cancelled' ? 'line-through' : 'none' }}>{a.title}</div>
                                        {a.description && <div style={{ fontSize: 11.5, color: t.dim, marginTop: 2, lineHeight: 1.4 }}>{a.description}</div>}
                                    </button>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div>
                            {groupedByMonth.map(group => (
                                <div key={group.key} style={{ marginBottom: 16 }}>
                                    <button onClick={() => { setSelectedDate(group.date); setDateExplicitlySelected(true) }} style={{ fontSize: 11, fontWeight: 700, color: gold, background: 'none', border: 'none', padding: 0, marginBottom: 8, cursor: 'pointer', textTransform: 'uppercase', letterSpacing: '.04em' }}>
                                        {group.date.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}
                                    </button>
                                    <div style={{ borderTop: `1px solid ${t.border}` }} />
                                    {group.items.map((a, i) => (
                                        <button key={a.id} onClick={() => setDetail(a)} style={{
                                            width: '100%', display: 'flex', alignItems: 'flex-start', gap: 10, textAlign: 'left',
                                            background: 'none', border: 'none', borderBottom: i < group.items.length - 1 ? `1px solid ${t.border}` : 'none',
                                            cursor: 'pointer', fontFamily: 'inherit', padding: '10px 0', opacity: a.status === 'cancelled' ? .5 : 1,
                                        }}>
                                            <span style={{ width: 22, height: 22, borderRadius: 6, background: t.muted, display: 'flex', alignItems: 'center', justifyContent: 'center', color: colorFor(a.type), flexShrink: 0, marginTop: 1 }}>
                                                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">{iconFor(a.type)}</svg>
                                            </span>
                                            <div style={{ flex: 1, minWidth: 0 }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                                                    <div style={{ fontSize: 13, fontWeight: 700, color: t.text, textDecoration: a.status === 'cancelled' ? 'line-through' : 'none' }}>{a.title}</div>
                                                    {renderSourceBadge(a)}
                                                    {renderStatusBadge(a)}
                                                </div>
                                                {a.description && <div style={{ fontSize: 11.5, color: t.dim, marginTop: 2, lineHeight: 1.4 }}>{a.description}</div>}
                                            </div>
                                            <div style={{ fontSize: 10.5, color: t.dim, flexShrink: 0, whiteSpace: 'nowrap' }}>{a.has_time ? new Date(a.occurred_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) : 'All day'}</div>
                                        </button>
                                    ))}
                                </div>
                            ))}
                        </div>
                    )}
                </GlassCard>
            </div>

            {/* Detail drawer/modal */}
            {detail && (
                <>
                    <div className="activity-detail-backdrop" onClick={() => setDetail(null)} />
                    <div className="activity-detail modal-sheet" style={{
                        position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)', width: 420, maxWidth: '92vw',
                        background: t.panelBg, border: `1px solid ${t.border}`, borderRadius: '16px 16px 0 0', padding: 22, zIndex: 300,
                        boxShadow: '0 -20px 50px rgba(0,0,0,.5)', maxHeight: '85dvh', overflowY: 'auto',
                    }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                            <div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                                    {renderSourceBadge(detail)}
                                    {renderStatusBadge(detail)}
                                </div>
                                <div style={{ fontSize: 16, fontWeight: 700, color: t.text }}>{detail.title}</div>
                                {detail.description && <div style={{ fontSize: 12.5, color: t.dim, marginTop: 4 }}>{detail.description}</div>}
                            </div>
                            <button onClick={() => setDetail(null)} style={{ background: 'none', border: 'none', color: t.dim, fontSize: 18, cursor: 'pointer', padding: 4 }}>✕</button>
                        </div>
                        <div style={{ display: 'flex', gap: 24, marginBottom: 18 }}>
                            <div>
                                <div style={{ fontSize: 10, color: t.dim, textTransform: 'uppercase', marginBottom: 3 }}>Date</div>
                                <div style={{ fontSize: 12.5, color: t.text }}>{new Date(detail.occurred_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</div>
                            </div>
                            {detail.has_time && (
                                <div>
                                    <div style={{ fontSize: 10, color: t.dim, textTransform: 'uppercase', marginBottom: 3 }}>Time</div>
                                    <div style={{ fontSize: 12.5, color: t.text }}>{new Date(detail.occurred_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}</div>
                                </div>
                            )}
                        </div>

                        {detail.source === 'manual' ? (
                            detail.is_own ? (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                    {detail.status !== 'completed' && (
                                        <button disabled={busyId === detail.event_id} onClick={() => setStatus(detail, 'completed')} style={{
                                            width: '100%', background: 'rgba(19,194,142,.12)', color: '#13c28e', fontWeight: 700, fontSize: 13, padding: '11px',
                                            borderRadius: 8, border: '1px solid rgba(19,194,142,.25)', cursor: 'pointer', fontFamily: 'inherit',
                                        }}>✓ Mark Complete</button>
                                    )}
                                    <button disabled={busyId === detail.event_id} onClick={() => openEdit(detail)} style={{
                                        width: '100%', background: gold, color: '#0a0a08', fontWeight: 700, fontSize: 13, padding: '11px',
                                        borderRadius: 8, border: 'none', cursor: 'pointer', fontFamily: 'inherit',
                                    }}>Edit</button>
                                    <div style={{ display: 'flex', gap: 8 }}>
                                        {detail.status !== 'cancelled' && (
                                            <button disabled={busyId === detail.event_id} onClick={() => setStatus(detail, 'cancelled')} style={{
                                                flex: 1, background: t.muted, color: t.dim, fontWeight: 600, fontSize: 12.5, padding: '10px',
                                                borderRadius: 8, border: `1px solid ${t.border}`, cursor: 'pointer', fontFamily: 'inherit',
                                            }}>Cancel</button>
                                        )}
                                        <button disabled={busyId === detail.event_id} onClick={() => deleteEvent(detail)} style={{
                                            flex: 1, background: 'rgba(239,68,68,.08)', color: '#ef4444', fontWeight: 600, fontSize: 12.5, padding: '10px',
                                            borderRadius: 8, border: '1px solid rgba(239,68,68,.15)', cursor: 'pointer', fontFamily: 'inherit',
                                        }}>Delete</button>
                                    </div>
                                </div>
                            ) : (
                                <div style={{ fontSize: 11.5, color: t.dim }}>
                                    {detail.created_by_name ? `Added by ${detail.created_by_name} — only they can edit or complete this.` : "This was added by a teammate — only they can edit or complete it."}
                                </div>
                            )
                        ) : detail.action_url ? (
                            <button onClick={() => handleActivityAction(detail)} style={{ width: '100%', background: gold, color: '#0a0a08', fontWeight: 700, fontSize: 13, padding: '11px', borderRadius: 8, border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>
                                View Details
                            </button>
                        ) : (
                            <div style={{ fontSize: 11.5, color: t.dim }}>No additional details available for this activity.</div>
                        )}
                    </div>
                </>
            )}

            {modalOpen && (
                <ActivityEventModal
                    role={role}
                    light={light}
                    initialDate={pendingDate}
                    existing={editingDraft}
                    onClose={() => setModalOpen(false)}
                    onSaved={() => { setModalOpen(false); setReloadKey(k => k + 1) }}
                />
            )}
        </div>
    )
}