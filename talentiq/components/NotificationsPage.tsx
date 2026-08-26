'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { api } from '@/lib/api'

type Notification = {
    id: string
    type: string
    title: string
    message: string
    is_read: boolean
    created_at: string
    action_url?: string | null
}

const gold = '#e2b04a'
const border = 'rgba(255,255,255,.08)'
const textDim = 'rgba(255,255,255,.4)'
const textMain = 'rgba(255,255,255,.92)'

function relativeTime(iso: string): string {
    const diffSec = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000))
    if (diffSec < 60) return 'just now'
    const diffMin = Math.floor(diffSec / 60)
    if (diffMin < 60) return `${diffMin}m ago`
    const diffHr = Math.floor(diffMin / 60)
    if (diffHr < 24) return `${diffHr}h ago`
    const diffDay = Math.floor(diffHr / 24)
    if (diffDay === 1) return 'Yesterday'
    if (diffDay < 7) return `${diffDay}d ago`
    return new Date(iso).toLocaleDateString()
}

type Tab = 'all' | 'unread' | 'read'

export default function NotificationsPage({ role }: { role: 'hr' | 'candidate' }) {
    const router = useRouter()
    const [tab, setTab] = useState<Tab>('all')
    const [items, setItems] = useState<Notification[]>([])
    const [loading, setLoading] = useState(true)
    const [offset, setOffset] = useState(0)
    const [hasMore, setHasMore] = useState(false)

    const load = async (reset: boolean) => {
        setLoading(true)
        try {
            const res = await api.getNotifications({ unread_only: tab === 'unread', limit: 20, offset: reset ? 0 : offset })
            const filtered = tab === 'read' ? (res.notifications || []).filter((n: Notification) => n.is_read) : (res.notifications || [])
            setItems(reset ? filtered : [...items, ...filtered])
            setHasMore(res.has_more)
            setOffset((reset ? 0 : offset) + (res.notifications?.length || 0))
        } catch {
            // leave whatever's already shown
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => { load(true) /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [tab])

    const handleClick = async (n: Notification) => {
        if (!n.is_read) {
            setItems(prev => prev.map(i => i.id === n.id ? { ...i, is_read: true } : i))
            api.markNotificationRead(n.id).catch(() => { })
        }
        if (n.action_url) router.push(n.action_url)
    }

    return (
        <div style={{ padding: role === 'hr' ? 28 : '28px 28px 60px', maxWidth: 780, margin: role === 'hr' ? 0 : '0 auto' }}>
            <div style={{ marginBottom: 20 }}>
                <div style={{ fontFamily: "Inter, sans-serif", fontSize: 24, fontWeight: 600, color: textMain }}>Notifications</div>
                <div style={{ fontSize: 12.5, color: textDim, marginTop: 2 }}>Everything that's happened, in one place.</div>
            </div>

            <div style={{ display: 'flex', gap: 6, marginBottom: 18 }}>
                {(['all', 'unread', 'read'] as Tab[]).map(t => (
                    <button key={t} onClick={() => setTab(t)} style={{
                        fontSize: 12.5, fontWeight: 600, padding: '7px 14px', borderRadius: 100, cursor: 'pointer', fontFamily: 'inherit',
                        border: `1px solid ${tab === t ? gold : border}`, background: tab === t ? 'rgba(226,176,74,.1)' : 'transparent', color: tab === t ? gold : textDim,
                        textTransform: 'capitalize',
                    }}>{t}</button>
                ))}
            </div>

            {loading && items.length === 0 && <div style={{ fontSize: 13, color: textDim, padding: 20, textAlign: 'center' }}>Loading…</div>}
            {!loading && items.length === 0 && <div style={{ fontSize: 13, color: textDim, padding: 20, textAlign: 'center' }}>Nothing here yet.</div>}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {items.map(n => (
                    <button key={n.id} onClick={() => handleClick(n)} style={{
                        textAlign: 'left', display: 'flex', gap: 12, alignItems: 'flex-start', padding: '13px 16px', borderRadius: 10,
                        border: `1px solid ${border}`, background: n.is_read ? '#121210' : 'rgba(226,176,74,.05)', cursor: 'pointer', fontFamily: 'inherit',
                    }}>
                        {!n.is_read && <span style={{ width: 7, height: 7, borderRadius: 4, background: gold, marginTop: 6, flexShrink: 0 }} />}
                        {n.is_read && <span style={{ width: 7, flexShrink: 0 }} />}
                        <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 13, fontWeight: 700, color: textMain }}>{n.title}</div>
                            <div style={{ fontSize: 12, color: 'rgba(255,255,255,.55)', marginTop: 2, lineHeight: 1.5 }}>{n.message}</div>
                            <div style={{ fontSize: 11, color: textDim, marginTop: 5 }}>{relativeTime(n.created_at)}</div>
                        </div>
                    </button>
                ))}
            </div>

            {hasMore && !loading && (
                <button onClick={() => load(false)} style={{ marginTop: 16, width: '100%', fontSize: 12.5, fontWeight: 600, padding: '10px', borderRadius: 8, border: `1px solid ${border}`, background: 'transparent', color: textDim, cursor: 'pointer', fontFamily: 'inherit' }}>
                    Load more
                </button>
            )}
        </div>
    )
}