'use client'

import Link from 'next/link'
import NotificationsPage from '@/components/NotificationsPage'

export default function CandidateNotificationsPage() {
    return (
        <div style={{ minHeight: '100vh', background: '#f7f5f0', fontFamily: 'Inter, sans-serif', color: '#1f1c17' }}>
            <div style={{ maxWidth: 780, margin: '0 auto', padding: '24px 28px 0' }}>
                <Link href="/candidate/dashboard" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#7a7468', textDecoration: 'none' }}>
                    ← Back to Dashboard
                </Link>
            </div>
            <NotificationsPage role="candidate" light />
        </div>
    )
}