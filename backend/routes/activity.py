"""
Activity Timeline's aggregation layer. Deliberately NOT a new persisted
table — every activity is derived at request time from tables that already
exist, so there is nothing new to keep in sync and nothing that can drift
out of date with the real event.

To avoid showing the same real-world event twice, each event type has
exactly ONE source of truth:
  - Anything that already creates a Notification (core/notifications.py,
    pass 21) uses that Notification as-is — it already has a good title,
    message, and action_url. We never also re-derive the same fact from
    Application/InterviewSession directly.
  - Only event types with NO existing notification get pulled straight
    from their owning table: candidate practice sessions, HR job creation,
    and HR's own decision action (the candidate gets a notification for
    being accepted/rejected, but HR never got one for making the call).
"""
from datetime import datetime, timezone
from sqlalchemy.orm import Session

from models.notification import Notification
from models.practice import PracticeSession
from models.job import Job
from models.application import Application
from models.user import User
from schemas.activity import ActivityItem
from fastapi import APIRouter

router = APIRouter(prefix="/activity", tags=["activity"])
# Notification types that are genuinely calendar-worthy for each role.
# (Deliberately excludes noisy/internal types if any exist beyond these.)
CANDIDATE_NOTIF_TYPES = {"application_received", "interview_invitation", "interview_completed", "application_accepted", "application_rejected"}
HR_NOTIF_TYPES = {"new_application", "ats_screening_completed", "ai_screening_completed", "screening_failed", "interview_completed"}


def _aware(dt: datetime) -> datetime:
    """SQLite drops tzinfo on DateTime(timezone=True) columns (Postgres,
    the real production DB, does not) — normalize so comparisons never
    crash on a naive-vs-aware mismatch in either environment."""
    return dt if dt.tzinfo is not None else dt.replace(tzinfo=timezone.utc)


def _notif_to_activity(n: Notification) -> ActivityItem:
    return ActivityItem(
        id=f"notif:{n.id}",
        type=n.type,
        title=n.title,
        description=n.message,
        occurred_at=_aware(n.created_at),
        related_type=n.related_type,
        related_id=n.related_id,
        action_url=n.action_url,
    )


def get_candidate_activities(db: Session, user: User, start: datetime, end: datetime) -> list[ActivityItem]:
    items: list[ActivityItem] = []

    notifs = (
        db.query(Notification)
        .filter(Notification.user_id == user.id, Notification.type.in_(CANDIDATE_NOTIF_TYPES),
                Notification.created_at >= start, Notification.created_at <= end)
        .all()
    )
    items.extend(_notif_to_activity(n) for n in notifs)

    sessions = (
        db.query(PracticeSession)
        .filter(PracticeSession.user_id == user.id)
        .all()
    )
    for s in sessions:
        ts = s.completed_at or s.created_at
        if ts is None:
            continue
        ts = _aware(ts)
        if not (start <= ts <= end):
            continue
        done = s.completed_at is not None
        items.append(ActivityItem(
            id=f"practice:{s.id}",
            type="practice_session",
            title="Practice session completed" if done else "Practice session started",
            description=s.target_role,
            occurred_at=ts,
            related_type="practice_session",
            related_id=str(s.id),
            action_url="/candidate/dashboard/practice/history",
        ))

    items.sort(key=lambda a: a.occurred_at)
    return items


def get_candidate_summary(db: Session, user: User) -> dict:
    """All-time counts — cheap COUNT()s, independent of whatever month is
    currently being viewed, so the summary strip stays stable while paging
    through the calendar."""
    applications = db.query(Application).filter(Application.candidate_id == user.id).count()
    interviews = (
        db.query(Notification)
        .filter(Notification.user_id == user.id, Notification.type == "interview_completed")
        .count()
    )
    practice = db.query(PracticeSession).filter(PracticeSession.user_id == user.id, PracticeSession.completed_at.isnot(None)).count()
    recruiter_responses = (
        db.query(Notification)
        .filter(Notification.user_id == user.id, Notification.type.in_(["application_accepted", "application_rejected", "interview_invitation"]))
        .count()
    )
    return {"applications": applications, "interviews": interviews, "practice_sessions": practice, "recruiter_responses": recruiter_responses}


def get_hr_activities(db: Session, user: User, start: datetime, end: datetime) -> list[ActivityItem]:
    from core.org_scope import get_org_scoped_user_ids
    scoped_ids = get_org_scoped_user_ids(user, db)
    items: list[ActivityItem] = []

    notifs = (
        db.query(Notification)
        .filter(Notification.user_id == user.id, Notification.type.in_(HR_NOTIF_TYPES),
                Notification.created_at >= start, Notification.created_at <= end)
        .all()
    )
    items.extend(_notif_to_activity(n) for n in notifs)

    jobs = (
        db.query(Job)
        .filter(Job.hr_user_id.in_(scoped_ids), Job.created_at >= start, Job.created_at <= end)
        .all()
    )
    for j in jobs:
        items.append(ActivityItem(
            id=f"job:{j.id}",
            type="job_created",
            title="Job created",
            description=f"{j.title}{' · ' + j.company if j.company else ''}",
            occurred_at=_aware(j.created_at),
            related_type="job",
            related_id=str(j.id),
            action_url="/hr/dashboard?section=history",
        ))

    decided = (
        db.query(Application)
        .join(Job, Application.job_id == Job.id)
        .filter(Job.hr_user_id.in_(scoped_ids), Application.decision.in_(["accepted", "rejected"]),
                Application.decision_at >= start, Application.decision_at <= end)
        .all()
    )
    for a in decided:
        job = db.query(Job).filter(Job.id == a.job_id).first()
        items.append(ActivityItem(
            id=f"decision:{a.id}",
            type=f"candidate_{a.decision}",
            title=f"Candidate {a.decision}",
            description=f"{a.candidate_name or 'Candidate'} — {job.title if job else 'Unknown role'}",
            occurred_at=_aware(a.decision_at),
            related_type="application",
            related_id=str(a.id),
            action_url=f"/hr/dashboard?section=candidates&application={a.id}",
        ))

    items.sort(key=lambda a: a.occurred_at)
    return items


def get_hr_summary(db: Session, user: User) -> dict:
    from core.org_scope import get_org_scoped_user_ids
    scoped_ids = get_org_scoped_user_ids(user, db)

    candidates = (
        db.query(Application)
        .join(Job, Application.job_id == Job.id)
        .filter(Job.hr_user_id.in_(scoped_ids))
        .count()
    )
    interviews = (
        db.query(Notification)
        .filter(Notification.user_id == user.id, Notification.type == "interview_completed")
        .count()
    )
    decisions = (
        db.query(Application)
        .join(Job, Application.job_id == Job.id)
        .filter(Job.hr_user_id.in_(scoped_ids), Application.decision.in_(["accepted", "rejected"]))
        .count()
    )
    followups = (
        db.query(Application)
        .join(Job, Application.job_id == Job.id)
        .filter(Job.hr_user_id.in_(scoped_ids), Application.invited_posting_id.isnot(None))
        .count()
    )
    return {"candidates": candidates, "interviews": interviews, "decisions": decisions, "follow_ups": followups}