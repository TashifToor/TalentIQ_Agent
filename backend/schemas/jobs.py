from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime


# ---- shared enums (plain strings, validated in the route layer so a bad
# value gets a clean 400 instead of a raw pydantic error) -------------------
WORK_ARRANGEMENTS = ("remote", "hybrid", "onsite")
EMPLOYMENT_TYPES = ("full_time", "part_time", "contract", "internship")
JOB_STATUSES = ("draft", "published", "closed")


class JobCreate(BaseModel):
    title: str
    company: Optional[str] = None
    location: Optional[str] = None
    description: str
    responsibilities: Optional[str] = None
    required_skills: List[str] = []
    preferred_skills: List[str] = []
    experience_required: Optional[str] = None
    work_arrangement: Optional[str] = None
    employment_type: Optional[str] = None
    salary_min: Optional[int] = None
    salary_max: Optional[int] = None
    salary_currency: Optional[str] = None
    application_deadline: Optional[datetime] = None
    openings: Optional[int] = None


class JobUpdate(BaseModel):
    """All fields optional -- PATCH semantics, only sent fields are changed."""
    title: Optional[str] = None
    company: Optional[str] = None
    location: Optional[str] = None
    description: Optional[str] = None
    responsibilities: Optional[str] = None
    required_skills: Optional[List[str]] = None
    preferred_skills: Optional[List[str]] = None
    experience_required: Optional[str] = None
    work_arrangement: Optional[str] = None
    employment_type: Optional[str] = None
    salary_min: Optional[int] = None
    salary_max: Optional[int] = None
    salary_currency: Optional[str] = None
    application_deadline: Optional[datetime] = None
    openings: Optional[int] = None


class JobAIAssistRequest(BaseModel):
    raw_text: str = Field(..., min_length=10, description="HR's rough/unstructured job description draft.")


class JobAIAssistResponse(BaseModel):
    title: Optional[str] = None
    description: str
    responsibilities: Optional[str] = None
    required_skills: List[str] = []
    preferred_skills: List[str] = []
    experience_required: Optional[str] = None
    interview_focus_areas: List[str] = []
    suggested_evaluation_criteria: List[str] = []


class jobResponse(BaseModel):
    id: str
    hr_user_id: Optional[int] = None
    title: str
    company: Optional[str]
    location: Optional[str]
    description: str
    responsibilities: Optional[str] = None
    required_skills: List[str] = []
    preferred_skills: List[str] = []
    experience_required: Optional[str] = None
    work_arrangement: Optional[str] = None
    employment_type: Optional[str] = None
    salary_min: Optional[int] = None
    salary_max: Optional[int] = None
    salary_currency: Optional[str] = None
    application_deadline: Optional[datetime] = None
    openings: Optional[int] = None
    status: str
    is_active: bool
    views_count: int = 0
    created_at: datetime
    updated_at: Optional[datetime] = None
    published_at: Optional[datetime] = None
    applicant_count: Optional[int] = 0
    # candidate-only, populated when the caller is an authenticated candidate
    has_applied: Optional[bool] = None
    application_status: Optional[str] = None  # applied | screening | interview | rejected | selected
    match_percent: Optional[int] = None
    match_reasons: List[str] = []

    model_config = {"arbitrary_types_allowed": True}


class JobListResponse(BaseModel):
    total: int
    jobs: List[jobResponse]


class JobAnalytics(BaseModel):
    views: int
    applications: int
    screening: int
    interviews: int
    accepted: int
    rejected: int


class JobMatchRequest(BaseModel):
    cv_text: str = Field(..., min_length=20)


class SkillGapsOut(BaseModel):
    required: List[str] = []
    nice_to_have: List[str] = []


class JobFitSignal(BaseModel):
    key: str             # skills | experience | resume
    label: str
    percent: Optional[int] = None   # 0-100, real/deterministic — None when only a qualitative read is possible
    qualitative: Optional[str] = None  # "Strong Match" | "Good Match" | "Potential Match" | "Low Match" | "Not enough data yet"
    source: str           # what real data this came from


class JobMatchResponse(BaseModel):
    overall_score: int
    fit_level: str
    score_explanation: str
    strengths: List[str] = []
    skill_gaps: SkillGapsOut = SkillGapsOut()
    experience_gaps: List[str] = []
    interview_readiness: str
    interview_readiness_reason: str
    focus_areas: List[str] = []
    next_actions: List[str] = []
    signals: List[JobFitSignal] = []


class RecommendedJobsRequest(BaseModel):
    cv_text: str = Field(..., min_length=20)


class RecommendedJob(BaseModel):
    job: jobResponse
    match_percent: int
    reasons: List[str] = []


class WhyRecommendedRequest(BaseModel):
    cv_text: str = Field(..., min_length=20)


class WhyRecommendedResponse(BaseModel):
    match_percent: int
    reasons: List[str] = []
    has_enough_data: bool