'use client'
import { GlassCard } from '@/components/shared/primitives'
import { BuilderFormData } from '@/components/modules/interview-engine/formData'

const inputSt = { background: 'var(--dash-surface-2)', border: '1px solid var(--dash-border)', borderRadius: 8, padding: '11px 14px', fontSize: 13, fontFamily: 'Inter,sans-serif', color: 'var(--dash-text)', outline: 'none', width: '100%' } as const

export default function ChatConfig({ data, onChange }: { data: BuilderFormData; onChange: (patch: Partial<BuilderFormData>) => void }) {
  const interviewerPreview = data.interviewerName.trim() || 'Kelly'
  return (
    <div className="builder-2col">
      {/* Left — the form, styled like composing a conversation */}
      <div>
        <div className="responsive-grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
          <input placeholder="Role title (e.g. Backend Engineer)" value={data.title} onChange={e => onChange({ title: e.target.value })} style={inputSt} className="premium-input" />
          <input placeholder="Company (optional)" value={data.company} onChange={e => onChange({ company: e.target.value })} style={inputSt} className="premium-input" />
        </div>
        <input placeholder="Interviewer persona name — e.g. Kelly, Alex. Leave blank for a random one."
          value={data.interviewerName} onChange={e => onChange({ interviewerName: e.target.value })} style={{ ...inputSt, marginBottom: 10 }} className="premium-input" />
        <textarea placeholder="Paste the full job description here..." value={data.jd} onChange={e => onChange({ jd: e.target.value })}
          style={{ ...inputSt, minHeight: 150, resize: 'vertical', marginBottom: 10, fontFamily: 'Inter,sans-serif' }} className="premium-input" />
        <textarea placeholder={"Extra questions to weave in naturally (optional, one per line)\ne.g. Are you willing to relocate to Lahore?\nWhat's your notice period?"}
          value={data.extraQuestions} onChange={e => onChange({ extraQuestions: e.target.value })}
          style={{ ...inputSt, minHeight: 80, resize: 'vertical', fontFamily: 'Inter,sans-serif' }} className="premium-input" />
      </div>

      {/* Right — live conversational preview */}
      <GlassCard light style={{ padding: 16, alignSelf: 'start' }}>
        <div style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--dash-text-muted)', textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 12 }}>
          How it'll open
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', marginBottom: 10 }}>
          <div style={{ width: 26, height: 26, borderRadius: 8, background: 'linear-gradient(135deg,#c5931f,#e2b04a)', display: 'grid', placeItems: 'center', flexShrink: 0, fontSize: 12 }}>💬</div>
          <div style={{ background: 'var(--dash-surface-2)', border: '1px solid var(--dash-border)', borderRadius: '4px 12px 12px 12px', padding: '10px 13px', fontSize: 12, lineHeight: 1.6, color: 'var(--dash-text)' }}>
            Hi! I'm {interviewerPreview}, and I'll be conducting your screening interview{data.title ? ` for the ${data.title} role` : ''} today. Before we dive in — could you start by telling me a bit about yourself?
          </div>
        </div>
        <div style={{ fontSize: 11, color: 'var(--dash-text-faint)', lineHeight: 1.6, marginTop: 14 }}>
          Flow: self-intro → education → skills → project deep-dives → your extra questions. Non-skippable, text-based, candidate answers by typing.
        </div>
      </GlassCard>
    </div>
  )
}