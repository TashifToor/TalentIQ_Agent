'use client'
import { MetricCard, EmptyState, GlassCard } from '@/components/shared/primitives'
import { BuilderFormData } from '@/components/modules/interview-engine/formData'
import { getModeDefinition } from '@/components/modules/interview-engine/modeData'

// Small, honest heuristic — not an LLM call. Real semantic skill-detection
// and rubric generation is Phase-3 Hiring Copilot territory; this just
// gives the recruiter a quick, deterministic sanity-check right now.
const COMMON_SKILLS = [
  'Python', 'JavaScript', 'TypeScript', 'React', 'Next.js', 'Node.js', 'FastAPI', 'Django',
  'PostgreSQL', 'MySQL', 'MongoDB', 'Redis', 'Docker', 'Kubernetes', 'AWS', 'GCP', 'Azure',
  'SQL', 'GraphQL', 'REST', 'Celery', 'Java', 'Go', 'Rust', 'C++', 'Git', 'CI/CD', 'Linux',
]

function detectSkills(jd: string): string[] {
  const found = COMMON_SKILLS.filter(s => new RegExp(`\\b${s.replace('.', '\\.')}\\b`, 'i').test(jd))
  return found.slice(0, 8)
}

function estimateDuration(data: BuilderFormData): string {
  if (data.mode === 'mcq') {
    const total = Object.values(data.assessmentCounts).reduce((a, b) => a + b, 0)
    const minutes = Math.round((total * data.secondsPerQuestion) / 60) || 0
    return `~${minutes} min`
  }
  return getModeDefinition(data.mode).duration
}

export default function AIReviewStep({ data }: { data: BuilderFormData }) {
  const mode = getModeDefinition(data.mode)
  const skills = detectSkills(data.jd)
  const questionCount = data.mode === 'mcq'
    ? Object.values(data.assessmentCounts).reduce((a, b) => a + b, 0)
    : null

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${questionCount !== null ? 3 : 2}, 1fr)`, gap: 12, marginBottom: 20 }}>
        <MetricCard label="Estimated Duration" value={estimateDuration(data)} icon="⏱" accent={mode.accent} />
        <MetricCard label="Mode" value={mode.title.replace('AI ', '')} icon={mode.icon} accent={mode.accent} />
        {questionCount !== null && <MetricCard label="Questions" value={String(questionCount)} icon="#" accent={mode.accent} />}
      </div>

      {skills.length > 0 && (
        <GlassCard style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,.4)', textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 10 }}>
            Skills detected in your JD
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {skills.map(s => (
              <span key={s} style={{ fontSize: 11.5, fontWeight: 600, padding: '5px 11px', borderRadius: 100, background: `${mode.accent}15`, color: mode.accent, border: `1px solid ${mode.accent}30` }}>{s}</span>
            ))}
          </div>
        </GlassCard>
      )}

      <GlassCard>
        <EmptyState
          icon="🧠"
          title="Deeper AI suggestions — coming with the Hiring Copilot"
          description="JD rewrites, missing-skill detection, rubric generation, and interview-plan tuning will appear here automatically once the Copilot ships. For now, review your setup and continue."
        />
      </GlassCard>
    </div>
  )
}