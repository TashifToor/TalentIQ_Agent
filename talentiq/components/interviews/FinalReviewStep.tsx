'use client'
import { GlassCard, MetricCard, AnimatedButton } from '@/components/shared/primitives'
import { BuilderFormData } from '@/components/modules/interview-engine/formData'
import { getModeDefinition } from '@/components/modules/interview-engine/modeData'

export default function FinalReviewStep({
  data, onChange, onGenerate, saving, error,
}: {
  data: BuilderFormData
  onChange: (patch: Partial<BuilderFormData>) => void
  onGenerate: () => void
  saving: boolean
  error: string
}) {
  const mode = getModeDefinition(data.mode)
  const questionCount = data.mode === 'mcq' ? Object.values(data.assessmentCounts).reduce((a, b) => a + b, 0) : null

  return (
    <div style={{ maxWidth: 560 }}>
      <GlassCard light style={{ marginBottom: 16, padding: 0, overflow: 'hidden' }}>
        <div style={{ height: 4, background: mode.gradient }} />
        <div style={{ padding: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
            <div style={{ width: 38, height: 38, borderRadius: 10, display: 'grid', placeItems: 'center', fontSize: 18, background: `${mode.accent}18` }}>{mode.icon}</div>
            <div>
              <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--dash-text)' }}>{data.title || 'Untitled Role'}</div>
              <div style={{ fontSize: 11.5, color: 'var(--dash-text-muted)' }}>{data.company || 'No company set'} · {mode.title}</div>
            </div>
          </div>

          <div className="responsive-grid-3" style={{ display: 'grid', gridTemplateColumns: `repeat(${questionCount !== null ? 3 : 2}, 1fr)`, gap: 10 }}>
            <MetricCard label="Duration" value={mode.duration} accent={mode.accent} light />
            <MetricCard label="Interviewer" value={data.interviewerName.trim() || 'Random'} accent={mode.accent} light />
            {questionCount !== null && <MetricCard label="Questions" value={String(questionCount)} accent={mode.accent} light />}
          </div>
        </div>
      </GlassCard>

      <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, cursor: 'pointer', marginBottom: 18, color: 'var(--dash-text)' }}>
        <input type="checkbox" checked={data.notifyOnCompletion} onChange={e => onChange({ notifyOnCompletion: e.target.checked })} style={{ accentColor: '#e2b04a' }} />
        Email me when a candidate completes this
      </label>

      {error && <div style={{ fontSize: 12, color: '#ef4444', marginBottom: 12 }}>{error}</div>}
      <AnimatedButton onClick={onGenerate} loading={saving} fullWidth>
        {saving ? 'Creating...' : 'Generate Interview Link →'}
      </AnimatedButton>
    </div>
  )
}