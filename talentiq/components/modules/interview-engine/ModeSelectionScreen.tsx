'use client'
import { useState, ReactNode } from 'react'
import { GlassCard, GradientBadge, FeatureCard, AnimatedButton, FloatingAction } from '@/components/shared/primitives'
import { MODE_DEFINITIONS, InterviewMode } from './modeData'

export default function ModeSelectionScreen({
  onSelect, ctaLabel = 'Create Interview →', heading = 'Choose Your Interview Experience',
  subheading = 'Every mode is its own product — pick the one that fits this role.',
  eyebrow = 'AI Hiring Operating System', sidePanel,
}: {
  onSelect: (mode: InterviewMode) => void
  ctaLabel?: string
  heading?: string
  subheading?: string
  eyebrow?: string
  sidePanel?: ReactNode
}) {
  const [expanded, setExpanded] = useState<InterviewMode | null>(null)

  return (
    <div className="builder-with-copilot">
      <div style={{ flex: 1 }}>
        <div style={{ marginBottom: 28, textAlign: 'center' }}>
          <GradientBadge label={eyebrow} tone="gold" icon="✦" />
          <div style={{ fontFamily: "Inter, sans-serif", fontSize: 32, fontWeight: 600, color: '#fff', margin: '14px 0 6px' }}>
            {heading}
          </div>
          <div style={{ fontSize: 13, color: 'rgba(255,255,255,.4)' }}>{subheading}</div>
        </div>

        <div className="builder-3col" style={{ position: 'relative' }}>
          {/* Ambient floating glow blobs behind the cards */}
          <div className="floating-glow" style={{ position: 'absolute', width: 280, height: 280, borderRadius: '50%', background: 'radial-gradient(circle, rgba(167,139,250,.12) 0%, transparent 70%)', top: -60, right: -40, filter: 'blur(60px)', pointerEvents: 'none', zIndex: 0 }} />
          <div className="floating-glow drift-d1" style={{ position: 'absolute', width: 220, height: 220, borderRadius: '50%', background: 'radial-gradient(circle, rgba(226,176,74,.1) 0%, transparent 70%)', bottom: -40, left: -30, filter: 'blur(60px)', pointerEvents: 'none', zIndex: 0 }} />

          {MODE_DEFINITIONS.map((m, i) => {
            const isOpen = expanded === m.id
            return (
              <div key={m.id} className="wizard-step-in" style={{ animationDelay: `${i * 0.08}s`, position: 'relative', zIndex: 1 }}>
                <GlassCard hoverable glow style={{
                  padding: 0, overflow: 'hidden', height: '100%', display: 'flex', flexDirection: 'column',
                  border: m.flagship ? `1.5px solid ${m.accent}66` : '1px solid rgba(255,255,255,.08)',
                  boxShadow: m.flagship ? `0 0 40px -8px ${m.accent}33` : undefined,
                }}>
                  {/* Top gradient banner */}
                  <div style={{ height: 4, background: m.gradient }} />

                  <div style={{ padding: '20px 18px', flex: 1, display: 'flex', flexDirection: 'column' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                      <div style={{
                        width: 44, height: 44, borderRadius: 12, display: 'grid', placeItems: 'center', fontSize: 20,
                        background: `${m.accent}18`, border: `1px solid ${m.accent}30`,
                      }} className={m.flagship ? 'voice-pulse' : ''}>
                        {m.icon}
                      </div>
                      {m.flagship && <GradientBadge label="Flagship" tone="purple" icon="⚡" />}
                    </div>

                    <div style={{ fontSize: 16.5, fontWeight: 700, color: '#fff', marginBottom: 5 }}>{m.title}</div>
                    <div style={{ fontSize: 11.5, color: 'rgba(255,255,255,.45)', lineHeight: 1.6, marginBottom: 14 }}>{m.tagline}</div>

                    <div style={{ display: 'flex', gap: 14, marginBottom: 14, paddingBottom: 14, borderBottom: '1px solid rgba(255,255,255,.06)' }}>
                      <div>
                        <div style={{ fontSize: 9.5, color: 'rgba(255,255,255,.3)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.03em' }}>Duration</div>
                        <div style={{ fontSize: 12, color: 'rgba(255,255,255,.7)', fontWeight: 600, marginTop: 2 }}>{m.duration}</div>
                      </div>
                      <div>
                        <div style={{ fontSize: 9.5, color: 'rgba(255,255,255,.3)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.03em' }}>Difficulty</div>
                        <div style={{ fontSize: 12, color: 'rgba(255,255,255,.7)', fontWeight: 600, marginTop: 2 }}>{m.difficulty}</div>
                      </div>
                    </div>

                    {isOpen && (
                      <div className="scale-in" style={{ marginBottom: 12 }}>
                        <div style={{ fontSize: 9.5, color: 'rgba(255,255,255,.3)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.03em', marginBottom: 6 }}>AI Features</div>
                        {m.aiFeatures.map(f => <FeatureCard key={f} icon="◆" label={f} />)}
                        <div style={{ fontSize: 9.5, color: 'rgba(255,255,255,.3)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.03em', margin: '10px 0 6px' }}>Best For</div>
                        {m.bestFor.map(f => <FeatureCard key={f} icon="→" label={f} />)}
                      </div>
                    )}

                    <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: 8, paddingTop: 8 }}>
                      <FloatingAction label={isOpen ? 'Show less' : 'Learn more'} icon={isOpen ? '▲' : '▼'} onClick={() => setExpanded(isOpen ? null : m.id)} />
                      <AnimatedButton fullWidth onClick={() => onSelect(m.id)}>{ctaLabel}</AnimatedButton>
                    </div>
                  </div>
                </GlassCard>
              </div>
            )
          })}
        </div>
      </div>

      {sidePanel}
    </div>
  )
}