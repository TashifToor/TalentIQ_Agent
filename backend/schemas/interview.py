from pydantic import BaseModel
from typing import List, Literal, Optional
from datetime import datetime


# ── HR side ──────────────────────────────────────────────────────

InterviewMode = Literal["chatbot", "mcq", "voice_agent"]


class BankQuestion(BaseModel):
    question: str
    options: List[str]        # exactly 4
    correct_index: int        # 0-3
    topic: Optional[str] = "general"


class InterviewPostingCreate(BaseModel):
    title: str
    company: Optional[str] = None
    job_description: str
    extra_questions: List[str] = []
    interviewer_name: Optional[str] = None

    mode: InterviewMode = "chatbot"
    assessment_source: Optional[str] = None          # "ai" | "bank" — required when mode == "mcq"
    assessment_bank: Optional[List[BankQuestion]] = None  # used when source == "bank"

    # used when source == "ai" — HR controls exactly how many questions per category
    assessment_count_dsa: int = 0
    assessment_count_job_desc: int = 0
    assessment_count_problem_solving: int = 0
    assessment_count_teamwork: int = 0
    assessment_count_hr: int = 0
    assessment_seconds_per_question: int = 60
    notify_hr_on_completion: bool = True


class InterviewPostingResponse(BaseModel):
    id: str
    title: str
    company: Optional[str] = None
    job_description: str
    extra_questions: List[str]
    interviewer_name: str
    mode: InterviewMode
    assessment_source: Optional[str] = None
    assessment_question_count: int = 0
    assessment_seconds_per_question: int = 60
    notify_hr_on_completion: bool = True
    public_slug: str
    public_link: str
    is_active: bool
    candidate_count: int = 0
    created_at: str


class InterviewSessionSummary(BaseModel):
    id: str
    candidate_name: str
    candidate_email: str
    status: str
    ai_score: Optional[int] = None
    final_verdict: Optional[str] = None
    assessment_score: Optional[int] = None
    proctoring_flag_count: int = 0
    terminated_reason: Optional[str] = None
    created_at: str
    completed_at: Optional[str] = None


class InterviewSessionReport(BaseModel):
    id: str
    candidate_name: str
    candidate_email: str
    status: str
    stage: str
    ai_score: Optional[int] = None
    final_verdict: Optional[str] = None
    experience_assessment: Optional[str] = None
    deep_analysis: Optional[str] = None
    transcript: List[dict]
    assessment_score: Optional[int] = None
    assessment_breakdown: Optional[dict] = None
    assessment_flags: List[dict] = []
    assessment_photos: List[str] = []
    terminated_reason: Optional[str] = None
    created_at: str
    completed_at: Optional[str] = None


# ── Talent Intelligence — deterministic candidate ranking for a posting ──

class RankedCandidate(BaseModel):
    id: str
    candidate_name: str
    candidate_email: str
    status: str
    fit_score: Optional[int] = None         # None until at least one real signal exists
    fit_tier: str                            # "strong" | "good" | "possible" | "low" | "not_enough_data"
    recommendation: Optional[str] = None     # real final_verdict passthrough, or None
    ai_score: Optional[int] = None
    assessment_score: Optional[int] = None
    # Resume / ATS intelligence — from the candidate's own linked account (core.candidate_identity),
    # reusing their real CV Optimizer scan history (core.resume_intelligence). Never fabricated;
    # resume_available is False (all resume_* fields None/empty) when no linked account or no scan exists.
    resume_available: bool = False
    ats_score: Optional[int] = None
    matched_skills: List[str] = []
    missing_skills: List[str] = []
    skill_match_pct: Optional[int] = None
    resume_verdict: Optional[str] = None
    resume_role_title: Optional[str] = None   # the JD title the resume was actually scanned against — may differ from this posting
    resume_scanned_at: Optional[str] = None
    experience_match_available: bool = False  # always False today — no experience signal exists anywhere in this data model
    education_match_available: bool = False   # always False today — no education signal exists anywhere in this data model
    proctoring_flag_count: int = 0
    evidence: List[str] = []
    created_at: str
    completed_at: Optional[str] = None


class PostingRankingResponse(BaseModel):
    posting_id: str
    posting_title: str
    total_candidates: int
    strong_count: int
    good_count: int
    possible_count: int
    low_count: int
    not_enough_data_count: int
    recommended_count: int   # recommendation in ("Strong Hire", "Hire")
    candidates: List[RankedCandidate]


# ── Public / candidate side ─────────────────────────────────────

class PublicPostingInfo(BaseModel):
    title: str
    company: Optional[str] = None
    interviewer_name: str
    is_active: bool
    mode: InterviewMode
    assessment_seconds_per_question: int = 60
    assessment_question_count: int = 0   # real, only meaningful for mode == "mcq"


class InterviewSessionStateResponse(BaseModel):
    """Recovery endpoint — lets a refreshed/reconnected client restore exactly
    where it left off, without creating a duplicate session."""
    session_id: str
    status: str                # in_progress | completed
    stage: str                 # interview | assessment | done
    awaiting_cv: bool
    transcript: List[dict] = []
    turn_count: int = 0
    assessment_current_index: int = 0


class InterviewStartRequest(BaseModel):
    candidate_name: str
    candidate_email: str


class InterviewMessage(BaseModel):
    role: str  # "assistant" | "candidate"
    content: str


class InterviewStartResponse(BaseModel):
    session_id: str
    stage: str                    # "interview" | "assessment" — what the frontend should render first
    message: Optional[str] = None  # AI's opening question, when stage == "interview"


class InterviewMessageRequest(BaseModel):
    message: str


class InterviewMessageResponse(BaseModel):
    message: Optional[str] = None      # AI's next question/follow-up (null once concluded)
    status: str                        # "in_progress" | "completed"
    turn_count: int
    awaiting_cv: bool = False          # true when the UI should show a CV upload control instead of the text box
    next_stage: Optional[str] = None   # set to "assessment" when the interview stage just finished and an assessment follows


class AssessmentQuestionOut(BaseModel):
    id: str
    index: int             # 1-based position for a "Question X of N" display
    total: int
    question: str
    options: List[str]
    seconds_allowed: int = 60
    seconds_remaining: int = 60   # server-authoritative — computed from current_question_started_at, not client clock


class AssessmentAnswerRequest(BaseModel):
    question_id: str
    selected_index: int    # -1 means "timed out / no answer" — always scored as incorrect


class AssessmentAnswerResponse(BaseModel):
    status: str                              # "in_progress" | "completed"
    next_question: Optional[AssessmentQuestionOut] = None
    score: Optional[int] = None              # only set once completed


class AssessmentFlagRequest(BaseModel):
    type: str        # "tab_hidden" | "window_blur" | "left_site" | "fullscreen_exit" | etc.
    detail: Optional[str] = None


class TerminateResponse(BaseModel):
    status: str = "terminated"
    message: str


class VoiceTranscribeResponse(BaseModel):
    text: str