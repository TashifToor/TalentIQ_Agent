from sqlalchemy import Column, Integer, String, Float, JSON, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from models.database import Base


class ScanHistory(Base):
    __tablename__ = "scan_history"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)

    role_title = Column(String, nullable=True)
    candidate_score = Column(Float, nullable=False)
    final_verdict = Column(String, nullable=True)
    matched_skills = Column(JSON, nullable=True) 
    missing_skills = Column(JSON, nullable=True)   
    is_shortlisted = Column(String, nullable=True)
    trigger_interview = Column(String, nullable=True)
    deep_analysis = Column(String, nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())

    user = relationship("User", backref="scan_history")