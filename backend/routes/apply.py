import json
import shutil
import os
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, status
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from typing import List

from models.database import get_db
from middleware.auth import get_current_user
from models.user import User
from models.job import Job
from models.application import Application
from schemas.application import ApplicationResponse
from core.graph import TalentIQGraph
from core.loader import CvLoader
from core.chunker import TextChunker
from core.faiss import VectorStore

router=APIRouter(prefix="/apply",tags=["Applications"])

UPLOAD_DIR = "../data/pdf"
os.makedirs(UPLOAD_DIR, exist_ok=True)

def require_candidate(current_user:User):
    if current_user.role != "candidate":
        raise HTTPException(status_code=403,detail="Only candidates can apply.")
    return current_user

def parse_json_list(val: str) -> List[str]:
    try:
        return json.loads(val) if val else []
    except Exception:
        return []


# ── POST /apply/{job_id} — Candidate applies ──────────────────────
@router.post("/{job_id}", status_code=status.HTTP_201_CREATED)
async def apply_to_job(
    job_id: str,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    require_candidate(current_user)

    # Check job exists
    job = db.query(Job).filter(Job.id == job_id, Job.is_active == True).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found or closed.")

    # Check already applied
    existing = db.query(Application).filter(
        Application.job_id == job_id,
        Application.candidate_id == current_user.id,
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="You already applied to this job.")

    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files allowed.")

    # Save CV
    file_path = os.path.join(UPLOAD_DIR, f"{current_user.id}_{file.filename}")
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    # Parse PDF text
    loader = CvLoader(data_path=UPLOAD_DIR)
    documents = loader.load()
    cv_text = "\n\n".join([doc.page_content for doc in documents]) if documents else ""

    # Vectorize CV
    chunker = TextChunker()
    chunks = chunker.split_documents(documents) if documents else []
    if chunks:
        vector_store = VectorStore()
        vector_store.create_and_save_store(chunks)

    # Run AI screening
    ai_score         = 0
    matched_skills   = []
    missing_skills   = []
    final_verdict    = "Pending"
    deep_analysis    = ""
    is_shortlisted   = "pending"
    trigger_interview = "no"

    if cv_text.strip():
        try:
            agent = TalentIQGraph()
            report = agent.run_screening(job_description=job.description)
            if report:
                ai_score         = report.get("candidate_score", 0)
                matched_skills   = report.get("matched_skills", [])
                missing_skills   = report.get("missing_skills", [])
                final_verdict    = report.get("final_verdict", "Reviewed")
                deep_analysis    = report.get("screening_analysis", "")
                is_shortlisted   = "yes" if report.get("is_shortlisted", False) else "no"
                trigger_interview = "yes" if report.get("trigger_interview", False) else "no"
        except Exception as e:
            print(f"[Apply] AI screening error: {e}")

    # Save application
    application = Application(
        job_id=job_id,
        candidate_id=current_user.id,
        cv_filename=file.filename,
        cv_text=cv_text[:5000],  # store first 5000 chars
        ai_score=ai_score,
        matched_skills=json.dumps(matched_skills),
        missing_skills=json.dumps(missing_skills),
        final_verdict=final_verdict,
        deep_analysis=deep_analysis,
        is_shortlisted=is_shortlisted,
        trigger_interview=trigger_interview,
        screened_at=datetime.utcnow(),
    )
    db.add(application)

    # Increment checks used
    current_user.checks_used = (current_user.checks_used or 0) + 1
    db.commit()
    db.refresh(application)

    # Notifications — fire only now that the application + inline ATS
    # screening have both genuinely succeeded and been committed.
    try:
        from core.notifications import create_notification, notify_org_hr
        create_notification(
            db, current_user.id, "application_received",
            "Application received",
            f"Your application for {job.title} has been submitted and screened.",
            related_id=str(application.id), related_type="application",
            action_url="/candidate/dashboard/applications",
        )
        notify_org_hr(
            db, job.hr_user_id, "new_application",
            "New application received",
            f"{application.candidate_name or 'A candidate'} applied for {job.title}.",
            related_id=str(application.id), related_type="application",
            action_url=f"/hr/dashboard?section=candidates&application={application.id}",
        )
        if cv_text.strip():
            notify_org_hr(
                db, job.hr_user_id, "ats_screening_completed",
                "ATS screening completed",
                f"{application.candidate_name or 'A candidate'}'s resume scored {ai_score} for {job.title}.",
                related_id=str(application.id), related_type="application",
                action_url=f"/hr/dashboard?section=candidates&application={application.id}",
            )
    except Exception as e:
        print(f"[Apply] Notification creation failed (non-fatal): {e}")

    return {
        "status": "success",
        "message": "Application submitted and screened successfully.",
        "application_id": str(application.id),
        "ai_score": ai_score,
        "matched_skills": matched_skills,
        "missing_skills": missing_skills,
        "final_verdict": final_verdict,
        "deep_analysis": deep_analysis,
        "is_shortlisted": is_shortlisted,
        "trigger_interview": trigger_interview,
    }


# ── GET /apply/my — Candidate apni applications dekhe ─────────────
@router.get("/my", response_model=List[dict])
def my_applications(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    require_candidate(current_user)
    from core.application_status import derive_status, build_timeline

    apps = db.query(Application).filter(
        Application.candidate_id == current_user.id
    ).order_by(Application.created_at.desc()).all()

    result = []
    for app in apps:
        job = db.query(Job).filter(Job.id == app.job_id).first()
        result.append({
            "application_id":  str(app.id),
            "job_id":          str(app.job_id),
            "job_title":       job.title if job else "Unknown",
            "company":         job.company if job else "",
            "location":        job.location if job else None,
            "job_status":      job.status if job else None,
            "ai_score":        app.ai_score,
            "matched_skills":  parse_json_list(app.matched_skills),
            "missing_skills":  parse_json_list(app.missing_skills),
            "final_verdict":   app.final_verdict,
            "deep_analysis":   app.deep_analysis,
            "is_shortlisted":  app.is_shortlisted,
            "trigger_interview": app.trigger_interview,
            "decision":        app.decision,
            "status":          derive_status(app),
            "timeline":        build_timeline(app),
            "applied_at":      app.created_at.isoformat() if app.created_at else "",
        })
    return result


# ── GET /apply/latest-resume — candidate ka sabse recent resume text ──
# reuse karne ke liye (Jobs Marketplace AI Match preview), taake wo dobara
# upload na kare. Sirf unki apni sabse recent Application ka cv_text —
# koi naya storage nahi, jo already applications table me saved hai wahi.
@router.get("/latest-resume")
def latest_resume(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    require_candidate(current_user)
    app = db.query(Application).filter(
        Application.candidate_id == current_user.id,
        Application.cv_text.isnot(None),
    ).order_by(Application.created_at.desc()).first()

    if not app or not (app.cv_text or "").strip():
        return {"available": False, "cv_text": None, "cv_filename": None}

    return {"available": True, "cv_text": app.cv_text, "cv_filename": app.cv_filename}


# ── GET /apply/job/{job_id} — HR all applicants dekhe ─────────────
@router.get("/job/{job_id}", response_model=List[dict])
def job_applicants(
    job_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role != "hr":
        raise HTTPException(status_code=403, detail="HR only.")

    job = db.query(Job).filter(
        Job.id == job_id,
        Job.hr_user_id == current_user.id,
    ).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found.")

    apps = db.query(Application).filter(
        Application.job_id == job_id
    ).order_by(Application.ai_score.desc()).all()   # auto-ranked by score

    result = []
    for app in apps:
        candidate = db.query(User).filter(User.id == app.candidate_id).first()
        result.append({
            "application_id":   str(app.id),
            "candidate_id":     app.candidate_id,
            "candidate_name":   candidate.name if candidate else "Unknown",
            "candidate_email":  candidate.email if candidate else "",
            "cv_filename":      app.cv_filename,
            "ai_score":         app.ai_score,
            "matched_skills":   parse_json_list(app.matched_skills),
            "missing_skills":   parse_json_list(app.missing_skills),
            "final_verdict":    app.final_verdict,
            "deep_analysis":    app.deep_analysis,
            "is_shortlisted":   app.is_shortlisted,
            "trigger_interview": app.trigger_interview,
            "applied_at":       app.created_at.isoformat() if app.created_at else "",
        })
    return result


# ── GET /apply/{application_id}/resume — HR views the exact PDF this candidate submitted ──
# Reuses the file already saved to disk by apply_to_job() above (UPLOAD_DIR,
# named f"{candidate_id}_{cv_filename}") -- no new storage, no new upload
# path. Org-scoped the same way every other per-application HR action is
# (core.org_scope.get_org_scoped_user_ids), and 404s rather than 403s so an
# application ID from another org can't even be confirmed to exist.
@router.get("/{application_id}/resume")
def view_applicant_resume(
    application_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role != "hr":
        raise HTTPException(status_code=403, detail="HR only.")

    from core.org_scope import get_org_scoped_user_ids
    scoped_ids = get_org_scoped_user_ids(current_user, db)
    app = (
        db.query(Application)
        .join(Job, Application.job_id == Job.id)
        .filter(Application.id == application_id, Job.hr_user_id.in_(scoped_ids))
        .first()
    )
    if not app:
        raise HTTPException(status_code=404, detail="Application not found.")
    if not app.cv_filename:
        raise HTTPException(status_code=404, detail="No resume file on record for this application.")

    file_path = os.path.join(UPLOAD_DIR, f"{app.candidate_id}_{app.cv_filename}")
    if not os.path.isfile(file_path):
        # Real, honest case: bulk-screening-created applications or older
        # records may not have the original file retained on disk anymore.
        raise HTTPException(status_code=404, detail="The original resume file is no longer available.")

    return FileResponse(file_path, media_type="application/pdf", filename=app.cv_filename)