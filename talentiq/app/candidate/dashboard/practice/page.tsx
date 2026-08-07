'use client'
import { useState } from 'react'
import Link from 'next/link'
import ModeSelectionScreen from '@/components/modules/interview-engine/ModeSelectionScreen'
import { getModeDefinition, InterviewMode } from '@/components/modules/interview-engine/modeData'
import { GlassCard, AnimatedButton, GradientBadge, EmptyState } from '@/components/shared/primitives'
import AIFeedbackReport from '@/components/modules/reports/AIFeedbackReport'

export default function InterviewPracticePage() {
  const [selected, setSelected] = useState<InterviewMode | null>(null)
  const [showReportPreview, setShowReportPreview] = useState(false)

  return (
    <div style={{ minHeight: '100vh', background: '#0c0c0a', fontFamily: 'Syne, sans-serif', color: 'rgba(255,255,255,.88)' }}>
      <div style={{ height: 56, borderBottom: '1px solid rgba(255,255,255,.07)', display: 'flex', alignItems: 'center', padding: '0 28px', gap: 16 }}>
        <Link href="/candidate/dashboard" style={{ color: 'rgba(255,255,255,.4)', textDecoration: 'none', fontSize: 13 }}>← Dashboard</Link>
        <span style={{ color: 'rgba(255,255,255,.15)' }}>·</span>
        <span style={{ fontSize: 13, color: 'rgba(255,255,255,.6)', fontWeight: 600 }}>Interview Practice</span>
      </div>

      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '40px 24px' }}>
        {!selected ? (
          <ModeSelectionScreen
            eyebrow="AI Career Coach"
            heading="Practice Your Interview Skills"
            subheading="Same AI engines recruiters use — practice risk-free before the real thing."
            ctaLabel="Start Practice →"
            onSelect={setSelected}
          />
        ) : (
          <PracticeComingSoon mode={selected} onBack={() => setSelected(null)} onPreviewReport={() => setShowReportPreview(true)} />
        )}

        {showReportPreview && (
          <div className="scale-in" style={{ marginTop: 24, maxWidth: 640, marginLeft: 'auto', marginRight: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'rgba(255,255,255,.5)' }}>Preview — what your feedback report will look like</div>
              <button onClick={() => setShowReportPreview(false)} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,.35)', cursor: 'pointer', fontSize: 12 }}>Close ✕</button>
            </div>
            <AIFeedbackReport data={{}} />
          </div>
        )}
      </div>
    </div>
  )
}

function PracticeComingSoon({ mode, onBack, onPreviewReport }: { mode: InterviewMode; onBack: () => void; onPreviewReport: () => void }) {
  const m = getModeDefinition(mode)
  return (
    <div className="wizard-step-in" style={{ maxWidth: 520, margin: '0 auto', textAlign: 'center' }}>
      <button onClick={onBack} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,.4)', cursor: 'pointer', fontSize: 12.5, marginBottom: 24 }}>← Choose a different mode</button>
      <GlassCard>
        <div style={{ width: 56, height: 56, borderRadius: 14, display: 'grid', placeItems: 'center', fontSize: 24, background: `${m.accent}18`, margin: '0 auto 16px' }}>{m.icon}</div>
        <div style={{ fontSize: 19, fontWeight: 700, color: '#fff', marginBottom: 8 }}>{m.title} practice is coming soon</div>
        <div style={{ marginBottom: 16 }}><GradientBadge label="In development" tone="purple" /></div>
        <EmptyState
          icon="🚧"
          title="We're building the live practice session"
          description={`This will run on the same ${m.title.toLowerCase()} engine recruiters use, scoped to a private practice session — no posting or recruiter involved.`}
        />
        <div style={{ marginTop: 16 }}>
          <AnimatedButton variant="secondary" onClick={onPreviewReport}>Preview the feedback report →</AnimatedButton>
        </div>
      </GlassCard>
    </div>
  )
}