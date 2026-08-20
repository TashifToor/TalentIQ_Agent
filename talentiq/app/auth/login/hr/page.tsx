'use client'
import { useState, useRef, useEffect, Suspense } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { api } from '@/lib/api'
import { BRAND_NAME } from '@/lib/brand'

function FontImports() {
  return (
    <style jsx global>{`
      @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;500;600&family=Inter:wght@300;400;500;600&display=swap');

      /* Tablet: drop the decorative panel, let the form take the full width */
      @media (max-width: 900px) {
        .auth-left { display: none !important; }
        .auth-right { flex: 1 1 100% !important; max-width: 100% !important; border-left: none !important; }
      }
      /* Mobile: tighten side padding so nothing overflows horizontally, keep the form the focus */
      @media (max-width: 560px) {
        .auth-topbar, .auth-form-wrap, .auth-footer { padding-left: 24px !important; padding-right: 24px !important; }
        .auth-footer { flex-direction: column; align-items: flex-start !important; gap: 10px; }
      }
    `}</style>
  )
}

function HRLoginInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [inviteToken, setInviteToken] = useState<string | null>(null)
  const [inviteOrgName, setInviteOrgName] = useState('')
  const [inviteError, setInviteError] = useState('')
  const [tab, setTab] = useState<'login' | 'signup'>('login')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [focused, setFocused] = useState<string | null>(null)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [company, setCompany] = useState('')

  const [showForgot, setShowForgot] = useState(false)
  const [forgotStep, setForgotStep] = useState<'email' | 'otp'>('email')
  const [forgotEmail, setForgotEmail] = useState('')
  const [forgotMsg, setForgotMsg] = useState('')
  const [forgotLoading, setForgotLoading] = useState(false)
  const [otpDigits, setOtpDigits] = useState<string[]>(['', '', '', '', ''])
  const [newPassword, setNewPassword] = useState('')
  const otpRefs = useRef<(HTMLInputElement | null)[]>([])

  const handleSendOtp = async () => {
    if (forgotLoading || !forgotEmail.trim()) return
    setForgotLoading(true)
    setForgotMsg('')
    try {
      await api.forgotPassword(forgotEmail.trim())
      setForgotStep('otp')
      setForgotMsg('')
      setTimeout(() => otpRefs.current[0]?.focus(), 50)
    } catch {
      setForgotMsg('Something went wrong. Please try again.')
    } finally { setForgotLoading(false) }
  }

  const handleOtpChange = (i: number, v: string) => {
    if (v && !/^[0-9]$/.test(v)) return
    const next = [...otpDigits]
    next[i] = v
    setOtpDigits(next)
    if (v && i < 4) otpRefs.current[i + 1]?.focus()
  }

  const handleOtpKeyDown = (i: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !otpDigits[i] && i > 0) otpRefs.current[i - 1]?.focus()
  }

  const handleOtpPaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    const digits = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 5)
    if (!digits) return
    e.preventDefault()
    const next = ['', '', '', '', '']
    for (let i = 0; i < digits.length; i++) next[i] = digits[i]
    setOtpDigits(next)
    otpRefs.current[Math.min(digits.length, 4)]?.focus()
  }

  const handleResetPassword = async () => {
    if (forgotLoading) return
    const otp = otpDigits.join('')
    if (otp.length < 5) { setForgotMsg('Enter the full 5-digit code.'); return }
    if (newPassword.length < 6) { setForgotMsg('Password must be at least 6 characters.'); return }
    setForgotLoading(true)
    setForgotMsg('')
    try {
      await api.resetPassword(forgotEmail.trim(), otp, newPassword)
      setShowForgot(false)
      setForgotStep('email')
      setOtpDigits(['', '', '', '', ''])
      setNewPassword('')
      setEmail(forgotEmail)
      setTab('login')
      setError('✓ Password reset! Log in with your new password.')
    } catch (e: any) {
      setForgotMsg(e.message || 'Invalid or expired code.')
    } finally { setForgotLoading(false) }
  }

  // Signup email verification
  const [signupStep, setSignupStep] = useState<'form' | 'verify'>('form')
  const [pendingEmail, setPendingEmail] = useState('')
  const [verifyOtp, setVerifyOtp] = useState<string[]>(['', '', '', '', ''])
  const [verifyMsg, setVerifyMsg] = useState('')
  const [verifyLoading, setVerifyLoading] = useState(false)
  const verifyRefs = useRef<(HTMLInputElement | null)[]>([])

  const handleVerifyOtpChange = (i: number, v: string) => {
    if (v && !/^[0-9]$/.test(v)) return
    const next = [...verifyOtp]
    next[i] = v
    setVerifyOtp(next)
    if (v && i < 4) verifyRefs.current[i + 1]?.focus()
  }

  const handleVerifyOtpKeyDown = (i: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !verifyOtp[i] && i > 0) verifyRefs.current[i - 1]?.focus()
  }

  const handleVerifyOtpPaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    const digits = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 5)
    if (!digits) return
    e.preventDefault()
    const next = ['', '', '', '', '']
    for (let i = 0; i < digits.length; i++) next[i] = digits[i]
    setVerifyOtp(next)
    verifyRefs.current[Math.min(digits.length, 4)]?.focus()
  }

  const handleVerifySignup = async () => {
    if (verifyLoading) return
    const otp = verifyOtp.join('')
    if (otp.length < 5) { setVerifyMsg('Enter the full 5-digit code.'); return }
    setVerifyLoading(true)
    setVerifyMsg('')
    try {
      const data = await api.verifySignup(pendingEmail, otp)
      localStorage.setItem('token', data.access_token)
      localStorage.setItem('role', 'hr')
      document.cookie = `token=${data.access_token}; path=/`
      document.cookie = `role=hr; path=/`
      router.push('/hr/dashboard')
    } catch (e: any) {
      setVerifyMsg(e.message || 'Invalid or expired code.')
    } finally { setVerifyLoading(false) }
  }

  const handleResendVerification = async () => {
    setVerifyLoading(true)
    setVerifyMsg('')
    try {
      await api.resendVerification(pendingEmail)
      setVerifyMsg('New code sent.')
    } catch {
      setVerifyMsg('Could not resend code. Try again shortly.')
    } finally { setVerifyLoading(false) }
  }

  const handleLogin = async () => {
    if (loading) return
    setError('')
    setLoading(true)
    try {
      const data = await api.login(email, password)
      localStorage.setItem('token', data.access_token)
      localStorage.setItem('role', 'hr')
      document.cookie = `token=${data.access_token}; path=/`
      document.cookie = `role=hr; path=/`
      router.push('/hr/dashboard')
    } catch (e: any) {
      if (e.code === 'EMAIL_NOT_VERIFIED') {
        setPendingEmail(email)
        setSignupStep('verify')
        setTab('signup')
        setVerifyMsg('')
        try { await api.resendVerification(email) } catch { }
        setTimeout(() => verifyRefs.current[0]?.focus(), 50)
        return
      }
      setError(e.message || 'Login failed. Please check your credentials.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const token = searchParams?.get('invite')
    if (!token) return
    setInviteToken(token)
    setTab('signup')
    api.checkInvite(token)
      .then((data: any) => {
        setInviteOrgName(data.org_name)
        setEmail(data.email)
      })
      .catch((e: any) => setInviteError(e.message || 'This invite link is invalid or has expired.'))
  }, [searchParams])

  const handleSignup = async () => {
    if (loading) return
    setError('')
    setLoading(true)
    try {
      await api.signupHR({
        name: `${firstName} ${lastName}`.trim(),
        email,
        password,
        company: inviteToken ? inviteOrgName : company,
        invite_token: inviteToken || undefined,
      })
      setPendingEmail(email)
      setSignupStep('verify')
      setVerifyOtp(['', '', '', '', ''])
      setVerifyMsg('')
      setTimeout(() => verifyRefs.current[0]?.focus(), 50)
    } catch (e: any) {
      if (e.message?.toLowerCase().includes('already registered')) {
        setError('Email already registered. Please use the Login tab, or click Forgot Password if you never verified it.')
        setTab('login')
        return
      }
      setError(e.message || 'Signup failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh', fontFamily: "'Inter', system-ui, sans-serif" }}>
      <FontImports />

      {/* ============ LEFT — DARK DATA-LED PANEL ============ */}
      <div className="auth-left" style={{ flex: '1 1 52%', background: 'linear-gradient(165deg, #11140f 0%, #0a0c08 70%)', position: 'relative', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>

        {/* Quiet grid texture, behind everything, fixed */}
        <div style={{
          position: 'absolute', inset: 0, zIndex: 0, pointerEvents: 'none', opacity: 0.5,
          backgroundImage: 'linear-gradient(rgba(255,255,255,.025) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.025) 1px, transparent 1px)',
          backgroundSize: '64px 64px',
        }} />
        <div style={{ position: 'absolute', inset: 24, border: '1px solid rgba(122,168,142,.16)', borderRadius: 2, pointerEvents: 'none', zIndex: 1 }} />

        <div style={{ position: 'relative', zIndex: 2, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', height: '100%', padding: '56px 60px' }}>

          {/* Top: wordmark + portal label */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: 12, textDecoration: 'none' }}>
              <div style={{ width: 30, height: 30, border: '1px solid rgba(122,168,142,.5)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <div style={{ width: 6, height: 6, background: '#7aa88e', borderRadius: '50%' }} />
              </div>
              <span style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 21, fontWeight: 500, color: 'rgba(245,242,235,.92)', letterSpacing: '0.5px' }}>{BRAND_NAME}</span>
            </Link>
            <span style={{ fontSize: 10.5, fontWeight: 500, color: 'rgba(122,168,142,.7)', letterSpacing: '0.16em', textTransform: 'uppercase' }}>
              For organizations
            </span>
          </div>

          {/* Middle: headline + supporting message */}
          <div style={{ maxWidth: 420 }}>
            <div style={{ fontSize: 11, fontWeight: 500, letterSpacing: '0.18em', textTransform: 'uppercase', color: '#7aa88e', marginBottom: 20 }}>
              For HR teams
            </div>
            <h2 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 'clamp(32px,3.6vw,44px)', fontWeight: 500, lineHeight: 1.16, color: '#f5f2eb', letterSpacing: '-0.4px', marginBottom: 16 }}>
              Build your next<br />great team.
            </h2>
            <p style={{ fontSize: 14.5, color: 'rgba(245,242,235,.42)', lineHeight: 1.7, maxWidth: 360, fontWeight: 300 }}>
              Find, evaluate, and hire exceptional talent with intelligent candidate screening and AI-powered interviews.
            </p>
          </div>

          {/* Bottom: capability grid — real product surfaces, no invented stats */}
          <div style={{ maxWidth: 420 }}>
            <div style={{
              display: 'grid', gridTemplateColumns: '1fr 1fr', columnGap: 28, rowGap: 20,
              borderTop: '1px solid rgba(255,255,255,.08)', paddingTop: 24,
            }}>
              {[
                { l: 'AI-Powered Interviews', d: 'Structured, consistent, on your schedule' },
                { l: 'Resume & ATS Screening', d: 'Rank candidates against the role' },
                { l: 'Talent Pool', d: 'One searchable home for every applicant' },
                { l: 'Interview Reports', d: 'Clear writeups the whole team can read' },
                { l: 'Decision Center', d: 'Compare finalists side by side' },
                { l: 'Team Collaboration', d: 'Share notes and decide together' },
              ].map(item => (
                <div key={item.l} style={{ display: 'flex', gap: 10 }}>
                  <span style={{ width: 4, height: 4, borderRadius: '50%', background: '#7aa88e', marginTop: 7, flexShrink: 0 }} />
                  <div>
                    <div style={{ fontSize: 12.5, fontWeight: 500, color: 'rgba(245,242,235,.85)', marginBottom: 3 }}>{item.l}</div>
                    <div style={{ fontSize: 11.5, color: 'rgba(245,242,235,.34)', lineHeight: 1.4, fontWeight: 300 }}>{item.d}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ============ RIGHT — FORM PANEL (LIGHT, RESTRAINED) ============ */}
      <div className="auth-right" style={{ flex: '1 1 480px', maxWidth: 500, background: '#fbfaf7', borderLeft: '1px solid #e4e0d4', display: 'flex', flexDirection: 'column' }}>

        <div className="auth-topbar" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '32px 48px 0' }}>
          <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 13, color: '#7a7768', textDecoration: 'none' }}>
            <span style={{ fontSize: 15 }}>←</span> Back
          </Link>
          <Link href="/auth/login/candidate" style={{ fontSize: 13, color: '#7a7768', textDecoration: 'none' }}>
            Candidate? <span style={{ color: '#3f6e58' }}>Sign in</span>
          </Link>
        </div>

        <div className="auth-form-wrap" style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '40px 48px', maxWidth: 420, width: '100%' }}>

          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 9, marginBottom: 36 }}>
            <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#3f6e58', display: 'inline-block' }} />
            <span style={{ fontSize: 11, fontWeight: 500, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#3f6e58' }}>HR team portal</span>
          </div>

          <div style={{ display: 'flex', gap: 28, marginBottom: 36, borderBottom: '1px solid #e4e0d4' }}>
            {(['login', 'signup'] as const).map(t => (
              <button
                key={t}
                onClick={() => setTab(t)}
                style={{
                  padding: '0 0 14px', fontSize: 14, fontWeight: 500, fontFamily: 'inherit',
                  border: 'none', cursor: 'pointer', background: 'none',
                  color: tab === t ? '#1a1a16' : '#a3a092',
                  borderBottom: tab === t ? '1.5px solid #3f6e58' : '1.5px solid transparent',
                  marginBottom: -1, transition: 'color .2s',
                }}
              >
                {t === 'login' ? 'Sign in' : 'Start free trial'}
              </button>
            ))}
          </div>

          {error && (
            <div style={{ background: 'rgba(196,75,75,.06)', border: '1px solid rgba(196,75,75,.22)', color: '#a83f3f', fontSize: 13, padding: '11px 15px', borderRadius: 3, marginBottom: 20 }}>
              {error}
            </div>
          )}

          {tab === 'login' ? (
            <>
              <div>
                <h1 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 30, fontWeight: 500, color: '#1a1a16', marginBottom: 8, letterSpacing: '-0.3px' }}>
                  Welcome back
                </h1>
                <p style={{ fontSize: 13.5, color: '#7a7768', marginBottom: 30, fontWeight: 300 }}>
                  Not on {BRAND_NAME} yet?{' '}
                  <button onClick={() => setTab('signup')} style={{ color: '#3f6e58', fontWeight: 500, background: 'none', border: 'none', cursor: 'pointer', fontSize: 13.5, fontFamily: 'inherit', padding: 0 }}>
                    Start your trial
                  </button>
                </p>

                <LightField label="Work email" type="email" value={email} onChange={setEmail} placeholder="you@company.com"
                  focused={focused === 'email'} onFocus={() => setFocused('email')} onBlur={() => setFocused(null)} />
                <LightField label="Password" type="password" value={password} onChange={setPassword} placeholder="••••••••"
                  focused={focused === 'password'} onFocus={() => setFocused('password')} onBlur={() => setFocused(null)} />

                <div style={{ textAlign: 'right', marginBottom: 28 }}>
                  <a href="#" onClick={e => { e.preventDefault(); setShowForgot(true); setForgotMsg(''); setForgotEmail(email) }} style={{ fontSize: 12.5, color: '#a3a092', textDecoration: 'none' }}>Forgot password?</a>
                </div>

                <button onClick={handleLogin} disabled={loading} style={{ ...primaryBtnDark, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                  {loading && (
                    <svg width="14" height="14" viewBox="0 0 24 24" style={{ animation: 'spin 0.8s linear infinite' }}>
                      <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" />
                      <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="3" strokeDasharray="28 56" strokeLinecap="round" />
                    </svg>
                  )}
                  {loading ? 'Signing in…' : 'Sign in'}
                </button>

                <style dangerouslySetInnerHTML={{ __html: `@keyframes spin{to{transform:rotate(360deg)}}` }} />
              </div>

              {/* Forgot Password Modal */}
              {showForgot && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', zIndex: 999, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => { setShowForgot(false); setForgotStep('email') }}>
                  <div style={{ background: '#fff', border: '1px solid rgba(0,0,0,.08)', borderRadius: 16, padding: 28, width: 340, maxWidth: '90vw', boxShadow: '0 20px 60px rgba(0,0,0,.15)' }} onClick={e => e.stopPropagation()}>
                    {forgotStep === 'email' ? (
                      <>
                        <div style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 22, fontWeight: 600, marginBottom: 6, color: '#1a1a16' }}>Forgot Password</div>
                        <p style={{ fontSize: 13, color: '#7a7768', marginBottom: 20 }}>Enter your email — we'll send a 5-digit reset code.</p>
                        <input value={forgotEmail} onChange={e => setForgotEmail(e.target.value)} placeholder="your@email.com" style={{ width: '100%', background: '#f5f4f0', border: '1px solid rgba(0,0,0,.08)', borderRadius: 8, padding: '10px 12px', fontSize: 13, color: '#1a1a16', outline: 'none', fontFamily: 'inherit', marginBottom: 12, boxSizing: 'border-box' as any }} />
                        {forgotMsg && <div style={{ fontSize: 12, color: '#dc2626', marginBottom: 12 }}>{forgotMsg}</div>}
                        <div style={{ display: 'flex', gap: 8 }}>
                          <button onClick={() => setShowForgot(false)} style={{ flex: 1, fontSize: 13, padding: '9px', borderRadius: 8, border: '1px solid rgba(0,0,0,.08)', background: 'transparent', color: '#7a7768', cursor: 'pointer', fontFamily: 'inherit' }}>Cancel</button>
                          <button onClick={handleSendOtp} disabled={forgotLoading} style={{ flex: 1, fontSize: 13, fontWeight: 600, padding: '9px', borderRadius: 8, border: 'none', background: '#2d5a47', color: '#fff', cursor: 'pointer', fontFamily: 'inherit' }}>{forgotLoading ? 'Sending…' : 'Send Code'}</button>
                        </div>
                      </>
                    ) : (
                      <>
                        <div style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 22, fontWeight: 600, marginBottom: 6, color: '#1a1a16' }}>Enter Code</div>
                        <p style={{ fontSize: 13, color: '#7a7768', marginBottom: 18 }}>Sent to {forgotEmail}. Expires in 10 minutes.</p>

                        <div style={{ display: 'flex', gap: 8, marginBottom: 16, justifyContent: 'center' }}>
                          {otpDigits.map((d, i) => (
                            <input
                              key={i}
                              ref={el => { otpRefs.current[i] = el }}
                              value={d}
                              onChange={e => handleOtpChange(i, e.target.value)}
                              onKeyDown={e => handleOtpKeyDown(i, e)}
                              onPaste={handleOtpPaste}
                              maxLength={1}
                              inputMode="numeric"
                              aria-label={`Reset code digit ${i + 1} of 5`}
                              style={{ width: 40, height: 48, textAlign: 'center', fontSize: 20, fontWeight: 600, background: '#f5f4f0', border: '1px solid rgba(0,0,0,.1)', borderRadius: 8, color: '#1a1a16', outline: 'none', fontFamily: 'inherit' }}
                            />
                          ))}
                        </div>

                        <input
                          type="password"
                          value={newPassword}
                          onChange={e => setNewPassword(e.target.value)}
                          placeholder="New password"
                          style={{ width: '100%', background: '#f5f4f0', border: '1px solid rgba(0,0,0,.08)', borderRadius: 8, padding: '10px 12px', fontSize: 13, color: '#1a1a16', outline: 'none', fontFamily: 'inherit', marginBottom: 12, boxSizing: 'border-box' as any }}
                        />

                        {forgotMsg && <div style={{ fontSize: 12, color: '#dc2626', marginBottom: 12 }}>{forgotMsg}</div>}

                        <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
                          <button onClick={() => { setForgotStep('email'); setForgotMsg('') }} style={{ flex: 1, fontSize: 13, padding: '9px', borderRadius: 8, border: '1px solid rgba(0,0,0,.08)', background: 'transparent', color: '#7a7768', cursor: 'pointer', fontFamily: 'inherit' }}>Back</button>
                          <button onClick={handleResetPassword} disabled={forgotLoading} style={{ flex: 1, fontSize: 13, fontWeight: 600, padding: '9px', borderRadius: 8, border: 'none', background: '#2d5a47', color: '#fff', cursor: 'pointer', fontFamily: 'inherit' }}>{forgotLoading ? 'Resetting…' : 'Reset Password'}</button>
                        </div>
                        <button onClick={handleSendOtp} disabled={forgotLoading} style={{ width: '100%', fontSize: 12, background: 'none', border: 'none', color: '#a3a092', cursor: 'pointer', fontFamily: 'inherit' }}>Resend code</button>
                      </>
                    )}
                  </div>
                </div>
              )}
            </>
          ) : signupStep === 'verify' ? (
            <div>
              <h1 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 28, fontWeight: 500, color: '#1a1a16', marginBottom: 8, letterSpacing: '-0.3px' }}>
                Verify your email
              </h1>
              <p style={{ fontSize: 13.5, color: '#7a7768', marginBottom: 24, fontWeight: 300 }}>
                Sent to {pendingEmail}. Expires in 10 minutes.
              </p>

              <div style={{ display: 'flex', gap: 8, marginBottom: 20, justifyContent: 'center' }}>
                {verifyOtp.map((d, i) => (
                  <input
                    key={i}
                    ref={el => { verifyRefs.current[i] = el }}
                    value={d}
                    onChange={e => handleVerifyOtpChange(i, e.target.value)}
                    onKeyDown={e => handleVerifyOtpKeyDown(i, e)}
                    onPaste={handleVerifyOtpPaste}
                    maxLength={1}
                    inputMode="numeric"
                    aria-label={`Digit ${i + 1} of 5`}
                    style={{ width: 44, height: 52, textAlign: 'center', fontSize: 20, fontWeight: 600, background: '#f5f4f0', border: '1px solid rgba(0,0,0,.1)', borderRadius: 8, color: '#1a1a16', outline: 'none', fontFamily: 'inherit' }}
                  />
                ))}
              </div>

              {verifyMsg && <div style={{ fontSize: 12, color: verifyMsg === 'New code sent.' ? '#2d7a5f' : '#dc2626', marginBottom: 16, textAlign: 'center' }}>{verifyMsg}</div>}

              <button onClick={handleVerifySignup} disabled={verifyLoading} style={primaryBtnGreen}>
                {verifyLoading ? 'Verifying…' : 'Verify & Continue'}
              </button>

              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 14 }}>
                <button onClick={() => { setSignupStep('form'); setTab('signup') }} style={{ fontSize: 12.5, color: '#a3a092', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>Back</button>
                <button onClick={handleResendVerification} disabled={verifyLoading} style={{ fontSize: 12.5, color: '#2d5a47', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>Resend code</button>
              </div>
            </div>
          ) : (
            <div>
              <h1 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 28, fontWeight: 500, color: '#1a1a16', marginBottom: 8, letterSpacing: '-0.3px' }}>
                Start your trial
              </h1>
              <p style={{ fontSize: 13.5, color: '#7a7768', marginBottom: 24, fontWeight: 300 }}>
                3 days, full access. No card required.
              </p>

              {inviteToken && inviteOrgName && (
                <div style={{ background: '#eef5f0', border: '1px solid #cfe3d6', borderRadius: 10, padding: '12px 14px', marginBottom: 20, fontSize: 13, color: '#2d5a47' }}>
                  You're joining <strong>{inviteOrgName}</strong>'s team on {BRAND_NAME}.
                </div>
              )}
              {inviteError && (
                <div style={{ background: '#fdeeee', border: '1px solid #f0caca', borderRadius: 10, padding: '12px 14px', marginBottom: 20, fontSize: 13, color: '#b91c1c' }}>
                  {inviteError}
                </div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 22 }}>
                <LightField label="First name" type="text" value={firstName} onChange={setFirstName} placeholder="Ahmed"
                  focused={focused === 'first'} onFocus={() => setFocused('first')} onBlur={() => setFocused(null)} bare />
                <LightField label="Last name" type="text" value={lastName} onChange={setLastName} placeholder="Khan"
                  focused={focused === 'last'} onFocus={() => setFocused('last')} onBlur={() => setFocused(null)} bare />
              </div>
              <LightField label="Work email" type="email" value={email} onChange={setEmail} placeholder="you@company.com"
                focused={focused === 'email'} onFocus={() => setFocused('email')} onBlur={() => setFocused(null)} />
              {!inviteToken && (
                <LightField label="Company" type="text" value={company} onChange={setCompany} placeholder="Your company"
                  focused={focused === 'company'} onFocus={() => setFocused('company')} onBlur={() => setFocused(null)} />
              )}
              <LightField label="Password" type="password" value={password} onChange={setPassword} placeholder="Create a password"
                focused={focused === 'password'} onFocus={() => setFocused('password')} onBlur={() => setFocused(null)} />

              <button onClick={handleSignup} disabled={loading} style={primaryBtnGreen}>
                {loading ? 'Creating account…' : inviteToken ? 'Join workspace' : 'Start free trial'}
              </button>

              {!inviteToken && (
                <p style={{ textAlign: 'center', fontSize: 12, color: '#a3a092', marginTop: 18, fontWeight: 300 }}>
                  $49/month after trial · Cancel anytime
                </p>
              )}
              <p style={{ textAlign: 'center', fontSize: 11.5, color: '#a3a092', marginTop: 6, fontWeight: 300 }}>
                By continuing you agree to our <a href="/terms" style={{ color: '#2d5a47' }}>Terms</a> and <a href="/privacy" style={{ color: '#2d5a47' }}>Privacy Policy</a>
              </p>
            </div>
          )}
        </div>

        <div className="auth-footer" style={{ padding: '24px 48px', borderTop: '1px solid #e4e0d4', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 12.5, color: '#a3a092', fontWeight: 300 }}>Looking for a job instead?</span>
          <Link href="/auth/login/candidate" style={{ fontSize: 12.5, color: '#3f6e58', textDecoration: 'none', fontWeight: 500 }}>Candidate portal →</Link>
        </div>
      </div>
    </div>
  )
}

const lightLabelStyle: React.CSSProperties = {
  display: 'block', fontSize: 11.5, fontWeight: 500, letterSpacing: '0.05em',
  color: '#a3a092', marginBottom: 10,
}

const lightInputBareStyle: React.CSSProperties = {
  width: '100%', background: 'transparent', border: 'none', outline: 'none',
  color: '#1a1a16', fontSize: 14.5, fontFamily: 'inherit', padding: '10px 0',
}

const primaryBtnDark: React.CSSProperties = {
  width: '100%', background: '#1a1a16', color: '#fbfaf7', fontWeight: 600,
  fontSize: 14, padding: '15px', borderRadius: 3, border: 'none',
  cursor: 'pointer', fontFamily: 'inherit', letterSpacing: '0.01em', marginBottom: 24,
}

const primaryBtnGreen: React.CSSProperties = {
  width: '100%', background: '#3f6e58', color: '#fbfaf7', fontWeight: 600,
  fontSize: 14, padding: '15px', borderRadius: 3, border: 'none',
  cursor: 'pointer', fontFamily: 'inherit', letterSpacing: '0.01em',
}

function LightField({
  label, type, value, onChange, placeholder, focused, onFocus, onBlur, bare,
}: {
  label: string; type: string; value: string; onChange: (v: string) => void
  placeholder: string; focused: boolean; onFocus: () => void; onBlur: () => void; bare?: boolean
}) {
  const [reveal, setReveal] = useState(false)
  const isPassword = type === 'password'
  const inputId = `light-field-${label.toLowerCase().replace(/\s+/g, '-')}`
  return (
    <div style={{ marginBottom: bare ? 0 : 22 }}>
      <label htmlFor={inputId} style={lightLabelStyle}>{label}</label>
      <div style={{ display: 'flex', alignItems: 'center', borderBottom: `1px solid ${focused ? '#3f6e58' : '#dcd8ca'}`, transition: 'border-color .2s' }}>
        <input
          id={inputId}
          type={isPassword && reveal ? 'text' : type}
          value={value} onChange={e => onChange(e.target.value)} onFocus={onFocus} onBlur={onBlur}
          placeholder={placeholder} autoComplete={isPassword ? 'current-password' : undefined}
          style={{ ...lightInputBareStyle, flex: 1 }}
        />
        {isPassword && (
          <button
            type="button"
            onClick={() => setReveal(r => !r)}
            aria-label={reveal ? 'Hide password' : 'Show password'}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#a3a092', padding: '0 2px 6px', display: 'flex', alignItems: 'center' }}
          >
            {reveal ? (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7-10-7-10-7z" /><circle cx="12" cy="12" r="3" /></svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M3 3l18 18" /><path d="M10.6 10.6a2 2 0 002.8 2.8" /><path d="M9.9 4.24A9.8 9.8 0 0112 4c6 0 10 7 10 7a17.6 17.6 0 01-3.1 3.87M6.6 6.6C4 8.3 2 11 2 11s4 7 10 7a9.6 9.6 0 004.4-1.06" /></svg>
            )}
          </button>
        )}
      </div>
    </div>
  )
}

export default function HRLogin() {
  return (
    <Suspense fallback={null}>
      <HRLoginInner />
    </Suspense>
  )
}