import { CopilotResult } from './types'

// Same deterministic heuristic used in the HR wizard's AI Review step —
// not an LLM call, just keyword-matching + arithmetic. Kept here so both
// contexts (Job Creation, Interview Builder) get identical, real results.
const COMMON_SKILLS = [
  'Python', 'JavaScript', 'TypeScript', 'React', 'Next.js', 'Node.js', 'FastAPI', 'Django',
  'PostgreSQL', 'MySQL', 'MongoDB', 'Redis', 'Docker', 'Kubernetes', 'AWS', 'GCP', 'Azure',
  'SQL', 'GraphQL', 'REST', 'Celery', 'Java', 'Go', 'Rust', 'C++', 'Git', 'CI/CD', 'Linux',
]

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function skillPattern(s: string): RegExp {
  // \b only makes sense at a word/non-word transition — a skill like "C++"
  // ends in a non-word char, so a trailing \b would silently never match.
  const startsWithWordChar = /\w/.test(s[0])
  const endsWithWordChar = /\w/.test(s[s.length - 1])
  const prefix = startsWithWordChar ? '\\b' : ''
  const suffix = endsWithWordChar ? '\\b' : ''
  return new RegExp(`${prefix}${escapeRegex(s)}${suffix}`, 'i')
}

function detectSkills(jd: string): string[] {
  return COMMON_SKILLS.filter(s => skillPattern(s).test(jd)).slice(0, 10)
}

// Very rough word-count-based estimate — flags a JD that's too thin to
// build a good interview from. Real, not fabricated: it's just math.
function estimateThinness(jd: string): { thin: boolean; wordCount: number } {
  const wordCount = jd.trim().split(/\s+/).filter(Boolean).length
  return { thin: wordCount > 0 && wordCount < 40, wordCount }
}

export function getJDInsights(jd: string): CopilotResult {
  const trimmed = jd.trim()
  if (!trimmed) return { state: 'empty', items: [] }

  const skills = detectSkills(trimmed)
  const { thin, wordCount } = estimateThinness(trimmed)

  return {
    state: 'ready',
    items: [
      {
        id: 'skills_detected', label: 'Skills detected in JD', icon: '🔍',
        status: skills.length > 0 ? 'available' : 'coming_soon',
        content: skills.length > 0 ? skills.join(', ') : undefined,
      },
      {
        id: 'jd_length', label: 'JD completeness check', icon: '📏',
        status: 'available',
        content: thin ? `Only ${wordCount} words — a fuller JD usually produces better interview questions.` : `${wordCount} words — enough detail to work with.`,
      },
      { id: 'jd_rewrite', label: 'Rewrite unclear sections', icon: '✍️', status: 'coming_soon' },
      { id: 'missing_responsibilities', label: 'Suggest missing responsibilities', icon: '📋', status: 'coming_soon' },
      { id: 'duplicate_requirements', label: 'Detect duplicated requirements', icon: '⚠️', status: 'coming_soon' },
      { id: 'experience_level', label: 'Recommend experience level', icon: '🎯', status: 'coming_soon' },
      { id: 'structure_suggestion', label: 'Suggested interview structure', icon: '🗂', status: 'coming_soon' },
      { id: 'technical_topics', label: 'Technical topics to probe', icon: '💻', status: 'coming_soon' },
      { id: 'behavioral_topics', label: 'Behavioral topics to probe', icon: '🤝', status: 'coming_soon' },
      { id: 'followup_questions', label: 'Follow-up question generator', icon: '❓', status: 'coming_soon' },
      { id: 'evaluation_criteria', label: 'Recommended evaluation criteria', icon: '📐', status: 'coming_soon' },
    ],
  }
}