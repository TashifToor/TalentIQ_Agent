'use client'
import { useState } from 'react'
import { GlassCard, AnimatedButton, GradientBadge } from './shared/primitives'
import { getModeDefinition } from './shared/modeData'

export default function LinkGeneratedStep({ posting, onDone }: { posting: any; onDone: () => void }) {
  const [copied, setCopied] = useState(false)
  const mode = getModeDefinition(posting.mode)

  const copyLink = () => {
    navigator.clipboard?.writeText(posting.public_link).catch(() => {})
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="wizard-step-in" style={{ maxWidth: 480, margin: '20px auto 0', textAlign: 'center' }}>
      <div className="success-ring" style={{
        width: 64, height: 64, borderRadius: '50%', margin: '0 auto 20px', display: 'grid', placeItems: 'center',
        background: 'linear-gradient(135deg, rgba(19,194,142,.18), rgba(19,194,142,.06))', border: '1.5px solid rgba(19,194,142,.4)',
      }}>
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
          <path className="check-draw" d="M5 12.5l4.5 4.5L19 7" stroke="#13c28e" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>

      <div style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 26, fontWeight: 600, color: '#fff', marginBottom: 6 }}>
        Interview link is live
      </div>
      <div style={{ fontSize: 12.5, color: 'rgba(255,255,255,.4)', marginBottom: 24 }}>
        Share it with candidates — {mode.title} starts the moment they open it.
      </div>

      <GlassCard style={{ padding: '14px 16px', marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ flex: 1, textAlign: 'left', fontSize: 12, color: 'rgba(255,255,255,.7)', fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {posting.public_link}
          </div>
          <button onClick={copyLink} style={{
            flexShrink: 0, padding: '7px 14px', borderRadius: 7, border: 'none', cursor: 'pointer',
            background: copied ? 'rgba(19,194,142,.15)' : 'rgba(255,255,255,.06)', color: copied ? '#13c28e' : 'rgba(255,255,255,.7)',
            fontSize: 11.5, fontWeight: 700, fontFamily: 'Inter,sans-serif', transition: 'all .2s',
          }}>
            {copied ? '✓ Copied' : 'Copy'}
          </button>
        </div>
      </GlassCard>

      <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginBottom: 24 }}>
        <GradientBadge label={mode.title} tone={mode.id === 'voice_agent' ? 'purple' : mode.id === 'mcq' ? 'teal' : 'gold'} icon={mode.icon} />
      </div>

      <AnimatedButton onClick={onDone} fullWidth>View Interview Dashboard →</AnimatedButton>
    </div>
  )
}