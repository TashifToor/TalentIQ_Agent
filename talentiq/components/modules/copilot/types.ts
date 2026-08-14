export type CopilotContext =
  | 'job_creation'
  | 'interview_builder'
  | 'candidate_review'
  | 'reports'
  | 'hr_overview'
  | 'candidate_home'

// 'coming_soon' = genuinely not built yet (no backend/LLM capability exists).
// 'empty'       = the capability IS built, but there is no data for THIS candidate/session
//                 yet (e.g. not an MCQ interview, so no category breakdown). Never labeled "Soon".
export type CapabilityStatus = 'available' | 'thinking' | 'error' | 'coming_soon' | 'empty'

export interface CapabilityItem {
  id: string
  label: string
  icon: string
  status: CapabilityStatus
  content?: string          // plain-text body — always populated for 'available' and 'empty'
  errorMessage?: string     // populated only when status === 'error'
  emptyReason?: string      // short reason shown for 'empty' (e.g. "Only MCQ mode reports this")
  data?: unknown            // structured payload for rich rendering — shape keyed by id, see below
}

export type CopilotPanelState = 'empty' | 'ready' | 'error'

export interface CopilotResult {
  state: CopilotPanelState
  items: CapabilityItem[]
}

// ── Structured payloads (attached as CapabilityItem.data) ─────────

// id: 'strengths' | 'concerns'
export interface ScoreBreakdownEntry {
  key: string
  label: string
  pct: number
  correct: number
  total: number
  severity?: 'high' | 'medium' | 'low'   // concerns only
}

// id: 'evidence'
export interface EvidenceGroup {
  label: string
  icon: string
  items: string[]
}

// id: 'recommendation'
export interface RecommendationData {
  verdict: string
  score: number | null
  scoreLabel: string
  why: string[]
}

// id: 'compare'
export interface ComparePeer {
  id: string
  name: string
  score: number | null
}
export interface CompareData {
  candidateId: string | null
  candidateName?: string
  rank: number | null
  total: number
  peers: ComparePeer[]
}

// id: 'hiring_overview' (hr_overview context)
export interface StatTile {
  label: string
  value: string
}

// id: 'verdict_mix' (hr_overview context)
export interface VerdictMixEntry {
  label: string
  count: number
}

// id: 'resume_screening' | 'interview_practice' (candidate_home context)
export interface CandidateStatTile {
  label: string
  value: string
  accent?: string
}