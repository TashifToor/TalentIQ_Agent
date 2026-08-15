from sqlalchemy import Column, String, Text, Integer, DateTime, ForeignKey
from sqlalchemy.sql import func
from sqlalchemy.dialects.postgresql import UUID
from models.database import Base
import uuid


class Application(Base):
    __tablename__="applications"

    id=             Column(UUID(as_uuid=True),primary_key=True,default=uuid.uuid4,index=True)
    job_id=         Column(UUID(as_uuid=True),ForeignKey("jobs.id"),nullable=False)
    candidate_id=   Column(Integer,ForeignKey("users.id"),nullable=False)
    cv_filename=    Column(String,nullable=True)
    cv_text=        Column(Text,nullable=True)
    candidate_name= Column(String,nullable=True)   # persisted from the pipeline's own name extraction
    candidate_email=Column(String,nullable=True)   # only ever set when an HR user explicitly types it in

    # CrewAI screening committee — qualitative multi-agent analysis, kept
    # entirely separate from the deterministic ATS fields above. Never
    # duplicates ai_score/matched_skills/missing_skills/final_verdict.
    ai_screening_status=     Column(String, nullable=False, default="not_analyzed")  # not_analyzed|queued|analyzing|completed|failed
    ai_screening_result=     Column(Text, nullable=True)      # ScreeningCommitteeResult, JSON-serialized
    ai_screening_updated_at= Column(DateTime(timezone=True), nullable=True)

    ai_score=       Column(Integer,default=0)
    matched_skills= Column(Text,default="[]")  
    missing_skills= Column(Text,default="[]")   
    final_verdict=  Column(String,nullable=True)
    deep_analysis=  Column(Text,nullable=True)
    is_shortlisted= Column(String,default="pending")  
    trigger_interview= Column(String,default="no")       

    created_at=    Column(DateTime(timezone=True),server_default=func.now())
    screened_at=   Column(DateTime(timezone=True),nullable=True)