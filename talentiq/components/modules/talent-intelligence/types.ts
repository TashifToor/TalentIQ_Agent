export type FitTier = 'strong' | 'good' | 'possible' | 'low' | 'not_enough_data'

export interface RankedCandidate {
    id: string
    candidate_name: string
    candidate_email: string
    status: string
    fit_score: number | null
    fit_tier: FitTier
    recommendation: string | null
    ai_score: number | null
    assessment_score: number | null
    // Resume / ATS intelligence — from the candidate's own linked account, when one exists.
    resume_available: boolean
    ats_score: number | null
    matched_skills: string[]
    missing_skills: string[]
    skill_match_pct: number | null
    resume_verdict: string | null
    resume_role_title: string | null    // JD title the resume was actually scanned against — may differ from this posting
    resume_scanned_at: string | null
    experience_match_available: boolean  // always false today — no signal exists
    education_match_available: boolean   // always false today — no signal exists
    proctoring_flag_count: number
    evidence: string[]
    created_at: string
    completed_at: string | null
}

export interface PostingRanking {
    posting_id: string
    posting_title: string
    total_candidates: number
    strong_count: number
    good_count: number
    possible_count: number
    low_count: number
    not_enough_data_count: number
    recommended_count: number
    candidates: RankedCandidate[]
}

export type RankingFilter =
    | 'all' | 'strong' | 'good' | 'possible' | 'low'
    | 'interviewed' | 'not_interviewed' | 'recommended'

export const FIT_TIER_LABEL: Record<FitTier, string> = {
    strong: 'Strong Match',
    good: 'Good Match',
    possible: 'Possible Match',
    low: 'Low Match',
    not_enough_data: 'Not Enough Data',
}

export const FIT_TIER_COLOR: Record<FitTier, string> = {
    strong: '#13c28e',
    good: '#5cb8e4',
    possible: '#e2b04a',
    low: '#ef4444',
    not_enough_data: 'rgba(255,255,255,.3)',
}

// ── Talent Pool (bulk-screening Application, GET /bulk/talent-pool[/:id]) ──
export type InterviewStatus = 'unknown' | 'not_invited' | 'invited' | 'in_progress' | 'completed'

export interface PoolCandidate {
    id: string
    job_id: string
    job_title: string | null
    candidate_name: string | null
    candidate_email: string | null
    has_linked_account: boolean
    cv_filename?: string | null
    deep_analysis?: string | null
    is_shortlisted: 'pending' | 'yes' | 'no'
    trigger_interview: boolean
    interview_status: InterviewStatus
    interview_session_id: string | null
    has_report: boolean
    created_at: string | null
    screened_at: string | null
    fit_score: number | null
    fit_tier: FitTier
    recommendation: string | null
    resume_available: boolean
    ats_score: number | null
    matched_skills: string[]
    missing_skills: string[]
    skill_match_pct: number | null
    resume_verdict: string | null
    resume_role_title: string | null
    resume_scanned_at: string | null
    resume_matches_current_context: boolean
    evidence: string[]
    // detail-endpoint-only fields
    job_description?: string | null
    interview_report?: {
        id: string
        candidate_name: string
        candidate_email: string
        ai_score: number | null
        assessment_score: number | null
        final_verdict: string | null
        experience_assessment: string | null
        deep_analysis: string | null
    } | null
    // CrewAI Screening Committee — "AI Analysis", always kept visually
    // separate from the deterministic "System Score" fields above.
    ai_screening_status?: AiScreeningStatus
    ai_screening_updated_at?: string | null
    ai_screening_result?: ScreeningCommitteeResult | null
}

export const INTERVIEW_STATUS_LABEL: Record<InterviewStatus, string> = {
    unknown: 'Unknown',
    not_invited: 'Not Invited',
    invited: 'Invited',
    in_progress: 'In Progress',
    completed: 'Completed',
}

// ── CrewAI Screening Committee — qualitative "AI Analysis", always shown
// separate from the deterministic "System Score" fields above. ──
export type AiScreeningStatus = 'not_analyzed' | 'queued' | 'analyzing' | 'completed' | 'failed'

export interface ResumeAnalysis {
    matched_skills: string[]
    missing_skills: string[]
    experience_evidence: string[]
    education_evidence: string[]
    relevant_evidence: string[]
    unavailable_fields: string[]
}
export interface JobFitAnalysis {
    matched_requirements: string[]
    missing_requirements: string[]
    strong_matches: string[]
    concerns: string[]
    evidence: string[]
}
export interface InterviewAnalysis {
    available: boolean
    strengths: string[]
    concerns: string[]
    evidence: string[]
    unavailable_reason: string | null
}
export interface HiringAnalysis {
    recommendation: string
    reasons: string[]
    confidence: string
    evidence: string[]
}
export interface ScreeningCommitteeResult {
    resume_analysis: ResumeAnalysis
    job_fit_analysis: JobFitAnalysis
    interview_analysis: InterviewAnalysis
    hiring_analysis: HiringAnalysis
    model: string
    generated_at: string | null
}