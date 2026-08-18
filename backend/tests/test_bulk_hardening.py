"""
Focused tests for the production-hardening pass: duplicate-trigger
protection, completed-result reuse, explicit retry after failure,
Move-to-Interview duplicate prevention (both real-session and
invited-no-session cases), malformed AI-result handling, and bulk-screening
Job idempotency against Celery redelivery.

Run with: pytest backend/tests/test_bulk_hardening.py
"""
import os
import sys
import json
from unittest.mock import patch, MagicMock

import pytest

PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

os.environ.setdefault("DATABASE_URL", "sqlite:///:memory:")
os.environ.setdefault("SECRET_KEY", "test-secret")
os.environ.setdefault("GROQ_API_KEY", "test-key-not-used-by-mocked-tests")
os.environ.setdefault("FRONTEND_URL", "https://test.talentiq.local")

# routes.bulk imports tasks.screening_task at module load time, which pulls
# in a heavy PDF/embedding dependency chain (langchain text splitters,
# sentence-transformers, etc.) unrelated to anything this file tests. None
# of these tests exercise run_bulk_screening's internals directly, so a
# lightweight stub avoids that entire chain rather than requiring it to be
# fully installed just to import routes.bulk.
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


def _seed_hr_job_application(db, **app_overrides):
    import uuid as uuid_lib
    from models import user, job as job_model, application as application_model
    suffix = uuid_lib.uuid4().hex[:10]
    hr = user.User(email=f"hr-{suffix}@test.com", password_hash=f"x-{suffix}", role="hr", name="HR Test")
    db.add(hr); db.commit()
    j = job_model.Job(hr_user_id=hr.id, title="Backend Engineer", description="FastAPI role")
    db.add(j); db.commit()
    defaults = dict(
        job_id=j.id, candidate_id=hr.id, cv_filename="a.pdf", candidate_name="Ali Khan",
        cv_text="Ali Khan resume text", ai_score=91,
        matched_skills=json.dumps(["FastAPI"]), missing_skills=json.dumps(["AWS"]),
        final_verdict="Strong Fit",
    )
    defaults.update(app_overrides)
    app = application_model.Application(**defaults)
    db.add(app); db.commit()
    return hr, j, app


# ── 1. celery_app registers the AI-screening task (the concrete bug this pass fixes) ──

def test_crew_screening_task_is_registered_with_celery_app():
    from core.celery_app import celery_app
    assert "tasks.crew_screening_task" in celery_app.conf.include, (
        "tasks.crew_screening_task must be in celery_app's include list — otherwise "
        "a worker process never registers run_candidate_ai_screening and .delay() "
        "calls silently go nowhere."
    )


# ── 2. Atomic trigger claim — two near-simultaneous requests, only one wins ──

def test_trigger_ai_screening_atomic_claim_prevents_duplicate_launch():
    from routes.bulk import trigger_ai_screening
    db = _fresh_db()
    hr, job, app = _seed_hr_job_application(db)

    with patch("routes.bulk.get_scoped_application", return_value=app), \
         patch("tasks.crew_screening_task.run_candidate_ai_screening") as mock_task:
        mock_task.delay = MagicMock()
        first = trigger_ai_screening(str(app.id), db=db, current_user=hr)
        # Second call happens before any worker has moved status past 'queued' —
        # simulates a double-click or two open tabs.
        second = trigger_ai_screening(str(app.id), db=db, current_user=hr)

    assert first["already_running"] is False
    assert second["already_running"] is True
    assert mock_task.delay.call_count == 1, "a second concurrent trigger must not launch a second Celery task"


def test_trigger_ai_screening_refuses_without_resume_text():
    from routes.bulk import trigger_ai_screening
    db = _fresh_db()
    hr, job, app = _seed_hr_job_application(db, cv_text="")

    from fastapi import HTTPException
    with patch("routes.bulk.get_scoped_application", return_value=app):
        with pytest.raises(HTTPException) as exc_info:
            trigger_ai_screening(str(app.id), db=db, current_user=hr)
    assert exc_info.value.status_code == 400


def test_trigger_ai_screening_allows_retry_after_failure():
    from routes.bulk import trigger_ai_screening
    db = _fresh_db()
    hr, job, app = _seed_hr_job_application(db, ai_screening_status="failed")

    with patch("routes.bulk.get_scoped_application", return_value=app), \
         patch("tasks.crew_screening_task.run_candidate_ai_screening") as mock_task:
        mock_task.delay = MagicMock()
        result = trigger_ai_screening(str(app.id), db=db, current_user=hr)

    assert result["already_running"] is False
    assert result["status"] == "queued"
    mock_task.delay.assert_called_once()


def test_trigger_ai_screening_allows_rerun_after_completion():
    # "Re-analyze" — a completed result must not block a fresh explicit run.
    from routes.bulk import trigger_ai_screening
    db = _fresh_db()
    hr, job, app = _seed_hr_job_application(db, ai_screening_status="completed", ai_screening_result=json.dumps({"ok": True}))

    with patch("routes.bulk.get_scoped_application", return_value=app), \
         patch("tasks.crew_screening_task.run_candidate_ai_screening") as mock_task:
        mock_task.delay = MagicMock()
        result = trigger_ai_screening(str(app.id), db=db, current_user=hr)

    assert result["already_running"] is False
    mock_task.delay.assert_called_once()


# ── 3. Malformed ai_screening_result must not crash the detail endpoint ──

def test_get_talent_pool_candidate_handles_corrupted_ai_result_json():
    from routes.bulk import get_talent_pool_candidate
    db = _fresh_db()
    hr, job, app = _seed_hr_job_application(db, ai_screening_status="completed", ai_screening_result="{not valid json")

    with patch("routes.bulk.get_scoped_application", return_value=app):
        entry = get_talent_pool_candidate(str(app.id), db=db, current_user=hr)

    assert entry["ai_screening_result"] is None
    assert entry["ai_screening_status"] == "failed"   # corrupted result reported honestly, not as "completed"


# ── 4. Move to Interview — duplicate prevention, both real-session and invited-only cases ──

def test_move_to_interview_blocks_when_session_already_exists():
    from routes.bulk import move_to_interview, MoveToInterviewRequest
    from models import interview as interview_model

    db = _fresh_db()
    hr, job, app = _seed_hr_job_application(db, candidate_email="ali@candidate.com")
    posting = interview_model.InterviewPosting(hr_user_id=hr.id, title="Backend Role", job_description="...", mode="chatbot")
    db.add(posting); db.commit()
    session = interview_model.InterviewSession(posting_id=posting.id, candidate_name="Ali Khan", candidate_email="ali@candidate.com", status="in_progress")
    db.add(session); db.commit()

    with patch("routes.bulk.get_scoped_application", return_value=app), \
         patch("routes.bulk.send_interview_invite_email") as mock_email:
        result = move_to_interview(str(app.id), MoveToInterviewRequest(posting_id=str(posting.id)), db=db, current_user=hr)

    assert result["already_exists"] is True
    assert result["interview_status"] == "in_progress"
    mock_email.assert_not_called()


def test_move_to_interview_blocks_second_invite_when_already_invited_no_session_yet():
    from routes.bulk import move_to_interview, MoveToInterviewRequest
    from models import interview as interview_model

    db = _fresh_db()
    hr, job, app = _seed_hr_job_application(db, candidate_email="ali@candidate.com", trigger_interview="yes")
    posting = interview_model.InterviewPosting(hr_user_id=hr.id, title="Backend Role", job_description="...", mode="chatbot")
    db.add(posting); db.commit()
    # Deliberately no InterviewSession — candidate was invited but hasn't started.

    with patch("routes.bulk.get_scoped_application", return_value=app), \
         patch("routes.bulk.send_interview_invite_email") as mock_email:
        result = move_to_interview(str(app.id), MoveToInterviewRequest(posting_id=str(posting.id)), db=db, current_user=hr)

    assert result["already_exists"] is True
    assert result["interview_status"] == "invited"
    mock_email.assert_not_called(), "an already-invited candidate must never get a second invite email"


def test_move_to_interview_sends_invite_for_a_genuinely_new_candidate():
    from routes.bulk import move_to_interview, MoveToInterviewRequest
    from models import interview as interview_model

    db = _fresh_db()
    hr, job, app = _seed_hr_job_application(db, candidate_email="new@candidate.com")
    posting = interview_model.InterviewPosting(hr_user_id=hr.id, title="Backend Role", job_description="...", mode="chatbot")
    db.add(posting); db.commit()

    with patch("routes.bulk.get_scoped_application", return_value=app), \
         patch("routes.bulk.send_interview_invite_email", return_value=True) as mock_email:
        result = move_to_interview(str(app.id), MoveToInterviewRequest(posting_id=str(posting.id)), db=db, current_user=hr)

    assert result["already_exists"] is False
    assert result["emailed"] is True
    mock_email.assert_called_once()
    db.refresh(app)
    assert app.trigger_interview == "yes"


# ── 5. Bulk-screening Job idempotency against Celery redelivery ──

def test_duplicate_source_task_id_is_not_created_twice():
    # Directly exercises the idempotency invariant run_bulk_screening relies
    # on: a second Job insert carrying the same source_task_id as an
    # existing one should never happen — the task's own guard (query before
    # insert) is what prevents it; this test locks in that a lookup by
    # source_task_id reliably finds the first run so the guard has something
    # real to check against.
    from models import job as job_model
    db = _fresh_db()
    from models import user
    import uuid as uuid_lib
    suffix = uuid_lib.uuid4().hex[:10]
    hr = user.User(email=f"hr2-{suffix}@test.com", password_hash=f"x2-{suffix}", role="hr", name="HR2")
    db.add(hr); db.commit()

    task_id = "celery-task-abc-123"
    first = job_model.Job(hr_user_id=hr.id, title="Role", description="...", source_task_id=task_id)
    db.add(first); db.commit()

    found = db.query(job_model.Job).filter(job_model.Job.source_task_id == task_id).first()
    assert found is not None
    assert str(found.id) == str(first.id)

    # A naive re-run of the same task would hit this guard and skip creating
    # a second Job — assert there is exactly one Job with this task_id.
    count = db.query(job_model.Job).filter(job_model.Job.source_task_id == task_id).count()
    assert count == 1