import uuid
from sqlalchemy import Column, String, Text, Integer, Boolean, Date, Time, DateTime, ForeignKey
from sqlalchemy.sql import func
from sqlalchemy.dialects.postgresql import UUID
from models.database import Base


class ActivityEvent(Base):
    """
    A manually-created planner entry ("Personal Plan") — distinct from the
    automatic activity feed in core/activity_feed.py, which is derived at
    request time from Notification/PracticeSession/Job/Application and is
    never stored. This table exists only for things the PLATFORM doesn't
    already know about: a candidate's own reminder to "apply to 5 backend
    jobs tomorrow", an HR user's own note to "review Backend candidates".

    Ownership (user_id, who created it) is unchanged — same as Notification,
    no organization_id column. But visibility for HR is now org-scoped like
    Jobs/screenings already are (see routes/activity.py): any teammate in
    the same Team Workspace can SEE a colleague's planner event in the
    combined feed, with a "by <name>" label. Only the creator can edit,
    complete, cancel, or delete it — a personal reminder someone jotted for
    themselves stays theirs to manage, even though the team can see it now.

    company/role/location_or_link are generic optional-detail fields reused
    across activity types (Interview: company+role+link; Job Application:
    company+role+link-as-job-URL; Practice: role holds "practice type",
    notes holds the topic) rather than one column per type — keeps this one
    reusable table instead of a table-per-type, per the task's own
    "adapt the schema, don't blindly copy" instruction.
    """
    __tablename__ = "activity_events"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)

    activity_type = Column(String, nullable=False)   # practice | resume | interview | screening | application | follow_up | career_goal | meeting | other (candidate)
                                                        # interview_scheduled | candidate_review | screening_deadline | follow_up | team_meeting | job_deadline | selected | rejected | other (HR)
    title = Column(String, nullable=False)
    notes = Column(Text, nullable=True)

    event_date = Column(Date, nullable=False, index=True)
    event_time = Column(Time, nullable=True)          # null = no specific time ("all day")

    company = Column(String, nullable=True)
    role = Column(String, nullable=True)
    location_or_link = Column(String, nullable=True)

    status = Column(String, nullable=False, default="planned")   # planned | completed | cancelled

    # Optional link to a real existing entity — candidate: their own
    # Application; HR: an org-scoped Job or Application. Same loose,
    # nullable related_id/related_type convention Notification already
    # uses. When set, the API resolves a real action_url from it instead of
    # trusting anything the client sent, so this can never point somewhere
    # the user doesn't actually have access to.
    related_type = Column(String, nullable=True)     # "application" | "job"
    related_id = Column(String, nullable=True)

    # Reminder — offset in minutes before event_time (0 = at time of event,
    # 1440 = 1 day before); null = no reminder. reminder_task_id is the
    # Celery task id from apply_async(eta=...) so an edit/delete/complete
    # can revoke the still-pending task instead of leaving a stale one to
    # fire against changed/gone data. reminder_sent guards against a
    # duplicate notification if the task is ever redelivered.
    reminder_offset_minutes = Column(Integer, nullable=True)
    reminder_task_id = Column(String, nullable=True)
    reminder_sent = Column(Boolean, nullable=False, default=False)

    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)