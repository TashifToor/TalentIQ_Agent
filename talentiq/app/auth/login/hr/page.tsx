'use client'
import { useState, useRef, useEffect, Suspense } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { api } from '@/lib/api'

function FontImports() {
  return (
    <style jsx global>{`
      @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;500;600&family=Inter:wght@300;400;500;600&display=swap');
    `}</style>
  )
}

const CANDIDATES = [
  { initials: 'AR', name: 'Aisha Rao', role: 'Frontend Engineer · 4 yrs', score: 91 },
  { initials: 'MK', name: 'Maaz Khan', role: 'Full-Stack Developer · 3 yrs', score: 84 },
  { initials: 'SC', name: 'Sara Chen', role: 'Backend Engineer · 5 yrs', score: 79 },
]

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
    if (!forgotEmail.trim()) return
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

  const handleResetPassword = async () => {
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

  const handleVerifySignup = async () => {
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
        try { await api.resendVerification(email) } catch {}
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
      <div style={{ flex: '1 1 52%', background: 'linear-gradient(165deg, #11140f 0%, #0a0c08 70%)', position: 'relative', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>

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
              <span style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 21, fontWeight: 500, color: 'rgba(245,242,235,.92)', letterSpacing: '0.5px' }}>TalentIQ</span>
            </Link>
            <span style={{ fontSize: 10.5, fontWeight: 500, color: 'rgba(122,168,142,.7)', letterSpacing: '0.16em', textTransform: 'uppercase' }}>
              For organizations
            </span>
          </div>

          {/* Middle: single composed data panel — no scattered cards */}
          <div style={{ maxWidth: 400 }}>
            <div style={{ background: 'linear-gradient(165deg, rgba(255,255,255,.045), rgba(255,255,255,.015))', border: '1px solid rgba(255,255,255,.09)', borderRadius: 4, padding: '26px 28px' }}>

              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 18 }}>
                <span style={{ fontSize: 11, fontWeight: 500, color: 'rgba(245,242,235,.4)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>This week</span>
                <span style={{ fontSize: 12, color: '#7aa88e', fontWeight: 500 }}>↑ 24%</span>
              </div>

              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 20 }}>
                <span style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 38, fontWeight: 500, color: '#f5f2eb', lineHeight: 1 }}>42</span>
                <span style={{ fontSize: 13, color: 'rgba(245,242,235,.4)' }}>candidates screened</span>
              </div>

              {/* Minimal bar row */}
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 5, height: 36, marginBottom: 22 }}>
                {[40, 65, 52, 80, 48, 90, 70].map((h, i) => (
                  <div key={i} style={{ flex: 1, borderRadius: '1px 1px 0 0', height: `${h}%`, background: i === 5 ? '#7aa88e' : 'rgba(255,255,255,.14)' }} />
                ))}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, borderTop: '1px solid rgba(255,255,255,.08)', paddingTop: 18 }}>
                {CANDIDATES.map(c => (
                  <div key={c.name} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <span style={{ fontSize: 11, color: 'rgba(245,242,235,.3)', width: 16, flexShrink: 0, fontWeight: 500 }}>{c.initials}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, color: 'rgba(245,242,235,.78)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.name}</div>
                      <div style={{ fontSize: 11.5, color: 'rgba(245,242,235,.32)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.role}</div>
                    </div>
                    <span style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 17, color: '#7aa88e', fontWeight: 500, flexShrink: 0 }}>{c.score}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Bottom: headline + thin stat strip */}
          <div>
            <div style={{ fontSize: 11, fontWeight: 500, letterSpacing: '0.18em', textTransform: 'uppercase', color: '#7aa88e', marginBottom: 20 }}>
              For HR teams
            </div>
            <h2 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 'clamp(30px,3.4vw,42px)', fontWeight: 500, lineHeight: 1.2, color: '#f5f2eb', letterSpacing: '-0.4px' }}>
              Screen with precision.<br />Hire with confidence.
            </h2>
          </div>
        </div>
      </div>

      {/* ============ RIGHT — FORM PANEL (LIGHT, RESTRAINED) ============ */}
      <div style={{ flex: '1 1 480px', maxWidth: 500, background: '#fbfaf7', borderLeft: '1px solid #e4e0d4', display: 'flex', flexDirection: 'column' }}>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '32px 48px 0' }}>
          <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 13, color: '#7a7768', textDecoration: 'none' }}>
            <span style={{ fontSize: 15 }}>←</span> Back
          </Link>
          <Link href="/auth/login/candidate" style={{ fontSize: 13, color: '#7a7768', textDecoration: 'none' }}>
            Candidate? <span style={{ color: '#3f6e58' }}>Sign in</span>
          </Link>
        </div>

        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '40px 48px', maxWidth: 420, width: '100%' }}>

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
                Not on TalentIQ yet?{' '}
                <button onClick={() => setTab('signup')} style={{ color: '#3f6e58', fontWeight: 500, background: 'none', border: 'none', cursor: 'pointer', fontSize: 13.5, fontFamily: 'inherit', padding: 0 }}>
                  Start your trial
                </button>
              </p>

              <LightField label="Work email" type="email" value={email} onChange={setEmail} placeholder="you@company.com"
                focused={focused === 'email'} onFocus={() => setFocused('email')} onBlur={() => setFocused(null)} />
              <LightField label="Password" type="password" value={password} onChange={setPassword} placeholder="••••••••"
                focused={focused === 'password'} onFocus={() => setFocused('password')} onBlur={() => setFocused(null)} />

              <div style={{ textAlign: 'right', marginBottom: 28 }}>
                <a href="#" onClick={e=>{e.preventDefault();setShowForgot(true);setForgotMsg('');setForgotEmail(email)}} style={{ fontSize: 12.5, color: '#a3a092', textDecoration: 'none' }}>Forgot password?</a>
              </div>

              <button onClick={handleLogin} disabled={loading} style={{ ...primaryBtnDark, display:'flex', alignItems:'center', justifyContent:'center', gap:8 }}>
                {loading && (
                  <svg width="14" height="14" viewBox="0 0 24 24" style={{ animation:'spin 0.8s linear infinite' }}>
                    <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3"/>
                    <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="3" strokeDasharray="28 56" strokeLinecap="round"/>
                  </svg>
                )}
                {loading ? 'Signing in…' : 'Sign in'}
              </button>

              <style dangerouslySetInnerHTML={{ __html: `@keyframes spin{to{transform:rotate(360deg)}}` }} />

              <LightDivider />
              <LightGoogleButton />
            </div>

            {/* Forgot Password Modal */}
            {showForgot && (
              <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.5)', zIndex:999, display:'flex', alignItems:'center', justifyContent:'center' }} onClick={()=>{setShowForgot(false); setForgotStep('email')}}>
                <div style={{ background:'#fff', border:'1px solid rgba(0,0,0,.08)', borderRadius:16, padding:28, width:340, maxWidth:'90vw', boxShadow:'0 20px 60px rgba(0,0,0,.15)' }} onClick={e=>e.stopPropagation()}>
                  {forgotStep === 'email' ? (
                    <>
                      <div style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:22, fontWeight:600, marginBottom:6, color:'#1a1a16' }}>Forgot Password</div>
                      <p style={{ fontSize:13, color:'#7a7768', marginBottom:20 }}>Enter your email — we'll send a 5-digit reset code.</p>
                      <input value={forgotEmail} onChange={e=>setForgotEmail(e.target.value)} placeholder="your@email.com" style={{ width:'100%', background:'#f5f4f0', border:'1px solid rgba(0,0,0,.08)', borderRadius:8, padding:'10px 12px', fontSize:13, color:'#1a1a16', outline:'none', fontFamily:'inherit', marginBottom:12, boxSizing:'border-box' as any }} />
                      {forgotMsg && <div style={{ fontSize:12, color:'#dc2626', marginBottom:12 }}>{forgotMsg}</div>}
                      <div style={{ display:'flex', gap:8 }}>
                        <button onClick={()=>setShowForgot(false)} style={{ flex:1, fontSize:13, padding:'9px', borderRadius:8, border:'1px solid rgba(0,0,0,.08)', background:'transparent', color:'#7a7768', cursor:'pointer', fontFamily:'inherit' }}>Cancel</button>
                        <button onClick={handleSendOtp} disabled={forgotLoading} style={{ flex:1, fontSize:13, fontWeight:600, padding:'9px', borderRadius:8, border:'none', background:'#2d5a47', color:'#fff', cursor:'pointer', fontFamily:'inherit' }}>{forgotLoading?'Sending…':'Send Code'}</button>
                      </div>
                    </>
                  ) : (
                    <>
                      <div style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:22, fontWeight:600, marginBottom:6, color:'#1a1a16' }}>Enter Code</div>
                      <p style={{ fontSize:13, color:'#7a7768', marginBottom:18 }}>Sent to {forgotEmail}. Expires in 10 minutes.</p>

                      <div style={{ display:'flex', gap:8, marginBottom:16, justifyContent:'center' }}>
                        {otpDigits.map((d, i) => (
                          <input
                            key={i}
                            ref={el => { otpRefs.current[i] = el }}
                            value={d}
                            onChange={e=>handleOtpChange(i, e.target.value)}
                            onKeyDown={e=>handleOtpKeyDown(i, e)}
                            maxLength={1}
                            inputMode="numeric"
                            style={{ width:40, height:48, textAlign:'center', fontSize:20, fontWeight:600, background:'#f5f4f0', border:'1px solid rgba(0,0,0,.1)', borderRadius:8, color:'#1a1a16', outline:'none', fontFamily:'inherit' }}
                          />
                        ))}
                      </div>

                      <input
                        type="password"
                        value={newPassword}
                        onChange={e=>setNewPassword(e.target.value)}
                        placeholder="New password"
                        style={{ width:'100%', background:'#f5f4f0', border:'1px solid rgba(0,0,0,.08)', borderRadius:8, padding:'10px 12px', fontSize:13, color:'#1a1a16', outline:'none', fontFamily:'inherit', marginBottom:12, boxSizing:'border-box' as any }}
                      />

                      {forgotMsg && <div style={{ fontSize:12, color:'#dc2626', marginBottom:12 }}>{forgotMsg}</div>}

                      <div style={{ display:'flex', gap:8, marginBottom:10 }}>
                        <button onClick={()=>{setForgotStep('email'); setForgotMsg('')}} style={{ flex:1, fontSize:13, padding:'9px', borderRadius:8, border:'1px solid rgba(0,0,0,.08)', background:'transparent', color:'#7a7768', cursor:'pointer', fontFamily:'inherit' }}>Back</button>
                        <button onClick={handleResetPassword} disabled={forgotLoading} style={{ flex:1, fontSize:13, fontWeight:600, padding:'9px', borderRadius:8, border:'none', background:'#2d5a47', color:'#fff', cursor:'pointer', fontFamily:'inherit' }}>{forgotLoading?'Resetting…':'Reset Password'}</button>
                      </div>
                      <button onClick={handleSendOtp} disabled={forgotLoading} style={{ width:'100%', fontSize:12, background:'none', border:'none', color:'#a3a092', cursor:'pointer', fontFamily:'inherit' }}>Resend code</button>
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
                    maxLength={1}
                    inputMode="numeric"
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
                14 days, full access. No card required.
              </p>

              {inviteToken && inviteOrgName && (
                <div style={{ background: '#eef5f0', border: '1px solid #cfe3d6', borderRadius: 10, padding: '12px 14px', marginBottom: 20, fontSize: 13, color: '#2d5a47' }}>
                  You're joining <strong>{inviteOrgName}</strong>'s team on TalentIQ.
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

        <div style={{ padding: '24px 48px', borderTop: '1px solid #e4e0d4', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
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
  return (
    <div style={{ marginBottom: bare ? 0 : 22 }}>
      <label style={lightLabelStyle}>{label}</label>
      <div style={{ borderBottom: `1px solid ${focused ? '#3f6e58' : '#dcd8ca'}`, transition: 'border-color .2s' }}>
        <input type={type} value={value} onChange={e => onChange(e.target.value)} onFocus={onFocus} onBlur={onBlur} placeholder={placeholder} style={lightInputBareStyle} />
      </div>
    </div>
  )
}

function LightDivider() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 20 }}>
      <div style={{ flex: 1, height: 1, background: '#e4e0d4' }} />
      <span style={{ fontSize: 11.5, color: '#a3a092', letterSpacing: '0.05em' }}>OR</span>
      <div style={{ flex: 1, height: 1, background: '#e4e0d4' }} />
    </div>
  )
}

function LightGoogleButton() {
  return (
    <button style={{
      width: '100%', background: 'transparent', border: '1px solid #dcd8ca', borderRadius: 3,
      padding: 13, fontSize: 13.5, fontFamily: 'inherit', color: '#5a5750', cursor: 'pointer',
      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
    }}>
      <GoogleIcon /> Continue with Google Workspace
    </button>
  )
}

function GoogleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 17 17">
      <path d="M16.32 8.7c0-.6-.05-1.18-.15-1.74H8.5v3.29h4.4a3.76 3.76 0 01-1.63 2.47v2.06h2.64c1.54-1.42 2.41-3.51 2.41-6.08z" fill="#4285F4" />
      <path d="M8.5 16.5c2.2 0 4.05-.73 5.4-1.97l-2.64-2.06c-.73.49-1.67.78-2.76.78-2.12 0-3.92-1.43-4.56-3.36H1.2v2.13A8 8 0 008.5 16.5z" fill="#34A853" />
      <path d="M3.94 9.89A4.8 4.8 0 013.69 8.5c0-.48.08-.94.25-1.39V4.98H1.2A8 8 0 000 8.5c0 1.29.3 2.5.84 3.52l3.1-2.13z" fill="#FBBC04" />
      <path d="M8.5 3.75c1.2 0 2.27.41 3.12 1.22l2.34-2.34A8 8 0 001.2 4.98l3.1 2.13C4.57 5.18 6.37 3.75 8.5 3.75z" fill="#EA4335" />
    </svg>
  )
}

export default function HRLogin() {
  return (
    <Suspense fallback={null}>
      <HRLoginInner />
    </Suspense>
  )
}