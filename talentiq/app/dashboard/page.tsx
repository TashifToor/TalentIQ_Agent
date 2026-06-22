'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function DashboardPage() {
  const router = useRouter()
  useEffect(() => {
    // Check role from localStorage and redirect
    const role = localStorage.getItem('role')
    if (role === 'hr') {
      router.replace('/hr/dashboard')
    } else {
      router.replace('/candidate/dashboard')
    }
  }, [router])

  return (
    <div style={{ minHeight: '100vh', background: '#0c0c0a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ width: 40, height: 40, border: '3px solid rgba(226,176,74,.2)', borderTopColor: '#e2b04a', borderRadius: '50%', animation: 'spin .7s linear infinite', margin: '0 auto 16px' }} />
        <p style={{ color: 'rgba(255,255,255,.4)', fontSize: 14, fontFamily: 'Syne, sans-serif' }}>Redirecting...</p>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}
