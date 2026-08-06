export type InterviewMode = 'chatbot' | 'mcq' | 'voice_agent'

export interface ModeDefinition {
  id: InterviewMode
  icon: string
  title: string
  tagline: string
  gradient: string       // card border/glow gradient
  accent: string         // solid accent color for text/badges
  duration: string
  difficulty: string
  flagship?: boolean
  aiFeatures: string[]
  bestFor: string[]
}

export const MODE_DEFINITIONS: ModeDefinition[] = [
  {
    id: 'chatbot',
    icon: '💬',
    title: 'AI Chat Interview',
    tagline: 'Adaptive AI recruiter that reads, remembers, and probes.',
    gradient: 'linear-gradient(135deg,#c5931f,#e2b04a,#f5d87a)',
    accent: '#e2b04a',
    duration: '15–25 min',
    difficulty: 'Adaptive',
    aiFeatures: [
      'Resume & JD aware', 'Dynamic follow-up questions', 'Project deep-dives',
      'Adaptive difficulty', 'Evidence-based scoring',
    ],
    bestFor: ['Initial screening', 'Technical interviews', 'Behavioral evaluation'],
  },
  {
    id: 'mcq',
    icon: '📝',
    title: 'AI Assessment',
    tagline: 'Timed, proctored, auto-graded skills testing at scale.',
    gradient: 'linear-gradient(135deg,#0b7c5e,#13c28e,#5eead4)',
    accent: '#13c28e',
    duration: '10–30 min',
    difficulty: 'Configurable',
    aiFeatures: [
      'AI-generated or custom question bank', '5 skill categories', 'Per-question timer',
      'Webcam + tab-switch proctoring', 'Auto-grading',
    ],
    bestFor: ['Campus hiring', 'Bulk hiring', 'Technical filtering'],
  },
  {
    id: 'voice_agent',
    icon: '🎙',
    title: 'AI Voice Interview',
    tagline: 'Talk to an AI recruiter in real time — not a chatbot with a voice.',
    gradient: 'linear-gradient(135deg,#7c3aed,#a78bfa,#c4b5fd)',
    accent: '#a78bfa',
    duration: '20–35 min',
    difficulty: 'Adaptive',
    flagship: true,
    aiFeatures: [
      'Natural spoken conversation', 'Resume & JD aware', 'Project & architecture deep-dives',
      'Communication analysis', 'Evidence-based evaluation',
    ],
    bestFor: ['Senior technical roles', 'Final-round screening', 'Communication-heavy roles'],
  },
]

export function getModeDefinition(id: InterviewMode): ModeDefinition {
  return MODE_DEFINITIONS.find(m => m.id === id) || MODE_DEFINITIONS[0]
}