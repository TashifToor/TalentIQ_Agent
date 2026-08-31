"""
Delivers a single reminder notification for one ActivityEvent, at a specific
future time. Scheduled via `send_activity_reminder.apply_async(eta=...)` at
create/edit time in routes/activity.py — this does NOT need Celery Beat
(which is for recurring schedules); a plain `eta=`/`countdown=` task is
exactly what Celery is designed for one-off future-time delivery, and this
project's Redis-backed worker (core/celery_app.py) already reliably runs
this pattern for bulk screening today.

Reliability note (see also the report this was flagged in): the scheduled
task message lives in Redis (the broker) until a worker consumes it, so it
survives a worker restart. It does NOT survive a Redis flush/data-loss event
with no persistence configured — the same caveat that already applies to
every other Celery task in this codebase, not a new risk introduced here.

Idempotent by construction: re-checks the event's current state (still
exists, still "planned", not already reminder_sent) before ever creating a
notification, so a redelivered/duplicate task execution is a safe no-op —
and create_notification() itself is idempotent per (user_id, type,
related_id, related_type) as a second layer of safety.
"""
import logging
from datetime import datetime, date, time as dtime, timedelta, timezone

from core.celery_app import celery_app

logger = logging.getLogger("talentiq.reminder_task")


def compute_reminder_eta(event_date: date, event_time: dtime | None, offset_minutes: int) -> datetime:
    """The moment the reminder should fire. A date-only (no event_time)
    event reminds at 09:00 local-naive on the target day minus the offset —
    there's no clock time to count back from otherwise."""
    base_time = event_time or dtime(9, 0)
    event_dt = datetime.combine(event_date, base_time, tzinfo=timezone.utc)
    return event_dt - timedelta(minutes=offset_minutes)


@celery_app.task(bind=True, name="tasks.reminder_task.send_activity_reminder", max_retries=0)
def send_activity_reminder(self, event_id: str):
    from models.database import session_local
    from models.activity_event import ActivityEvent
    from core.notifications import create_notification

    db = session_local()
    try:
        event = db.query(ActivityEvent).filter(ActivityEvent.id == event_id).first()
        if not event:
            logger.info(f"[reminder] event={event_id} no longer exists — skipping")
            return {"status": "skipped_deleted"}
        if event.status != "planned":
            logger.info(f"[reminder] event={event_id} status={event.status} — skipping")
            return {"status": "skipped_not_planned"}
        if event.reminder_sent:
            logger.info(f"[reminder] event={event_id} already sent — skipping")
            return {"status": "skipped_already_sent"}

        when = f" at {event.event_time.strftime('%I:%M %p')}" if event.event_time else ""
        extra = f" — {event.company}" if event.company else ""
        create_notification(
            db,
            user_id=event.user_id,
            type="activity_reminder",
            title=f"Reminder: {event.title}",
            message=f"{event.title}{extra} is coming up{when} on {event.event_date.strftime('%b %d')}.",
            related_id=str(event.id),
            related_type="activity_event",
            action_url=f"/candidate/dashboard/activity?date={event.event_date.isoformat()}"
            if _is_candidate(db, event.user_id) else f"/hr/dashboard?section=activity&date={event.event_date.isoformat()}",
        )
        event.reminder_sent = True
        db.commit()
        logger.info(f"[reminder] event={event_id} notification sent")
        return {"status": "sent"}
    finally:
        db.close()


def _is_candidate(db, user_id: int) -> bool:
    from models.user import User
    u = db.query(User).filter(User.id == user_id).first()
    return bool(u and u.role == "candidate")