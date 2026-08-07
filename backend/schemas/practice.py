from pydantic import BaseModel
from typing import List, Literal, Optional, Dict


PracticeMode = Literal["chatbot", "mcq", "voice_agent"]


class PracticeSessionCreate(BaseModel):
    mode: PracticeMode
    target_role: str
    experience_level: Optional[str] = None       # junior | mid | senior
    difficulty: Optional[str] = None              # easy | medium | hard
    length_minutes: int = 15
    skills_focus: List[str] = []
    job_description: Optional[str] = None         # optional — practice against a real JD
    resume_text: Optional[str] = None              # optional — pre-supplied, no mid-flow ask


class PracticeQuestionPublic(BaseModel):
    id: str
    question: str
    options: List[str]
    topic: str


class PracticeSessionStateResponse(BaseModel):
    id: str
    mode: PracticeMode
    stage: str                  # interview | assessment | done
    status: str                 # in_progress | completed | abandoned
    target_role: str
    interviewer_name: str
    transcript: List[dict] = []
    turn_count: int = 0
    assessment_questions: Optional[List[PracticeQuestionPublic]] = None
    assessment_current_index: int = 0
    assessment_total: int = 0


class PracticeMessageRequest(BaseModel):
    message: str


class PracticeTurnResponse(BaseModel):
    message: str
    action: str                 # continue | conclude
    stage: str
    turn_count: int


class PracticeAssessmentAnswerRequest(BaseModel):
    question_id: str
    selected_index: int


class PracticeAssessmentAnswerResponse(BaseModel):
    stage: str
    assessment_current_index: int
    assessment_total: int
    next_question: Optional[PracticeQuestionPublic] = None


class PracticeTranscribeResponse(BaseModel):
    text: str


class PracticeReportResponse(BaseModel):
    id: str
    mode: PracticeMode
    target_role: str
    status: str
    ai_score: Optional[int] = None
    assessment_score: Optional[int] = None
    assessment_breakdown: Optional[Dict[str, Dict[str, int]]] = None
    final_verdict: Optional[str] = None
    experience_assessment: Optional[str] = None
    deep_analysis: Optional[str] = None
    created_at: str
    completed_at: Optional[str] = None


class PracticeHistoryItem(BaseModel):
    id: str
    mode: PracticeMode
    target_role: str
    status: str
    ai_score: Optional[int] = None
    assessment_score: Optional[int] = None
    final_verdict: Optional[str] = None
    created_at: str
    completed_at: Optional[str] = None