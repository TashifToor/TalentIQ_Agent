'use client'

import { useRouter } from 'next/navigation'
import { useNotificationContext, notificationPriority, ToastItem } from './NotificationProvider'

const gold = '#e2b04a'
const border = 'rgba(255,255,255,.1)'
const textDim = 'rgba(255,255,255,.4)'
const textMain = 'rgba(255,255,255,.92)'
const panelBg = '#161614'

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

function Toast({ toast }: { toast: ToastItem }) {
    const router = useRouter()
    const { dismissToast, markRead } = useNotificationContext()
    const priority = notificationPriority(toast.type)
    const accent = priority === 'high' ? gold : 'rgba(255,255,255,.3)'

    const handleClick = () => {
        if (!toast.is_read) markRead(toast.id)
        dismissToast(toast._toastId)
        if (toast.action_url) router.push(toast.action_url)
    }

    return (
        <div
            role="status"
            className="notif-toast"
            style={{
                display: 'flex', gap: 10, alignItems: 'flex-start', width: '100%', maxWidth: 360,
                background: panelBg, border: `1px solid ${border}`, borderLeft: `3px solid ${accent}`,
                borderRadius: 10, padding: '12px 14px', boxShadow: '0 12px 32px rgba(0,0,0,.4)', pointerEvents: 'auto',
            }}
        >
            <button onClick={handleClick} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', flex: 1, minWidth: 0, background: 'none', border: 'none', textAlign: 'left', cursor: 'pointer', padding: 0, fontFamily: 'inherit' }}>
                <span style={{ flexShrink: 0, width: 26, height: 26, borderRadius: 7, background: 'rgba(255,255,255,.06)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: accent }}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">{iconFor(toast.type)}</svg>
                </span>
                <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ display: 'block', fontSize: 12.5, fontWeight: 700, color: textMain }}>{toast.title}</span>
                    <span style={{ display: '-webkit-box', fontSize: 11.5, color: 'rgba(255,255,255,.55)', marginTop: 2, lineHeight: 1.4, overflow: 'hidden', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as any }}>{toast.message}</span>
                </span>
            </button>
            <button onClick={() => dismissToast(toast._toastId)} aria-label="Dismiss" style={{ background: 'none', border: 'none', color: textDim, fontSize: 14, cursor: 'pointer', padding: 2, flexShrink: 0 }}>✕</button>
        </div>
    )
}

export default function NotificationToasts() {
    const { toasts } = useNotificationContext()
    if (toasts.length === 0) return null

    return (
        <div className="notif-toast-stack" aria-live="polite" style={{
            position: 'fixed', bottom: 20, right: 20, zIndex: 400, display: 'flex', flexDirection: 'column-reverse', gap: 8,
            maxWidth: 360, width: 'calc(100% - 40px)',
        }}>
            {toasts.slice(-3).map(t => <Toast key={t._toastId} toast={t} />)}
        </div>
    )
}