import type { Metadata } from 'next'
import Link from 'next/link'
import CVBuilderWizard from '@/components/CVBuilderWizard'

export const metadata: Metadata = {
  title: 'Free AI CV Builder — ATS-Friendly Resume Maker | TalentIQ',
  description: 'Build a professional, ATS-friendly CV in minutes with AI. Upload your existing resume or start from scratch, pick a template, and tailor it to any job description — free, no signup required for your first 2 CVs.',
  keywords: 'AI CV builder, free resume builder, ATS friendly resume, AI resume maker, CV maker, resume generator',
  openGraph: {
    title: 'Free AI CV Builder — ATS-Friendly Resume Maker',
    description: 'Build a professional, ATS-optimized CV in minutes. Free — no signup required for your first 2 CVs.',
    type: 'website',
  },
}

export default function PublicCVBuilderPage() {
  return (
    <div style={{ minHeight: '100vh', background: '#0a0a08' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@500;600&family=Syne:wght@400;500;600;700&display=swap');
      `}</style>

      {/* Header / hero — real on-page content for SEO, not just meta tags */}
      <header style={{ maxWidth: 900, margin: '0 auto', padding: '40px 16px 8px', textAlign: 'center', fontFamily: 'Syne, sans-serif' }}>
        <Link href="/" style={{ fontSize: 13, fontWeight: 700, color: '#d4af6d', textDecoration: 'none', letterSpacing: 1 }}>TALENTIQ</Link>
        <h1 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 34, fontWeight: 600, color: '#f5f2eb', margin: '16px 0 10px' }}>
          Free AI CV Builder
        </h1>
        <p style={{ fontSize: 14, color: 'rgba(245,242,235,.5)', maxWidth: 520, margin: '0 auto' }}>
          Upload your CV or start fresh, pick a clean ATS-friendly template, and optionally tailor it to a
          specific job description — powered by AI. Your first 2 CVs are free, no account needed.
        </p>
      </header>

      <CVBuilderWizard />

      <footer style={{ textAlign: 'center', padding: '20px 16px 40px', fontSize: 12, color: 'rgba(245,242,235,.25)', fontFamily: 'Syne, sans-serif' }}>
        Want unlimited CVs and AI-powered screening against real job descriptions?{' '}
        <Link href="/auth/login/candidate" style={{ color: '#d4af6d' }}>Create a free TalentIQ account →</Link>
        <div style={{ marginTop: 14 }}>
          <Link href="/privacy" style={{ color: 'rgba(245,242,235,.3)', marginRight: 16 }}>Privacy Policy</Link>
          <Link href="/terms" style={{ color: 'rgba(245,242,235,.3)' }}>Terms of Service</Link>
        </div>
      </footer>
    </div>
  )
}