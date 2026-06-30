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

    ai_score=       Column(Integer,default=0)
    matched_skills= Column(Text,default="[]")  
    missing_skills= Column(Text,default="[]")   
    final_verdict=  Column(String,nullable=True)
    deep_analysis=  Column(Text,nullable=True)
    is_shortlisted= Column(String,default="pending")  
    trigger_interview= Column(String,default="no")       

    created_at=    Column(DateTime(timezone=True),server_default=func.now())
    screened_at=   Column(DateTime(timezone=True),nullable=True)