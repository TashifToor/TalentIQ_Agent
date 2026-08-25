"""
Runs the CrewAI screening committee (core/screening_crew.py) for ONE
candidate at a time, as its own Celery task on the existing bulk-screening
worker infrastructure (core/celery_app.py) — not a new job queue.

Deliberately triggered on-demand (via POST /bulk/applications/{id}/ai-screening)
rather than automatically for every candidate in every bulk batch: running a
4-agent LLM crew for every CV in a 25-candidate batch would be expensive and
slow, and the product spec explicitly asks for an explicit "Run AI Analysis"
action rather than always-on analysis. The Celery/queueing architecture this
task runs on is identical to run_bulk_screening's, so wiring it into an
auto-chained per-candidate flow later is a small change, not a rewrite.

A single candidate's failure here can NEVER affect run_bulk_screening or any
other candidate's ai_screening_status — this task only ever touches its own
Application row.
"""
import json
import logging
import time
from datetime import datetime, timezone

from core.celery_app import celery_app

logger = logging.getLogger("talentiq.crew_screening_task")


@celery_app.task(bind=True, name="tasks.crew_screening_task.run_candidate_ai_screening", max_retries=0)
def run_candidate_ai_screening(self, application_id: str):
    # Imported inside the task (not at module load) so this file can be
    # imported for inspection/tests without requiring a live DB connection.
    from models.database import session_local
    from models.job import Job
    from models.application import Application
    from models.user import User
    from models.interview import InterviewSession, InterviewPosting
    from core.candidate_identity import resolve_application_identity, resolve_interview_status
    from core.org_scope import get_org_scoped_user_ids
    from core.screening_crew import run_screening_crew

    db = session_local()
    start = time.time()
    try:
        app = db.query(Application).filter(Application.id == application_id).first()
        if not app:
            logger.warning(f"[ai-screening] application={application_id} not found — skipping")
            return {"status": "not_found"}

        job = db.query(Job).filter(Job.id == app.job_id).first()
        logger.info(f"[ai-screening] start application={application_id} job={app.job_id}")

        app.ai_screening_status = "analyzing"
        db.commit()

        # Reuse existing candidate identity + interview-session matching —
        # never re-derive this logic here.
        name, email, has_account = resolve_application_identity(db, app)
        org_sessions = []
        if email and job:
            job_owner = db.query(User).filter(User.id == job.hr_user_id).first()
            scoped_ids = get_org_scoped_user_ids(job_owner, db) if job_owner else [job.hr_user_id]
            org_sessions = (
                db.query(InterviewSession)
                .join(InterviewPosting, InterviewSession.posting_id == InterviewPosting.id)
                .filter(InterviewPosting.hr_user_id.in_(scoped_ids))
                .all()
            )
        status_info = resolve_interview_status(app, email, has_account, org_sessions)
        session = status_info["session"]

        interview_summary = None
        if session and session.status == "completed":
            parts = []
            if session.experience_assessment:
                parts.append(session.experience_assessment)
            if session.deep_analysis:
                parts.append(session.deep_analysis)
            if session.assessment_score is not None:
                parts.append(f"Assessment score: {session.assessment_score}%")
            if session.ai_score is not None:
                parts.append(f"Interview score: {session.ai_score}")
            if session.final_verdict:
                parts.append(f"Interview verdict: {session.final_verdict}")
            interview_summary = "\n".join(parts) or None

        result = run_screening_crew(
            resume_text=(app.cv_text or "")[:12000],   # capped — bounds token cost regardless of resume length
            job_title=job.title if job else "",
            job_description=job.description if job else "",
            ats_matched_skills=json.loads(app.matched_skills or "[]"),
            ats_missing_skills=json.loads(app.missing_skills or "[]"),
            interview_summary=interview_summary,
        )

        app.ai_screening_result = result.model_dump_json()
        app.ai_screening_status = "completed"
        app.ai_screening_updated_at = datetime.now(timezone.utc)
        db.commit()

        if job:
            try:
                from core.notifications import notify_org_hr
                notify_org_hr(
                    db, job.hr_user_id, "ai_screening_completed",
                    "AI Screening Committee completed",
                    f"{job.title} · {name or app.candidate_name or 'Candidate'}",
                    related_id=str(app.id), related_type="application",
                    action_url=f"/hr/dashboard?section=candidates&application={app.id}",
                )
            except Exception as e:
                logger.error(f"[ai-screening] notification creation failed application={application_id}: {e}")

        duration = time.time() - start
        logger.info(f"[ai-screening] completed application={application_id} job={app.job_id} duration={duration:.1f}s")
        return {"status": "completed", "duration_seconds": round(duration, 1)}

    except Exception as e:
        # Never let one candidate's failure propagate — mark this row failed
        # and leave its existing deterministic ATS result completely untouched.
        logger.error(f"[ai-screening] FAILED application={application_id}: {type(e).__name__}: {e}")
        try:
            db.rollback()
            app = db.query(Application).filter(Application.id == application_id).first()
            if app:
                app.ai_screening_status = "failed"
                app.ai_screening_updated_at = datetime.now(timezone.utc)
                db.commit()
                job = db.query(Job).filter(Job.id == app.job_id).first()
                if job:
                    try:
                        from core.notifications import notify_org_hr
                        notify_org_hr(
                            db, job.hr_user_id, "screening_failed",
                            "AI Screening Committee failed",
                            f"AI screening for {job.title} could not complete — the existing ATS result is unaffected.",
                            related_id=str(app.id), related_type="application",
                            action_url=f"/hr/dashboard?section=candidates&application={app.id}",
                        )
                    except Exception as notif_err:
                        logger.error(f"[ai-screening] failure-notification creation failed application={application_id}: {notif_err}")
        except Exception as inner:
            logger.error(f"[ai-screening] could not even record failure for application={application_id}: {inner}")
        return {"status": "failed", "error": type(e).__name__}
    finally:
        db.close()