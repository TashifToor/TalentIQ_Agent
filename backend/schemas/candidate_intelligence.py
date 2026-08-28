from typing import List, Optional
from pydantic import BaseModel


class SkillGaps(BaseModel):
    required: List[str] = []
    nice_to_have: List[str] = []


class ATSSignal(BaseModel):
    label: str
    status: str
    note: str


class CandidateAnalysisRequest(BaseModel):
    cv_text: str
    job_description: Optional[str] = None


class CandidateAnalysisResponse(BaseModel):
    overall_score: int
    fit_level: str
    score_explanation: str
    strengths: List[str] = []
    skill_gaps: SkillGaps = SkillGaps()
    experience_gaps: List[str] = []
    recruiter_impression: str
    ats_signals: List[ATSSignal] = []
    interview_readiness: str
    interview_readiness_reason: str
    focus_areas: List[str] = []
    next_actions: List[str] = []