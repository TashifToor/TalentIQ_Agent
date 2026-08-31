"""
Activity & Planner. Combines two sources into one feed:
  - Automatic activities (core/activity_feed.py) — derived at request time
    from tables that already exist, never stored, read-only ("TalentIQ
    Activity" in the UI).
  - Manual planner events (models/activity_event.py) — user-created,
    editable ("Personal Plan" in the UI). For HR, visible to the whole
    Team Workspace (like Jobs already are) but only editable by whoever
    created it.

FIX (earlier in this pass): this router previously had zero
@router.get/@router.post decorators — every function below core/
activity_feed.py's duplicate copy here was dead code, so GET /activities
has never actually worked. Removed the duplication (now imports from
core/activity_feed.py, the one real source of truth) and added the
missing endpoints, matching the path the frontend has always called
(`/activities?start=&end=`).
"""
import uuid as uuid_lib
from datetime import datetime, date, time as dtime, timezone
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import or_

from models.database import get_db
from models.user import User
from models.job import Job
from models.application import Application
from models.activity_event import ActivityEvent
from middleware.auth import get_current_user
from schemas.activity import ActivityItem, ActivityFeedResponse
from schemas.activity_event import (
    ActivityEventCreate, ActivityEventUpdate, ActivityEventOut, LinkableEntity,
    CANDIDATE_ACTIVITY_TYPES, HR_ACTIVITY_TYPES, REMINDER_OFFSETS, RELATABLE_TYPES,
)
from core.activity_feed import (
    get_candidate_activities, get_candidate_summary,
    get_hr_activities, get_hr_summary,
)
from core.activity_reminders import schedule_reminder, revoke_pending_reminder
from core.org_scope import get_org_scoped_user_ids

router = APIRouter(prefix="/activities", tags=["Activity & Planner"])


def _valid_types(role: str) -> set[str]:
    return CANDIDATE_ACTIVITY_TYPES if role == "candidate" else HR_ACTIVITY_TYPES


def _resolve_action_url(related_type: str | None, related_id: str | None, is_hr: bool) -> str | None:
    """Same URL shape core/activity_feed.py already uses for automatic
    activities — a manually-linked event should navigate exactly the same
    way an automatic one about the same entity would."""
    if not related_type or not related_id:
        return None
    if related_type == "application":
        return f"/hr/dashboard?section=candidates&application={related_id}" if is_hr else "/candidate/dashboard/history"
    if related_type == "job":
        return "/hr/dashboard?section=talent-pool" if is_hr else None
    return None


def _validate_and_own_link(db: Session, current_user: User, related_type: str | None, related_id: str | None) -> None:
    """Raises 400 if the link is malformed, 404 if it points at something
    this user can't actually access — never trust a client-supplied
    related_id without checking it's really theirs (or their org's)."""
    if related_type is None and related_id is None:
        return
    if related_type is None or related_id is None:
        raise HTTPException(status_code=400, detail="related_type and related_id must be set together")
    if related_type not in RELATABLE_TYPES:
        raise HTTPException(status_code=400, detail="Invalid related_type")
    try:
        rid = uuid_lib.UUID(related_id)
    except ValueError:
        raise HTTPException(status_code=404, detail="Linked item not found")

    if related_type == "application":
        q = db.query(Application).filter(Application.id == rid)
        q = q.filter(Application.candidate_id == current_user.id) if current_user.role == "candidate" \
            else q.filter(Application.job_id == Job.id, Job.hr_user_id.in_(get_org_scoped_user_ids(current_user, db)))
        if not q.first():
            raise HTTPException(status_code=404, detail="Linked application not found")
    elif related_type == "job":
        if current_user.role != "hr":
            raise HTTPException(status_code=400, detail="Only HR can link a job")
        job = db.query(Job).filter(Job.id == rid, Job.hr_user_id.in_(get_org_scoped_user_ids(current_user, db))).first()
        if not job:
            raise HTTPException(status_code=404, detail="Linked job not found")


def _event_to_item(e: ActivityEvent, viewer_id: int, creator_name: str | None, is_hr: bool) -> ActivityItem:
    has_time = e.event_time is not None
    occurred = datetime.combine(e.event_date, e.event_time or dtime(0, 0), tzinfo=timezone.utc)
    desc_parts = [p for p in [e.company, e.role] if p]
    is_own = e.user_id == viewer_id
    return ActivityItem(
        id=f"event:{e.id}",
        type=e.activity_type,
        title=e.title,
        description=" — ".join(desc_parts) if desc_parts else e.notes,
        occurred_at=occurred,
        related_type=e.related_type or "activity_event",
        related_id=e.related_id or str(e.id),
        action_url=_resolve_action_url(e.related_type, e.related_id, is_hr),
        source="manual",
        status=e.status,
        has_time=has_time,
        event_id=str(e.id),
        created_by_name=None if is_own else creator_name,
        is_own=is_own,
    )


def _serialize_event(db: Session, e: ActivityEvent, is_hr: bool) -> ActivityEventOut:
    return ActivityEventOut(
        id=str(e.id),
        activity_type=e.activity_type,
        title=e.title,
        event_date=e.event_date,
        event_time=e.event_time,
        notes=e.notes,
        company=e.company,
        role=e.role,
        location_or_link=e.location_or_link,
        status=e.status,
        reminder_offset_minutes=e.reminder_offset_minutes,
        related_type=e.related_type,
        related_id=e.related_id,
        action_url=_resolve_action_url(e.related_type, e.related_id, is_hr),
        created_by_name=None,   # the serializer is only ever used for the creator's own request/response
        created_at=e.created_at.isoformat(),
        updated_at=e.updated_at.isoformat(),
    )


def _get_owned_event(db: Session, event_id: str, current_user: User) -> ActivityEvent:
    """Creator-only — used by every write action (edit/status/delete). A
    teammate can SEE another HR user's event in the feed, but only the
    person who created it can change it."""
    try:
        uid = uuid_lib.UUID(event_id)
    except ValueError:
        raise HTTPException(status_code=404, detail="Activity not found")
    event = db.query(ActivityEvent).filter(ActivityEvent.id == uid).first()
    # 404, not 403, on someone else's event — same convention as
    # routes/notifications.py: never confirm an ID belongs to someone else.
    if not event or event.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Activity not found")
    return event


# ── GET /activities — combined automatic + manual feed for a date range ──
@router.get("", response_model=ActivityFeedResponse)
def get_activities(
    start: date = Query(...),
    end: date = Query(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    start_dt = datetime.combine(start, dtime.min, tzinfo=timezone.utc)
    end_dt = datetime.combine(end, dtime.max, tzinfo=timezone.utc)
    is_hr = current_user.role != "candidate"

    if current_user.role == "candidate":
        items = get_candidate_activities(db, current_user, start_dt, end_dt)
        summary = get_candidate_summary(db, current_user)
        visible_user_ids = [current_user.id]
    else:
        items = get_hr_activities(db, current_user, start_dt, end_dt)
        summary = get_hr_summary(db, current_user)
        # Manual planner events are visible to the whole Team Workspace,
        # same as Jobs/screenings already are — not just the creator.
        visible_user_ids = get_org_scoped_user_ids(current_user, db)

    manual = (
        db.query(ActivityEvent)
        .filter(ActivityEvent.user_id.in_(visible_user_ids),
                ActivityEvent.event_date >= start, ActivityEvent.event_date <= end)
        .all()
    )
    creator_names: dict[int, str] = {}
    if is_hr and len(visible_user_ids) > 1:
        creators = db.query(User.id, User.name).filter(User.id.in_({e.user_id for e in manual})).all()
        creator_names = {uid: name for uid, name in creators}

    items.extend(_event_to_item(e, current_user.id, creator_names.get(e.user_id), is_hr) for e in manual)
    items.sort(key=lambda a: a.occurred_at)

    my_manual = [e for e in manual if e.user_id == current_user.id]
    summary["planned_activities"] = (
        db.query(ActivityEvent)
        .filter(ActivityEvent.user_id == current_user.id, ActivityEvent.status == "planned")
        .count()
    )
    summary["completed_this_range"] = sum(1 for e in my_manual if e.status == "completed")

    return ActivityFeedResponse(activities=items, summary=summary)


# ── GET /activities/link-options — search existing entities for the picker ──
@router.get("/link-options", response_model=list[LinkableEntity])
def get_link_options(
    q: str = Query("", max_length=100),
    related_type: str = Query(..., pattern="^(application|job)$"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    results: list[LinkableEntity] = []
    like = f"%{q.strip()}%" if q.strip() else "%"

    if related_type == "application":
        query = db.query(Application, Job).join(Job, Application.job_id == Job.id)
        if current_user.role == "candidate":
            query = query.filter(Application.candidate_id == current_user.id)
        else:
            query = query.filter(Job.hr_user_id.in_(get_org_scoped_user_ids(current_user, db)))
        if q.strip():
            query = query.filter(or_(Application.candidate_name.ilike(like), Job.title.ilike(like), Job.company.ilike(like)))
        for app, job in query.order_by(Application.created_at.desc()).limit(20).all():
            label = f"{app.candidate_name or 'Unnamed candidate'} — {job.title}" if current_user.role != "candidate" else job.title
            results.append(LinkableEntity(related_type="application", related_id=str(app.id), label=label, subtitle=job.company))

    elif related_type == "job":
        if current_user.role == "candidate":
            raise HTTPException(status_code=400, detail="Candidates cannot link jobs")
        query = db.query(Job).filter(Job.hr_user_id.in_(get_org_scoped_user_ids(current_user, db)))
        if q.strip():
            query = query.filter(or_(Job.title.ilike(like), Job.company.ilike(like)))
        for job in query.order_by(Job.created_at.desc()).limit(20).all():
            results.append(LinkableEntity(related_type="job", related_id=str(job.id), label=job.title, subtitle=job.company))

    return results


# ── POST /activities/events — create a manual planner event ──
@router.post("/events", response_model=ActivityEventOut, status_code=201)
def create_event(
    payload: ActivityEventCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if payload.activity_type not in _valid_types(current_user.role):
        raise HTTPException(status_code=400, detail="Invalid activity type for this role")
    if payload.reminder_offset_minutes not in REMINDER_OFFSETS:
        raise HTTPException(status_code=400, detail="Invalid reminder option")
    _validate_and_own_link(db, current_user, payload.related_type, payload.related_id)

    event = ActivityEvent(
        user_id=current_user.id,
        activity_type=payload.activity_type,
        title=payload.title.strip(),
        notes=payload.notes,
        event_date=payload.event_date,
        event_time=payload.event_time,
        company=payload.company,
        role=payload.role,
        location_or_link=payload.location_or_link,
        status="planned",
        reminder_offset_minutes=payload.reminder_offset_minutes,
        related_type=payload.related_type,
        related_id=payload.related_id,
    )
    db.add(event)
    db.flush()   # get event.id before scheduling, without a second round trip
    schedule_reminder(event)
    db.commit()
    db.refresh(event)
    return _serialize_event(db, event, current_user.role != "candidate")


# ── PATCH /activities/events/{id} — edit a manual planner event ──
@router.patch("/events/{event_id}", response_model=ActivityEventOut)
def update_event(
    event_id: str,
    payload: ActivityEventUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    event = _get_owned_event(db, event_id, current_user)

    if payload.activity_type is not None:
        if payload.activity_type not in _valid_types(current_user.role):
            raise HTTPException(status_code=400, detail="Invalid activity type for this role")
        event.activity_type = payload.activity_type
    if payload.title is not None:
        event.title = payload.title.strip()
    if payload.event_date is not None:
        event.event_date = payload.event_date
    if payload.event_time is not None:
        event.event_time = payload.event_time
    if payload.notes is not None:
        event.notes = payload.notes
    if payload.company is not None:
        event.company = payload.company
    if payload.role is not None:
        event.role = payload.role
    if payload.location_or_link is not None:
        event.location_or_link = payload.location_or_link

    if payload.clear_reminder:
        event.reminder_offset_minutes = None
    elif payload.reminder_offset_minutes is not None:
        if payload.reminder_offset_minutes not in REMINDER_OFFSETS:
            raise HTTPException(status_code=400, detail="Invalid reminder option")
        event.reminder_offset_minutes = payload.reminder_offset_minutes

    if payload.clear_link:
        event.related_type = None
        event.related_id = None
    elif payload.related_type is not None or payload.related_id is not None:
        _validate_and_own_link(db, current_user, payload.related_type, payload.related_id)
        event.related_type = payload.related_type
        event.related_id = payload.related_id

    # Any change to date/time/reminder invalidates whatever was previously
    # scheduled — always safe to revoke-and-reschedule rather than trying to
    # detect exactly which fields matter.
    revoke_pending_reminder(event)
    if event.status == "planned":
        schedule_reminder(event)

    db.commit()
    db.refresh(event)
    return _serialize_event(db, event, current_user.role != "candidate")


# ── PATCH /activities/events/{id}/status — quick planned/completed/cancelled ──
@router.patch("/events/{event_id}/status", response_model=ActivityEventOut)
def update_event_status(
    event_id: str,
    status: str = Query(..., pattern="^(planned|completed|cancelled)$"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    event = _get_owned_event(db, event_id, current_user)
    event.status = status
    if status != "planned":
        # A completed/cancelled event doesn't need a "coming up" reminder.
        revoke_pending_reminder(event)
    else:
        schedule_reminder(event)
    db.commit()
    db.refresh(event)
    return _serialize_event(db, event, current_user.role != "candidate")


# ── DELETE /activities/events/{id} ──
@router.delete("/events/{event_id}")
def delete_event(
    event_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    event = _get_owned_event(db, event_id, current_user)
    revoke_pending_reminder(event)
    db.delete(event)
    db.commit()
    return {"deleted": True}