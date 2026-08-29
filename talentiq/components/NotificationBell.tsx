'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useNotificationContext, NotificationItem } from './NotificationProvider'

const gold = '#e2b04a'
const panelBg = '#141412'
const border = 'rgba(255,255,255,.09)'
const textDim = 'rgba(255,255,255,.4)'
const textMain = 'rgba(255,255,255,.92)'

function relativeTime(iso: string): string {
    const then = new Date(iso).getTime()
    const now = Date.now()
    const diffSec = Math.max(0, Math.floor((now - then) / 1000))
    if (diffSec < 60) return 'just now'
    const diffMin = Math.floor(diffSec / 60)
    if (diffMin < 60) return `${diffMin}m ago`
    const diffHr = Math.floor(diffMin / 60)
    if (diffHr < 24) return `${diffHr}h ago`
    const then_d = new Date(iso)
    const now_d = new Date()
    const isYesterday = then_d.getDate() === now_d.getDate() - 1 && then_d.getMonth() === now_d.getMonth() && then_d.getFullYear() === now_d.getFullYear()
    if (isYesterday) return 'Yesterday'
    const diffDay = Math.floor(diffHr / 24)
    if (diffDay < 7) return `${diffDay}d ago`
    return then_d.toLocaleDateString()
}

function groupLabel(iso: string): 'Today' | 'Yesterday' | 'Earlier' {
    const then = new Date(iso)
    const now = new Date()
    if (then.toDateString() === now.toDateString()) return 'Today'
    const yesterday = new Date(now)
    yesterday.setDate(now.getDate() - 1)
    if (then.toDateString() === yesterday.toDateString()) return 'Yesterday'
    return 'Earlier'
}

const TYPE_ICON: Record<string, JSX.Element> = {
    new_application: <path d="M12 5v14M5 12h14" />,
    application_received: <path d="M12 5v14M5 12h14" />,
    ats_screening_completed: <path d="M9 11l3 3L22 4M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" />,
    ai_screening_completed: <path d="M9 11l3 3L22 4M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" />,
    screening_failed: <><circle cx="12" cy="12" r="10" /><path d="M12 8v4M12 16h.01" /></>,
    interview_completed: <><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M8 2v4M16 2v4M3 10h18" /></>,
    interview_invitation: <><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M8 2v4M16 2v4M3 10h18" /></>,
    application_accepted: <path d="M20 6L9 17l-5-5" />,
    application_rejected: <path d="M18 6L6 18M6 6l12 12" />,
}

function iconFor(type: string) {
    return TYPE_ICON[type] || <><circle cx="12" cy="12" r="9" /><path d="M12 8v4M12 16h.01" /></>
}

export default function NotificationBell({ role }: { role: 'hr' | 'candidate' }) {
    const router = useRouter()
    const { unreadCount, items, loadingList, refreshList, markRead, markAllRead } = useNotificationContext()
    const [open, setOpen] = useState(false)
    const rootRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        if (open) refreshList()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open])

    useEffect(() => {
        const onClickOutside = (e: MouseEvent) => {
            if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false)
        }
        const onEscape = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
        if (open) {
            document.addEventListener('mousedown', onClickOutside)
            document.addEventListener('keydown', onEscape)
        }
        return () => {
            document.removeEventListener('mousedown', onClickOutside)
            document.removeEventListener('keydown', onEscape)
        }
    }, [open])

    const handleClickItem = (n: NotificationItem) => {
        if (!n.is_read) markRead(n.id)
        setOpen(false)
        if (n.action_url) router.push(n.action_url)
    }

    const groups: { label: string; items: NotificationItem[] }[] = []
        ; (['Today', 'Yesterday', 'Earlier'] as const).forEach(label => {
            const inGroup = items.filter(n => groupLabel(n.created_at) === label)
            if (inGroup.length) groups.push({ label, items: inGroup })
        })

    const viewAllHref = role === 'hr' ? '/hr/dashboard/notifications' : '/candidate/dashboard/notifications'

    return (
        <div ref={rootRef} style={{ position: 'relative' }}>
            <button
                onClick={() => setOpen(o => !o)}
                aria-label="Notifications"
                aria-haspopup="true"
                aria-expanded={open}
                style={{
                    position: 'relative', width: 38, height: 38, borderRadius: 9, border: `1px solid ${border}`,
                    background: open ? 'rgba(255,255,255,.06)' : 'transparent', cursor: 'pointer', display: 'flex',
                    alignItems: 'center', justifyContent: 'center', color: textMain, transition: 'background .15s',
                }}
            >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M18 8a6 6 0 00-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
                    <path d="M13.73 21a2 2 0 01-3.46 0" />
                </svg>
                {unreadCount > 0 && (
                    <span aria-hidden="true" style={{
                        position: 'absolute', top: -4, right: -4, minWidth: 17, height: 17, borderRadius: 9, background: gold,
                        color: '#0a0a09', fontSize: 10, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center',
                        padding: '0 4px', border: '2px solid #0c0c0a', lineHeight: 1,
                    }}>{unreadCount > 99 ? '99+' : unreadCount}</span>
                )}
                <span style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0,0,0,0)' }}>
                    {unreadCount > 0 ? `${unreadCount} unread notifications` : 'No unread notifications'}
                </span>
            </button>

            <div className={`notif-backdrop${open ? ' open' : ''}`} onClick={() => setOpen(false)} />

            <div role="dialog" aria-label="Notifications" aria-hidden={!open} className={`notif-popover${open ? ' open' : ''}`} style={{
                position: 'absolute', top: 46, right: 0, width: 360, maxHeight: 480, background: panelBg,
                border: `1px solid ${border}`, borderRadius: 14, boxShadow: '0 20px 50px rgba(0,0,0,.5)',
                flexDirection: 'column', zIndex: 200, overflow: 'hidden',
                // display is intentionally NOT set here — it's owned entirely by the
                // .notif-popover / .notif-popover.open CSS rules in globals.css. Setting
                // it inline (as before) beat those rules via specificity on desktop/tablet,
                // which is why the panel never actually closed above the mobile breakpoint.
            }}>
                <div style={{ padding: '14px 16px', borderBottom: `1px solid ${border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: 14, fontWeight: 700, color: textMain, fontFamily: 'inherit' }}>Notifications</span>
                    <button onClick={() => setOpen(false)} aria-label="Close" className="notif-close" style={{ display: 'none', background: 'none', border: 'none', color: textDim, fontSize: 18, cursor: 'pointer', padding: 4 }}>✕</button>
                </div>

                <div style={{ flex: 1, overflowY: 'auto' }}>
                    {loadingList && items.length === 0 && (
                        <div style={{ padding: 24, textAlign: 'center', fontSize: 12.5, color: textDim }}>Loading…</div>
                    )}
                    {!loadingList && items.length === 0 && (
                        <div style={{ padding: 28, textAlign: 'center', fontSize: 12.5, color: textDim }}>You're all caught up.</div>
                    )}
                    {groups.map(g => (
                        <div key={g.label}>
                            <div style={{ padding: '10px 16px 4px', fontSize: 10.5, fontWeight: 700, color: textDim, textTransform: 'uppercase', letterSpacing: '.06em' }}>{g.label}</div>
                            {g.items.map(n => (
                                <button key={n.id} onClick={() => handleClickItem(n)} style={{
                                    width: '100%', textAlign: 'left', display: 'flex', gap: 10, padding: '10px 16px', border: 'none',
                                    background: n.is_read ? 'transparent' : 'rgba(226,176,74,.05)', cursor: 'pointer', fontFamily: 'inherit',
                                    borderBottom: `1px solid rgba(255,255,255,.04)`, transition: 'background .12s',
                                }}>
                                    <span style={{ flexShrink: 0, width: 30, height: 30, borderRadius: 8, background: 'rgba(255,255,255,.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: n.is_read ? textDim : gold }}>
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">{iconFor(n.type)}</svg>
                                    </span>
                                    <span style={{ flex: 1, minWidth: 0 }}>
                                        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                            <span style={{ fontSize: 12.5, fontWeight: 700, color: textMain }}>{n.title}</span>
                                            {!n.is_read && <span aria-hidden="true" style={{ width: 6, height: 6, borderRadius: 3, background: gold, flexShrink: 0 }} />}
                                        </span>
                                        <span style={{ display: 'block', fontSize: 11.5, color: 'rgba(255,255,255,.55)', marginTop: 2, lineHeight: 1.4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{n.message}</span>
                                        <span style={{ display: 'block', fontSize: 10.5, color: textDim, marginTop: 3 }}>{relativeTime(n.created_at)}</span>
                                    </span>
                                </button>
                            ))}
                        </div>
                    ))}
                </div>

                <div style={{ padding: '10px 14px', borderTop: `1px solid ${border}`, display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                    <button onClick={markAllRead} disabled={unreadCount === 0} style={{ background: 'none', border: 'none', color: unreadCount === 0 ? textDim : gold, fontSize: 11.5, fontWeight: 600, cursor: unreadCount === 0 ? 'default' : 'pointer', padding: 4, fontFamily: 'inherit' }}>
                        Mark all as read
                    </button>
                    <button onClick={() => { setOpen(false); router.push(viewAllHref) }} style={{ background: 'none', border: 'none', color: textDim, fontSize: 11.5, fontWeight: 600, cursor: 'pointer', padding: 4, fontFamily: 'inherit' }}>
                        View all notifications →
                    </button>
                </div>
            </div>
        </div>
    )
}