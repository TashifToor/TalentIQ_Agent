"""
One place that schedules/revokes an ActivityEvent's reminder Celery task, so
every route that can affect it (create, update, complete, delete) goes
through the same logic instead of re-implementing eta math or revoke calls.
"""
import logging
from datetime import datetime, timezone

from core.celery_app import celery_app
from models.activity_event import ActivityEvent

logger = logging.getLogger("talentiq.activity_reminders")


def revoke_pending_reminder(event: ActivityEvent) -> None:
    """Cancels a still-pending scheduled reminder task, if any. Safe to call
    even if there's nothing scheduled, or if it already fired (revoke on an
    already-executed task is a harmless no-op)."""
    if event.reminder_task_id:
        try:
            celery_app.control.revoke(event.reminder_task_id)
        except Exception:
            # Broker unreachable etc. — never let this block the actual
            # create/update/delete the user asked for.
            logger.warning(f"[reminders] could not revoke task={event.reminder_task_id}", exc_info=True)
        event.reminder_task_id = None


def schedule_reminder(event: ActivityEvent) -> None:
    """Schedules a fresh reminder for `event` based on its current
    event_date/event_time/reminder_offset_minutes. Caller is responsible for
    calling revoke_pending_reminder() first if one might already exist (all
    callers in routes/activity.py do). No-ops if reminder_offset_minutes is
    None, or if the computed reminder time has already passed (never
    schedules a reminder in the past — that would fire immediately, which
    isn't a "reminder" for something the user is creating/editing right
    now)."""
    from tasks.reminder_task import send_activity_reminder, compute_reminder_eta

    if event.reminder_offset_minutes is None:
        return

    eta = compute_reminder_eta(event.event_date, event.event_time, event.reminder_offset_minutes)
    if eta <= datetime.now(timezone.utc):
        logger.info(f"[reminders] event={event.id} computed reminder time is in the past — not scheduling")
        return

    event.reminder_sent = False
    try:
        result = send_activity_reminder.apply_async(args=[str(event.id)], eta=eta)
        event.reminder_task_id = result.id
    except Exception:
        # A broker hiccup should never break the create/update the user is
        # actually asking for — the event is still saved either way, it
        # just won't have a reminder this time. Same defensive posture as
        # revoke_pending_reminder() below.
        logger.warning(f"[reminders] could not schedule task for event={event.id}", exc_info=True)