'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { api, clearAuthState } from '@/lib/api'
import { ThemeSettingsControl } from '@/components/ThemeToggle'

export default function CandidateSettings() {
  const router = useRouter()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [savingName, setSavingName] = useState(false)
  const [nameMsg, setNameMsg] = useState('')

  const [currentPw, setCurrentPw] = useState('')
  const [newPw, setNewPw] = useState('')
  const [savingPw, setSavingPw] = useState(false)
  const [pwMsg, setPwMsg] = useState('')
  const [pwError, setPwError] = useState('')

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deletePassword, setDeletePassword] = useState('')
  const [deleteError, setDeleteError] = useState('')

  useEffect(() => {
    api.me().then((u: any) => {
      setName(u?.name || u?.full_name || '')
      setEmail(u?.email || '')
    }).catch(() => {})
  }, [])

  const handleSaveName = async () => {
    setSavingName(true)
    setNameMsg('')
    try {
      await api.updateProfile(name)
      setNameMsg('Saved.')
    } catch (err: any) {
      setNameMsg(err.message || 'Failed to update name.')
    } finally {
      setSavingName(false)
    }
  }

  const handleChangePassword = async () => {
    setPwError('')
    setPwMsg('')
    if (!currentPw || !newPw) { setPwError('Fill in both fields.'); return }
    if (newPw.length < 8) { setPwError('New password must be at least 8 characters.'); return }
    setSavingPw(true)
    try {
      await api.changePassword(currentPw, newPw)
      setPwMsg('Password updated successfully.')
      setCurrentPw('')
      setNewPw('')
    } catch (err: any) {
      setPwError(err.message || 'Failed to change password.')
    } finally {
      setSavingPw(false)
    }
  }

  const handleLogout = () => {
    clearAuthState()
    window.location.replace('/auth/login/candidate')
  }

  const handleDelete = async () => {
    if (!deletePassword.trim()) { setDeleteError('Enter your password to confirm.'); return }
    setDeleting(true)
    setDeleteError('')
    try {
      await api.deleteAccount(deletePassword)
      clearAuthState()
      router.push('/')
    } catch (err: any) {
      setDeleteError(err.message || 'Failed to delete account.')
      setDeleting(false)
    }
  }

  const inputStyle = {
    background: 'var(--dash-surface-2)',
    border: '1px solid var(--dash-border)',
    borderBottom: '1px solid var(--dash-overlay-14)',
    borderRadius: '8px 8px 0 0',
    padding: '10px 12px',
    fontSize: 13,
    fontFamily: 'Inter, sans-serif',
    color: 'var(--dash-text)',
    outline: 'none',
    width: '100%',
  } as React.CSSProperties

  return (
    <div style={{ minHeight: '100vh', background: 'var(--dash-bg)', fontFamily: 'Inter, sans-serif', color: 'var(--dash-text)' }}>
      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
        @keyframes fadeUp { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        .fade-up { animation: fadeUp .4s ease both; }
        .settings-input:focus { border-bottom-color: #e2b04a !important; }
        .save-btn { transition: opacity .2s; }
        .save-btn:hover { opacity: .85; }
        .danger-link { transition: color .2s; }
        .danger-link:hover { color: #ef4444 !important; }
      `}</style>

      <div style={{ maxWidth: 640, margin: '0 auto', padding: '40px 24px 80px' }}>
        <Link href="/candidate/dashboard" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--dash-text-muted)', textDecoration: 'none', marginBottom: 28 }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 18l-6-6 6-6" /></svg>
          Back to Dashboard
        </Link>

        <div style={{ fontFamily: "Inter, sans-serif", fontSize: 28, fontWeight: 600, marginBottom: 4 }}>Settings</div>
        <div style={{ fontSize: 13, color: 'var(--dash-text-muted)', marginBottom: 28 }}>Manage your account preferences</div>

        {/* Profile Section */}
        <div className="fade-up" style={{ background: 'var(--dash-surface)', border: '1px solid var(--dash-border)', borderRadius: 12, padding: 24, marginBottom: 20 }}>
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>Profile</div>
          <div style={{ fontSize: 12, color: 'var(--dash-text-muted)', marginBottom: 18 }}>Update your display name</div>

          <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--dash-text-muted)', letterSpacing: '.06em', textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>Full Name</label>
          <input className="settings-input" style={{ ...inputStyle, marginBottom: 10 }} value={name} onChange={e => setName(e.target.value)} />

          <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--dash-text-muted)', letterSpacing: '.06em', textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>Email</label>
          <input style={{ ...inputStyle, opacity: .5, cursor: 'not-allowed', marginBottom: 14 }} value={email} disabled />
          <div style={{ fontSize: 11, color: 'var(--dash-text-faint)', marginBottom: 14, marginTop: -8 }}>Email address cannot be changed.</div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button className="save-btn" onClick={handleSaveName} disabled={savingName} style={{ background: '#e2b04a', color: '#0a0a09', fontSize: 13, fontWeight: 700, padding: '9px 18px', borderRadius: 8, border: 'none', cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}>
              {savingName ? 'Saving…' : 'Save Changes'}
            </button>
            {nameMsg && <span style={{ fontSize: 12, color: nameMsg === 'Saved.' ? '#13c28e' : '#ef4444' }}>{nameMsg}</span>}
          </div>
        </div>

        {/* Appearance Section */}
        <div className="fade-up" style={{ background: 'var(--dash-surface)', border: '1px solid var(--dash-border)', borderRadius: 12, padding: 24, marginBottom: 20 }}>
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>Appearance</div>
          <div style={{ fontSize: 12, color: 'var(--dash-text-muted)', marginBottom: 18 }}>Choose how your workspace looks.</div>
          <ThemeSettingsControl />
        </div>

        {/* Password Section */}
        <div className="fade-up" style={{ background: 'var(--dash-surface)', border: '1px solid var(--dash-border)', borderRadius: 12, padding: 24, marginBottom: 20 }}>
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>Password</div>
          <div style={{ fontSize: 12, color: 'var(--dash-text-muted)', marginBottom: 18 }}>Change your account password</div>

          <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--dash-text-muted)', letterSpacing: '.06em', textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>Current Password</label>
          <input className="settings-input" type="password" style={{ ...inputStyle, marginBottom: 14 }} value={currentPw} onChange={e => setCurrentPw(e.target.value)} />

          <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--dash-text-muted)', letterSpacing: '.06em', textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>New Password</label>
          <input className="settings-input" type="password" style={{ ...inputStyle, marginBottom: 14 }} value={newPw} onChange={e => setNewPw(e.target.value)} />

          {pwError && <div style={{ fontSize: 12, color: '#ef4444', marginBottom: 12 }}>{pwError}</div>}

          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button className="save-btn" onClick={handleChangePassword} disabled={savingPw} style={{ background: '#e2b04a', color: '#0a0a09', fontSize: 13, fontWeight: 700, padding: '9px 18px', borderRadius: 8, border: 'none', cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}>
              {savingPw ? 'Updating…' : 'Update Password'}
            </button>
            {pwMsg && <span style={{ fontSize: 12, color: '#13c28e' }}>{pwMsg}</span>}
          </div>
        </div>

        {/* Data Export Section */}
        <div className="fade-up" style={{ background: 'var(--dash-surface)', border: '1px solid var(--dash-border)', borderRadius: 12, padding: 24, marginBottom: 20, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 2 }}>Download My Data</div>
            <div style={{ fontSize: 12, color: 'var(--dash-text-muted)' }}>Get a copy of everything TalentIQ stores about your account — scan history, applications, and profile info.</div>
          </div>
          <button onClick={async () => { try { await api.exportMyData() } catch {} }} style={{ background: 'transparent', border: '1px solid var(--dash-overlay-14)', color: 'var(--dash-text)', fontSize: 13, fontWeight: 600, padding: '9px 18px', borderRadius: 8, cursor: 'pointer', fontFamily: 'Inter, sans-serif', whiteSpace: 'nowrap' }}>
            Download JSON
          </button>
        </div>

        {/* Session Section */}
        <div className="fade-up" style={{ background: 'var(--dash-surface)', border: '1px solid var(--dash-border)', borderRadius: 12, padding: 24, marginBottom: 20, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 2 }}>Sign Out</div>
            <div style={{ fontSize: 12, color: 'var(--dash-text-muted)' }}>End your current session on this device</div>
          </div>
          <button onClick={handleLogout} style={{ background: 'none', border: '1px solid var(--dash-overlay-14)', color: 'var(--dash-text)', fontSize: 13, fontWeight: 600, padding: '9px 18px', borderRadius: 8, cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}>
            Log Out
          </button>
        </div>

        {/* Danger Zone */}
        <div className="fade-up" style={{ background: 'rgba(239,68,68,.04)', border: '1px solid rgba(239,68,68,.15)', borderRadius: 12, padding: 24 }}>
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4, color: '#ef4444' }}>Delete Account</div>
          <div style={{ fontSize: 12, color: 'var(--dash-text-muted)', marginBottom: 16 }}>This permanently deletes your account, CV data, and scan history. This cannot be undone.</div>

          {!showDeleteConfirm ? (
            <button className="danger-link" onClick={() => setShowDeleteConfirm(true)} style={{ background: 'none', border: 'none', color: 'var(--dash-text-muted)', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'Inter, sans-serif', textDecoration: 'underline' }}>
              Delete my account
            </button>
          ) : (
            <div>
              <input
                type="password"
                value={deletePassword}
                onChange={e => setDeletePassword(e.target.value)}
                placeholder="Enter your password to confirm"
                style={{ ...inputStyle, marginBottom: 10, maxWidth: 280 }}
              />
              {deleteError && <div style={{ fontSize: 12, color: '#ef4444', marginBottom: 10 }}>{deleteError}</div>}
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <button onClick={handleDelete} disabled={deleting} style={{ background: '#ef4444', color: '#fff', fontSize: 13, fontWeight: 700, padding: '9px 18px', borderRadius: 8, border: 'none', cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}>
                  {deleting ? 'Deleting…' : 'Yes, delete permanently'}
                </button>
                <button onClick={() => { setShowDeleteConfirm(false); setDeletePassword(''); setDeleteError('') }} style={{ background: 'none', border: 'none', color: 'var(--dash-text-muted)', fontSize: 13, cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}>
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}