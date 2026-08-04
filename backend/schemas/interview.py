from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime


# ── HR side ──────────────────────────────────────────────────────

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

    interview_enabled: bool = True
    assessment_enabled: bool = False
    assessment_source: Optional[str] = None          # "ai" | "bank" — required if assessment_enabled
    assessment_bank: Optional[List[BankQuestion]] = None  # used when source == "bank"

    # used when source == "ai" — HR controls exactly how many questions per category
    assessment_count_dsa: int = 0
    assessment_count_job_desc: int = 0
    assessment_count_problem_solving: int = 0
    assessment_count_teamwork: int = 0
    assessment_count_hr: int = 0
    assessment_seconds_per_question: int = 60
    notify_hr_on_completion: bool = True
    voice_enabled: bool = False


class InterviewPostingResponse(BaseModel):
    id: str
    title: str
    company: Optional[str] = None
    job_description: str
    extra_questions: List[str]
    interviewer_name: str
    interview_enabled: bool
    assessment_enabled: bool
    assessment_source: Optional[str] = None
    assessment_question_count: int = 0
    assessment_seconds_per_question: int = 60
    notify_hr_on_completion: bool = True
    voice_enabled: bool = False
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


# ── Public / candidate side ─────────────────────────────────────

class PublicPostingInfo(BaseModel):
    title: str
    company: Optional[str] = None
    interviewer_name: str
    is_active: bool
    interview_enabled: bool
    assessment_enabled: bool
    assessment_seconds_per_question: int = 60
    voice_enabled: bool = False


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