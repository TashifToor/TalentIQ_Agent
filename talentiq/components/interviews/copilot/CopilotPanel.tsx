'use client'
import { GlassCard, EmptyState, GradientBadge } from '@/components/shared/primitives'

/**
 * Reserved slot for the AI Hiring Copilot (Phase 3).
 * Renders alongside the HR wizard now as a "Coming Soon" panel so no
 * redesign is needed later — Phase 3 just fills content here with:
 * JD Optimizer, AI Recommendations, Interview Planner, etc.
 */
export default function CopilotPanel({ context }: { context?: string }) {
  return (
    <GlassCard style={{ width: 260, flexShrink: 0, alignSelf: 'flex-start', position: 'sticky', top: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
        <div style={{
          width: 26, height: 26, borderRadius: 8, display: 'grid', placeItems: 'center', flexShrink: 0,
          background: 'linear-gradient(135deg,#7c3aed,#a78bfa)',
        }}>
          <svg width="13" height="13" viewBox="0 0 16 16" fill="#fff"><path d="M8 1l1.6 4.4L14 7l-4.4 1.6L8 13l-1.6-4.4L2 7l4.4-1.6z" /></svg>
        </div>
        <div style={{ fontSize: 12.5, fontWeight: 700, color: '#fff' }}>Hiring Copilot</div>
        <GradientBadge label="Soon" tone="purple" />
      </div>
      <EmptyState
        icon="🧠"
        title="Your AI co-pilot is warming up"
        description={context || 'Once live, this panel will improve your JD, flag missing skills, and build the interview plan for you automatically.'}
      />
    </GlassCard>
  )
}