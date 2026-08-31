'use client'

import { useEffect, useState } from 'react'
import { api } from '@/lib/api'

export type ManualEventDraft = {
    id?: string
    activity_type: string
    title: string
    event_date: string
    event_time: string
    notes: string
    company: string
    role: string
    location_or_link: string
    reminder_offset_minutes: number | null
    related_type?: string | null
    related_id?: string | null
    related_label?: string | null   // display-only, populated when opening an existing linked event for edit
}

const CANDIDATE_TYPES = [
    { key: 'practice', label: 'Practice' },
    { key: 'resume', label: 'Resume / CV' },
    { key: 'interview', label: 'Interview' },
    { key: 'screening', label: 'Screening / Assessment' },
    { key: 'application', label: 'Job Application' },
    { key: 'follow_up', label: 'Follow-up' },
    { key: 'career_goal', label: 'Career Goal' },
    { key: 'meeting', label: 'Meeting' },
    { key: 'other', label: 'Other' },
]
const HR_TYPES = [
    { key: 'interview_scheduled', label: 'Interview Scheduled' },
    { key: 'candidate_review', label: 'Candidate Review' },
    { key: 'screening_deadline', label: 'Screening Deadline' },
    { key: 'follow_up', label: 'Follow-up' },
    { key: 'team_meeting', label: 'Team Hiring Meeting' },
    { key: 'job_deadline', label: 'Job Posting Deadline' },
    { key: 'selected', label: 'Candidate Selected' },
    { key: 'rejected', label: 'Candidate Rejection' },
    { key: 'other', label: 'Custom Reminder' },
]

// Which optional-detail fields make sense for a given type — keeps the base
// form fast (Type/Title/Date/Time/Notes) and only shows more when it's
// actually relevant, per the spec.
const DETAIL_FIELDS: Record<string, ('company' | 'role' | 'location_or_link')[]> = {
    interview: ['company', 'role', 'location_or_link'],
    interview_scheduled: ['company', 'role', 'location_or_link'],
    application: ['company', 'role', 'location_or_link'],
    screening: ['company', 'role'],
    screening_deadline: ['company', 'role'],
    candidate_review: ['company', 'role'],
    follow_up: ['company', 'role'],
    selected: ['company', 'role'],
    rejected: ['company', 'role'],
    team_meeting: ['location_or_link'],
    meeting: ['location_or_link'],
}
const LOCATION_LABEL: Record<string, string> = {
    interview: 'Meeting link', interview_scheduled: 'Meeting link',
    application: 'Job URL', team_meeting: 'Location / link', meeting: 'Location / link',
}

// Which activity types can link to a real existing record, and which kind.
// A candidate can only ever link their own Application; HR can link either
// an Application (a specific candidate) or a Job (e.g. a posting deadline).
const LINKABLE: Record<string, 'application' | 'job'> = {
    interview: 'application', application: 'application', screening: 'application', follow_up: 'application',
    interview_scheduled: 'application', candidate_review: 'application', selected: 'application', rejected: 'application',
    job_deadline: 'job', screening_deadline: 'application',
}

const REMINDER_OPTIONS: { value: number | null; label: string }[] = [
    { value: null, label: 'None' },
    { value: 0, label: 'At time of event' },
    { value: 10, label: '10 minutes before' },
    { value: 30, label: '30 minutes before' },
    { value: 60, label: '1 hour before' },
    { value: 1440, label: '1 day before' },
]

export default function ActivityEventModal({
    role, light, initialDate, existing, onClose, onSaved,
}: {
    role: 'hr' | 'candidate'
    light?: boolean
    initialDate: string
    existing?: ManualEventDraft | null
    onClose: () => void
    onSaved: () => void
}) {
    const types = role === 'hr' ? HR_TYPES : CANDIDATE_TYPES
    const [draft, setDraft] = useState<ManualEventDraft>(existing || {
        activity_type: types[0].key, title: '', event_date: initialDate, event_time: '',
        notes: '', company: '', role: '', location_or_link: '', reminder_offset_minutes: null,
        related_type: null, related_id: null, related_label: null,
    })
    const [saving, setSaving] = useState(false)
    const [err, setErr] = useState('')
    const [linkQuery, setLinkQuery] = useState('')
    const [linkResults, setLinkResults] = useState<{ related_type: string; related_id: string; label: string; subtitle?: string }[]>([])
    const [linkSearching, setLinkSearching] = useState(false)
    const [linkOpen, setLinkOpen] = useState(false)

    const t = light
        ? { text: '#1f1c17', dim: '#7a7468', border: '#e7e4da', inputBg: '#faf9f5', panelBg: '#ffffff' }
        : { text: 'rgba(255,255,255,.92)', dim: 'rgba(255,255,255,.4)', border: 'rgba(255,255,255,.09)', inputBg: '#1a1a17', panelBg: '#141412' }
    const gold = '#e2b04a'

    const detailFields = DETAIL_FIELDS[draft.activity_type] || []
    const linkKind = LINKABLE[draft.activity_type]
    const set = <K extends keyof ManualEventDraft>(k: K, v: ManualEventDraft[K]) => setDraft(d => ({ ...d, [k]: v }))

    // Reset any in-progress link search when the activity type changes to
    // something that links to a different kind of entity (or nothing).
    useEffect(() => { setLinkQuery(''); setLinkResults([]); setLinkOpen(false) }, [linkKind])

    useEffect(() => {
        if (!linkOpen || !linkKind) return
        const handle = setTimeout(() => {
            setLinkSearching(true)
            api.getActivityLinkOptions(linkKind, linkQuery)
                .then((res: any[]) => setLinkResults(res || []))
                .catch(() => setLinkResults([]))
                .finally(() => setLinkSearching(false))
        }, 250)
        return () => clearTimeout(handle)
    }, [linkQuery, linkOpen, linkKind])

    const inputSt: React.CSSProperties = {
        width: '100%', background: t.inputBg, border: `1px solid ${t.border}`, borderRadius: 8,
        padding: '10px 12px', fontSize: 13, color: t.text, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box',
    }
    const labelSt: React.CSSProperties = { fontSize: 11, fontWeight: 700, color: t.dim, textTransform: 'uppercase', letterSpacing: '.03em', marginBottom: 6, display: 'block' }

    const save = async () => {
        if (!draft.title.trim()) { setErr('Give it a title.'); return }
        setSaving(true)
        setErr('')
        const payload = {
            activity_type: draft.activity_type,
            title: draft.title.trim(),
            event_date: draft.event_date,
            event_time: draft.event_time || null,
            notes: draft.notes || null,
            company: draft.company || null,
            role: draft.role || null,
            location_or_link: draft.location_or_link || null,
            reminder_offset_minutes: draft.reminder_offset_minutes,
            related_type: draft.related_type || null,
            related_id: draft.related_id || null,
        }
        try {
            if (draft.id) {
                await api.updateActivityEvent(draft.id, {
                    ...payload,
                    clear_reminder: draft.reminder_offset_minutes === null,
                    clear_link: !draft.related_id,
                })
            } else {
                await api.createActivityEvent(payload)
            }
            onSaved()
        } catch (e: any) {
            setErr(e.message || 'Could not save this activity.')
        } finally {
            setSaving(false)
        }
    }

    return (
        <>
            <div className="activity-detail-backdrop" onClick={onClose} style={{ zIndex: 310 }} />
            <div className="activity-detail modal-sheet" style={{
                position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)', width: 460, maxWidth: '92vw',
                background: t.panelBg, border: `1px solid ${t.border}`, borderRadius: '16px 16px 0 0', padding: 22, zIndex: 320,
                boxShadow: '0 -20px 50px rgba(0,0,0,.5)', maxHeight: '88dvh', overflowY: 'auto',
            }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                    <div style={{ fontSize: 15, fontWeight: 700, color: t.text }}>{draft.id ? 'Edit Activity' : 'Add Activity'}</div>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', color: t.dim, fontSize: 18, cursor: 'pointer', padding: 4 }}>✕</button>
                </div>

                <div style={{ marginBottom: 12 }}>
                    <label style={labelSt}>Activity Type</label>
                    <select value={draft.activity_type} onChange={e => set('activity_type', e.target.value)} style={inputSt}>
                        {types.map(t2 => <option key={t2.key} value={t2.key}>{t2.label}</option>)}
                    </select>
                </div>

                <div style={{ marginBottom: 12 }}>
                    <label style={labelSt}>Title</label>
                    <input value={draft.title} onChange={e => set('title', e.target.value)} placeholder="e.g. Interview with ABC Technologies" style={inputSt} maxLength={200} />
                </div>

                <div style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
                    <div style={{ flex: 1 }}>
                        <label style={labelSt}>Date</label>
                        <input type="date" value={draft.event_date} onChange={e => set('event_date', e.target.value)} style={inputSt} />
                    </div>
                    <div style={{ flex: 1 }}>
                        <label style={labelSt}>Time <span style={{ textTransform: 'none', fontWeight: 400 }}>(optional)</span></label>
                        <input type="time" value={draft.event_time} onChange={e => set('event_time', e.target.value)} style={inputSt} />
                    </div>
                </div>

                {detailFields.includes('company') && (
                    <div style={{ marginBottom: 12 }}>
                        <label style={labelSt}>Company</label>
                        <input value={draft.company} onChange={e => set('company', e.target.value)} placeholder="e.g. ABC Technologies" style={inputSt} />
                    </div>
                )}
                {detailFields.includes('role') && (
                    <div style={{ marginBottom: 12 }}>
                        <label style={labelSt}>Role</label>
                        <input value={draft.role} onChange={e => set('role', e.target.value)} placeholder="e.g. Backend Developer" style={inputSt} />
                    </div>
                )}
                {detailFields.includes('location_or_link') && (
                    <div style={{ marginBottom: 12 }}>
                        <label style={labelSt}>{LOCATION_LABEL[draft.activity_type] || 'Location / link'}</label>
                        <input value={draft.location_or_link} onChange={e => set('location_or_link', e.target.value)} placeholder="e.g. Google Meet URL" style={inputSt} />
                    </div>
                )}

                {linkKind && (
                    <div style={{ marginBottom: 12 }}>
                        <label style={labelSt}>Link to existing {linkKind === 'application' ? (role === 'hr' ? 'candidate' : 'application') : 'job'} <span style={{ textTransform: 'none', fontWeight: 400 }}>(optional)</span></label>
                        {draft.related_id ? (
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: t.inputBg, border: `1px solid ${t.border}`, borderRadius: 8, padding: '9px 12px' }}>
                                <span style={{ fontSize: 12.5, color: t.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                    {draft.related_label || `${draft.company || ''} ${draft.role || ''}`.trim() || 'Linked'}
                                </span>
                                <button onClick={() => { set('related_type', null); set('related_id', null); set('related_label', null) }} style={{ background: 'none', border: 'none', color: t.dim, cursor: 'pointer', fontSize: 14, padding: '0 0 0 8px', flexShrink: 0 }}>✕</button>
                            </div>
                        ) : (
                            <div style={{ position: 'relative' }}>
                                <input
                                    value={linkQuery}
                                    onChange={e => { setLinkQuery(e.target.value); setLinkOpen(true) }}
                                    onFocus={() => setLinkOpen(true)}
                                    placeholder={linkKind === 'application' ? 'Search by name or role…' : 'Search by job title…'}
                                    style={inputSt}
                                />
                                {linkOpen && (linkResults.length > 0 || linkSearching) && (
                                    <div style={{
                                        position: 'absolute', top: '100%', left: 0, right: 0, marginTop: 4, background: t.panelBg,
                                        border: `1px solid ${t.border}`, borderRadius: 8, maxHeight: 180, overflowY: 'auto', zIndex: 10, boxShadow: '0 8px 24px rgba(0,0,0,.25)',
                                    }}>
                                        {linkSearching && <div style={{ padding: 10, fontSize: 12, color: t.dim }}>Searching…</div>}
                                        {!linkSearching && linkResults.map(r => (
                                            <button key={r.related_id} onClick={() => {
                                                set('related_type', r.related_type); set('related_id', r.related_id); set('related_label', r.label)
                                                setLinkOpen(false)
                                            }} style={{
                                                display: 'block', width: '100%', textAlign: 'left', background: 'none', border: 'none',
                                                borderBottom: `1px solid ${t.border}`, padding: '9px 12px', cursor: 'pointer', fontFamily: 'inherit',
                                            }}>
                                                <div style={{ fontSize: 12.5, color: t.text }}>{r.label}</div>
                                                {r.subtitle && <div style={{ fontSize: 10.5, color: t.dim }}>{r.subtitle}</div>}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                )}

                <div style={{ marginBottom: 12 }}>
                    <label style={labelSt}>Notes <span style={{ textTransform: 'none', fontWeight: 400 }}>(optional)</span></label>
                    <textarea value={draft.notes} onChange={e => set('notes', e.target.value)} placeholder="Any additional information…" rows={3} style={{ ...inputSt, resize: 'vertical', fontFamily: 'inherit' }} />
                </div>

                <div style={{ marginBottom: 18 }}>
                    <label style={labelSt}>Reminder</label>
                    <select value={draft.reminder_offset_minutes === null ? 'none' : String(draft.reminder_offset_minutes)}
                        onChange={e => set('reminder_offset_minutes', e.target.value === 'none' ? null : Number(e.target.value))} style={inputSt}>
                        {REMINDER_OPTIONS.map(o => <option key={o.label} value={o.value === null ? 'none' : o.value}>{o.label}</option>)}
                    </select>
                </div>

                {err && <div style={{ fontSize: 12, color: '#f87171', marginBottom: 12 }}>{err}</div>}

                <button onClick={save} disabled={saving} style={{
                    width: '100%', background: gold, color: '#0a0a08', fontWeight: 700, fontSize: 13, padding: '12px',
                    borderRadius: 8, border: 'none', cursor: saving ? 'default' : 'pointer', fontFamily: 'inherit', opacity: saving ? .7 : 1,
                }}>
                    {saving ? 'Saving…' : draft.id ? 'Save Changes' : 'Add Activity'}
                </button>
            </div>
        </>
    )
}