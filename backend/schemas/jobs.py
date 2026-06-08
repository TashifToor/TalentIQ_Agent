from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime
import uuid


class JobCreate(BaseModel):
    title:       str
    company:    Optional[str] = None
    location:   Optional[str] = None
    description: str
    

class jobResponse(BaseModel):
    id:           str
    title:        str
    company:      Optional[str]
    location:     Optional[str]
    description:  str
    is_active:    bool
    created_at:   datetime
    applicant_count: Optional[int] = 0
    
    model_config = {"arbitrary_types_allowed": True}
    