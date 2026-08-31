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
    # Added for the Activity & Planner upgrade — both default so every
    # existing automatic-activity call site keeps working unchanged.
    source: str = "system"        # "system" (auto-derived, read-only) | "manual" (user-created, editable)
    status: Optional[str] = None  # planned | completed | cancelled — only set for source="manual"
    has_time: bool = True         # False = date-only manual event ("all day", no clock time)
    event_id: Optional[str] = None  # the real ActivityEvent UUID — only set for source="manual", used for edit/delete/complete
    created_by_name: Optional[str] = None  # only set for an HR teammate's manual event that isn't the viewer's own
    is_own: bool = True           # False = a teammate's manual event — view-only for the viewer


class ActivityFeedResponse(BaseModel):
    activities: List[ActivityItem]
    summary: dict                 # e.g. {"applications": 12, "interviews": 4} — only real counts, computed from the same range