import os
import re
import json
import shutil
import smtplib
import zipfile
import tempfile
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from datetime import datetime

from fastapi import APIRouter, UploadFile, File, Form, Depends, HTTPException
from sqlalchemy.orm import Session
from celery.result import AsyncResult

from models.database import get_db
from middleware.auth import get_current_user
from models.user import User
from models.job import Job
from models.application import Application
from core.celery_app import celery_app
from core.redis_client import check_rate_limit
from tasks.screening_task import run_bulk_screening

router = APIRouter(prefix="/bulk", tags=["Bulk Screening"])
MAX_CVS = 25
MAX_ZIP_SIZE_MB = 50
MAX_ZIP_SIZE_BYTES = MAX_ZIP_SIZE_MB * 1024 * 1024

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
        color = "#13c28e" if score >= 75 else "#e2b04a" if score >= 55 else "#ef4444"
        top_rows += f"""
        <tr>
          <td style="padding:10px 12px;border-bottom:1px solid #1e1e1b;color:rgba(255,255,255,.5);font-size:12px">#{i}</td>
          <td style="padding:10px 12px;border-bottom:1px solid #1e1e1b;color:rgba(255,255,255,.8);font-size:13px;font-weight:600">{name}</td>
          <td style="padding:10px 12px;border-bottom:1px solid #1e1e1b;font-size:14px;font-weight:700;color:{color}">{score}</td>
          <td style="padding:10px 12px;border-bottom:1px solid #1e1e1b;color:rgba(255,255,255,.4);font-size:11px">{verdict}</td>
        </tr>"""

    html = f"""
    <div style="font-family:'Inter',sans-serif;max-width:560px;margin:0 auto;background:#0a0a08;color:#fff;border-radius:12px;overflow:hidden;border:1px solid #1e1e1b">
      <div style="padding:28px 32px;border-bottom:1px solid #1e1e1b">
        <div style="font-size:11px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:#13c28e;margin-bottom:8px">TalentIQ</div>
        <h1 style="font-size:22px;font-weight:600;margin:0 0 6px">Screening Complete</h1>
        <p style="color:rgba(255,255,255,.4);font-size:13px;margin:0">{job_title}</p>
      </div>
      <div style="padding:24px 32px">
        <p style="color:rgba(255,255,255,.6);font-size:13px;margin:0 0 20px">Hi {hr_name}, your bulk screening of <strong style="color:#fff">{total} CV(s)</strong> is complete.</p>
        <table style="width:100%;border-collapse:collapse;background:#111110;border-radius:8px;overflow:hidden;border:1px solid #1e1e1b">
          <thead>
            <tr style="background:#161614">
              <th style="padding:10px 12px;text-align:left;font-size:10px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:rgba(255,255,255,.3)">#</th>
              <th style="padding:10px 12px;text-align:left;font-size:10px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:rgba(255,255,255,.3)">Candidate</th>
              <th style="padding:10px 12px;text-align:left;font-size:10px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:rgba(255,255,255,.3)">Score</th>
              <th style="padding:10px 12px;text-align:left;font-size:10px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:rgba(255,255,255,.3)">Verdict</th>
            </tr>
          </thead>
          <tbody>{top_rows}</tbody>
        </table>
        <div style="margin-top:24px">
          <a href="http://localhost:3000/hr/dashboard" style="display:inline-block;padding:11px 22px;background:#13c28e;color:#0a0a08;border-radius:8px;font-size:13px;font-weight:700;text-decoration:none">View Full Results</a>
        </div>
      </div>
    </div>"""

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


def save_screening_to_db(
    db: Session,
    hr_user: User,
    job_title: str,
    job_description: str,
    results: list,
) -> str:
    """Create Job record + Application records for each screened CV."""
    job = Job(
        hr_user_id=hr_user.id,
        title=job_title or "Untitled Role",
        description=job_description,
    )
    db.add(job)
    db.flush()  # get job.id without committing

    for r in results:
        app = Application(
            job_id=job.id,
            candidate_id=hr_user.id,  # placeholder — no real candidate account
            cv_filename=r.get("filename", ""),
            ai_score=r.get("ai_score", 0),
            matched_skills=json.dumps(r.get("matched_skills", [])),
            missing_skills=json.dumps(r.get("missing_skills", [])),
            final_verdict=r.get("final_verdict", ""),
            deep_analysis=r.get("deep_analysis", ""),
            is_shortlisted="yes" if r.get("is_shortlisted") else "no",
            trigger_interview="yes" if r.get("trigger_interview") else "no",
            screened_at=datetime.utcnow(),
        )
        db.add(app)

    db.commit()
    return str(job.id)


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
            job_description=job_description,
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


@router.get("/jobs")
def get_hr_jobs(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """HR ke saare past screening jobs with results (team workspace: sab teammates ke jobs bhi)."""
    require_hr(current_user)
    from core.org_scope import get_org_scoped_user_ids
    scoped_ids = get_org_scoped_user_ids(current_user, db)
    jobs = db.query(Job).filter(Job.hr_user_id.in_(scoped_ids)).order_by(Job.created_at.desc()).all()
    result = []
    for job in jobs:
        apps = db.query(Application).filter(Application.job_id == job.id).all()
        result.append({
            "id": str(job.id),
            "title": job.title,
            "description": job.description,
            "created_at": job.created_at.isoformat() if job.created_at else None,
            "total_candidates": len(apps),
            "shortlisted": sum(1 for a in apps if a.is_shortlisted == "yes"),
            "top_score": max((a.ai_score for a in apps), default=0),
            "candidates": [
                {
                    "filename": a.cv_filename,
                    "ai_score": a.ai_score,
                    "matched_skills": json.loads(a.matched_skills or "[]"),
                    "missing_skills": json.loads(a.missing_skills or "[]"),
                    "final_verdict": a.final_verdict,
                    "deep_analysis": a.deep_analysis,
                    "is_shortlisted": a.is_shortlisted == "yes",
                    "trigger_interview": a.trigger_interview == "yes",
                    "screened_at": a.screened_at.isoformat() if a.screened_at else None,
                }
                for a in sorted(apps, key=lambda x: x.ai_score, reverse=True)
            ]
        })
    return result 