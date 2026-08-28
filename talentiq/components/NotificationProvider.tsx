'use client'

import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { api } from '@/lib/api'
import { maybeShowBrowserNotification } from '@/lib/useBrowserNotificationPermission'

export type NotificationItem = {
    id: string
    type: string
    title: string
    message: string
    is_read: boolean
    created_at: string
    related_id?: string | null
    related_type?: string | null
    action_url?: string | null
}

export type ToastItem = NotificationItem & { _toastId: string }

// Presentation priority inferred from the existing notification `type` —
// no backend/database change, no invented field. Anything not listed here
// defaults to "normal". Nothing is "low" yet in the real type set, but the
// tier exists so a future quiet/informational type has somewhere to go
// without needing another pass through this file.
const HIGH_PRIORITY = new Set(['interview_invitation', 'application_accepted', 'application_rejected', 'screening_failed'])
const LOW_PRIORITY = new Set<string>([])

export function notificationPriority(type: string): 'high' | 'normal' | 'low' {
    if (HIGH_PRIORITY.has(type)) return 'high'
    if (LOW_PRIORITY.has(type)) return 'low'
    return 'normal'
}

type Ctx = {
    unreadCount: number
    items: NotificationItem[]
    loadingList: boolean
    toasts: ToastItem[]
    refreshList: () => Promise<void>
    markRead: (id: string) => void
    markAllRead: () => void
    dismissToast: (toastId: string) => void
}

const NotificationCtx = createContext<Ctx | null>(null)

export function useNotificationContext() {
    const ctx = useContext(NotificationCtx)
    if (!ctx) throw new Error('useNotificationContext must be used inside <NotificationProvider>')
    return ctx
}

const POLL_MS = 25000
const TOAST_DURATION_MS = 6000

export function NotificationProvider({ children }: { children: React.ReactNode }) {
    const [unreadCount, setUnreadCount] = useState(0)
    const [items, setItems] = useState<NotificationItem[]>([])
    const [loadingList, setLoadingList] = useState(false)
    const [toasts, setToasts] = useState<ToastItem[]>([])

    // The single source of truth for "have we already reacted to this
    // notification" — shared by both toast and browser-notification logic,
    // so one real event can only ever produce one of each, no matter how
    // many components are mounted (bell in the mobile topbar AND the
    // desktop header, on HR dashboard, being the concrete case this fixes).
    const seenIdsRef = useRef<Set<string>>(new Set())
    const firstPollRef = useRef(true)

    const poll = useCallback(async () => {
        try {
            const res = await api.getUnreadNotificationCount()
            setUnreadCount(res.unread_count ?? 0)

            if (res.unread_count > 0) {
                const latest = await api.getNotifications({ limit: 5 })
                const fresh: NotificationItem[] = (latest.notifications || []).filter(
                    (n: NotificationItem) => !n.is_read && !seenIdsRef.current.has(n.id)
                )
                for (const n of fresh) seenIdsRef.current.add(n.id)

                // Never toast on the very first poll after mount/reload — that
                // would re-announce everything already sitting unread.
                if (!firstPollRef.current) {
                    for (const n of fresh) {
                        const priority = notificationPriority(n.type)
                        if (priority === 'low') continue
                        const toastId = `${n.id}-${Date.now()}`
                        setToasts(prev => [...prev, { ...n, _toastId: toastId }])
                        setTimeout(() => setToasts(prev => prev.filter(t => t._toastId !== toastId)), TOAST_DURATION_MS)

                        if (priority === 'high') {
                            maybeShowBrowserNotification(n.title, n.message, () => {
                                if (n.action_url) window.location.assign(n.action_url)
                            })
                        }
                    }
                }
            }
            firstPollRef.current = false
        } catch {
            // silent — next poll retries; nothing to show is safer than showing stale/wrong data
        }
    }, [])

    useEffect(() => {
        poll()
        const interval = setInterval(poll, POLL_MS)
        return () => clearInterval(interval)
    }, [poll])

    const refreshList = useCallback(async () => {
        setLoadingList(true)
        try {
            const res = await api.getNotifications({ limit: 10 })
            setItems(res.notifications || [])
            setUnreadCount(res.unread_count ?? 0)
            for (const n of (res.notifications || [])) seenIdsRef.current.add(n.id)
        } catch {
            // keep whatever was already shown
        } finally {
            setLoadingList(false)
        }
    }, [])

    const markRead = useCallback((id: string) => {
        setItems(prev => prev.map(i => i.id === id ? { ...i, is_read: true } : i))
        setUnreadCount(c => Math.max(0, c - 1))
        api.markNotificationRead(id).catch(() => { })
    }, [])

    const markAllRead = useCallback(() => {
        setItems(prev => prev.map(i => ({ ...i, is_read: true })))
        setUnreadCount(0)
        api.markAllNotificationsRead().catch(() => { })
    }, [])

    const dismissToast = useCallback((toastId: string) => {
        setToasts(prev => prev.filter(t => t._toastId !== toastId))
    }, [])

    return (
        <NotificationCtx.Provider value={{ unreadCount, items, loadingList, toasts, refreshList, markRead, markAllRead, dismissToast }}>
            {children}
        </NotificationCtx.Provider>
    )
}