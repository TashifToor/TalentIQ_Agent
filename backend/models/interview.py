import uuid
import secrets
from sqlalchemy import Column, String, Text, Integer, DateTime, ForeignKey, Boolean
from sqlalchemy.sql import func
from sqlalchemy.dialects.postgresql import UUID
from models.database import Base


def generate_slug() -> str:
    # url-safe, short enough to look clean in a LinkedIn post, long enough not to be guessable
    return secrets.token_urlsafe(9)


class InterviewPosting(Base):
    """
    HR-created interview posting — replaces the old unused 'Open Role' field.
    HR pastes a JD (+ optional extra questions), this generates a public_slug
    that becomes the shareable link candidates use to start the AI interview.
    """
    __tablename__ = "interview_postings"

    id =               Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    hr_user_id =       Column(Integer, ForeignKey("users.id"), nullable=False)
    title =            Column(String, nullable=False)
    company =          Column(String, nullable=True)
    job_description =  Column(Text, nullable=False)
    extra_questions =  Column(Text, default="[]")   # JSON list[str] — HR's must-ask questions
    interviewer_name = Column(String, default="Kelly")  # human name the AI interviewer goes by in chat
    public_slug =      Column(String, unique=True, index=True, nullable=False, default=generate_slug)
    is_active =        Column(Boolean, default=True)

    # HR picks exactly ONE mode per posting — these are peer interview
    # modes (like Micro1/Mercor/HeyMilo), not stackable stages anymore.
    # "chatbot" = text conversational interview, "mcq" = proctored MCQ
    # assessment, "voice_agent" = standalone real-time voice interview.
    mode =                      Column(String, nullable=False, default="chatbot")
    assessment_source =         Column(String, nullable=True)   # "ai" | "bank" — only used when mode == "mcq"
    assessment_num_questions =  Column(Integer, default=20)
    assessment_questions =      Column(Text, default="[]")  # JSON list[{id, question, options[4], correct_index, topic}] — fixed at posting creation so every candidate gets the same set
    assessment_seconds_per_question = Column(Integer, default=60)  # countdown per MCQ — unanswered in time scores 0 for that question
    notify_hr_on_completion =  Column(Boolean, default=True)  # send the HR notification email when a candidate finishes

    created_at =       Column(DateTime(timezone=True), server_default=func.now())


class InterviewSession(Base):
    """
    One candidate's run through an interview posting. No user_id — candidates
    never log in for this flow, they're identified by name+email they submit
    at the start of the session.
    """
    __tablename__ = "interview_sessions"

    id =                    Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    posting_id =             Column(UUID(as_uuid=True), ForeignKey("interview_postings.id"), nullable=False)
    candidate_name =          Column(String, nullable=False)
    candidate_email =         Column(String, nullable=False, index=True)

    transcript =              Column(Text, default="[]")   # JSON list[{role, content}]
    turn_count =               Column(Integer, default=0)   # number of candidate answers so far
    status =                   Column(String, default="in_progress")  # in_progress | completed
    awaiting_cv =              Column(Boolean, default=False)  # AI has asked for CV, waiting on upload/skip
    cv_text =                  Column(Text, nullable=True)     # extracted text from uploaded CV, if any

    stage =                    Column(String, default="interview")  # interview | assessment | done — drives what the public UI shows next
    assessment_answers =       Column(Text, default="[]")   # JSON list[{question_id, selected_index}]
    assessment_current_index = Column(Integer, default=0)
    assessment_score =         Column(Integer, nullable=True)     # % correct, 0-100
    assessment_flags =         Column(Text, default="[]")   # JSON list[{type, detail, at}] — proctoring events (tab switch, left site, etc.)
    assessment_photos =        Column(Text, default="[]")   # JSON list[str] — relative file paths of periodic webcam captures
    assessment_started_at =    Column(DateTime(timezone=True), nullable=True)
    assessment_completed_at =  Column(DateTime(timezone=True), nullable=True)
    current_question_started_at = Column(DateTime(timezone=True), nullable=True)  # server-authoritative — set each time a question is served, checked on answer to enforce the real time limit regardless of client clock
    terminated_reason =        Column(String, nullable=True)  # e.g. "left_page_during_assessment" — set when a session is force-ended for suspected cheating

    ai_score =                 Column(Integer, nullable=True)
    final_verdict =            Column(String, nullable=True)
    experience_assessment =    Column(Text, nullable=True)
    deep_analysis =            Column(Text, nullable=True)

    created_at =               Column(DateTime(timezone=True), server_default=func.now())
    completed_at =             Column(DateTime(timezone=True), nullable=True)