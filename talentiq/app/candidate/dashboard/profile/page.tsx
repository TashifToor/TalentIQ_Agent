'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { api } from '@/lib/api'

export default function CandidateProfile() {
  const [user, setUser] = useState<{ name?: string; email?: string; created_at?: string } | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.me()
      .then((u: any) => setUser({ name: u?.name || u?.full_name, email: u?.email, created_at: u?.created_at }))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  return (
    <div style={{ minHeight: '100vh', background: '#f7f5f0', fontFamily: 'Inter, sans-serif', color: '#1f1c17' }}>
      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
        @keyframes fadeUp { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        .fade-up { animation: fadeUp .4s ease both; }
      `}</style>

      <div style={{ maxWidth: 640, margin: '0 auto', padding: '40px 24px' }}>
        <Link href="/candidate/dashboard" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#7a7468', textDecoration: 'none', marginBottom: 28 }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 18l-6-6 6-6" /></svg>
          Back to Dashboard
        </Link>

        <div style={{ fontFamily: "Inter, sans-serif", fontSize: 28, fontWeight: 600, marginBottom: 4 }}>My Profile</div>
        <div style={{ fontSize: 13, color: '#7a7468', marginBottom: 28 }}>Your account information</div>

        <div className="fade-up" style={{ background: '#ffffff', border: '1px solid rgba(10,10,9,.1)', borderRadius: 12, padding: 28 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 28, paddingBottom: 24, borderBottom: '1px solid rgba(10,10,9,.1)' }}>
            <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'linear-gradient(135deg,#c5931f,#e2b04a)', display: 'grid', placeItems: 'center', fontSize: 18, fontWeight: 700, color: '#0a0a09', flexShrink: 0 }}>
              {(user?.name || 'U').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()}
            </div>
            <div>
              <div style={{ fontFamily: "Inter, sans-serif", fontSize: 20, fontWeight: 600 }}>{loading ? 'Loading…' : user?.name || 'Unnamed User'}</div>
              <div style={{ fontSize: 13, color: '#7a7468', marginTop: 2 }}>{user?.email}</div>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            <Field label="Full Name" value={user?.name || '—'} />
            <Field label="Email Address" value={user?.email || '—'} />
            <Field label="Plan" value="Free — 3 scans/month" accent />
            {user?.created_at && <Field label="Member Since" value={new Date(user.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })} />}
          </div>

          <div style={{ marginTop: 24, paddingTop: 20, borderTop: '1px solid rgba(10,10,9,.1)', fontSize: 12, color: '#7a7468' }}>
            Want to change your name or password?{' '}
            <Link href="/candidate/dashboard/settings" style={{ color: '#e2b04a', textDecoration: 'none' }}>Go to Settings</Link>
          </div>
        </div>
      </div>
    </div>
  )
}

function Field({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 14, borderBottom: '1px solid rgba(10,10,9,.1)' }}>
      <span style={{ fontSize: 12, color: '#7a7468', letterSpacing: '.04em', textTransform: 'uppercase' }}>{label}</span>
      <span style={{ fontSize: 14, fontWeight: 500, color: accent ? '#e2b04a' : '#1f1c17' }}>{value}</span>
    </div>
  )
}