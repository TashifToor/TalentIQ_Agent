from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime
import uuid


class ApplicationResponse(BaseModel):
    id:               str
    job_id:           str
    candidate_id:     int
    candidate_name:   Optional[str] = None
    candidate_email:  Optional[str] = None
    cv_filename:      Optional[str]
    ai_score:         int
    matched_skills:   List[str]
    missing_skills:   List[str]
    final_verdict:    Optional[str]
    deep_analysis:    Optional[str]
    is_shortlisted:   str
    trigger_interview: str
    created_at:       datetime
    screened_at:      Optional[datetime]
    
    model_config = {"arbitrary_types_allowed": True}