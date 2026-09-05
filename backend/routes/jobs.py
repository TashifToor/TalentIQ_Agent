import json
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException, Request, status, Query
from sqlalchemy import or_
from sqlalchemy.orm import Session
from typing import List, Optional

from models.database import get_db
from middleware.auth import get_current_user, get_current_user_optional
from models.user import User
from models.job import Job
from models.application import Application
from schemas.jobs import (
    JobCreate, JobUpdate, jobResponse, JobListResponse, JobAnalytics,
    JobAIAssistRequest, JobAIAssistResponse,
    JobMatchRequest, JobMatchResponse, SkillGapsOut,
    RecommendedJobsRequest, RecommendedJob,
    WhyRecommendedRequest, WhyRecommendedResponse,
    WORK_ARRANGEMENTS, EMPLOYMENT_TYPES,
)
from core.ai_provider import AIProviderError
from core.redis_client import check_rate_limit

router = APIRouter(prefix="/jobs", tags=["Jobs"])


def require_hr(current_user: User):
    if current_user.role != "hr":
        raise HTTPException(status_code=403, detail="Only HR users can do this.")
    return current_user


def _parse_list(val) -> List[str]:
    if not val:
        return []
    try:
        parsed = json.loads(val)
        return parsed if isinstance(parsed, list) else []
    except Exception:
        return []


def _to_response(job: Job, applicant_count: int = 0, has_applied: Optional[bool] = None,
                  application_status: Optional[str] = None,
                  match_percent: Optional[int] = None, match_reasons: Optional[List[str]] = None) -> jobResponse:
    return jobResponse(
        id=str(job.id),
        hr_user_id=job.hr_user_id,
        title=job.title,
        company=job.company,
        location=job.location,
        description=job.description,
        responsibilities=job.responsibilities,
        required_skills=_parse_list(job.required_skills),
        preferred_skills=_parse_list(job.preferred_skills),
        experience_required=job.experience_required,
        work_arrangement=job.work_arrangement,
        employment_type=job.employment_type,
        salary_min=job.salary_min,
        salary_max=job.salary_max,
        salary_currency=job.salary_currency,
        application_deadline=job.application_deadline,
        openings=job.openings,
        status=job.status,
        is_active=job.is_active,
        views_count=job.views_count or 0,
        created_at=job.created_at,
        updated_at=job.updated_at,
        published_at=job.published_at,
        applicant_count=applicant_count,
        has_applied=has_applied,
        application_status=application_status,
        match_percent=match_percent,
        match_reasons=match_reasons or [],
    )


def _validate_enums(work_arrangement: Optional[str], employment_type: Optional[str]):
    if work_arrangement and work_arrangement not in WORK_ARRANGEMENTS:
        raise HTTPException(status_code=400, detail=f"work_arrangement must be one of {WORK_ARRANGEMENTS}")
    if employment_type and employment_type not in EMPLOYMENT_TYPES:
        raise HTTPException(status_code=400, detail=f"employment_type must be one of {EMPLOYMENT_TYPES}")


def _get_owned_job(db: Session, job_id: str, current_user: User) -> Job:
    from core.org_scope import get_org_scoped_user_ids
    scoped_ids = get_org_scoped_user_ids(current_user, db)
    job = db.query(Job).filter(Job.id == job_id, Job.hr_user_id.in_(scoped_ids)).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found.")
    return job


# ================= HR: create / edit / lifecycle =================

@router.post("", response_model=jobResponse, status_code=status.HTTP_201_CREATED)
def create_job(
    body: JobCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Creates a job as a DRAFT. HR previews and explicitly publishes separately."""
    require_hr(current_user)
    _validate_enums(body.work_arrangement, body.employment_type)

    job = Job(
        hr_user_id=current_user.id,
        title=body.title,
        company=body.company,
        location=body.location,
        description=body.description,
        responsibilities=body.responsibilities,
        required_skills=json.dumps(body.required_skills or []),
        preferred_skills=json.dumps(body.preferred_skills or []),
        experience_required=body.experience_required,
        work_arrangement=body.work_arrangement,
        employment_type=body.employment_type,
        salary_min=body.salary_min,
        salary_max=body.salary_max,
        salary_currency=body.salary_currency,
        application_deadline=body.application_deadline,
        openings=body.openings,
        status="draft",
        is_active=False,
    )
    db.add(job)
    db.commit()
    db.refresh(job)
    return _to_response(job)


@router.patch("/{job_id}", response_model=jobResponse)
def update_job(
    job_id: str,
    body: JobUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    require_hr(current_user)
    job = _get_owned_job(db, job_id, current_user)
    _validate_enums(body.work_arrangement, body.employment_type)

    data = body.model_dump(exclude_unset=True)
    for field in ("required_skills", "preferred_skills"):
        if field in data:
            data[field] = json.dumps(data[field] or [])
    for k, v in data.items():
        setattr(job, k, v)

    db.commit()
    db.refresh(job)
    count = db.query(Application).filter(Application.job_id == job.id).count()
    return _to_response(job, applicant_count=count)


@router.post("/{job_id}/publish", response_model=jobResponse)
def publish_job(job_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    require_hr(current_user)
    job = _get_owned_job(db, job_id, current_user)
    if job.status == "published":
        return _to_response(job)
    if not job.title or not job.description:
        raise HTTPException(status_code=400, detail="Title and description are required before publishing.")

    job.status = "published"
    job.is_active = True
    if not job.published_at:
        job.published_at = datetime.utcnow()
    job.closed_at = None
    db.commit()
    db.refresh(job)

    # Notify candidates -- only the ones with a real, existing skill-overlap
    # signal against this specific job (see find_candidates_to_notify_for_job).
    # create_notification() dedupes on (user_id, type, related_id, related_type),
    # so re-publishing the same job (e.g. close -> reopen -> publish again,
    # though reopen doesn't call this) never re-notifies the same candidate.
    try:
        from core.notifications import create_notification
        from core.job_intelligence import find_candidates_to_notify_for_job

        matches = find_candidates_to_notify_for_job(db, job)
        company_label = job.company or "A hiring organization"
        for candidate_id, percent, reasons in matches:
            create_notification(
                db, candidate_id, "job_recommended",
                f"New job: {job.title}",
                f"{company_label} is hiring for {job.title} — this role matches your profile.",
                related_id=str(job.id), related_type="job",
                action_url=f"/candidate/dashboard/jobs/{job.id}",
            )
    except Exception as e:
        print(f"[Jobs] Publish notification creation failed (non-fatal): {e}")

    return _to_response(job)


@router.post("/{job_id}/close", response_model=jobResponse)
def close_job(job_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    require_hr(current_user)
    job = _get_owned_job(db, job_id, current_user)
    job.status = "closed"
    job.is_active = False
    job.closed_at = datetime.utcnow()
    db.commit()
    db.refresh(job)
    return _to_response(job)


@router.post("/{job_id}/reopen", response_model=jobResponse)
def reopen_job(job_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    require_hr(current_user)
    job = _get_owned_job(db, job_id, current_user)
    if job.status != "closed":
        raise HTTPException(status_code=400, detail="Only a closed job can be reopened.")
    job.status = "published"
    job.is_active = True
    job.closed_at = None
    db.commit()
    db.refresh(job)
    return _to_response(job)


@router.delete("/{job_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_job(
    job_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    require_hr(current_user)
    job = _get_owned_job(db, job_id, current_user)
    if job.status != "draft":
        raise HTTPException(status_code=400, detail="Only draft jobs can be deleted. Close a published job instead.")
    db.delete(job)
    db.commit()


# ================= HR: own jobs + analytics =================

@router.get("/mine", response_model=JobListResponse)
def my_jobs(
    status_filter: Optional[str] = Query(None, alias="status"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    require_hr(current_user)
    from core.org_scope import get_org_scoped_user_ids
    scoped_ids = get_org_scoped_user_ids(current_user, db)

    q = db.query(Job).filter(Job.hr_user_id.in_(scoped_ids))
    if status_filter:
        q = q.filter(Job.status == status_filter)
    jobs = q.order_by(Job.created_at.desc()).all()

    result = []
    for job in jobs:
        count = db.query(Application).filter(Application.job_id == job.id).count()
        result.append(_to_response(job, applicant_count=count))
    return JobListResponse(total=len(result), jobs=result)


@router.get("/{job_id}/analytics", response_model=JobAnalytics)
def job_analytics(job_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    require_hr(current_user)
    job = _get_owned_job(db, job_id, current_user)

    apps = db.query(Application).filter(Application.job_id == job.id).all()
    screening = sum(1 for a in apps if a.ai_screening_status in ("queued", "analyzing", "completed") or (a.ai_score or 0) > 0)
    interviews = sum(1 for a in apps if a.trigger_interview == "yes" or a.invited_posting_id is not None)
    accepted = sum(1 for a in apps if a.decision == "accepted")
    rejected = sum(1 for a in apps if a.decision == "rejected")

    return JobAnalytics(
        views=job.views_count or 0,
        applications=len(apps),
        screening=screening,
        interviews=interviews,
        accepted=accepted,
        rejected=rejected,
    )


# ================= AI-assisted job creation =================

@router.post("/ai-assist", response_model=JobAIAssistResponse)
def ai_assist_job(
    request: Request,
    body: JobAIAssistRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    require_hr(current_user)
    allowed, wait_seconds = check_rate_limit(f"jobs-ai-assist:{current_user.id}", cooldown_seconds=5)
    if not allowed:
        raise HTTPException(status_code=429, detail=f"Please wait {wait_seconds}s and try again.")

    from core.job_intelligence import structure_job_draft
    try:
        data = structure_job_draft(body.raw_text)
    except AIProviderError as e:
        raise HTTPException(status_code=502, detail=str(e))

    return JobAIAssistResponse(**data)


# ================= Candidate: marketplace listing + detail =================

@router.get("", response_model=JobListResponse)
def list_jobs(
    q: Optional[str] = None,
    location: Optional[str] = None,
    work_arrangement: Optional[str] = None,
    employment_type: Optional[str] = None,
    skill: Optional[str] = None,
    experience_level: Optional[str] = None,
    min_salary: Optional[int] = None,
    posted_within_days: Optional[int] = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=50),
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional),
):
    """Public marketplace listing -- published jobs only, never draft/closed."""
    query = db.query(Job).filter(Job.status == "published")

    if q:
        like = f"%{q}%"
        query = query.filter(or_(Job.title.ilike(like), Job.company.ilike(like), Job.description.ilike(like)))
    if location:
        query = query.filter(Job.location.ilike(f"%{location}%"))
    if work_arrangement:
        query = query.filter(Job.work_arrangement == work_arrangement)
    if employment_type:
        query = query.filter(Job.employment_type == employment_type)
    if skill:
        # required_skills/preferred_skills are JSON-text -- a simple ILIKE
        # over the serialized list is a fine, fast, good-enough substring
        # match for a single skill keyword filter.
        like = f"%{skill}%"
        query = query.filter(or_(Job.required_skills.ilike(like), Job.preferred_skills.ilike(like)))
    if experience_level:
        # experience_required is HR's own free text ("3-5 years", "Senior",
        # "Entry-level", ...) -- there's no structured enum anywhere in the
        # schema to filter against, and inventing one would mean guessing a
        # bucket for every existing job. A substring match against the real
        # text HR actually entered is the honest version of this filter.
        query = query.filter(Job.experience_required.ilike(f"%{experience_level}%"))
    if min_salary is not None:
        # Only matches jobs that actually published a salary range and whose
        # upper bound meets the candidate's ask -- jobs with no salary data
        # at all are excluded rather than assumed to qualify.
        query = query.filter(Job.salary_max.isnot(None), Job.salary_max >= min_salary)
    if posted_within_days is not None:
        cutoff = datetime.utcnow() - timedelta(days=posted_within_days)
        query = query.filter(Job.published_at.isnot(None), Job.published_at >= cutoff)

    total = query.count()
    jobs = query.order_by(Job.published_at.desc().nullslast(), Job.created_at.desc()) \
                 .offset((page - 1) * page_size).limit(page_size).all()

    applied_map = {}
    if current_user and current_user.role == "candidate":
        from core.application_status import derive_status
        job_ids = [j.id for j in jobs]
        apps = db.query(Application).filter(
            Application.candidate_id == current_user.id, Application.job_id.in_(job_ids)
        ).all()
        applied_map = {a.job_id: derive_status(a) for a in apps}

    result = []
    for job in jobs:
        count = db.query(Application).filter(Application.job_id == job.id).count()
        app_status = applied_map.get(job.id)
        has_applied = (job.id in applied_map) if current_user and current_user.role == "candidate" else None
        result.append(_to_response(job, applicant_count=count, has_applied=has_applied, application_status=app_status))
    return JobListResponse(total=total, jobs=result)


@router.get("/{job_id}", response_model=jobResponse)
def get_job(
    job_id: str,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional),
):
    job = db.query(Job).filter(Job.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found.")

    is_owner = bool(current_user and current_user.role == "hr")
    if is_owner:
        from core.org_scope import get_org_scoped_user_ids
        is_owner = job.hr_user_id in get_org_scoped_user_ids(current_user, db)

    if job.status != "published" and not is_owner:
        raise HTTPException(status_code=404, detail="Job not found.")

    if not is_owner:
        job.views_count = (job.views_count or 0) + 1
        db.commit()
        db.refresh(job)

    count = db.query(Application).filter(Application.job_id == job.id).count()
    has_applied = None
    application_status = None
    if current_user and current_user.role == "candidate":
        from core.application_status import derive_status
        existing = db.query(Application).filter(
            Application.job_id == job.id, Application.candidate_id == current_user.id
        ).first()
        has_applied = existing is not None
        if existing:
            application_status = derive_status(existing)

    return _to_response(job, applicant_count=count, has_applied=has_applied, application_status=application_status)


# ================= Candidate: AI Job Match / readiness =================

@router.post("/{job_id}/match", response_model=JobMatchResponse)
def match_job(
    job_id: str,
    request: Request,
    body: JobMatchRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    AI-assisted job fit for one specific job, against resume text the
    candidate supplies (pasted, or reused from a prior application -- see
    GET /apply/latest-resume). Powers the job detail page's "Your Job
    Match" / "Increase your chances" / readiness sections -- same
    underlying engine as Candidate Intelligence, just scoped to one job's
    real description.
    """
    if current_user.role != "candidate":
        raise HTTPException(status_code=403, detail="Only candidates can request a job match.")

    job = db.query(Job).filter(Job.id == job_id, Job.status == "published").first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found or no longer published.")

    allowed, wait_seconds = check_rate_limit(f"jobs-match:{current_user.id}", cooldown_seconds=5)
    if not allowed:
        raise HTTPException(status_code=429, detail=f"Please wait {wait_seconds}s and try again.")

    from core.candidate_intelligence import run_candidate_analysis
    try:
        result = run_candidate_analysis(body.cv_text, job.description)
    except AIProviderError as e:
        raise HTTPException(status_code=502, detail=str(e))

    from core.job_intelligence import compute_fit_signals
    signals = compute_fit_signals(job, result, db=db, candidate_id=current_user.id)

    result = dict(result)
    result["skill_gaps"] = SkillGapsOut(**result.get("skill_gaps", {"required": [], "nice_to_have": []}))
    result["signals"] = signals
    return JobMatchResponse(**result)


# ================= Candidate: cheap "Why this job?" chip =================

@router.post("/{job_id}/why-recommended", response_model=WhyRecommendedResponse)
def why_recommended(
    job_id: str,
    body: WhyRecommendedRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Cheap, deterministic (no LLM call) explanation chip for one specific
    job -- same scorer used for the Recommended For You ranking, just run
    against a single job on demand for the job detail page's "Why this
    job?" line. Distinct from /match, which is the full LLM-backed AI Job
    Match analysis -- this is meant to render instantly, not replace it.
    """
    if current_user.role != "candidate":
        raise HTTPException(status_code=403, detail="Only candidates get this.")

    job = db.query(Job).filter(Job.id == job_id, Job.status == "published").first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found or no longer published.")

    from core.job_intelligence import score_job_against_skills
    job_dict = {
        "required_skills": _parse_list(job.required_skills),
        "preferred_skills": _parse_list(job.preferred_skills),
        "work_arrangement": job.work_arrangement,
    }
    has_data = bool(job_dict["required_skills"] or job_dict["preferred_skills"])
    percent, reasons = score_job_against_skills(job_dict, body.cv_text) if has_data else (0, [])
    return WhyRecommendedResponse(match_percent=percent, reasons=reasons, has_enough_data=has_data)


# ================= Candidate: Recommended For You =================

@router.post("/recommended/for-me", response_model=List[RecommendedJob])
def recommended_jobs(
    body: RecommendedJobsRequest,
    limit: int = Query(6, ge=1, le=20),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Cheap, deterministic (no per-job LLM call) skill-overlap ranking across
    every published job with structured skills, using the resume text the
    candidate supplies. Jobs with no structured skills at all are excluded
    rather than shown with a fabricated score -- see score_job_against_skills.
    """
    if current_user.role != "candidate":
        raise HTTPException(status_code=403, detail="Only candidates get job recommendations.")

    from core.job_intelligence import score_job_against_skills
    from core.career_interests import infer_career_interests

    already_applied_ids = {
        r[0] for r in db.query(Application.job_id).filter(Application.candidate_id == current_user.id).all()
    }
    # Light, capped tie-break signal from the candidate's OWN real application
    # history -- reuses core.career_interests (no new scoring engine, no
    # LLM call), and never outweighs the actual skill-match percent below.
    applied_jobs = db.query(Job).filter(Job.id.in_(already_applied_ids)).all() if already_applied_ids else []
    interest_signal = infer_career_interests(applied_jobs)

    jobs = db.query(Job).filter(Job.status == "published").order_by(Job.created_at.desc()).limit(200).all()

    scored = []
    for job in jobs:
        if job.id in already_applied_ids:
            continue
        job_dict = {
            "required_skills": _parse_list(job.required_skills),
            "preferred_skills": _parse_list(job.preferred_skills),
            "work_arrangement": job.work_arrangement,
        }
        percent, reasons = score_job_against_skills(job_dict, body.cv_text)
        if percent > 0:
            if interest_signal["has_enough_data"] and interest_signal["top_work_arrangement"] and job.work_arrangement == interest_signal["top_work_arrangement"]:
                percent = min(100, percent + 5)
                reasons = reasons + ["Similar to roles you've recently explored"]
            scored.append((percent, job, reasons))

    scored.sort(key=lambda t: t[0], reverse=True)
    top = scored[:limit]

    out = []
    for percent, job, reasons in top:
        count = db.query(Application).filter(Application.job_id == job.id).count()
        out.append(RecommendedJob(
            job=_to_response(job, applicant_count=count, has_applied=False),
            match_percent=percent,
            reasons=reasons,
        ))
    return out