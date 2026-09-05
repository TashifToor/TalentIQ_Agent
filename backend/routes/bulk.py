import os
import re
import json
import shutil
import smtplib
import zipfile
import tempfile
import logging
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from utils.email_template import render_email
from datetime import datetime

from fastapi import APIRouter, UploadFile, File, Form, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import update
from celery.result import AsyncResult

from models.database import get_db
from middleware.auth import get_current_user
from models.user import User
from models.job import Job
from models.application import Application
from models.interview import InterviewPosting, InterviewSession
from core.celery_app import celery_app
from core.redis_client import check_rate_limit
from core.org_scope import get_org_scoped_user_ids
from core.talent_ranking import compute_candidate_fit
from core.candidate_identity import resolve_application_identity, resolve_interview_status
from core.assessment import score_assessment
from core.decision_center import build_decision_email
from utils.email_utils import normalize_email
from tasks.screening_task import run_bulk_screening
from pydantic import BaseModel
from typing import List, Optional, Literal

logger = logging.getLogger("talentiq.bulk")

router = APIRouter(prefix="/bulk", tags=["Bulk Screening"])
MAX_CVS = 25
MAX_ZIP_SIZE_MB = 50
MAX_ZIP_SIZE_BYTES = MAX_ZIP_SIZE_MB * 1024 * 1024
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:3000")

UPLOAD_TMP = os.path.join(os.path.dirname(__file__), "..", "data", "bulk_tmp")
os.makedirs(UPLOAD_TMP, exist_ok=True)

MAIL_USERNAME = os.getenv("MAIL_USERNAME", "")
MAIL_PASSWORD = os.getenv("MAIL_PASSWORD", "")
MAIL_FROM     = os.getenv("MAIL_FROM", MAIL_USERNAME)
MAIL_SERVER   = os.getenv("MAIL_SERVER", "smtp.gmail.com")
MAIL_PORT     = int(os.getenv("MAIL_PORT", "587"))


def require_hr(user: User):
    if (user.role or "").lower() != "hr":
        raise HTTPException(status_code=403, detail="Only HR users can do this.")
    return user


def get_scoped_application(db: Session, application_id: str, current_user: User) -> Application:
    """
    Ownership check for every per-application action below: the Application
    must belong to a Job owned by this HR user's org (same
    get_org_scoped_user_ids pattern used everywhere else HR-owned data is
    queried). 404s rather than 403s so an application ID from another org
    can't even be confirmed to exist.
    """
    scoped_ids = get_org_scoped_user_ids(current_user, db)
    app = (
        db.query(Application)
        .join(Job, Application.job_id == Job.id)
        .filter(Application.id == application_id, Job.hr_user_id.in_(scoped_ids))
        .first()
    )
    if not app:
        raise HTTPException(status_code=404, detail="Application not found.")
    return app


def build_candidate_entry(db: Session, app: Application, job: Job | None, org_sessions: list, org_postings: dict | None = None) -> dict:
    """
    The single source of truth for "everything we know about this
    candidate" — used by the Bulk Screening results list, Talent Pool list,
    and the Talent Pool candidate detail view, so all three always agree
    (no second interpretation of the same Application row).

    org_sessions and org_postings must be prefetched once per request by the
    caller (not re-queried per candidate) to avoid an N+1 pattern.
    org_postings is optional only for callers that don't need
    interview_posting resolved (none currently — kept optional so this
    signature change can't break a caller that forgets to pass it; it just
    degrades interview_posting to None instead of raising).
    """
    org_postings = org_postings or {}
    name, email, has_linked_account = resolve_application_identity(db, app)
    status_info = resolve_interview_status(app, email, has_linked_account, org_sessions)
    session = status_info["session"]

    # Resolve the real posting this candidate is actually tied to — from the
    # matched session when one exists (they're actually interviewing), else
    # from the persistent invited_posting_id set by move_to_interview() when
    # they were invited but haven't started. Never inferred any other way.
    posting_obj = None
    if session:
        posting_obj = org_postings.get(session.posting_id)
    elif app.invited_posting_id:
        posting_obj = org_postings.get(app.invited_posting_id)
    interview_posting = None
    if posting_obj:
        interview_posting = {
            "id": str(posting_obj.id),
            "title": posting_obj.title,
            "public_link": f"{FRONTEND_URL}/interview/{posting_obj.public_slug}",
        }

    matched = json.loads(app.matched_skills or "[]")
    missing = json.loads(app.missing_skills or "[]")
    total = len(matched) + len(missing)
    skill_match_pct = round((len(matched) / total) * 100) if total > 0 else None

    # This ATS score was computed directly against `job`'s own description —
    # by construction, never a stale/unrelated scan — so exact_job_match=True
    # always here (unlike the interview-posting ranking path, which pulls a
    # candidate's separately-run CV Optimizer history and must caveat it).
    resume_profile = {
        "resume_available": True,
        "ats_score": app.ai_score,
        "matched_skills": matched,
        "missing_skills": missing,
        "skill_match_pct": skill_match_pct,
        "resume_verdict": app.final_verdict,
        "resume_role_title": job.title if job else None,
        "resume_scanned_at": app.screened_at.isoformat() if app.screened_at else None,
        "exact_job_match": True,
    }

    fit = compute_candidate_fit(
        ai_score=session.ai_score if session else None,
        assessment_score=session.assessment_score if session else None,
        final_verdict=(session.final_verdict if session else None) or app.final_verdict,
        assessment_breakdown=None,
        proctoring_flag_count=len(json.loads(session.assessment_flags or "[]")) if session else 0,
        status=session.status if session else "not_started",
        resume_profile=resume_profile,
    )

    return {
        "id": str(app.id),
        "job_id": str(app.job_id),
        "job_title": job.title if job else None,
        "candidate_name": name,
        "candidate_email": email,
        "has_linked_account": has_linked_account,
        "cv_filename": app.cv_filename,
        "deep_analysis": app.deep_analysis,
        "is_shortlisted": app.is_shortlisted,          # "pending" | "yes" | "no"
        "trigger_interview": app.trigger_interview == "yes",
        "decision": app.decision,                          # pending | accepted | rejected
        "decision_at": app.decision_at.isoformat() if app.decision_at else None,
        "notification_status": app.notification_status,    # not_sent | sending | sent | failed
        "notification_sent_at": app.notification_sent_at.isoformat() if app.notification_sent_at else None,
        "interview_status": status_info["status"],      # unknown | not_invited | invited | in_progress | completed
        "interview_session_id": str(session.id) if session else None,
        "interview_posting": interview_posting,          # {id, title, public_link} — the exact posting, when resolvable
        "has_report": bool(session and session.status == "completed"),
        "created_at": app.created_at.isoformat() if app.created_at else None,
        "screened_at": app.screened_at.isoformat() if app.screened_at else None,
        **fit,   # fit_score, fit_tier, recommendation, ats_score, matched_skills, missing_skills,
                 # skill_match_pct, resume_verdict, resume_role_title, resume_scanned_at,
                 # resume_matches_current_context, evidence
    }


def extract_candidate_name(filename: str, cv_text: str = "") -> str:
    """Extract real name from filename or CV text."""
    # 1. Try CV text — look for name pattern in first 300 chars
    if cv_text:
        first_block = cv_text[:300]
        lines = [l.strip() for l in first_block.split('\n') if l.strip()]
        for line in lines[:5]:
            # Skip lines with emails, phones, URLs, or too many words
            if any(x in line.lower() for x in ['@', 'http', 'linkedin', 'github', 'phone', 'email', 'address']):
                continue
            words = line.split()
            if 2 <= len(words) <= 4 and all(w[0].isupper() for w in words if w.isalpha()):
                return line

    # 2. Parse filename
    name = os.path.splitext(filename)[0]
    # Remove common suffixes
    name = re.sub(r'[_\-](cv|resume|application|updated|new|final|2024|2025|2026)', '', name, flags=re.I)
    name = re.sub(r'[_\-]', ' ', name).strip()
    # Capitalize
    words = name.split()
    if 2 <= len(words) <= 4:
        return ' '.join(w.capitalize() for w in words)

    return name.title() or filename


def send_screening_complete_email(hr_email: str, hr_name: str, job_title: str, total: int, top_candidates: list):
    if not MAIL_PASSWORD or MAIL_PASSWORD == "your_gmail_app_password_here":
        print(f"[Email] Skipping email (not configured). HR: {hr_email}, Job: {job_title}")
        return

    top_rows = ""
    for i, c in enumerate(top_candidates[:5], 1):
        name = c.get("candidate_name") or c.get("filename", f"Candidate {i}")
        score = c.get("ai_score", 0)
        verdict = c.get("final_verdict", "")
        color = "#0e8f6b" if score >= 75 else "#b8862c" if score >= 55 else "#c0392b"
        top_rows += f"""
        <tr>
          <td style="padding:10px 12px;border-bottom:1px solid #e5e2d9;color:#8a8678;font-size:12px">#{i}</td>
          <td style="padding:10px 12px;border-bottom:1px solid #e5e2d9;color:#1a1815;font-size:13px;font-weight:600">{name}</td>
          <td style="padding:10px 12px;border-bottom:1px solid #e5e2d9;font-size:14px;font-weight:700;color:{color}">{score}</td>
          <td style="padding:10px 12px;border-bottom:1px solid #e5e2d9;color:#8a8678;font-size:11px">{verdict}</td>
        </tr>"""

    results_table = f"""
        <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;background:#f4f3ef;border-radius:8px;overflow:hidden;border:1px solid #e5e2d9;margin:16px 0;">
          <thead>
            <tr style="background:#efece3">
              <th style="padding:10px 12px;text-align:left;font-size:10px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#8a8678">#</th>
              <th style="padding:10px 12px;text-align:left;font-size:10px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#8a8678">Candidate</th>
              <th style="padding:10px 12px;text-align:left;font-size:10px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#8a8678">Score</th>
              <th style="padding:10px 12px;text-align:left;font-size:10px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#8a8678">Verdict</th>
            </tr>
          </thead>
          <tbody>{top_rows}</tbody>
        </table>"""

    html = render_email(
        heading="Screening complete",
        subheading=job_title,
        preheader=f"Your bulk screening of {total} CV(s) for {job_title} is complete.",
        body_html=f"<p style=\"margin:0;\">Hi {hr_name}, your bulk screening of <strong>{total} CV(s)</strong> is complete.</p>{results_table}",
        cta_label="View Full Results",
        cta_url=f"{FRONTEND_URL}/hr/dashboard",
    )

    msg = MIMEMultipart("alternative")
    msg["Subject"] = f"TalentIQ — Screening complete: {job_title} ({total} CVs)"
    msg["From"]    = MAIL_FROM
    msg["To"]      = hr_email
    msg.attach(MIMEText(html, "html"))

    try:
        with smtplib.SMTP(MAIL_SERVER, MAIL_PORT) as server:
            server.starttls()
            server.login(MAIL_USERNAME, MAIL_PASSWORD)
            server.sendmail(MAIL_FROM, hr_email, msg.as_string())
        print(f"[Email] Sent to {hr_email}")
    except Exception as e:
        print(f"[Email] Failed: {e}")


# NOTE: save_screening_to_db() previously lived here but was dead code — the
# actual save-to-DB happens inside tasks/screening_task.py's Celery task.
# Removed rather than left to rot next to the real implementation.


@router.post("/screen")
async def bulk_screen(
    job_description: str = Form(...),
    job_title: str = Form(""),
    top_n: int = Form(3),
    zip_file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    require_hr(current_user)

    allowed, wait_seconds = check_rate_limit(f"bulk:{current_user.id}", cooldown_seconds=30)
    if not allowed:
        raise HTTPException(status_code=429, detail=f"Please wait {wait_seconds}s before starting another bulk screening.")

    if not job_description.strip():
        raise HTTPException(status_code=400, detail="job_description is required.")
    if not zip_file.filename.lower().endswith((".zip", ".pdf")):
        raise HTTPException(status_code=400, detail="Upload a .zip or .pdf file.")

    zip_contents = await zip_file.read()
    if len(zip_contents) > MAX_ZIP_SIZE_BYTES:
        raise HTTPException(status_code=413, detail=f"File too large. Maximum size is {MAX_ZIP_SIZE_MB}MB.")
    if len(zip_contents) == 0:
        raise HTTPException(status_code=400, detail="Empty file.")

    task_tmp = tempfile.mkdtemp(dir=UPLOAD_TMP)

    try:
        if zip_file.filename.lower().endswith(".pdf"):
            name = os.path.splitext(zip_file.filename)[0]
            pdf_path = os.path.join(task_tmp, zip_file.filename)
            with open(pdf_path, "wb") as f:
                f.write(zip_contents)
            pdf_paths = [pdf_path]
            candidate_names = [name]
        else:
            zip_path = os.path.join(task_tmp, "upload.zip")
            with open(zip_path, "wb") as f:
                f.write(zip_contents)
            extract_dir = os.path.join(task_tmp, "extracted")
            os.makedirs(extract_dir, exist_ok=True)
            try:
                with zipfile.ZipFile(zip_path, "r") as z:
                    z.extractall(extract_dir)
            except zipfile.BadZipFile:
                shutil.rmtree(task_tmp)
                raise HTTPException(status_code=400, detail="Invalid zip file.")

            pdf_paths, candidate_names = [], []
            for root, _, files in os.walk(extract_dir):
                for fn in files:
                    if fn.lower().endswith(".pdf"):
                        pdf_paths.append(os.path.join(root, fn))
                        candidate_names.append(os.path.splitext(fn)[0])

            if not pdf_paths:
                shutil.rmtree(task_tmp)
                raise HTTPException(status_code=400, detail="No PDFs found in zip.")
            if len(pdf_paths) > MAX_CVS:
                shutil.rmtree(task_tmp)
                raise HTTPException(status_code=400, detail=f"Max {MAX_CVS} CVs allowed.")

        top_n = max(1, min(top_n, MAX_CVS))
        full_jd = f"Job Title: {job_title}\n\n{job_description}" if job_title else job_description

        task = run_bulk_screening.delay(
            full_jd, top_n, pdf_paths, candidate_names,
            hr_user_id=current_user.id,
            hr_email=current_user.email,
            hr_name=current_user.name or "HR Manager",
            job_title=job_title or "Screening",
            job_description_raw=job_description,
        )

        return {
            "task_id": task.id,
            "status": "queued",
            "total_cvs": len(pdf_paths),
            "message": f"Screening {len(pdf_paths)} CV(s) started.",
        }

    except HTTPException:
        raise
    except Exception as e:
        shutil.rmtree(task_tmp, ignore_errors=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/status/{task_id}")
def get_task_status(task_id: str, current_user: User = Depends(get_current_user)):
    require_hr(current_user)
    result = AsyncResult(task_id, app=celery_app)

    if result.state == "PENDING":
        return {"task_id": task_id, "state": "pending", "status": "Waiting in queue..."}
    if result.state == "STARTED":
        return {"task_id": task_id, "state": "started", "status": "Starting up..."}
    if result.state == "PROGRESS":
        meta = result.info or {}
        return {
            "task_id": task_id, "state": "progress",
            "current": meta.get("current", 0), "total": meta.get("total", 0),
            "current_name": meta.get("current_name", ""), "status": meta.get("status", "Processing..."),
            "partial_results": meta.get("results", []),
        }
    if result.state == "SUCCESS":
        return {"task_id": task_id, "state": "success", "status": "done", **(result.result or {})}
    if result.state == "FAILURE":
        return {"task_id": task_id, "state": "failure", "status": "Screening failed.", "error": str(result.info)}

    return {"task_id": task_id, "state": result.state, "status": "Unknown state."}


def get_scoped_org_sessions(db: Session, scoped_ids: list) -> list:
    """Every InterviewSession belonging to this org's own postings — fetched
    once per request and reused across all candidates, so matching identity
    to interview status never becomes an N+1 query pattern."""
    return (
        db.query(InterviewSession)
        .join(InterviewPosting, InterviewSession.posting_id == InterviewPosting.id)
        .filter(InterviewPosting.hr_user_id.in_(scoped_ids))
        .order_by(InterviewSession.created_at.desc())
        .all()
    )


def get_scoped_org_postings(db: Session, scoped_ids: list) -> dict:
    """Every InterviewPosting owned by this org, keyed by id — fetched once
    per request so build_candidate_entry can resolve a candidate's exact
    invited/interviewed posting without a query per candidate."""
    postings = db.query(InterviewPosting).filter(InterviewPosting.hr_user_id.in_(scoped_ids)).all()
    return {p.id: p for p in postings}


@router.get("/jobs")
def get_hr_jobs(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """HR ke saare past screening jobs with results (team workspace: sab teammates ke jobs bhi)."""
    require_hr(current_user)
    scoped_ids = get_org_scoped_user_ids(current_user, db)
    jobs = db.query(Job).filter(Job.hr_user_id.in_(scoped_ids)).order_by(Job.created_at.desc()).all()
    org_sessions = get_scoped_org_sessions(db, scoped_ids)
    org_postings = get_scoped_org_postings(db, scoped_ids)

    # One query for every Application across every job — avoids an N+1
    # per-job query, then groups them in Python.
    job_ids = [j.id for j in jobs]
    all_apps = db.query(Application).filter(Application.job_id.in_(job_ids)).all() if job_ids else []
    apps_by_job: dict = {}
    for a in all_apps:
        apps_by_job.setdefault(str(a.job_id), []).append(a)

    result = []
    for job in jobs:
        apps = apps_by_job.get(str(job.id), [])
        result.append({
            "id": str(job.id),
            "title": job.title,
            "description": job.description,
            "created_at": job.created_at.isoformat() if job.created_at else None,
            "total_candidates": len(apps),
            "shortlisted": sum(1 for a in apps if a.is_shortlisted == "yes"),
            "top_score": max((a.ai_score for a in apps), default=0),
            "candidates": [build_candidate_entry(db, a, job, org_sessions, org_postings) for a in sorted(apps, key=lambda x: x.ai_score, reverse=True)]
        })
    return result

# ── Request schemas for the actions below ──
class ApplicationActionRequest(BaseModel):
    action: Literal["shortlist", "reject", "reset"]
    candidate_email: Optional[str] = None   # only stored if the application doesn't already have one


class MoveToInterviewRequest(BaseModel):
    posting_id: str
    candidate_email: Optional[str] = None   # required if the application has no email on file yet


def send_interview_invite_email(candidate_email: str, candidate_name: str, posting_title: str, public_link: str):
    if not MAIL_PASSWORD or MAIL_PASSWORD == "your_gmail_app_password_here":
        print(f"[Email] Skipping invite (not configured). Candidate: {candidate_email}, Posting: {posting_title}")
        return False

    html = render_email(
        heading="You're invited to interview",
        subheading=posting_title,
        preheader=f"You've been invited to complete an AI interview for {posting_title}.",
        body_html=f"<p style=\"margin:0;\">Hi {candidate_name or 'there'}, you've been invited to complete an AI interview for <strong>{posting_title}</strong>.</p>",
        cta_label="Start Interview",
        cta_url=public_link,
    )

    msg = MIMEMultipart("alternative")
    msg["Subject"] = f"You're invited to interview — {posting_title}"
    msg["From"]    = MAIL_FROM
    msg["To"]      = candidate_email
    msg.attach(MIMEText(html, "html"))

    try:
        with smtplib.SMTP(MAIL_SERVER, MAIL_PORT) as server:
            server.starttls()
            server.login(MAIL_USERNAME, MAIL_PASSWORD)
            server.sendmail(MAIL_FROM, candidate_email, msg.as_string())
        print(f"[Email] Interview invite sent to {candidate_email}")
        return True
    except Exception as e:
        print(f"[Email] Invite failed: {e}")
        return False


# ── PATCH /bulk/applications/{id} — shortlist / reject / reset, real backend record ──
@router.patch("/applications/{application_id}")
def update_application(
    application_id: str,
    payload: ApplicationActionRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    require_hr(current_user)
    app = get_scoped_application(db, application_id, current_user)

    app.is_shortlisted = {"shortlist": "yes", "reject": "no", "reset": "pending"}[payload.action]

    if payload.candidate_email and not app.candidate_email:
        app.candidate_email = payload.candidate_email.strip()

    db.commit()
    db.refresh(app)

    scoped_ids = get_org_scoped_user_ids(current_user, db)
    job = db.query(Job).filter(Job.id == app.job_id).first()
    org_sessions = get_scoped_org_sessions(db, scoped_ids)
    org_postings = get_scoped_org_postings(db, scoped_ids)
    return build_candidate_entry(db, app, job, org_sessions, org_postings)


# ── POST /bulk/applications/{id}/move-to-interview — reuses the EXISTING interview posting/link, never a second interview system ──
@router.post("/applications/{application_id}/move-to-interview")
def move_to_interview(
    application_id: str,
    payload: MoveToInterviewRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    require_hr(current_user)
    app = get_scoped_application(db, application_id, current_user)

    scoped_ids = get_org_scoped_user_ids(current_user, db)
    posting = db.query(InterviewPosting).filter(
        InterviewPosting.id == payload.posting_id,
        InterviewPosting.hr_user_id.in_(scoped_ids),
    ).first()
    if not posting:
        raise HTTPException(status_code=404, detail="Interview posting not found.")

    email = (payload.candidate_email or app.candidate_email or "").strip()
    if not email:
        raise HTTPException(status_code=400, detail="This candidate has no email on file — enter one to send an interview invite.")

    # Prevent duplicate invitations: covers a real session (in progress or
    # completed) AND the case where the candidate was already invited but
    # hasn't started yet. The invited_posting_id relationship (set once,
    # below, the first time this succeeds) is what makes the second case
    # possible to answer accurately instead of just "invited, link unknown".
    org_sessions = get_scoped_org_sessions(db, scoped_ids)
    norm = normalize_email(email)
    existing = next((s for s in org_sessions if normalize_email(s.candidate_email) == norm), None)
    if existing:
        existing_posting = db.query(InterviewPosting).filter(InterviewPosting.id == existing.posting_id).first()
        return {
            "already_exists": True,
            "public_link": f"{FRONTEND_URL}/interview/{existing_posting.public_slug}" if existing_posting else None,
            "interview_status": "completed" if existing.status == "completed" else "in_progress",
            "posting_title": existing_posting.title if existing_posting else None,
            "emailed": False,
            "candidate_email": email,
        }
    if app.trigger_interview == "yes":
        # Already invited, hasn't started a session yet. invited_posting_id
        # (set on the original successful invite, verified against this
        # org — never inferred) lets us return the EXACT real link instead
        # of the previous honest-but-unhelpful "link unknown".
        invited_posting = (
            db.query(InterviewPosting)
            .filter(InterviewPosting.id == app.invited_posting_id, InterviewPosting.hr_user_id.in_(scoped_ids))
            .first()
            if app.invited_posting_id else None
        )
        return {
            "already_exists": True,
            "public_link": f"{FRONTEND_URL}/interview/{invited_posting.public_slug}" if invited_posting else None,
            "interview_status": "invited",
            "posting_title": invited_posting.title if invited_posting else None,
            "emailed": False,
            "candidate_email": email,
        }

    if not app.candidate_email:
        app.candidate_email = email

    app.trigger_interview = "yes"
    app.invited_posting_id = posting.id   # the real, persistent link — set once, never inferred
    app.interview_invited_at = datetime.utcnow()  # gives the candidate Timeline a real date for this step
    if app.is_shortlisted == "pending":
        app.is_shortlisted = "yes"
    db.commit()

    public_link = f"{FRONTEND_URL}/interview/{posting.public_slug}"
    name, _, _ = resolve_application_identity(db, app)
    emailed = send_interview_invite_email(email, name or "", posting.title, public_link)

    try:
        from utils.email_utils import normalize_email as _norm
        candidate_user = db.query(User).filter(
            User.normalized_email == _norm(email), User.role == "candidate"
        ).first()
        if candidate_user:
            from core.notifications import create_notification
            create_notification(
                db, candidate_user.id, "interview_invitation",
                "Interview invitation",
                f"You've been invited to interview for {posting.title}.",
                related_id=str(posting.id), related_type="posting",
                action_url=f"/interview/{posting.public_slug}",
            )
    except Exception as e:
        logger.error(f"[move_to_interview] notification creation failed application={application_id}: {e}")

    return {"already_exists": False, "public_link": public_link, "emailed": emailed, "candidate_email": email}


# ── GET /bulk/talent-pool — every screened candidate across the org's screening jobs, real filters happen client-side on this data ──
# Optional job_id: scopes the query to one job's applicants server-side —
# used by the Jobs Marketplace "Applicants" view so a single job posting's
# candidate list doesn't have to pull (and client-filter) the org's entire
# talent pool just to show one job's applicants.
@router.get("/talent-pool")
def get_talent_pool(
    job_id: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    require_hr(current_user)
    scoped_ids = get_org_scoped_user_ids(current_user, db)

    query = (
        db.query(Application)
        .join(Job, Application.job_id == Job.id)
        .filter(Job.hr_user_id.in_(scoped_ids))
    )
    if job_id:
        query = query.filter(Application.job_id == job_id)
    apps = query.order_by(Application.ai_score.desc()).all()

    jobs = {j.id: j for j in db.query(Job).filter(Job.hr_user_id.in_(scoped_ids)).all()}
    org_sessions = get_scoped_org_sessions(db, scoped_ids)
    org_postings = get_scoped_org_postings(db, scoped_ids)

    candidates = [build_candidate_entry(db, app, jobs.get(app.job_id), org_sessions, org_postings) for app in apps]
    return {"total": len(candidates), "candidates": candidates}


# ── GET /bulk/talent-pool/{id} — dedicated candidate detail view, one query pass, same builder as the list ──
@router.get("/talent-pool/{application_id}")
def get_talent_pool_candidate(
    application_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    require_hr(current_user)
    app = get_scoped_application(db, application_id, current_user)

    scoped_ids = get_org_scoped_user_ids(current_user, db)
    job = db.query(Job).filter(Job.id == app.job_id).first()
    org_sessions = get_scoped_org_sessions(db, scoped_ids)
    org_postings = get_scoped_org_postings(db, scoped_ids)

    entry = build_candidate_entry(db, app, job, org_sessions, org_postings)
    entry["job_description"] = job.description if job else None

    # Full AI feedback report, when a completed interview session exists —
    # same InterviewSessionReport contract the existing report view/Copilot
    # already use, so this never duplicates that report-generation logic.
    entry["interview_report"] = None
    if entry["interview_session_id"] and entry["has_report"]:
        session = next((s for s in org_sessions if str(s.id) == entry["interview_session_id"]), None)
        if session:
            entry["interview_report"] = {
                "id": str(session.id),
                "candidate_name": session.candidate_name,
                "candidate_email": session.candidate_email,
                "ai_score": session.ai_score,
                "assessment_score": session.assessment_score,
                "final_verdict": session.final_verdict,
                "experience_assessment": session.experience_assessment,
                "deep_analysis": session.deep_analysis,
            }

    # CrewAI screening committee — read-only here, never triggers a run.
    # "AI Analysis", kept clearly separate from the deterministic "System
    # Score" fields already in `entry` (fit_score, ats_score, etc).
    entry["ai_screening_status"] = app.ai_screening_status
    entry["ai_screening_updated_at"] = app.ai_screening_updated_at.isoformat() if app.ai_screening_updated_at else None
    try:
        entry["ai_screening_result"] = json.loads(app.ai_screening_result) if app.ai_screening_result else None
    except (json.JSONDecodeError, TypeError):
        # A corrupted/partial result should never crash the whole candidate
        # view — report it as needing a re-run rather than 500ing.
        logger.error(f"[ai-screening] malformed ai_screening_result JSON for application={application_id}")
        entry["ai_screening_result"] = None
        entry["ai_screening_status"] = "failed"

    return entry


# ── POST /bulk/applications/{id}/ai-screening — explicitly trigger (or re-trigger) the CrewAI committee ──
@router.post("/applications/{application_id}/ai-screening")
def trigger_ai_screening(
    application_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    require_hr(current_user)
    app = get_scoped_application(db, application_id, current_user)   # ownership verified server-side — id is never trusted alone

    if not (app.cv_text or "").strip():
        raise HTTPException(status_code=400, detail="No resume text is available for this candidate — cannot run AI analysis. This candidate was screened before resume text was persisted; re-screen the CV to enable this.")

    # Atomic claim, not read-then-write: two rapid clicks (or two tabs) can
    # both reach this endpoint with app.ai_screening_status == 'not_analyzed'
    # before either commits. A conditional UPDATE means only one request's
    # WHERE clause matches — rowcount tells us honestly whether we're the
    # one who gets to launch the Celery task.
    result = db.execute(
        update(Application)
        .where(Application.id == app.id, Application.ai_screening_status.notin_(["queued", "analyzing"]))
        .values(ai_screening_status="queued")
    )
    db.commit()

    if result.rowcount == 0:
        db.refresh(app)
        return {"status": app.ai_screening_status, "already_running": True}

    from tasks.crew_screening_task import run_candidate_ai_screening
    run_candidate_ai_screening.delay(application_id)

    return {"status": "queued", "already_running": False}


# ═══════════════════════════════════════════════════════════════════════
# DECISION CENTER — Accept/Reject a candidate + one personalized, editable,
# idempotently-sent notification email. Decision and notification are
# tracked as separate states on purpose (see models/application.py).
# ═══════════════════════════════════════════════════════════════════════

class DecisionPreviewRequest(BaseModel):
    decision: Literal["accepted", "rejected"]


class DecisionRequest(BaseModel):
    decision: Literal["accepted", "rejected"]
    notify: bool = True
    subject: Optional[str] = None   # HR's edited version — falls back to the generated draft if omitted
    body: Optional[str] = None


class BulkDecisionPreviewRequest(BaseModel):
    application_ids: List[str]
    decision: Literal["accepted", "rejected"]


class BulkDecisionItem(BaseModel):
    application_id: str
    decision: Literal["accepted", "rejected"]
    notify: bool = True
    subject: Optional[str] = None
    body: Optional[str] = None


class BulkDecisionRequest(BaseModel):
    items: List[BulkDecisionItem]


def _weak_assessment_categories(db: Session, session) -> list[str]:
    """Real weak categories from the candidate's OWN completed MCQ assessment
    only — never another candidate's, never invented. Reuses the same
    score_assessment computation the ranking endpoint already relies on."""
    if not session or session.status != "completed" or not session.assessment_score:
        return []
    posting = db.query(InterviewPosting).filter(InterviewPosting.id == session.posting_id).first()
    if not posting or not posting.assessment_questions:
        return []
    try:
        questions = json.loads(posting.assessment_questions or "[]")
        answers = json.loads(session.assessment_answers or "[]")
        breakdown = score_assessment(questions, answers)["breakdown_by_topic"]
    except Exception:
        return []
    weak = []
    for topic, stat in breakdown.items():
        if stat.get("total", 0) == 0:
            continue
        pct = round((stat["correct"] / stat["total"]) * 100)
        if pct < 60:
            weak.append(topic.replace("_", " ").title())
    return weak


def _build_preview(db: Session, app: Application, decision: str, scoped_ids: list) -> dict:
    job = db.query(Job).filter(Job.id == app.job_id).first()
    name, email, _ = resolve_application_identity(db, app)
    org_sessions = get_scoped_org_sessions(db, scoped_ids)
    _, resolved_email, has_account = resolve_application_identity(db, app)
    status_info = resolve_interview_status(app, resolved_email, has_account, org_sessions)
    weak_categories = _weak_assessment_categories(db, status_info["session"])

    matched = json.loads(app.matched_skills or "[]")
    missing = json.loads(app.missing_skills or "[]")

    missing_data = []
    if not email:
        missing_data.append("No candidate email on file — cannot send a notification.")
    if not matched and not missing and not weak_categories:
        missing_data.append("No resume/assessment performance data available — feedback will be generic.")

    subject, body = build_decision_email(
        candidate_name=name, job_title=job.title if job else "this role", company_name=job.company if job else None,
        decision=decision, ats_score=app.ai_score, matched_skills=matched, missing_skills=missing,
        assessment_weak_categories=weak_categories,
    )

    return {
        "application_id": str(app.id),
        "candidate_name": name,
        "candidate_email": email,
        "job_title": job.title if job else None,
        "decision": decision,
        "current_decision": app.decision,
        "subject": subject,
        "body": body,
        "missing_data": missing_data,
        "ready": bool(email) ,
    }


def _send_decision_email(to_email: str, subject: str, body: str) -> bool:
    if not MAIL_PASSWORD or MAIL_PASSWORD == "your_gmail_app_password_here":
        print(f"[Email] Skipping decision notification (not configured). To: {to_email}")
        return False
    body_html = "<div style=\"white-space:pre-wrap;margin:0;\">" + \
        body.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;") + "</div>"
    html = render_email(heading=subject, body_html=body_html)
    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = MAIL_FROM
    msg["To"] = to_email
    msg.attach(MIMEText(body, "plain"))
    msg.attach(MIMEText(html, "html"))
    try:
        with smtplib.SMTP(MAIL_SERVER, MAIL_PORT) as server:
            server.starttls()
            server.login(MAIL_USERNAME, MAIL_PASSWORD)
            server.sendmail(MAIL_FROM, to_email, msg.as_string())
        return True
    except Exception as e:
        print(f"[Email] Decision notification failed: {e}")
        return False


def _send_and_record(db: Session, app: Application, subject: str, body: str) -> str:
    """Atomic claim + send + record. Returns the final notification_status."""
    claim = db.execute(
        update(Application)
        .where(Application.id == app.id, Application.notification_status.notin_(["sending", "sent"]))
        .values(notification_status="sending", notification_subject=subject, notification_body=body)
    )
    db.commit()
    if claim.rowcount == 0:
        db.refresh(app)
        return app.notification_status  # someone else already claimed/sent this — never send twice

    email = (app.candidate_email or "").strip()
    sent = bool(email) and _send_decision_email(email, subject, body)

    app.notification_status = "sent" if sent else "failed"
    if sent:
        app.notification_sent_at = datetime.utcnow()
    db.commit()
    return app.notification_status


@router.get("/applications/{application_id}/decision-preview")
def get_decision_preview(
    application_id: str,
    decision: Literal["accepted", "rejected"],
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    require_hr(current_user)
    app = get_scoped_application(db, application_id, current_user)
    scoped_ids = get_org_scoped_user_ids(current_user, db)
    return _build_preview(db, app, decision, scoped_ids)


@router.post("/applications/{application_id}/decision")
def submit_decision(
    application_id: str,
    payload: DecisionRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    require_hr(current_user)
    app = get_scoped_application(db, application_id, current_user)

    if app.decision != "pending" and app.decision != payload.decision:
        raise HTTPException(status_code=409, detail=f"Candidate already {app.decision}.")

    # Atomic claim on the DECISION itself too — a double-click here must
    # only ever record one decision, exactly like everywhere else this
    # pattern is used in this file.
    if app.decision == "pending":
        claim = db.execute(
            update(Application)
            .where(Application.id == app.id, Application.decision == "pending")
            .values(decision=payload.decision, decision_at=datetime.utcnow())
        )
        db.commit()
        if claim.rowcount == 0:
            db.refresh(app)
            if app.decision != payload.decision:
                raise HTTPException(status_code=409, detail=f"Candidate already {app.decision}.")
        else:
            # Genuinely just transitioned pending -> accepted/rejected (this
            # branch only runs once per real decision, thanks to the atomic
            # claim above) — notify the candidate, but only when the
            # applicant is a real registered account (resolve_application_identity
            # already tells us this reliably; bulk-uploaded CVs have no
            # account to notify, and that's fine, not an error).
            try:
                _, _, is_real_account = resolve_application_identity(db, app)
                if is_real_account:
                    from core.notifications import create_notification
                    job = db.query(Job).filter(Job.id == app.job_id).first()
                    job_title = job.title if job else "the role"
                    if payload.decision == "accepted":
                        create_notification(
                            db, app.candidate_id, "application_accepted",
                            "Application accepted",
                            f"Great news — you've been accepted for {job_title}.",
                            related_id=str(app.id), related_type="application",
                            action_url="/candidate/dashboard/applications",
                        )
                    elif payload.decision == "rejected":
                        create_notification(
                            db, app.candidate_id, "application_rejected",
                            "Application update",
                            f"There's an update on your application for {job_title}.",
                            related_id=str(app.id), related_type="application",
                            action_url="/candidate/dashboard/applications",
                        )
            except Exception as e:
                logger.error(f"[submit_decision] notification creation failed application={application_id}: {e}")
    db.refresh(app)

    scoped_ids = get_org_scoped_user_ids(current_user, db)
    subject = payload.subject
    body = payload.body
    if not subject or not body:
        preview = _build_preview(db, app, payload.decision, scoped_ids)
        subject = subject or preview["subject"]
        body = body or preview["body"]

    notification_status = app.notification_status
    if payload.notify:
        notification_status = _send_and_record(db, app, subject, body)
    else:
        app.notification_subject = subject
        app.notification_body = body
        db.commit()

    return {
        "application_id": str(app.id),
        "decision": app.decision,
        "notification_status": notification_status,
    }


@router.post("/applications/{application_id}/decision/retry-notification")
def retry_decision_notification(
    application_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    require_hr(current_user)
    app = get_scoped_application(db, application_id, current_user)

    if app.decision == "pending":
        raise HTTPException(status_code=400, detail="No decision has been made for this candidate yet.")
    if not app.notification_subject or not app.notification_body:
        raise HTTPException(status_code=400, detail="No notification draft exists to retry.")
    if app.notification_status == "sent":
        return {"application_id": str(app.id), "notification_status": "sent"}

    # A retry must resend exactly what was already recorded/edited — never
    # regenerate, so HR's edits from the original send attempt are preserved.
    app.notification_status = "not_sent"  # release the previous failed claim so _send_and_record can re-claim it
    db.commit()
    status = _send_and_record(db, app, app.notification_subject, app.notification_body)
    return {"application_id": str(app.id), "notification_status": status}


@router.post("/decisions/preview")
def bulk_decision_preview(
    payload: BulkDecisionPreviewRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    require_hr(current_user)
    scoped_ids = get_org_scoped_user_ids(current_user, db)
    previews = []
    for application_id in payload.application_ids:
        try:
            app = get_scoped_application(db, application_id, current_user)
        except HTTPException:
            previews.append({"application_id": application_id, "ready": False, "missing_data": ["Candidate not found or not accessible."]})
            continue
        previews.append(_build_preview(db, app, payload.decision, scoped_ids))
    return {"previews": previews}


@router.post("/decisions")
def bulk_decisions(
    payload: BulkDecisionRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    require_hr(current_user)
    scoped_ids = get_org_scoped_user_ids(current_user, db)
    results = []
    for item in payload.items:
        # Each candidate is fully independent — one failure must never
        # affect the others, exactly like bulk screening's per-candidate
        # isolation.
        try:
            app = get_scoped_application(db, item.application_id, current_user)
        except HTTPException as e:
            results.append({"application_id": item.application_id, "ok": False, "error": e.detail})
            continue
        try:
            if app.decision != "pending" and app.decision != item.decision:
                results.append({"application_id": item.application_id, "ok": False, "error": f"Candidate already {app.decision}."})
                continue
            if app.decision == "pending":
                claim = db.execute(
                    update(Application)
                    .where(Application.id == app.id, Application.decision == "pending")
                    .values(decision=item.decision, decision_at=datetime.utcnow())
                )
                db.commit()
                if claim.rowcount == 0:
                    db.refresh(app)
                    if app.decision != item.decision:
                        results.append({"application_id": item.application_id, "ok": False, "error": f"Candidate already {app.decision}."})
                        continue
            db.refresh(app)

            subject, body = item.subject, item.body
            if not subject or not body:
                preview = _build_preview(db, app, item.decision, scoped_ids)
                subject = subject or preview["subject"]
                body = body or preview["body"]

            notification_status = app.notification_status
            if item.notify:
                notification_status = _send_and_record(db, app, subject, body)
            else:
                app.notification_subject = subject
                app.notification_body = body
                db.commit()

            results.append({"application_id": item.application_id, "ok": True, "decision": app.decision, "notification_status": notification_status})
        except Exception as e:
            logger.error(f"[decision] bulk item failed application={item.application_id}: {e}")
            results.append({"application_id": item.application_id, "ok": False, "error": "Could not process this candidate."})

    return {"results": results}