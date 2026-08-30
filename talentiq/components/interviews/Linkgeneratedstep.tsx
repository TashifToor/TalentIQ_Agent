'use client'
import { useState } from 'react'
import { GlassCard, AnimatedButton, GradientBadge, MetricCard } from '@/components/shared/primitives'
import { getModeDefinition } from '@/components/modules/interview-engine/modeData'

const CANDIDATE_INSTRUCTIONS: Record<string, string> = {
  chatbot: 'Candidates type their answers in a text conversation — no camera or mic required.',
  mcq: 'Candidates need a working webcam (proctored) and a stable connection for the timed questions.',
  voice_agent: 'Candidates need a working microphone. Push-to-talk — they tap to record each answer.',
}

export default function LinkGeneratedStep({ posting, onDone }: { posting: any; onDone: () => void }) {
  const [copied, setCopied] = useState(false)
  const [shared, setShared] = useState(false)
  const mode = getModeDefinition(posting.mode)
  const badgeTone = mode.id === 'voice_agent' ? 'purple' : mode.id === 'mcq' ? 'teal' : 'gold'

  const copyLink = () => {
    navigator.clipboard?.writeText(posting.public_link).catch(() => {})
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const shareLink = async () => {
    if (typeof navigator !== 'undefined' && (navigator as any).share) {
      try {
        await (navigator as any).share({ title: `${posting.title} — Interview`, url: posting.public_link })
        setShared(true)
        setTimeout(() => setShared(false), 2000)
        return
      } catch { /* user cancelled — no-op */ }
    }
    copyLink() // no native share support — fall back to copy, which is a real, working action
  }

  const createdDate = posting.created_at ? new Date(posting.created_at).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) : '—'

  return (
    <div className="wizard-step-in" style={{ maxWidth: 560, margin: '20px auto 0' }}>
      <div style={{ textAlign: 'center', marginBottom: 24 }}>
        <div className="success-ring" style={{
          width: 56, height: 56, borderRadius: '50%', margin: '0 auto 16px', display: 'grid', placeItems: 'center',
          background: 'linear-gradient(135deg, rgba(19,194,142,.18), rgba(19,194,142,.06))', border: '1.5px solid rgba(19,194,142,.4)',
        }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <path className="check-draw" d="M5 12.5l4.5 4.5L19 7" stroke="#13c28e" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <div style={{ fontFamily: "'Space Grotesk', Inter, sans-serif", fontSize: 24, fontWeight: 600, color: '#1f1c17' }}>Interview link is live</div>
      </div>

      {/* Posting overview — a real management screen, not just "your link is ready" */}
      <GlassCard light style={{ padding: 0, overflow: 'hidden', marginBottom: 16 }}>
        <div style={{ height: 4, background: mode.gradient }} />
        <div style={{ padding: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
            <div>
              <div style={{ fontSize: 17, fontWeight: 700, color: '#1f1c17' }}>{posting.title}</div>
              <div style={{ fontSize: 12, color: '#7a7468', marginTop: 2 }}>{posting.company || 'No company set'} · Created {createdDate}</div>
            </div>
            <GradientBadge label={posting.is_active ? 'Active' : 'Inactive'} tone={posting.is_active ? 'teal' : 'neutral'} light />
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 16 }}>
            <GradientBadge label={mode.title} tone={badgeTone} icon={mode.icon} light />
            {posting.interviewer_name && <GradientBadge label={`Interviewer: ${posting.interviewer_name}`} tone="neutral" light />}
            {posting.notify_hr_on_completion && <GradientBadge label="Email on completion" tone="neutral" icon="✉" light />}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: `repeat(${posting.mode === 'mcq' ? 3 : 2}, 1fr)`, gap: 8, marginBottom: 16 }}>
            <MetricCard label="Duration" value={mode.duration} accent={mode.accent} light />
            <MetricCard label="Difficulty" value={mode.difficulty} accent={mode.accent} light />
            {posting.mode === 'mcq' && <MetricCard label="Questions" value={String(posting.assessment_question_count ?? 0)} accent={mode.accent} light />}
          </div>

          <div style={{ fontSize: 11.5, color: '#5c574c', lineHeight: 1.6, background: '#f0eee6', borderRadius: 8, padding: '10px 12px' }}>
            <strong style={{ color: '#3a352d' }}>Candidate instructions: </strong>
            {CANDIDATE_INSTRUCTIONS[posting.mode] || 'Candidates open the link and follow the on-screen steps.'}
          </div>
        </div>
      </GlassCard>

      <GlassCard light style={{ padding: '14px 16px', marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ flex: 1, textAlign: 'left', fontSize: 12, color: '#3a352d', fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {posting.public_link}
          </div>
          <button onClick={copyLink} style={{
            flexShrink: 0, padding: '7px 14px', borderRadius: 7, border: 'none', cursor: 'pointer',
            background: copied ? 'rgba(19,194,142,.15)' : '#f0eee6', color: copied ? '#13c28e' : '#3a352d',
            fontSize: 11.5, fontWeight: 700, fontFamily: 'Inter,sans-serif', transition: 'all .2s',
          }}>
            {copied ? '✓ Copied' : 'Copy'}
          </button>
        </div>
      </GlassCard>

      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <a href={posting.public_link} target="_blank" rel="noopener noreferrer" style={{ flex: 1, textDecoration: 'none' }}>
          <AnimatedButton variant="secondary" fullWidth>Open Preview ↗</AnimatedButton>
        </a>
        <div style={{ flex: 1 }}>
          <AnimatedButton variant="secondary" onClick={shareLink} fullWidth>{shared ? '✓ Shared' : 'Share Link'}</AnimatedButton>
        </div>
      </div>

      <AnimatedButton onClick={onDone} fullWidth>View Interview Dashboard →</AnimatedButton>
    </div>
  )
}