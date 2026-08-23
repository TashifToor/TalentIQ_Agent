'use client'
import { GlassCard, GradientBadge } from '@/components/shared/primitives'
import { BuilderFormData } from '@/components/modules/interview-engine/formData'

const inputSt = { background: '#161614', border: '1px solid rgba(255,255,255,.08)', borderRadius: 8, padding: '11px 14px', fontSize: 13, fontFamily: 'Inter,sans-serif', color: 'rgba(255,255,255,.85)', outline: 'none', width: '100%' } as const

const CATEGORY_META: { key: keyof BuilderFormData['assessmentCounts']; label: string; icon: string }[] = [
  { key: 'dsa', label: 'DSA', icon: '⌘' },
  { key: 'job_desc', label: 'Job-specific (language/framework)', icon: '⚙' },
  { key: 'problem_solving', label: 'Problem Solving', icon: '◈' },
  { key: 'teamwork', label: 'Team Work (git/collaboration)', icon: '⇄' },
  { key: 'hr', label: 'HR / Behavioral', icon: '◎' },
]

export default function AssessmentConfig({ data, onChange }: { data: BuilderFormData; onChange: (patch: Partial<BuilderFormData>) => void }) {
  const total = Object.values(data.assessmentCounts).reduce((a, b) => a + b, 0)
  const ok = total >= 10 && total <= 50

  return (
    <div>
      <div className="responsive-grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
        <input placeholder="Role title (e.g. Backend Engineer)" value={data.title} onChange={e => onChange({ title: e.target.value })} style={inputSt} className="premium-input accent-teal" />
        <input placeholder="Company (optional)" value={data.company} onChange={e => onChange({ company: e.target.value })} style={inputSt} className="premium-input accent-teal" />
      </div>
      <textarea placeholder="Paste the full job description here — used to tailor generated questions..." value={data.jd} onChange={e => onChange({ jd: e.target.value })}
        style={{ ...inputSt, minHeight: 110, resize: 'vertical', marginBottom: 16, fontFamily: 'Inter,sans-serif' }} className="premium-input accent-teal" />

      {/* Exam-paper styled setup block */}
      <GlassCard style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '14px 18px', borderBottom: '1px solid rgba(255,255,255,.06)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#fff' }}>📝 Exam Builder</div>
          <GradientBadge label="Proctored" tone="teal" icon="●" />
        </div>

        <div style={{ padding: 18 }}>
          <div style={{ display: 'flex', gap: 20, marginBottom: 16 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, cursor: 'pointer' }}>
              <input type="radio" checked={data.assessmentSource === 'ai'} onChange={() => onChange({ assessmentSource: 'ai' })} style={{ accentColor: '#13c28e' }} />
              AI generates questions
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, cursor: 'pointer' }}>
              <input type="radio" checked={data.assessmentSource === 'bank'} onChange={() => onChange({ assessmentSource: 'bank' })} style={{ accentColor: '#13c28e' }} />
              I'll provide my own questions
            </label>
          </div>

          {data.assessmentSource === 'ai' ? (
            <div>
              <div className="responsive-grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
                {CATEGORY_META.map(({ key, label, icon }) => (
                  <div key={key} style={{ background: '#161614', border: '1px solid rgba(255,255,255,.06)', borderRadius: 8, padding: '10px 12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 10.5, color: 'rgba(255,255,255,.4)', marginBottom: 6 }}>
                      <span>{icon}</span>{label}
                    </div>
                    <input type="number" min={0} max={50} value={data.assessmentCounts[key]}
                      onChange={e => onChange({ assessmentCounts: { ...data.assessmentCounts, [key]: Math.max(0, Math.min(50, Number(e.target.value) || 0)) } })}
                      style={{ ...inputSt, padding: '6px 8px', fontSize: 14, fontWeight: 700 }} className="premium-input accent-teal" />
                  </div>
                ))}
              </div>
              <div style={{ fontSize: 12, fontWeight: 700, color: ok ? '#13c28e' : '#ef4444' }}>Total: {total} questions {!ok && '(must be 10–50)'}</div>
              <div style={{ fontSize: 10.5, color: 'rgba(255,255,255,.3)', marginTop: 6 }}>Generated once when the link is created — same set for every candidate.</div>
            </div>
          ) : (
            <div>
              <div style={{ fontSize: 10.5, color: 'rgba(255,255,255,.4)', marginBottom: 8, lineHeight: 1.6 }}>
                One question per block, blank line between blocks:<br />
                <code style={{ color: 'rgba(255,255,255,.5)' }}>Question text?<br />A) option<br />B) option<br />C) option<br />D) option<br />Correct: B</code>
              </div>
              <textarea placeholder={"What does 'git rebase -i' let you do?\nA) Delete the repo\nB) Interactively edit commit history\nC) Push to a remote\nD) Clone a branch\nCorrect: B"}
                value={data.assessmentBankText} onChange={e => onChange({ assessmentBankText: e.target.value })}
                style={{ ...inputSt, minHeight: 140, resize: 'vertical', fontFamily: 'monospace', fontSize: 12 }} className="premium-input accent-teal" />
            </div>
          )}

          <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid rgba(255,255,255,.06)', display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 12, color: 'rgba(255,255,255,.5)' }}>⏱ Seconds per question</span>
            <input type="number" min={5} max={600} value={data.secondsPerQuestion}
              onChange={e => onChange({ secondsPerQuestion: Math.max(5, Math.min(600, Number(e.target.value) || 60)) })}
              style={{ ...inputSt, width: 90, padding: '7px 10px' }} className="premium-input accent-teal" />
          </div>
        </div>
      </GlassCard>
    </div>
  )
}