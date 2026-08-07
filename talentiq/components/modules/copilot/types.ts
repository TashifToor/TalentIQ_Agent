export type CopilotContext = 'job_creation' | 'interview_builder' | 'candidate_review' | 'reports'
export type CapabilityStatus = 'available' | 'thinking' | 'error' | 'coming_soon'

export interface CapabilityItem {
  id: string
  label: string
  icon: string
  status: CapabilityStatus
  content?: string          // populated only when status === 'available'
  errorMessage?: string     // populated only when status === 'error'
}

export type CopilotPanelState = 'empty' | 'ready' | 'error'

export interface CopilotResult {
  state: CopilotPanelState
  items: CapabilityItem[]
}