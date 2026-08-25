from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
import uuid as uuid_lib

from models.database import get_db
from models.user import User
from models.notification import Notification
from middleware.auth import get_current_user
from schemas.notification import (
    NotificationResponse, NotificationListResponse, UnreadCountResponse, MarkReadResponse,
)

router = APIRouter(prefix="/notifications", tags=["Notifications"])


# ── GET /notifications — the authenticated user's own notifications, paginated ──
@router.get("", response_model=NotificationListResponse)
def list_notifications(
    unread_only: bool = Query(False),
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # Every query below filters on current_user.id — the client can never
    # pass a user_id, so there is no path to read another user's notifications.
    q = db.query(Notification).filter(Notification.user_id == current_user.id)
    if unread_only:
        q = q.filter(Notification.is_read == False)  # noqa: E712

    total = q.count()
    unread_count = (
        db.query(Notification)
        .filter(Notification.user_id == current_user.id, Notification.is_read == False)  # noqa: E712
        .count()
    )
    rows = q.order_by(Notification.created_at.desc()).offset(offset).limit(limit).all()

    return NotificationListResponse(
        notifications=[NotificationResponse.model_validate(_serialize(n)) for n in rows],
        total=total,
        unread_count=unread_count,
        has_more=offset + len(rows) < total,
    )


# ── GET /notifications/unread-count ──
@router.get("/unread-count", response_model=UnreadCountResponse)
def unread_count(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    count = (
        db.query(Notification)
        .filter(Notification.user_id == current_user.id, Notification.is_read == False)  # noqa: E712
        .count()
    )
    return UnreadCountResponse(unread_count=count)


def _parse_id(notification_id: str) -> uuid_lib.UUID:
    try:
        return uuid_lib.UUID(notification_id)
    except (ValueError, AttributeError, TypeError):
        raise HTTPException(status_code=404, detail="Notification not found.")


# ── PATCH /notifications/{id}/read — mark one as read, ownership enforced ──
@router.patch("/{notification_id}/read", response_model=MarkReadResponse)
def mark_read(
    notification_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    notif = (
        db.query(Notification)
        .filter(Notification.id == _parse_id(notification_id), Notification.user_id == current_user.id)
        .first()
    )
    if not notif:
        # 404, not 403 — an ID belonging to another user must not even be
        # confirmed to exist, same pattern used by get_scoped_application.
        raise HTTPException(status_code=404, detail="Notification not found.")

    if not notif.is_read:
        notif.is_read = True
        db.commit()
        db.refresh(notif)

    return MarkReadResponse(id=str(notif.id), is_read=notif.is_read)


# ── PATCH /notifications/read-all — mark every one of the current user's notifications as read ──
@router.patch("/read-all")
def mark_all_read(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    updated = (
        db.query(Notification)
        .filter(Notification.user_id == current_user.id, Notification.is_read == False)  # noqa: E712
        .update({"is_read": True})
    )
    db.commit()
    return {"updated": updated}


# ── DELETE /notifications/{id} — ownership enforced ──
@router.delete("/{notification_id}")
def delete_notification(
    notification_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    notif = (
        db.query(Notification)
        .filter(Notification.id == _parse_id(notification_id), Notification.user_id == current_user.id)
        .first()
    )
    if not notif:
        raise HTTPException(status_code=404, detail="Notification not found.")

    db.delete(notif)
    db.commit()
    return {"deleted": True}


def _serialize(n: Notification) -> dict:
    return {
        "id": str(n.id),
        "type": n.type,
        "title": n.title,
        "message": n.message,
        "is_read": n.is_read,
        "created_at": n.created_at,
        "related_id": n.related_id,
        "related_type": n.related_type,
        "action_url": n.action_url,
    }