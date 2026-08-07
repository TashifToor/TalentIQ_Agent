import uuid
from sqlalchemy import Column, String, Text, Integer, DateTime, ForeignKey
from sqlalchemy.sql import func
from sqlalchemy.dialects.postgresql import UUID
from models.database import Base


class PracticeSession(Base):
    """
    Candidate-owned AI mock interview — completely independent from the
    recruiter domain (InterviewPosting/InterviewSession). No posting, no
    recruiter, no public link: the candidate starts this directly from
    their own dashboard while authenticated, and owns it via user_id.

    Deliberately mirrors InterviewSession's report field names (ai_score,
    final_verdict, experience_assessment, deep_analysis, assessment_score,
    assessment_breakdown) so the frontend's shared AIFeedbackReport and
    Copilot candidate-insights modules work against either domain without
    modification — one report shape, two independent data sources.
    """
    __tablename__ = "practice_sessions"

    id =        Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    user_id =    Column(Integer, ForeignKey("users.id"), nullable=False, index=True)

    # Practice Configuration — set once at creation, never touches any
    # recruiter-owned table.
    mode =              Column(String, nullable=False)          # chatbot | mcq | voice_agent
    target_role =        Column(String, nullable=False)
    experience_level =   Column(String, nullable=True)          # junior | mid | senior
    difficulty =         Column(String, nullable=True)          # easy | medium | hard
    length_minutes =     Column(Integer, default=15)             # candidate's target length — drives turn/question count
    skills_focus =       Column(Text, default="[]")             # JSON list[str]
    job_description =    Column(Text, nullable=True)             # optional — candidate can paste a real JD to practice against
    resume_text =        Column(Text, nullable=True)             # optional — extracted CV text, supplied upfront at config time (no mid-flow ask, unlike recruiter flow)
    interviewer_name =   Column(String, default="Kelly")

    # Live session state
    stage =               Column(String, default="interview")   # interview | assessment | done
    transcript =          Column(Text, default="[]")            # JSON list[{role, content}] — chatbot/voice_agent modes
    turn_count =           Column(Integer, default=0)

    assessment_questions =      Column(Text, default="[]")      # JSON — mcq mode, generated once at session start
    assessment_answers =        Column(Text, default="[]")      # JSON list[{question_id, selected_index}]
    assessment_current_index =  Column(Integer, default=0)

    # Report — populated on finalize, same shape as the recruiter side
    ai_score =               Column(Integer, nullable=True)
    assessment_score =        Column(Integer, nullable=True)
    assessment_breakdown =    Column(Text, nullable=True)        # JSON {topic: {correct,total}}
    final_verdict =           Column(String, nullable=True)
    experience_assessment =   Column(Text, nullable=True)
    deep_analysis =           Column(Text, nullable=True)

    status =    Column(String, default="in_progress")            # in_progress | completed | abandoned

    created_at =    Column(DateTime(timezone=True), server_default=func.now())
    completed_at =  Column(DateTime(timezone=True), nullable=True)