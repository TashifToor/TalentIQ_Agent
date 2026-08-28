'use client'

import Link from 'next/link'
import NotificationsPage from '@/components/NotificationsPage'

export default function HRNotificationsPage() {
    return (
        <div style={{ minHeight: '100vh', background: '#0a0a09', fontFamily: 'Inter, sans-serif', color: 'rgba(255,255,255,.88)' }}>
            <div style={{ maxWidth: 780, margin: '0 auto', padding: '24px 28px 0' }}>
                <Link href="/hr/dashboard" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'rgba(255,255,255,.4)', textDecoration: 'none' }}>
                    ← Back to Dashboard
                </Link>
            </div>
            <NotificationsPage role="hr" />
        </div>
    )
}