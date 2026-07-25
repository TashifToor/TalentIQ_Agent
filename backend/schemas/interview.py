from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime


# ── HR side ──────────────────────────────────────────────────────

class InterviewPostingCreate(BaseModel):
    title: str
    company: Optional[str] = None
    job_description: str
    extra_questions: List[str] = []


class InterviewPostingResponse(BaseModel):
    id: str
    title: str
    company: Optional[str] = None
    job_description: str
    extra_questions: List[str]
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
    created_at: str
    completed_at: Optional[str] = None


class InterviewSessionReport(BaseModel):
    id: str
    candidate_name: str
    candidate_email: str
    status: str
    ai_score: Optional[int] = None
    final_verdict: Optional[str] = None
    experience_assessment: Optional[str] = None
    deep_analysis: Optional[str] = None
    transcript: List[dict]
    created_at: str
    completed_at: Optional[str] = None


# ── Public / candidate side ─────────────────────────────────────

class PublicPostingInfo(BaseModel):
    title: str
    company: Optional[str] = None
    is_active: bool


class InterviewStartRequest(BaseModel):
    candidate_name: str
    candidate_email: str


class InterviewMessage(BaseModel):
    role: str  # "assistant" | "candidate"
    content: str


class InterviewStartResponse(BaseModel):
    session_id: str
    message: str  # AI's opening question


class InterviewMessageRequest(BaseModel):
    message: str


class InterviewMessageResponse(BaseModel):
    message: Optional[str] = None      # AI's next question/follow-up (null once concluded)
    status: str                        # "in_progress" | "completed"
    turn_count: int