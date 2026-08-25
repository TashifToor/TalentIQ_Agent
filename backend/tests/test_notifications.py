"""
Tests for the notification system: creation, per-user ownership isolation,
HR org-scoped broadcast isolation, unread count, mark-read, mark-all-read,
and idempotent duplicate-event protection.

Run with: pytest backend/tests/test_notifications.py
"""
import os
import sys
import uuid as uuid_lib

PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

os.environ.setdefault("DATABASE_URL", "sqlite:///:memory:")
os.environ.setdefault("SECRET_KEY", "test-secret")
os.environ.setdefault("GROQ_API_KEY", "test-key-not-used-by-mocked-tests")
os.environ.setdefault("FRONTEND_URL", "https://test.talentiq.local")


def _fresh_db():
    from models.database import Base, engine, session_local
    from models import organization, user, job as job_model, application as application_model, interview, chat, practice, scan_history, notification
    Base.metadata.create_all(bind=engine)
    return session_local()


def _make_user(db, role="candidate", organization_id=None, **overrides):
    from models import user
    suffix = uuid_lib.uuid4().hex[:10]
    defaults = dict(email=f"{role}-{suffix}@test.com", password_hash=f"x-{suffix}", role=role, name=f"{role.title()} Test")
    defaults.update(overrides)
    u = user.User(organization_id=organization_id, **defaults)
    db.add(u)
    db.commit()
    return u


# ── 1. Basic creation ──

def test_create_notification_persists_expected_fields():
    from core.notifications import create_notification
    db = _fresh_db()
    u = _make_user(db)

    n = create_notification(db, u.id, "application_received", "Application received", "Your application was submitted.")

    assert n.id is not None
    assert n.user_id == u.id
    assert n.type == "application_received"
    assert n.is_read is False
    assert n.created_at is not None


# ── 2. Idempotency — the exact scenario a Celery redelivery would trigger ──

def test_create_notification_is_idempotent_on_retry():
    from core.notifications import create_notification
    from models.notification import Notification
    db = _fresh_db()
    u = _make_user(db)

    first = create_notification(db, u.id, "ai_screening_completed", "AI Screening completed", "Backend Developer · Ahmed Khan", related_id="app-123", related_type="application")
    second = create_notification(db, u.id, "ai_screening_completed", "AI Screening completed", "Backend Developer · Ahmed Khan", related_id="app-123", related_type="application")

    assert first.id == second.id, "a retried event for the same (user, type, related_id) must not create a second row"
    count = db.query(Notification).filter(Notification.user_id == u.id, Notification.type == "ai_screening_completed").count()
    assert count == 1


def test_create_notification_without_related_id_is_not_deduped():
    """Notifications with no natural related entity aren't deduped against
    each other — only related_id-bearing events get idempotency, which is
    the documented, intentional behavior in core/notifications.py."""
    from core.notifications import create_notification
    from models.notification import Notification
    db = _fresh_db()
    u = _make_user(db)

    create_notification(db, u.id, "generic_event", "Title", "Message one")
    create_notification(db, u.id, "generic_event", "Title", "Message two")

    count = db.query(Notification).filter(Notification.user_id == u.id, Notification.type == "generic_event").count()
    assert count == 2


# ── 3. Candidate-to-candidate isolation ──

def test_list_notifications_never_returns_another_candidates_notifications():
    from core.notifications import create_notification
    from routes.notifications import list_notifications
    db = _fresh_db()
    candidate_a = _make_user(db, role="candidate")
    candidate_b = _make_user(db, role="candidate")

    create_notification(db, candidate_a.id, "application_received", "A's notification", "belongs to A")
    create_notification(db, candidate_b.id, "application_received", "B's notification", "belongs to B")

    result = list_notifications(unread_only=False, limit=20, offset=0, db=db, current_user=candidate_b)

    titles = [n.title for n in result.notifications]
    assert "B's notification" in titles
    assert "A's notification" not in titles
    assert result.total == 1


# ── 4. HR organization isolation ──

def test_notify_org_hr_never_reaches_a_different_organization():
    from core.notifications import notify_org_hr
    from core.notifications import create_notification
    from routes.notifications import list_notifications
    db = _fresh_db()

    from models.organization import Organization
    org_a = Organization(id=uuid_lib.uuid4(), name="Org A", owner_user_id=1)
    org_b = Organization(id=uuid_lib.uuid4(), name="Org B", owner_user_id=1)
    db.add_all([org_a, org_b])
    db.commit()

    hr_a1 = _make_user(db, role="hr", organization_id=org_a.id)
    hr_a2 = _make_user(db, role="hr", organization_id=org_a.id)
    hr_b1 = _make_user(db, role="hr", organization_id=org_b.id)

    notify_org_hr(db, hr_a1.id, "new_application", "New application received", "Sarah Khan applied.")

    result_a2 = list_notifications(unread_only=False, limit=20, offset=0, db=db, current_user=hr_a2)
    result_b1 = list_notifications(unread_only=False, limit=20, offset=0, db=db, current_user=hr_b1)

    assert result_a2.total == 1, "teammates in the same org must receive the notification"
    assert result_b1.total == 0, "HR in a different organization must never receive it"


# ── 5. Unread count ──

def test_unread_count_matches_actual_unread_rows():
    from core.notifications import create_notification
    from routes.notifications import unread_count, mark_read
    db = _fresh_db()
    u = _make_user(db)

    n1 = create_notification(db, u.id, "t1", "One", "msg")
    n2 = create_notification(db, u.id, "t2", "Two", "msg")
    create_notification(db, u.id, "t3", "Three", "msg")

    assert unread_count(db=db, current_user=u).unread_count == 3

    mark_read(str(n1.id), db=db, current_user=u)
    assert unread_count(db=db, current_user=u).unread_count == 2


# ── 6. Mark read — ownership enforced ──

def test_mark_read_rejects_another_users_notification():
    from fastapi import HTTPException
    from core.notifications import create_notification
    from routes.notifications import mark_read
    db = _fresh_db()
    owner = _make_user(db)
    intruder = _make_user(db)

    n = create_notification(db, owner.id, "t", "Title", "msg")

    try:
        mark_read(str(n.id), db=db, current_user=intruder)
        assert False, "must not allow marking another user's notification as read"
    except HTTPException as e:
        assert e.status_code == 404


# ── 7. Mark all read ──

def test_mark_all_read_only_touches_current_users_rows():
    from core.notifications import create_notification
    from routes.notifications import mark_all_read, unread_count
    db = _fresh_db()
    u1 = _make_user(db)
    u2 = _make_user(db)

    create_notification(db, u1.id, "t", "A", "msg")
    create_notification(db, u1.id, "t", "B", "msg", related_id="x")
    create_notification(db, u2.id, "t", "C", "msg")

    mark_all_read(db=db, current_user=u1)

    assert unread_count(db=db, current_user=u1).unread_count == 0
    assert unread_count(db=db, current_user=u2).unread_count == 1, "another user's unread notifications must be untouched"