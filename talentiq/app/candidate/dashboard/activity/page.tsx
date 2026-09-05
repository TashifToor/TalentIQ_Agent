'use client'

import Link from 'next/link'
import ActivityTimeline from '@/components/ActivityTimeline'

export default function CandidateActivityPage() {
    return (
        <div style={{ minHeight: '100vh', background: 'var(--dash-bg)', fontFamily: 'Inter, sans-serif', color: 'var(--dash-text)' }}>
            <div style={{ maxWidth: 1120, margin: '0 auto', padding: '24px 24px 0' }}>
                <Link href="/candidate/dashboard" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--dash-text-muted)', textDecoration: 'none' }}>
                    ← Back to Dashboard
                </Link>
            </div>
            <ActivityTimeline role="candidate" />
        </div>
    )
}