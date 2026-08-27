'use client'
import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { api } from '@/lib/api'
import SocialAuthRow from '@/components/SocialAuthRow'

/* Loads Inter — safe to keep even if already loaded globally */
function FontImports() {
  return (
    <style jsx global>{`
      @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
    `}</style>
  )
}

export default function CandidateLogin() {
  const router = useRouter()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [tab, setTab] = useState<'login' | 'signup'>('login')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [strength, setStrength] = useState(0)
  const [focused, setFocused] = useState<string | null>(null)

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')

  const [showForgot, setShowForgot] = useState(false)
  const [forgotStep, setForgotStep] = useState<'email' | 'otp'>('email')
  const [forgotEmail, setForgotEmail] = useState('')
  const [forgotMsg, setForgotMsg] = useState('')
  const [forgotLoading, setForgotLoading] = useState(false)
  const [otpDigits, setOtpDigits] = useState<string[]>(['', '', '', '', ''])
  const [newPassword, setNewPassword] = useState('')
  const otpRefs = useRef<(HTMLInputElement | null)[]>([])

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
      localStorage.setItem('role', 'candidate')
      document.cookie = `token=${data.access_token}; path=/`
      document.cookie = `role=candidate; path=/`
      router.push('/candidate/dashboard')
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

  /* Ambient particle field — quiet, slow, premium */
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    let W = (canvas.width = canvas.offsetWidth)
    let H = (canvas.height = canvas.offsetHeight)
    const onResize = () => { W = canvas.width = canvas.offsetWidth; H = canvas.height = canvas.offsetHeight }
    window.addEventListener('resize', onResize)

    const particles: { x: number; y: number; vx: number; vy: number; r: number; alpha: number; gold: boolean }[] = []
    for (let i = 0; i < 70; i++) {
      particles.push({ x: Math.random() * W, y: Math.random() * H, vx: (Math.random() - 0.5) * 0.18, vy: (Math.random() - 0.5) * 0.18, r: Math.random() * 1.1 + 0.3, alpha: Math.random() * 0.35 + 0.08, gold: Math.random() > 0.82 })
    }

    let raf: number
    const draw = () => {
      ctx.clearRect(0, 0, W, H)
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const d = Math.hypot(particles[i].x - particles[j].x, particles[i].y - particles[j].y)
          if (d < 70) {
            ctx.beginPath()
            ctx.moveTo(particles[i].x, particles[i].y)
            ctx.lineTo(particles[j].x, particles[j].y)
            ctx.strokeStyle = `rgba(196,154,77,${0.08 * (1 - d / 70)})`
            ctx.lineWidth = 0.5
            ctx.stroke()
          }
        }
        const p = particles[i]
        p.x += p.vx; p.y += p.vy
        if (p.x < 0 || p.x > W) p.vx *= -1
        if (p.y < 0 || p.y > H) p.vy *= -1
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2)
        ctx.fillStyle = p.gold ? `rgba(212,175,109,${p.alpha + 0.12})` : `rgba(255,255,255,${p.alpha})`
        ctx.fill()
      }
      raf = requestAnimationFrame(draw)
    }
    draw()
    return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', onResize) }
  }, [])

  const calcStrength = (v: string) => {
    let s = 0
    if (v.length > 7) s++
    if (/[A-Z]/.test(v)) s++
    if (/[0-9]/.test(v)) s++
    if (/[^A-Za-z0-9]/.test(v)) s++
    setStrength(s)
  }

  const handleLogin = async () => {
    if (loading) return
    setError('')
    setLoading(true)
    try {
      const data = await api.login(email, password)
      localStorage.setItem('token', data.access_token)
      localStorage.setItem('role', 'candidate')
      document.cookie = `token=${data.access_token}; path=/`
      document.cookie = `role=candidate; path=/`
      router.push('/candidate/dashboard')
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

  const handleSignup = async () => {
    if (loading) return
    setError('')
    setLoading(true)
    try {
      await api.signupCandidate({ name, email, password })
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

  const strengthColors = ['#c44b4b', '#c4843f', '#b8a23c', '#4a9d6e']
  const strengthLabels = ['Weak', 'Fair', 'Good', 'Strong']

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#0a0a08', fontFamily: "'Inter', system-ui, sans-serif" }}>
      <FontImports />

      {/* ============ LEFT — EDITORIAL VISUAL PANEL ============ */}
      <div style={{ flex: '1 1 52%', position: 'relative', overflow: 'hidden', display: 'flex', flexDirection: 'column', background: 'radial-gradient(ellipse 120% 80% at 20% 0%, #161310 0%, #0a0a08 60%)' }}>
        <canvas ref={canvasRef} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0.9 }} />

        {/* Fine hairline frame — gives the panel a designed edge, not a flat block */}
        <div style={{ position: 'absolute', inset: 24, border: '1px solid rgba(212,175,109,.14)', borderRadius: 2, pointerEvents: 'none' }} />

        <div style={{ position: 'relative', zIndex: 2, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', height: '100%', padding: '56px 60px' }}>

          {/* Top: wordmark */}
          <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: 12, textDecoration: 'none' }}>
            <div style={{ width: 30, height: 30, border: '1px solid rgba(212,175,109,.5)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <div style={{ width: 6, height: 6, background: '#d4af6d', borderRadius: '50%' }} />
            </div>
            <span style={{ fontFamily: "Inter, sans-serif", fontSize: 21, fontWeight: 500, color: 'rgba(245,242,235,.92)', letterSpacing: '0.5px' }}>TalentIQ</span>
          </Link>

          {/* Middle: refined proof panel — single composed card, not scattered chips */}
          <div style={{ maxWidth: 380 }}>
            <div style={{
              background: 'linear-gradient(165deg, rgba(255,255,255,.045), rgba(255,255,255,.015))',
              border: '1px solid rgba(255,255,255,.09)',
              borderRadius: 4,
              padding: '28px 30px',
              backdropFilter: 'blur(6px)',
            }}>
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 20, borderBottom: '1px solid rgba(255,255,255,.08)', paddingBottom: 18 }}>
                <div>
                  <div style={{ fontFamily: "Inter, sans-serif", fontSize: 44, fontWeight: 500, color: '#d4af6d', lineHeight: 1, letterSpacing: '-0.5px' }}>91</div>
                  <div style={{ fontSize: 11, color: 'rgba(245,242,235,.4)', marginTop: 6, letterSpacing: '0.04em', textTransform: 'uppercase' }}>Match score</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 13, fontWeight: 500, color: 'rgba(245,242,235,.85)' }}>Zara Ahmed</div>
                  <div style={{ fontSize: 12, color: 'rgba(245,242,235,.4)', marginTop: 2 }}>Product Designer</div>
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
                {[{ l: 'Design systems', v: 96 }, { l: 'User research', v: 88 }, { l: 'Prototyping', v: 74 }].map(row => (
                  <div key={row.l} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <span style={{ fontSize: 12, color: 'rgba(245,242,235,.5)', width: 110, flexShrink: 0 }}>{row.l}</span>
                    <div style={{ flex: 1, height: 2, background: 'rgba(255,255,255,.08)', borderRadius: 1, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${row.v}%`, background: 'linear-gradient(90deg, #a8854a, #d4af6d)' }} />
                    </div>
                    <span style={{ fontSize: 11, color: 'rgba(245,242,235,.35)', width: 26, textAlign: 'right' }}>{row.v}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Bottom: editorial headline + restrained stat row */}
          <div>
            <div style={{ fontSize: 11, fontWeight: 500, letterSpacing: '0.18em', textTransform: 'uppercase', color: '#d4af6d', marginBottom: 20 }}>
              For candidates
            </div>
            <h2 style={{ fontFamily: "Inter, sans-serif", fontSize: 'clamp(32px,3.6vw,46px)', fontWeight: 500, lineHeight: 1.18, color: '#f5f2eb', marginBottom: 18, letterSpacing: '-0.5px' }}>
              Know exactly where<br />you stand — before<br />you apply.
            </h2>
            <p style={{ fontSize: 14.5, color: 'rgba(245,242,235,.42)', lineHeight: 1.75, maxWidth: 340, marginBottom: 32, fontWeight: 300 }}>
              A precise match score against any role, with the reasoning behind it. No guesswork.
            </p>
            <div style={{ display: 'flex', gap: 0, borderTop: '1px solid rgba(255,255,255,.08)', paddingTop: 20 }}>
              {[{ v: '94%', l: 'Accuracy' }, { v: '2.1s', l: 'Per scan' }, { v: '12k+', l: 'CVs read' }].map((s, i) => (
                <div key={s.l} style={{ paddingRight: 32, marginRight: 32, borderRight: i < 2 ? '1px solid rgba(255,255,255,.08)' : 'none' }}>
                  <div style={{ fontFamily: "Inter, sans-serif", fontSize: 24, fontWeight: 500, color: '#f5f2eb', lineHeight: 1 }}>{s.v}</div>
                  <div style={{ fontSize: 11, color: 'rgba(245,242,235,.35)', marginTop: 5, letterSpacing: '0.03em' }}>{s.l}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ============ RIGHT — FORM PANEL ============ */}
      <div style={{ flex: '1 1 480px', maxWidth: 500, background: '#0d0d0b', borderLeft: '1px solid rgba(255,255,255,.06)', display: 'flex', flexDirection: 'column' }}>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '32px 48px 0' }}>
          <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 13, color: 'rgba(245,242,235,.38)', textDecoration: 'none', fontWeight: 400 }}>
            <span style={{ fontSize: 15 }}>←</span> Back
          </Link>
          <Link href="/auth/login/hr" style={{ fontSize: 13, color: 'rgba(245,242,235,.38)', textDecoration: 'none' }}>
            HR team? <span style={{ color: '#d4af6d' }}>Sign in</span>
          </Link>
        </div>

        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '40px 48px', maxWidth: 420, width: '100%' }}>

          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 9, marginBottom: 36 }}>
            <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#d4af6d', display: 'inline-block' }} />
            <span style={{ fontSize: 11, fontWeight: 500, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'rgba(212,175,109,.85)' }}>Candidate portal</span>
          </div>

          {/* Tabs — underline style, not boxed pill (reads less templated) */}
          <div style={{ display: 'flex', gap: 28, marginBottom: 36, borderBottom: '1px solid rgba(255,255,255,.08)' }}>
            {(['login', 'signup'] as const).map(t => (
              <button
                key={t}
                onClick={() => setTab(t)}
                style={{
                  padding: '0 0 14px', fontSize: 14, fontWeight: 500,
                  fontFamily: 'inherit', border: 'none', cursor: 'pointer', background: 'none',
                  color: tab === t ? '#f5f2eb' : 'rgba(245,242,235,.32)',
                  borderBottom: tab === t ? '1.5px solid #d4af6d' : '1.5px solid transparent',
                  marginBottom: -1, transition: 'color .2s',
                }}
              >
                {t === 'login' ? 'Sign in' : 'Create account'}
              </button>
            ))}
          </div>

          {error && (
            <div style={{ background: 'rgba(196,75,75,.08)', border: '1px solid rgba(196,75,75,.25)', color: '#e08585', fontSize: 13, padding: '11px 15px', borderRadius: 3, marginBottom: 20 }}>
              {error}
            </div>
          )}

          {tab === 'login' ? (
            <>
            <div>
              <h1 style={{ fontFamily: "Inter, sans-serif", fontSize: 30, fontWeight: 500, color: '#f5f2eb', marginBottom: 8, letterSpacing: '-0.3px' }}>
                Welcome back
              </h1>
              <p style={{ fontSize: 13.5, color: 'rgba(245,242,235,.4)', marginBottom: 30, fontWeight: 300 }}>
                New here?{' '}
                <button onClick={() => setTab('signup')} style={{ color: '#d4af6d', fontWeight: 500, background: 'none', border: 'none', cursor: 'pointer', fontSize: 13.5, fontFamily: 'inherit', padding: 0 }}>
                  Create a free account
                </button>
              </p>

              <RefinedField label="Email" type="email" value={email} onChange={setEmail} placeholder="you@email.com"
                focused={focused === 'email'} onFocus={() => setFocused('email')} onBlur={() => setFocused(null)} />
              <RefinedField label="Password" type="password" value={password} onChange={setPassword} placeholder="••••••••"
                focused={focused === 'password'} onFocus={() => setFocused('password')} onBlur={() => setFocused(null)} />

              <div style={{ textAlign: 'right', marginBottom: 28 }}>
                <a href="#" onClick={e=>{e.preventDefault();setShowForgot(true);setForgotMsg('');setForgotEmail(email)}} style={{ fontSize: 12.5, color: 'rgba(245,242,235,.32)', textDecoration: 'none' }}>Forgot password?</a>
              </div>

              <button onClick={handleLogin} disabled={loading} style={{ ...primaryBtn, display:'flex', alignItems:'center', justifyContent:'center', gap:8 }}>
                {loading && (
                  <svg width="14" height="14" viewBox="0 0 24 24" style={{ animation:'spin 0.8s linear infinite' }}>
                    <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3"/>
                    <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="3" strokeDasharray="28 56" strokeLinecap="round"/>
                  </svg>
                )}
                {loading ? 'Signing in…' : 'Sign in'}
              </button>
              <style dangerouslySetInnerHTML={{ __html: `@keyframes spin{to{transform:rotate(360deg)}}` }} />
              <SocialAuthRow />
            </div>

            {/* Forgot Password Modal */}
            {showForgot && (
              <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.7)', zIndex:999, display:'flex', alignItems:'center', justifyContent:'center' }} onClick={()=>{setShowForgot(false); setForgotStep('email')}}>
                <div style={{ background:'#141412', border:'1px solid rgba(255,255,255,.1)', borderRadius:16, padding:28, width:340, maxWidth:'90vw' }} onClick={e=>e.stopPropagation()}>
                  {forgotStep === 'email' ? (
                    <>
                      <div style={{ fontFamily:"Inter, sans-serif", fontSize:22, fontWeight:600, marginBottom:6, color:'#f5f2eb' }}>Forgot Password</div>
                      <p style={{ fontSize:13, color:'rgba(255,255,255,.35)', marginBottom:20 }}>Enter your email — we'll send a 5-digit reset code.</p>
                      <input value={forgotEmail} onChange={e=>setForgotEmail(e.target.value)} placeholder="your@email.com" style={{ width:'100%', background:'#1e1e1b', border:'1px solid rgba(255,255,255,.08)', borderRadius:8, padding:'10px 12px', fontSize:13, color:'rgba(255,255,255,.8)', outline:'none', fontFamily:'inherit', marginBottom:12, boxSizing:'border-box' as any }} />
                      {forgotMsg && <div style={{ fontSize:12, color:'#ef4444', marginBottom:12 }}>{forgotMsg}</div>}
                      <div style={{ display:'flex', gap:8 }}>
                        <button onClick={()=>setShowForgot(false)} style={{ flex:1, fontSize:13, padding:'9px', borderRadius:8, border:'1px solid rgba(255,255,255,.08)', background:'transparent', color:'rgba(255,255,255,.4)', cursor:'pointer', fontFamily:'inherit' }}>Cancel</button>
                        <button onClick={handleSendOtp} disabled={forgotLoading} style={{ flex:1, fontSize:13, fontWeight:600, padding:'9px', borderRadius:8, border:'none', background:'#d4af6d', color:'#0a0a08', cursor:'pointer', fontFamily:'inherit' }}>{forgotLoading?'Sending…':'Send Code'}</button>
                      </div>
                    </>
                  ) : (
                    <>
                      <div style={{ fontFamily:"Inter, sans-serif", fontSize:22, fontWeight:600, marginBottom:6, color:'#f5f2eb' }}>Enter Code</div>
                      <p style={{ fontSize:13, color:'rgba(255,255,255,.35)', marginBottom:18 }}>Sent to {forgotEmail}. Expires in 10 minutes.</p>

                      <div style={{ display:'flex', gap:8, marginBottom:16, justifyContent:'center' }}>
                        {otpDigits.map((d, i) => (
                          <input
                            key={i}
                            ref={el => { otpRefs.current[i] = el }}
                            value={d}
                            onChange={e=>handleOtpChange(i, e.target.value)}
                            onKeyDown={e=>handleOtpKeyDown(i, e)}
                            onPaste={handleOtpPaste}
                            maxLength={1}
                            inputMode="numeric"
                            aria-label={`Reset code digit ${i + 1} of 5`}
                            style={{ width:40, height:48, textAlign:'center', fontSize:20, fontWeight:600, background:'#1e1e1b', border:'1px solid rgba(255,255,255,.12)', borderRadius:8, color:'#f5f2eb', outline:'none', fontFamily:'inherit' }}
                          />
                        ))}
                      </div>

                      <input
                        type="password"
                        value={newPassword}
                        onChange={e=>setNewPassword(e.target.value)}
                        placeholder="New password"
                        style={{ width:'100%', background:'#1e1e1b', border:'1px solid rgba(255,255,255,.08)', borderRadius:8, padding:'10px 12px', fontSize:13, color:'rgba(255,255,255,.8)', outline:'none', fontFamily:'inherit', marginBottom:12, boxSizing:'border-box' as any }}
                      />

                      {forgotMsg && <div style={{ fontSize:12, color:'#ef4444', marginBottom:12 }}>{forgotMsg}</div>}

                      <div style={{ display:'flex', gap:8, marginBottom:10 }}>
                        <button onClick={()=>{setForgotStep('email'); setForgotMsg('')}} style={{ flex:1, fontSize:13, padding:'9px', borderRadius:8, border:'1px solid rgba(255,255,255,.08)', background:'transparent', color:'rgba(255,255,255,.4)', cursor:'pointer', fontFamily:'inherit' }}>Back</button>
                        <button onClick={handleResetPassword} disabled={forgotLoading} style={{ flex:1, fontSize:13, fontWeight:600, padding:'9px', borderRadius:8, border:'none', background:'#d4af6d', color:'#0a0a08', cursor:'pointer', fontFamily:'inherit' }}>{forgotLoading?'Resetting…':'Reset Password'}</button>
                      </div>
                      <button onClick={handleSendOtp} disabled={forgotLoading} style={{ width:'100%', fontSize:12, background:'none', border:'none', color:'rgba(255,255,255,.3)', cursor:'pointer', fontFamily:'inherit' }}>Resend code</button>
                    </>
                  )}
                </div>
              </div>
            )}
            </>
          ) : signupStep === 'verify' ? (
            <div>
              <h1 style={{ fontFamily: "Inter, sans-serif", fontSize: 30, fontWeight: 500, color: '#f5f2eb', marginBottom: 8, letterSpacing: '-0.3px' }}>
                Verify your email
              </h1>
              <p style={{ fontSize: 13.5, color: 'rgba(245,242,235,.4)', marginBottom: 24, fontWeight: 300 }}>
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
                    style={{ width: 44, height: 52, textAlign: 'center', fontSize: 20, fontWeight: 600, background: '#1e1e1b', border: '1px solid rgba(255,255,255,.12)', borderRadius: 8, color: '#f5f2eb', outline: 'none', fontFamily: 'inherit' }}
                  />
                ))}
              </div>

              {verifyMsg && <div style={{ fontSize: 12, color: verifyMsg === 'New code sent.' ? '#13c28e' : '#ef4444', marginBottom: 16, textAlign: 'center' }}>{verifyMsg}</div>}

              <button onClick={handleVerifySignup} disabled={verifyLoading} style={primaryBtn}>
                {verifyLoading ? 'Verifying…' : 'Verify & Continue'}
              </button>

              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <button onClick={() => { setSignupStep('form'); setTab('signup') }} style={{ fontSize: 12.5, color: 'rgba(245,242,235,.32)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>Back</button>
                <button onClick={handleResendVerification} disabled={verifyLoading} style={{ fontSize: 12.5, color: '#d4af6d', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>Resend code</button>
              </div>
            </div>
          ) : (
            <div>
              <h1 style={{ fontFamily: "Inter, sans-serif", fontSize: 30, fontWeight: 500, color: '#f5f2eb', marginBottom: 8, letterSpacing: '-0.3px' }}>
                Create your account
              </h1>
              <p style={{ fontSize: 13.5, color: 'rgba(245,242,235,.4)', marginBottom: 30, fontWeight: 300 }}>
                Already have one?{' '}
                <button onClick={() => setTab('login')} style={{ color: '#d4af6d', fontWeight: 500, background: 'none', border: 'none', cursor: 'pointer', fontSize: 13.5, fontFamily: 'inherit', padding: 0 }}>
                  Sign in
                </button>
              </p>

              <RefinedField label="Full name" type="text" value={name} onChange={setName} placeholder="Your full name"
                focused={focused === 'name'} onFocus={() => setFocused('name')} onBlur={() => setFocused(null)} />
              <RefinedField label="Email" type="email" value={email} onChange={setEmail} placeholder="you@email.com"
                focused={focused === 'email'} onFocus={() => setFocused('email')} onBlur={() => setFocused(null)} />

              <div style={{ marginBottom: 22 }}>
                <label style={labelStyle}>Password</label>
                <div style={{
                  borderBottom: `1px solid ${focused === 'password' ? '#d4af6d' : 'rgba(255,255,255,.12)'}`,
                  transition: 'border-color .2s',
                }}>
                  <input
                    type="password"
                    value={password}
                    onChange={e => { setPassword(e.target.value); calcStrength(e.target.value) }}
                    onFocus={() => setFocused('password')}
                    onBlur={() => setFocused(null)}
                    placeholder="Create a strong password"
                    style={inputBareStyle}
                  />
                </div>
                <div style={{ display: 'flex', gap: 4, marginTop: 10 }}>
                  {[0, 1, 2, 3].map(i => (
                    <div key={i} style={{ flex: 1, height: 2, borderRadius: 1, background: i < strength ? strengthColors[strength - 1] : 'rgba(255,255,255,.08)', transition: 'background .3s' }} />
                  ))}
                </div>
                {strength > 0 && <p style={{ fontSize: 11, color: strengthColors[strength - 1], marginTop: 6, fontWeight: 500 }}>{strengthLabels[strength - 1]}</p>}
              </div>

              <button onClick={handleSignup} disabled={loading} style={primaryBtn}>
                {loading ? 'Creating account…' : 'Create account'}
              </button>

              <p style={{ textAlign: 'center', fontSize: 12, color: 'rgba(245,242,235,.3)', marginTop: 20, fontWeight: 300 }}>
                By continuing you agree to our <a href="/terms" style={{ color: '#d4af6d' }}>Terms</a> and <a href="/privacy" style={{ color: '#d4af6d' }}>Privacy Policy</a>
              </p>
            </div>
          )}
        </div>

        <div style={{ padding: '24px 48px', borderTop: '1px solid rgba(255,255,255,.06)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 12.5, color: 'rgba(245,242,235,.3)', fontWeight: 300 }}>Hiring instead of applying?</span>
          <Link href="/auth/login/hr" style={{ fontSize: 12.5, color: '#d4af6d', textDecoration: 'none', fontWeight: 500 }}>HR portal →</Link>
        </div>
      </div>
    </div>
  )
}

const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: 11.5, fontWeight: 500, letterSpacing: '0.05em',
  color: 'rgba(245,242,235,.4)', marginBottom: 10,
}

const inputBareStyle: React.CSSProperties = {
  width: '100%', background: 'transparent', border: 'none', outline: 'none',
  color: '#f5f2eb', fontSize: 14.5, fontFamily: 'inherit', padding: '10px 0',
}

const primaryBtn: React.CSSProperties = {
  width: '100%', background: '#d4af6d', color: '#15130f', fontWeight: 600,
  fontSize: 14, padding: '15px', borderRadius: 3, border: 'none',
  cursor: 'pointer', fontFamily: 'inherit', letterSpacing: '0.01em',
  marginBottom: 24, transition: 'background .2s, transform .15s',
}

function RefinedField({
  label, type, value, onChange, placeholder, focused, onFocus, onBlur,
}: {
  label: string; type: string; value: string; onChange: (v: string) => void
  placeholder: string; focused: boolean; onFocus: () => void; onBlur: () => void
}) {
  const [reveal, setReveal] = useState(false)
  const isPassword = type === 'password'
  const inputId = `field-${label.toLowerCase().replace(/\s+/g, '-')}`
  return (
    <div style={{ marginBottom: 22 }}>
      <label htmlFor={inputId} style={labelStyle}>{label}</label>
      <div style={{ display: 'flex', alignItems: 'center', borderBottom: `1px solid ${focused ? '#d4af6d' : 'rgba(255,255,255,.12)'}`, transition: 'border-color .2s' }}>
        <input
          id={inputId}
          type={isPassword && reveal ? 'text' : type}
          value={value}
          onChange={e => onChange(e.target.value)}
          onFocus={onFocus}
          onBlur={onBlur}
          placeholder={placeholder}
          autoComplete={isPassword ? 'current-password' : undefined}
          style={{ ...inputBareStyle, flex: 1 }}
        />
        {isPassword && (
          <button
            type="button"
            onClick={() => setReveal(r => !r)}
            aria-label={reveal ? 'Hide password' : 'Show password'}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(245,242,235,.4)', padding: '0 2px 6px', display: 'flex', alignItems: 'center' }}
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