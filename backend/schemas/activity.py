from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel


class ActivityItem(BaseModel):
    id: str                       # synthetic composite id (not a DB PK) — stable per source row
    type: str                     # e.g. "application", "interview_completed", "practice_session"
    title: str
    description: Optional[str] = None
    occurred_at: datetime
    related_type: Optional[str] = None
    related_id: Optional[str] = None
    action_url: Optional[str] = None


class ActivityFeedResponse(BaseModel):
    activities: List[ActivityItem]
    summary: dict                 # e.g. {"applications": 12, "interviews": 4} — only real counts, computed from the same range