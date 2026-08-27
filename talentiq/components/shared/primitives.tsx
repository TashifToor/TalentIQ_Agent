'use client'
import { useState, ReactNode, CSSProperties } from 'react'

/**
 * Shared design-system primitives for the AI Interview Builder.
 * Dark glassmorphism palette — reuses the CSS vars + animation classes
 * already defined in app/globals.css (--dark/--gold2/--teal2/.glass-card/etc)
 * so this stays visually consistent with the landing page + candidate dashboard.
 *
 * Intentionally kept in one file (a small "barrel" of primitives) rather than
 * 11 near-empty files — still individually exported/reusable, just co-located.
 */

// ─────────────────────────────────────────────────────────────────
// GlassCard — base glassmorphic container, the foundation every other
// card in this system builds on.
// ─────────────────────────────────────────────────────────────────
export function GlassCard({
  children, style, onClick, glow, hoverable, className,
}: {
  children: ReactNode; style?: CSSProperties; onClick?: () => void
  glow?: boolean; hoverable?: boolean; className?: string
}) {
  const [hovered, setHovered] = useState(false)
  return (
    <div
      className={`glass-card ${className || ''}`}
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        borderRadius: 16,
        padding: 20,
        position: 'relative',
        cursor: onClick ? 'pointer' : 'default',
        transition: 'transform .3s var(--ease), box-shadow .3s var(--ease), border-color .3s var(--ease)',
        transform: hoverable && hovered ? 'translateY(-4px) scale(1.01)' : 'none',
        boxShadow: glow && hovered
          ? '0 20px 60px -12px rgba(226,176,74,.25), 0 0 0 1px rgba(226,176,74,.15)'
          : hoverable && hovered ? '0 16px 40px -10px rgba(0,0,0,.4)' : '0 4px 16px -4px rgba(0,0,0,.2)',
        ...style,
      }}
    >
      {children}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────
// GradientBadge — small pill, used for "Flagship", difficulty, mode tags
// ─────────────────────────────────────────────────────────────────
const BADGE_GRADIENTS: Record<string, string> = {
  gold: 'linear-gradient(135deg,#c5931f,#e2b04a,#f5d87a)',
  teal: 'linear-gradient(135deg,#0b7c5e,#13c28e)',
  purple: 'linear-gradient(135deg,#7c3aed,#a78bfa)',
  neutral: 'linear-gradient(135deg,#3a3a36,#5a5a54)',
}
export function GradientBadge({ label, tone = 'neutral', icon }: { label: string; tone?: 'gold' | 'teal' | 'purple' | 'neutral'; icon?: string }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 10, fontWeight: 800,
      letterSpacing: '.04em', textTransform: 'uppercase', padding: '4px 10px', borderRadius: 100,
      background: BADGE_GRADIENTS[tone], color: tone === 'neutral' ? 'rgba(255,255,255,.8)' : '#0a0a08',
    }}>
      {icon && <span style={{ fontSize: 11 }}>{icon}</span>}{label}
    </span>
  )
}

// ─────────────────────────────────────────────────────────────────
// FeatureCard — compact icon+label row, used inside mode cards for
// the "AI Features" / "Anti-Cheat" bullet lists
// ─────────────────────────────────────────────────────────────────
export function FeatureCard({ icon, label }: { icon: string; label: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11.5, color: 'rgba(255,255,255,.55)', padding: '3px 0' }}>
      <span style={{ fontSize: 12, flexShrink: 0, opacity: .8 }}>{icon}</span>
      <span>{label}</span>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────
// StepHeader — back button + step progress dots, used by the wizard
// ─────────────────────────────────────────────────────────────────
export function StepHeader({
  title, subtitle, step, totalSteps, onBack,
}: { title: string; subtitle?: string; step: number; totalSteps: number; onBack?: () => void }) {
  return (
    <div style={{ marginBottom: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
        {onBack && (
          <button onClick={onBack} style={{
            width: 30, height: 30, borderRadius: 8, border: '1px solid rgba(255,255,255,.1)',
            background: 'rgba(255,255,255,.03)', color: 'rgba(255,255,255,.6)', cursor: 'pointer',
            display: 'grid', placeItems: 'center', flexShrink: 0, transition: 'all .2s',
          }}>
            <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M10 3L5 8l5 5" /></svg>
          </button>
        )}
        <div style={{ display: 'flex', gap: 5 }}>
          {Array.from({ length: totalSteps }).map((_, i) => (
            <div key={i} style={{
              width: i === step - 1 ? 22 : 7, height: 7, borderRadius: 4, transition: 'all .3s var(--ease)',
              background: i <= step - 1 ? 'linear-gradient(90deg,#c5931f,#e2b04a)' : 'rgba(255,255,255,.1)',
            }} />
          ))}
        </div>
        <span style={{ fontSize: 10.5, color: 'rgba(255,255,255,.3)', fontWeight: 600 }}>STEP {step} OF {totalSteps}</span>
      </div>
      <div style={{ fontFamily: "Inter, sans-serif", fontSize: 26, fontWeight: 600, color: '#fff', marginBottom: subtitle ? 4 : 0 }}>{title}</div>
      {subtitle && <div style={{ fontSize: 12.5, color: 'rgba(255,255,255,.35)' }}>{subtitle}</div>}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────
// MetricCard — number + label, used in the Final Review metrics grid
// ─────────────────────────────────────────────────────────────────
export function MetricCard({ label, value, icon, accent = '#e2b04a' }: { label: string; value: string; icon?: string; accent?: string }) {
  return (
    <GlassCard style={{ padding: '16px 18px', textAlign: 'center' }}>
      {icon && <div style={{ fontSize: 18, marginBottom: 6 }}>{icon}</div>}
      <div style={{ fontFamily: "Inter, sans-serif", fontSize: 24, fontWeight: 700, color: accent, marginBottom: 3 }}>{value}</div>
      <div style={{ fontSize: 10.5, color: 'rgba(255,255,255,.4)', textTransform: 'uppercase', letterSpacing: '.04em', fontWeight: 600 }}>{label}</div>
    </GlassCard>
  )
}

// ─────────────────────────────────────────────────────────────────
// AIInsightCard — used in the AI Review step for computed suggestions
// ─────────────────────────────────────────────────────────────────
const TONE_STYLES = {
  positive: { color: '#13c28e', bg: 'rgba(19,194,142,.08)', border: 'rgba(19,194,142,.25)', icon: '✓' },
  neutral: { color: '#e2b04a', bg: 'rgba(226,176,74,.08)', border: 'rgba(226,176,74,.25)', icon: 'ℹ' },
  suggestion: { color: '#a78bfa', bg: 'rgba(167,139,250,.08)', border: 'rgba(167,139,250,.25)', icon: '✦' },
}
export function AIInsightCard({ text, tone = 'neutral' }: { text: string; tone?: 'positive' | 'neutral' | 'suggestion' }) {
  const t = TONE_STYLES[tone]
  return (
    <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '10px 14px', borderRadius: 10, background: t.bg, border: `1px solid ${t.border}`, marginBottom: 8 }}>
      <span style={{ color: t.color, fontSize: 13, fontWeight: 700, flexShrink: 0, marginTop: 1 }}>{t.icon}</span>
      <span style={{ fontSize: 12.5, color: 'rgba(255,255,255,.75)', lineHeight: 1.6 }}>{text}</span>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────
// AnimatedButton — primary CTA with hover scale + glow
// ─────────────────────────────────────────────────────────────────
export function AnimatedButton({
  children, onClick, variant = 'primary', disabled, loading, fullWidth,
}: { children: ReactNode; onClick?: () => void; variant?: 'primary' | 'secondary' | 'ghost'; disabled?: boolean; loading?: boolean; fullWidth?: boolean }) {
  const [hovered, setHovered] = useState(false)
  const styles = {
    primary: { background: 'linear-gradient(135deg,#c5931f,#e2b04a)', color: '#0a0a08', border: 'none' },
    secondary: { background: 'rgba(255,255,255,.05)', color: '#fff', border: '1px solid rgba(255,255,255,.12)' },
    ghost: { background: 'transparent', color: 'rgba(255,255,255,.5)', border: 'none' },
  }[variant]
  const isDisabled = disabled || loading
  return (
    <button
      onClick={onClick}
      disabled={isDisabled}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        ...styles,
        width: fullWidth ? '100%' : undefined,
        padding: '12px 24px', borderRadius: 10, fontSize: 13, fontWeight: 700, fontFamily: 'Inter,sans-serif',
        cursor: isDisabled ? 'default' : 'pointer', opacity: isDisabled ? .55 : 1,
        transform: hovered && !isDisabled ? 'translateY(-1px) scale(1.015)' : 'none',
        boxShadow: hovered && !isDisabled && variant === 'primary' ? '0 8px 24px -4px rgba(226,176,74,.4)' : 'none',
        transition: 'all .2s var(--ease)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
      }}>
      {loading ? <LoadingSkeleton width={16} height={16} circle /> : children}
    </button>
  )
}

// ─────────────────────────────────────────────────────────────────
// FloatingAction — small pill trigger (e.g. "Learn more", expand)
// ─────────────────────────────────────────────────────────────────
export function FloatingAction({ label, onClick, icon }: { label: string; onClick: () => void; icon?: string }) {
  return (
    <button onClick={onClick} style={{
      display: 'inline-flex', alignItems: 'center', gap: 6, background: 'rgba(255,255,255,.04)',
      border: '1px solid rgba(255,255,255,.1)', borderRadius: 100, padding: '6px 13px', fontSize: 11,
      fontWeight: 600, color: 'rgba(255,255,255,.55)', cursor: 'pointer', fontFamily: 'Inter,sans-serif', transition: 'all .2s',
    }}>
      {icon && <span>{icon}</span>}{label}
    </button>
  )
}

// ─────────────────────────────────────────────────────────────────
// PremiumTooltip — hover-to-reveal tooltip wrapper
// ─────────────────────────────────────────────────────────────────
export function PremiumTooltip({ label, children }: { label: string; children: ReactNode }) {
  const [show, setShow] = useState(false)
  return (
    <div style={{ position: 'relative', display: 'inline-block' }} onMouseEnter={() => setShow(true)} onMouseLeave={() => setShow(false)}>
      {children}
      {show && (
        <div className="scale-in" style={{
          position: 'absolute', bottom: '100%', left: '50%', transform: 'translateX(-50%)', marginBottom: 8,
          background: '#1e1e1b', border: '1px solid rgba(255,255,255,.1)', borderRadius: 8, padding: '6px 10px',
          fontSize: 11, color: 'rgba(255,255,255,.8)', whiteSpace: 'nowrap', zIndex: 50, boxShadow: '0 8px 24px rgba(0,0,0,.4)',
        }}>
          {label}
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────
// EmptyState — used for the Copilot "Coming Soon" panel + AI review
// placeholder sections that don't have real AI output yet
// ─────────────────────────────────────────────────────────────────
export function EmptyState({ icon, title, description }: { icon: string; title: string; description: string }) {
  return (
    <div style={{ textAlign: 'center', padding: '28px 16px' }}>
      <div style={{ fontSize: 26, marginBottom: 10, opacity: .6 }}>{icon}</div>
      <div style={{ fontSize: 13, fontWeight: 700, color: 'rgba(255,255,255,.65)', marginBottom: 5 }}>{title}</div>
      <div style={{ fontSize: 11.5, color: 'rgba(255,255,255,.35)', lineHeight: 1.6, maxWidth: 280, margin: '0 auto' }}>{description}</div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────
// Timeline — vertical event timeline (interview history, activity log).
// Shared between HR candidate history and Candidate's own progress view.
// ─────────────────────────────────────────────────────────────────
export interface TimelineEvent { title: string; timestamp: string; description?: string; icon?: string; accent?: string }
export function Timeline({ events }: { events: TimelineEvent[] }) {
  if (events.length === 0) return <EmptyState icon="🕓" title="No activity yet" description="Events will show up here once something happens." />
  return (
    <div>
      {events.map((ev, i) => (
        <div key={i} style={{ display: 'flex', gap: 14, position: 'relative' }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
            <div style={{
              width: 26, height: 26, borderRadius: '50%', display: 'grid', placeItems: 'center', fontSize: 11,
              background: `${ev.accent || '#e2b04a'}18`, border: `1.5px solid ${ev.accent || '#e2b04a'}50`, flexShrink: 0,
            }}>{ev.icon || '●'}</div>
            {i < events.length - 1 && <div style={{ width: 1.5, flex: 1, background: 'rgba(255,255,255,.08)', minHeight: 24 }} />}
          </div>
          <div style={{ paddingBottom: 20, flex: 1 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 10 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#fff' }}>{ev.title}</div>
              <div style={{ fontSize: 10.5, color: 'rgba(255,255,255,.3)', flexShrink: 0 }}>{ev.timestamp}</div>
            </div>
            {ev.description && <div style={{ fontSize: 11.5, color: 'rgba(255,255,255,.45)', marginTop: 3, lineHeight: 1.6 }}>{ev.description}</div>}
          </div>
        </div>
      ))}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────
// ProgressRing — circular progress indicator (score, completion %)
// ─────────────────────────────────────────────────────────────────
export function ProgressRing({ value, size = 72, label, accent = '#e2b04a' }: { value: number; size?: number; label?: string; accent?: string }) {
  const r = (size - 8) / 2
  const circumference = 2 * Math.PI * r
  const offset = circumference - (Math.max(0, Math.min(100, value)) / 100) * circumference
  return (
    <div style={{ position: 'relative', width: size, height: size, display: 'inline-grid', placeItems: 'center' }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,.08)" strokeWidth="6" />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={accent} strokeWidth="6" strokeLinecap="round"
          strokeDasharray={circumference} strokeDashoffset={offset} style={{ transition: 'stroke-dashoffset .8s var(--ease)' }} />
      </svg>
      <div style={{ position: 'absolute', textAlign: 'center' }}>
        <div style={{ fontSize: size / 3.2, fontWeight: 700, color: '#fff', fontFamily: "Inter, sans-serif" }}>{Math.round(value)}</div>
        {label && <div style={{ fontSize: 8.5, color: 'rgba(255,255,255,.35)', fontWeight: 600, textTransform: 'uppercase' }}>{label}</div>}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────
// ActivityFeedItem — single row for an activity/notification feed
// ─────────────────────────────────────────────────────────────────
export function ActivityFeedItem({ icon, title, timestamp, accent = '#e2b04a' }: { icon: string; title: string; timestamp: string; accent?: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 0', borderBottom: '1px solid rgba(255,255,255,.05)' }}>
      <div style={{ width: 26, height: 26, borderRadius: 8, display: 'grid', placeItems: 'center', fontSize: 12, background: `${accent}15`, flexShrink: 0 }}>{icon}</div>
      <div style={{ flex: 1, fontSize: 12, color: 'rgba(255,255,255,.7)' }}>{title}</div>
      <div style={{ fontSize: 10.5, color: 'rgba(255,255,255,.3)', flexShrink: 0 }}>{timestamp}</div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────
// ChartBar — minimal premium bar chart, no external chart library
// ─────────────────────────────────────────────────────────────────
export function ChartBar({ data, accent = '#e2b04a' }: { data: { label: string; value: number }[]; accent?: string }) {
  const max = Math.max(...data.map(d => d.value), 1)
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10, height: 100 }}>
      {data.map((d, i) => (
        <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, height: '100%', justifyContent: 'flex-end' }}>
          <div className="bar-grow" style={{ ['--bh' as any]: `${(d.value / max) * 100}%`, width: '100%', maxWidth: 28, borderRadius: '4px 4px 0 0', background: `linear-gradient(180deg, ${accent}, ${accent}80)` }} />
          <div style={{ fontSize: 9.5, color: 'rgba(255,255,255,.35)', fontWeight: 600 }}>{d.label}</div>
        </div>
      ))}
    </div>
  )
}
export function LoadingSkeleton({ width = '100%', height = 14, circle }: { width?: number | string; height?: number; circle?: boolean }) {
  return (
    <div style={{
      width, height, borderRadius: circle ? '50%' : 6,
      background: 'linear-gradient(90deg, rgba(255,255,255,.05) 25%, rgba(255,255,255,.12) 50%, rgba(255,255,255,.05) 75%)',
      backgroundSize: '200% 100%', animation: 'shimmer 1.4s ease-in-out infinite',
    }} />
  )
}