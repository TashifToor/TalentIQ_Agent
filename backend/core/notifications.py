"""
The single place that creates Notification rows. Every real event site
(apply.py, screening_task.py, crew_screening_task.py, bulk.py,
interview_public.py) calls into this instead of constructing Notification
objects itself, so idempotency and the "only after the real event actually
succeeded" rule live in exactly one place.

Idempotency: for a given (user_id, type, related_id, related_type), calling
create_notification() again is a no-op — it returns the existing row instead
of inserting a duplicate. This is what makes it safe to call from Celery
tasks that can be redelivered (worker crash, retry) without spamming the
user with the same notification twice. Callers that have no natural
related_id (e.g. a one-off account event) should still pass a related_id —
using the real primary key of whatever triggered it — rather than leaving it
None, since None never dedupes against anything.
"""
from sqlalchemy.orm import Session
from models.notification import Notification
from models.user import User


def create_notification(
    db: Session,
    user_id: int,
    type: str,
    title: str,
    message: str,
    related_id: str | None = None,
    related_type: str | None = None,
    action_url: str | None = None,
) -> Notification:
    if related_id is not None:
        existing = (
            db.query(Notification)
            .filter(
                Notification.user_id == user_id,
                Notification.type == type,
                Notification.related_id == str(related_id),
                Notification.related_type == related_type,
            )
            .first()
        )
        if existing:
            return existing

    notif = Notification(
        user_id=user_id,
        type=type,
        title=title,
        message=message,
        related_id=str(related_id) if related_id is not None else None,
        related_type=related_type,
        action_url=action_url,
    )
    db.add(notif)
    db.commit()
    db.refresh(notif)
    return notif


def notify_org_hr(
    db: Session,
    hr_user_id: int,
    type: str,
    title: str,
    message: str,
    related_id: str | None = None,
    related_type: str | None = None,
    action_url: str | None = None,
) -> list[Notification]:
    """
    Notifies every HR member of the same org as hr_user_id (reuses the
    existing get_org_scoped_user_ids — the exact same set of people who
    already share visibility into this job's data), not just the one person
    who happens to own the Job row. A solo HR account just notifies
    themself, same as get_org_scoped_user_ids returns [self] for them.
    """
    from core.org_scope import get_org_scoped_user_ids

    hr_user = db.query(User).filter(User.id == hr_user_id).first()
    if not hr_user:
        return []
    scoped_ids = get_org_scoped_user_ids(hr_user, db)

    return [
        create_notification(db, uid, type, title, message, related_id, related_type, action_url)
        for uid in scoped_ids
    ]