'use client'
import { GlassCard, GradientBadge } from '@/components/shared/primitives'
import { BuilderFormData } from '@/components/modules/interview-engine/formData'

const inputSt = { background: 'var(--dash-surface-2)', border: '1px solid var(--dash-border)', borderRadius: 8, padding: '11px 14px', fontSize: 13, fontFamily: 'Inter,sans-serif', color: 'var(--dash-text)', outline: 'none', width: '100%' } as const

export default function VoiceConfig({ data, onChange }: { data: BuilderFormData; onChange: (patch: Partial<BuilderFormData>) => void }) {
  return (
    <div className="builder-2col">
      <div>
        <div className="responsive-grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
          <input placeholder="Role title (e.g. Senior Backend Engineer)" value={data.title} onChange={e => onChange({ title: e.target.value })} style={inputSt} className="premium-input accent-purple" />
          <input placeholder="Company (optional)" value={data.company} onChange={e => onChange({ company: e.target.value })} style={inputSt} className="premium-input accent-purple" />
        </div>
        <input placeholder="AI Recruiter's name — e.g. Kelly, Alex. Leave blank for a random one."
          value={data.interviewerName} onChange={e => onChange({ interviewerName: e.target.value })} style={{ ...inputSt, marginBottom: 10 }} className="premium-input accent-purple" />
        <textarea placeholder="Paste the full job description — the agent grounds every question in this..." value={data.jd} onChange={e => onChange({ jd: e.target.value })}
          style={{ ...inputSt, minHeight: 150, resize: 'vertical', marginBottom: 10, fontFamily: 'Inter,sans-serif' }} className="premium-input accent-purple" />
        <textarea placeholder={"Extra questions the agent should work in naturally (optional, one per line)"}
          value={data.extraQuestions} onChange={e => onChange({ extraQuestions: e.target.value })}
          style={{ ...inputSt, minHeight: 70, resize: 'vertical', fontFamily: 'Inter,sans-serif' }} className="premium-input accent-purple" />
      </div>

      {/* Right — "configuring an agent" panel with a waveform identity */}
      <GlassCard light style={{ padding: 18, alignSelf: 'start', border: '1px solid rgba(167,139,250,.3)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--dash-text)' }}>🎙 Agent Preview</div>
          <GradientBadge label="Flagship" tone="purple" icon="⚡" light />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 3, height: 48, marginBottom: 16 }}>
          {[14, 26, 18, 34, 12, 28, 20, 32, 16].map((h, i) => (
            <div key={i} className="wave-bar" style={{ width: 4, height: h, borderRadius: 2, background: 'linear-gradient(180deg,#a78bfa,#7c3aed)', animationDelay: `${i * 0.08}s` }} />
          ))}
        </div>

        <div style={{ fontSize: 11.5, color: 'var(--dash-text)', lineHeight: 1.7, marginBottom: 14 }}>
          {(data.interviewerName.trim() || 'Your AI recruiter')} will speak questions aloud and listen for spoken answers — grounded in the JD, with follow-ups based on what the candidate actually says.
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {['Push-to-talk voice turns (record → transcribe → respond)', 'Same scoring engine as Chat Interview', 'Full transcript saved for the recruiter report'].map(t => (
            <div key={t} style={{ display: 'flex', gap: 8, fontSize: 11, color: 'var(--dash-text-muted)' }}>
              <span style={{ color: '#a78bfa' }}>◆</span>{t}
            </div>
          ))}
        </div>
      </GlassCard>
    </div>
  )
}