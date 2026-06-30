import json
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List

from models.database import get_db
from middleware.auth import get_current_user
from models.user import User
from models.job import Job
from models.application import Application
from schemas.jobs import JobCreate, jobResponse

router = APIRouter(prefix="/jobs", tags=["Jobs"])


def require_hr(current_user: User):
    if current_user.role != "hr":
        raise HTTPException(status_code=403, detail="Only HR users can do this.")
    return current_user


# ── POST /jobs — HR creates a job ─────────────────────────────────
@router.post("", response_model=jobResponse, status_code=status.HTTP_201_CREATED)
def create_job(
    body: JobCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    require_hr(current_user)

    job = Job(
        hr_user_id=current_user.id,
        title=body.title,
        company=body.company,
        location=body.location,
        description=body.description,
    )
    db.add(job)
    db.commit()
    db.refresh(job)

    return jobResponse(
        id=str(job.id),
        title=job.title,
        company=job.company,
        location=job.location,
        description=job.description,
        is_active=job.is_active,
        created_at=job.created_at,
        applicant_count=0,
    )


# ── GET /jobs — Public job listings (candidates dekhen) ────────────
@router.get("", response_model=List[jobResponse])
def list_jobs(db: Session = Depends(get_db)):
    jobs = db.query(Job).filter(Job.is_active == True).order_by(Job.created_at.desc()).all()
    result = []
    for job in jobs:
        count = db.query(Application).filter(Application.job_id == job.id).count()
        result.append(jobResponse(
            id=str(job.id),
            title=job.title,
            company=job.company,
            location=job.location,
            description=job.description,
            is_active=job.is_active,
            created_at=job.created_at,
            applicant_count=count,
        ))
    return result


# ── GET /jobs/mine — HR apni jobs dekhe ───────────────────────────
@router.get("/mine", response_model=List[jobResponse])
def my_jobs(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    require_hr(current_user)
    jobs = db.query(Job).filter(
        Job.hr_user_id == current_user.id
    ).order_by(Job.created_at.desc()).all()

    result = []
    for job in jobs:
        count = db.query(Application).filter(Application.job_id == job.id).count()
        result.append(jobResponse(
            id=str(job.id),
            title=job.title,
            company=job.company,
            location=job.location,
            description=job.description,
            is_active=job.is_active,
            created_at=job.created_at,
            applicant_count=count,
        ))
    return result


# ── DELETE /jobs/{job_id} — HR job delete kare ────────────────────
@router.delete("/{job_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_job(
    job_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    require_hr(current_user)
    job = db.query(Job).filter(
        Job.id == job_id,
        Job.hr_user_id == current_user.id
    ).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    db.delete(job)
    db.commit()