'use client'

import Link from 'next/link'
import NotificationsPage from '@/components/NotificationsPage'

export default function CandidateNotificationsPage() {
    return (
        <div style={{ minHeight: '100vh', background: 'var(--dash-bg)', fontFamily: 'Inter, sans-serif', color: 'var(--dash-text)' }}>
            <div style={{ maxWidth: 780, margin: '0 auto', padding: '24px 28px 0' }}>
                <Link href="/candidate/dashboard" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--dash-text-muted)', textDecoration: 'none' }}>
                    ← Back to Dashboard
                </Link>
            </div>
            <NotificationsPage role="candidate" />
        </div>
    )
}