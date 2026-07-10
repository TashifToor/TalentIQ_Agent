'use client'

import Link from 'next/link'
import CVBuilderWizard from '@/components/CVBuilderWizard'

export default function CandidateCVBuilderPage() {
  return (
    <div style={{ minHeight: '100vh', background: '#0a0a08' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@500;600&family=Syne:wght@400;500;600;700&display=swap');
      `}</style>
      <div style={{ maxWidth: 900, margin: '0 auto', padding: '32px 16px 16px' }}>
        <Link href="/candidate/dashboard" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'rgba(255,255,255,.4)', textDecoration: 'none', marginBottom: 12, fontFamily: 'Syne, sans-serif' }}>
          ← Back to Dashboard
        </Link>
      </div>
      <CVBuilderWizard />
    </div>
  )
}