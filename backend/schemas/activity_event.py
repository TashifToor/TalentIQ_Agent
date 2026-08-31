from datetime import date, time
from typing import Optional
from pydantic import BaseModel, Field

# Curated, role-appropriate activity types. Enforced at the API layer (not a
# DB CHECK constraint, matching how Notification.type is a plain unchecked
# String elsewhere in this codebase) so adding a new type later is a
# one-line change here, not a migration.
CANDIDATE_ACTIVITY_TYPES = {
    "practice", "resume", "interview", "screening", "application",
    "follow_up", "career_goal", "meeting", "other",
}
HR_ACTIVITY_TYPES = {
    "interview_scheduled", "candidate_review", "screening_deadline", "follow_up",
    "team_meeting", "job_deadline", "selected", "rejected", "other",
}
REMINDER_OFFSETS = {None, 0, 10, 30, 60, 1440}  # None=no reminder, 0=at time of event, else minutes-before
RELATABLE_TYPES = {"application", "job"}


class ActivityEventCreate(BaseModel):
    activity_type: str
    title: str = Field(min_length=1, max_length=200)
    event_date: date
    event_time: Optional[time] = None
    notes: Optional[str] = None
    company: Optional[str] = None
    role: Optional[str] = None
    location_or_link: Optional[str] = None
    reminder_offset_minutes: Optional[int] = None
    related_type: Optional[str] = None   # "application" | "job" — validated + ownership-checked server-side
    related_id: Optional[str] = None


class ActivityEventUpdate(BaseModel):
    activity_type: Optional[str] = None
    title: Optional[str] = Field(default=None, min_length=1, max_length=200)
    event_date: Optional[date] = None
    event_time: Optional[time] = None
    notes: Optional[str] = None
    company: Optional[str] = None
    role: Optional[str] = None
    location_or_link: Optional[str] = None
    reminder_offset_minutes: Optional[int] = None
    clear_reminder: bool = False   # explicit flag — distinguishes "field omitted" from "user wants no reminder"
    related_type: Optional[str] = None
    related_id: Optional[str] = None
    clear_link: bool = False       # same distinction, for unlinking an entity


class ActivityEventOut(BaseModel):
    id: str
    activity_type: str
    title: str
    event_date: date
    event_time: Optional[time] = None
    notes: Optional[str] = None
    company: Optional[str] = None
    role: Optional[str] = None
    location_or_link: Optional[str] = None
    status: str
    reminder_offset_minutes: Optional[int] = None
    related_type: Optional[str] = None
    related_id: Optional[str] = None
    action_url: Optional[str] = None   # resolved server-side from related_type/related_id, if set
    created_by_name: Optional[str] = None   # only populated for HR teammates viewing someone else's event
    created_at: str
    updated_at: str

    class Config:
        from_attributes = True


class LinkableEntity(BaseModel):
    """One search result for the activity-link picker."""
    related_type: str    # "application" | "job"
    related_id: str
    label: str            # e.g. "Sarah Khan — Backend Developer" or "Backend Developer (Job)"
    subtitle: Optional[str] = None