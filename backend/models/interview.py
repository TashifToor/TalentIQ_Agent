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
    public_slug =      Column(String, unique=True, index=True, nullable=False, default=generate_slug)
    is_active =        Column(Boolean, default=True)
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

    ai_score =                 Column(Integer, nullable=True)
    final_verdict =            Column(String, nullable=True)
    experience_assessment =    Column(Text, nullable=True)
    deep_analysis =            Column(Text, nullable=True)

    created_at =               Column(DateTime(timezone=True), server_default=func.now())
    completed_at =             Column(DateTime(timezone=True), nullable=True)