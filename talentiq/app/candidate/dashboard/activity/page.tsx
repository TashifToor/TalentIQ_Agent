'use client'

import Link from 'next/link'
import ActivityTimeline from '@/components/ActivityTimeline'

export default function CandidateActivityPage() {
    return (
        <div style={{ minHeight: '100vh', background: '#0c0c0a', fontFamily: 'Inter, sans-serif', color: 'rgba(255,255,255,.88)' }}>
            <div style={{ maxWidth: 1120, margin: '0 auto', padding: '24px 24px 0' }}>
                <Link href="/candidate/dashboard" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'rgba(255,255,255,.4)', textDecoration: 'none' }}>
                    ← Back to Dashboard
                </Link>
            </div>
            <ActivityTimeline role="candidate" />
        </div>
    )
}