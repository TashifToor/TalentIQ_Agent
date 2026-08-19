"""
Focused tests for the final integration pass: the real, persistent
Application -> InterviewPosting relationship (invited_posting_id), and the
Move-to-Interview / Talent Pool behavior that depends on it.

Run with: pytest backend/tests/test_application_posting_link.py
"""
import os
import sys
import json
import uuid as uuid_lib
from unittest.mock import patch, MagicMock

import pytest

PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

os.environ.setdefault("DATABASE_URL", "sqlite:///:memory:")
os.environ.setdefault("SECRET_KEY", "test-secret")
os.environ.setdefault("GROQ_API_KEY", "test-key-not-used-by-mocked-tests")
os.environ.setdefault("FRONTEND_URL", "https://test.talentiq.local")

# Same rationale as tests/test_bulk_hardening.py — avoid pulling in the
# unrelated heavy PDF/embedding dependency chain just to import routes.bulk.
if "tasks.screening_task" not in sys.modules:
    import types
    stub = types.ModuleType("tasks.screening_task")
    stub.run_bulk_screening = MagicMock(name="run_bulk_screening_stub")
    sys.modules["tasks.screening_task"] = stub


def _fresh_db():
    from models.database import Base, engine, session_local
    from models import organization, user, job as job_model, application as application_model, interview, chat, practice, scan_history
    Base.metadata.create_all(bind=engine)
    return session_local()


def _seed(db, **app_overrides):
    from models import user, job as job_model, application as application_model, interview
    suffix = uuid_lib.uuid4().hex[:10]
    hr = user.User(email=f"hr-{suffix}@test.com", password_hash=f"x-{suffix}", role="hr", name="HR Test")
    db.add(hr); db.commit()
    j = job_model.Job(hr_user_id=hr.id, title="Backend Engineer", description="FastAPI role")
    db.add(j); db.commit()
    posting = interview.InterviewPosting(hr_user_id=hr.id, title="Backend Role", job_description="...", mode="chatbot")
    db.add(posting); db.commit()
    defaults = dict(
        job_id=j.id, candidate_id=hr.id, cv_filename="a.pdf", candidate_name="Ali Khan",
        candidate_email="ali@candidate.com", cv_text="Ali Khan resume text", ai_score=91,
        matched_skills=json.dumps(["FastAPI"]), missing_skills=json.dumps(["AWS"]),
        final_verdict="Strong Fit",
    )
    defaults.update(app_overrides)
    app = application_model.Application(**defaults)
    db.add(app); db.commit()
    return hr, j, posting, app


# ── 1. Move-to-Interview persists the real relationship ──

def test_move_to_interview_persists_invited_posting_id():
    from routes.bulk import move_to_interview, MoveToInterviewRequest
    db = _fresh_db()
    hr, job, posting, app = _seed(db)

    with patch("routes.bulk.get_scoped_application", return_value=app), \
         patch("routes.bulk.send_interview_invite_email", return_value=True):
        result = move_to_interview(str(app.id), MoveToInterviewRequest(posting_id=str(posting.id)), db=db, current_user=hr)

    assert result["already_exists"] is False
    assert result["public_link"] == f"https://test.talentiq.local/interview/{posting.public_slug}"
    db.refresh(app)
    assert app.invited_posting_id == posting.id


# ── 2. An already-invited candidate (no session started) returns the SAME real link — not "link unavailable" ──

def test_move_to_interview_returns_exact_link_for_already_invited_candidate():
    from routes.bulk import move_to_interview, MoveToInterviewRequest
    db = _fresh_db()
    hr, job, posting, app = _seed(db, trigger_interview="yes", invited_posting_id=None)
    app.invited_posting_id = posting.id
    db.commit()

    with patch("routes.bulk.get_scoped_application", return_value=app), \
         patch("routes.bulk.send_interview_invite_email") as mock_email:
        result = move_to_interview(str(app.id), MoveToInterviewRequest(posting_id=str(posting.id)), db=db, current_user=hr)

    assert result["already_exists"] is True
    assert result["interview_status"] == "invited"
    assert result["public_link"] == f"https://test.talentiq.local/interview/{posting.public_slug}", (
        "an already-invited candidate must get back their EXACT real posting link, not None"
    )
    assert result["posting_title"] == posting.title
    mock_email.assert_not_called()


# ── 3. Talent Pool / candidate detail surfaces the exact interview_posting ──

def test_build_candidate_entry_resolves_interview_posting_for_invited_candidate():
    from routes.bulk import build_candidate_entry, get_scoped_org_sessions, get_scoped_org_postings
    from core.org_scope import get_org_scoped_user_ids

    db = _fresh_db()
    hr, job, posting, app = _seed(db, trigger_interview="yes", invited_posting_id=None)
    app.invited_posting_id = posting.id
    db.commit()

    scoped_ids = get_org_scoped_user_ids(hr, db)
    org_sessions = get_scoped_org_sessions(db, scoped_ids)
    org_postings = get_scoped_org_postings(db, scoped_ids)
    entry = build_candidate_entry(db, app, job, org_sessions, org_postings)

    assert entry["interview_status"] == "invited"
    assert entry["interview_posting"] is not None
    assert entry["interview_posting"]["title"] == posting.title
    assert entry["interview_posting"]["public_link"].endswith(posting.public_slug)


def test_build_candidate_entry_resolves_interview_posting_from_real_session_when_one_exists():
    from routes.bulk import build_candidate_entry, get_scoped_org_sessions, get_scoped_org_postings
    from core.org_scope import get_org_scoped_user_ids
    from models import interview as interview_model

    db = _fresh_db()
    hr, job, posting, app = _seed(db, trigger_interview="yes", invited_posting_id=None)
    app.invited_posting_id = posting.id
    db.commit()
    session = interview_model.InterviewSession(posting_id=posting.id, candidate_name="Ali Khan", candidate_email="ali@candidate.com", status="in_progress")
    db.add(session); db.commit()

    scoped_ids = get_org_scoped_user_ids(hr, db)
    org_sessions = get_scoped_org_sessions(db, scoped_ids)
    org_postings = get_scoped_org_postings(db, scoped_ids)
    entry = build_candidate_entry(db, app, job, org_sessions, org_postings)

    assert entry["interview_status"] == "in_progress"
    assert entry["interview_posting"]["title"] == posting.title


def test_build_candidate_entry_interview_posting_is_none_when_never_invited():
    from routes.bulk import build_candidate_entry, get_scoped_org_sessions, get_scoped_org_postings
    from core.org_scope import get_org_scoped_user_ids

    db = _fresh_db()
    hr, job, posting, app = _seed(db)   # trigger_interview defaults to "no", invited_posting_id None

    scoped_ids = get_org_scoped_user_ids(hr, db)
    org_sessions = get_scoped_org_sessions(db, scoped_ids)
    org_postings = get_scoped_org_postings(db, scoped_ids)
    entry = build_candidate_entry(db, app, job, org_sessions, org_postings)

    assert entry["interview_status"] == "not_invited"
    assert entry["interview_posting"] is None


# ── 4. Organization isolation: invited_posting_id resolution must never leak another org's posting ──

def test_interview_posting_resolution_respects_org_scoping():
    from routes.bulk import build_candidate_entry, get_scoped_org_sessions, get_scoped_org_postings
    from core.org_scope import get_org_scoped_user_ids
    from models import user, job as job_model, application as application_model, interview as interview_model

    db = _fresh_db()
    # Org A owns the application; Org B owns the posting it happens to (invalidly) reference.
    suffix = uuid_lib.uuid4().hex[:10]
    org_a_hr = user.User(email=f"a-{suffix}@test.com", password_hash=f"pa-{suffix}", role="hr", name="Org A HR")
    org_b_hr = user.User(email=f"b-{suffix}@test.com", password_hash=f"pb-{suffix}", role="hr", name="Org B HR")
    db.add_all([org_a_hr, org_b_hr]); db.commit()

    job_a = job_model.Job(hr_user_id=org_a_hr.id, title="Org A Role", description="...")
    db.add(job_a); db.commit()
    posting_b = interview_model.InterviewPosting(hr_user_id=org_b_hr.id, title="Org B Posting", job_description="...", mode="chatbot")
    db.add(posting_b); db.commit()

    app = application_model.Application(
        job_id=job_a.id, candidate_id=org_a_hr.id, cv_filename="x.pdf", ai_score=50,
        trigger_interview="yes", invited_posting_id=posting_b.id,   # should never actually happen via the real endpoint — this simulates a corrupted/cross-org row
    )
    db.add(app); db.commit()

    scoped_ids = get_org_scoped_user_ids(org_a_hr, db)   # Org A's own scope only
    org_sessions = get_scoped_org_sessions(db, scoped_ids)
    org_postings = get_scoped_org_postings(db, scoped_ids)   # must NOT include posting_b
    entry = build_candidate_entry(db, app, job_a, org_sessions, org_postings)

    assert entry["interview_posting"] is None, "a posting outside the org's own scope must never be resolved/leaked"


def test_move_to_interview_rejects_posting_from_another_organization():
    from routes.bulk import move_to_interview, MoveToInterviewRequest
    from models import user, job as job_model, application as application_model, interview as interview_model
    from fastapi import HTTPException

    db = _fresh_db()
    suffix = uuid_lib.uuid4().hex[:10]
    org_a_hr = user.User(email=f"a2-{suffix}@test.com", password_hash=f"pa2-{suffix}", role="hr", name="Org A HR")
    org_b_hr = user.User(email=f"b2-{suffix}@test.com", password_hash=f"pb2-{suffix}", role="hr", name="Org B HR")
    db.add_all([org_a_hr, org_b_hr]); db.commit()

    job_a = job_model.Job(hr_user_id=org_a_hr.id, title="Org A Role", description="...")
    db.add(job_a); db.commit()
    app_a = application_model.Application(job_id=job_a.id, candidate_id=org_a_hr.id, cv_filename="x.pdf", ai_score=50, candidate_email="c@test.com")
    db.add(app_a); db.commit()

    posting_b = interview_model.InterviewPosting(hr_user_id=org_b_hr.id, title="Org B Posting", job_description="...", mode="chatbot")
    db.add(posting_b); db.commit()

    with patch("routes.bulk.get_scoped_application", return_value=app_a):
        with pytest.raises(HTTPException) as exc_info:
            move_to_interview(str(app_a.id), MoveToInterviewRequest(posting_id=str(posting_b.id)), db=db, current_user=org_a_hr)
    assert exc_info.value.status_code == 404


# ── 5. Existing applications with no invited_posting_id remain fully valid ──

def test_existing_application_without_invited_posting_id_is_unaffected():
    from routes.bulk import build_candidate_entry, get_scoped_org_sessions, get_scoped_org_postings
    from core.org_scope import get_org_scoped_user_ids

    db = _fresh_db()
    hr, job, posting, app = _seed(db)   # simulates a pre-existing row created before this migration
    assert app.invited_posting_id is None

    scoped_ids = get_org_scoped_user_ids(hr, db)
    org_sessions = get_scoped_org_sessions(db, scoped_ids)
    org_postings = get_scoped_org_postings(db, scoped_ids)
    entry = build_candidate_entry(db, app, job, org_sessions, org_postings)   # must not raise
    assert entry["interview_posting"] is None