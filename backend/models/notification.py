import uuid
from sqlalchemy import Column, String, Text, Boolean, DateTime, ForeignKey, Index, Integer
from sqlalchemy.sql import func
from sqlalchemy.dialects.postgresql import UUID
from models.database import Base


class Notification(Base):
    """
    One notification for one user. Always created after the real underlying
    event has already succeeded (application saved, screening completed,
    decision recorded, etc.) — never speculatively, never for a fake/demo
    event. Scoping to "this user only" is enforced entirely by every query
    filtering on Notification.user_id == current_user.id; there is no
    separate notion of organization on this table because a notification
    always belongs to exactly one person, never a team.

    related_id/related_type are a loose, optional pointer to the entity this
    notification is about (e.g. related_type="application", related_id=the
    Application's UUID) — used only to build a click-through link, never
    joined against for authorization. action_url is the fully-formed
    frontend path to navigate to, computed at creation time from data that
    was already verified to belong to the recipient.
    """
    __tablename__ = "notifications"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)

    type = Column(String, nullable=False)          # e.g. "new_application", "interview_completed"
    title = Column(String, nullable=False)
    message = Column(Text, nullable=False)

    is_read = Column(Boolean, nullable=False, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    related_id = Column(String, nullable=True)      # e.g. an Application/InterviewSession UUID, as a string
    related_type = Column(String, nullable=True)    # e.g. "application" | "interview_session" | "posting"
    action_url = Column(String, nullable=True)      # frontend path to open on click, or None

    # Idempotency key: for a given (user, type, related_id, related_type),
    # a duplicate create_notification() call is a no-op rather than a second
    # row — see core/notifications.py. Not a DB unique constraint on purpose
    # (related_id/related_type are nullable and some notification types have
    # no natural related entity), enforced instead by a pre-check query.

    __table_args__ = (
        Index("ix_notifications_user_created", "user_id", "created_at"),
        Index("ix_notifications_user_unread", "user_id", "is_read"),
    )