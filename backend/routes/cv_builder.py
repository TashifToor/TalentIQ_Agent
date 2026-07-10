import os
import tempfile
import shutil
from fastapi import APIRouter, UploadFile, File, Form, Depends, HTTPException, status, Request
from fastapi.responses import Response
from sqlalchemy.orm import Session

from models.database import get_db
from models.user import User
from middleware.auth import get_current_user_optional
from schemas.cv_builder import CVData, GenerateCVRequest
from core.loader import CvLoader
from core.cv_extractor import extract_cv_data
from core.cv_generator import optimize_cv_for_jd
from core.cv_pdf_renderer import render_cv_pdf
from core.redis_client import get_ip_usage_count, increment_ip_usage, check_rate_limit
from core.analytics import track

router = APIRouter(prefix="/cv-builder", tags=["CV Builder"])

ANON_FREE_LIMIT = 2
CANDIDATE_FREE_LIMIT = 3
MAX_PDF_SIZE_MB = 8
MAX_PDF_SIZE_BYTES = MAX_PDF_SIZE_MB * 1024 * 1024
PDF_MAGIC_BYTES = b"%PDF-"


def _client_ip(request: Request) -> str:
    # Respect a reverse proxy's forwarded header if present (e.g. behind
    # nginx/Render/Railway), falling back to the direct connection IP.
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


def _check_and_consume_quota(request: Request, db: Session, user: User | None):
    """
    Enforces the free-tier limit BEFORE doing any expensive work, and only
    increments usage on the way in — a failed generation shouldn't cost
    the user a free credit twice, but we also don't want people to build
    successfully and then not have it counted.
    """
    if user is None:
        ip = _client_ip(request)
        used = get_ip_usage_count(ip, "cvbuilder")
        if used >= ANON_FREE_LIMIT:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"ANON_LIMIT_REACHED|You've used your {ANON_FREE_LIMIT} free CV builds. Sign up (it's free) to keep going."
            )
        return  # actual increment happens after successful generation, see below

    if user.role != "candidate":
        # HR / other roles: CV Builder is a candidate-facing feature only (by design).
        raise HTTPException(status_code=403, detail="CV Builder is available for candidate accounts.")

    if user.subscription_status == "active":
        return  # paid — unlimited

    if (user.cv_builds_used or 0) >= CANDIDATE_FREE_LIMIT:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"FREE_LIMIT_REACHED|You've used all {CANDIDATE_FREE_LIMIT} free CV builds. Upgrade to Candidate Pro for unlimited access."
        )


def _consume_quota(request: Request, db: Session, user: User | None):
    """Called only after a successful generation."""
    if user is None:
        increment_ip_usage(_client_ip(request), "cvbuilder")
    else:
        user.cv_builds_used = (user.cv_builds_used or 0) + 1
        db.add(user)
        db.commit()


@router.post("/parse")
async def parse_cv(
    request: Request,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User | None = Depends(get_current_user_optional),
):
    """Upload an existing CV (PDF) and get back structured, editable fields."""
    ip = _client_ip(request)
    allowed, wait_seconds = check_rate_limit(f"cvbuilder-parse:{current_user.id if current_user else ip}", cooldown_seconds=5)
    if not allowed:
        raise HTTPException(status_code=429, detail=f"Please wait {wait_seconds}s and try again.")

    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are supported.")

    contents = await file.read()
    if len(contents) > MAX_PDF_SIZE_BYTES:
        raise HTTPException(status_code=413, detail=f"File too large. Maximum size is {MAX_PDF_SIZE_MB}MB.")
    if not contents.startswith(PDF_MAGIC_BYTES):
        raise HTTPException(status_code=400, detail="File is not a valid PDF.")

    tmp_dir = tempfile.mkdtemp()
    try:
        tmp_path = os.path.join(tmp_dir, "upload.pdf")
        with open(tmp_path, "wb") as f:
            f.write(contents)

        loader = CvLoader(data_path=tmp_dir)
        documents = loader.load()
        if not documents:
            raise HTTPException(status_code=400, detail="Could not extract text from PDF.")

        full_text = "\n\n".join([d.page_content for d in documents])
        cv_data = extract_cv_data(full_text)
        return cv_data.model_dump()
    finally:
        shutil.rmtree(tmp_dir, ignore_errors=True)


@router.post("/generate")
async def generate_cv(
    request: Request,
    body: GenerateCVRequest,
    db: Session = Depends(get_db),
    current_user: User | None = Depends(get_current_user_optional),
):
    """Generate a downloadable, ATS-friendly PDF from structured CV data,
    optionally rewritten to better match a target job description."""

    ip = _client_ip(request)
    allowed, wait_seconds = check_rate_limit(f"cvbuilder-gen:{current_user.id if current_user else ip}", cooldown_seconds=5)
    if not allowed:
        raise HTTPException(status_code=429, detail=f"Please wait {wait_seconds}s and try again.")

    _check_and_consume_quota(request, db, current_user)

    if body.template not in ("modern", "classic"):
        raise HTTPException(status_code=400, detail="template must be 'modern' or 'classic'.")

    cv_data = body.cv_data
    if body.job_description and body.job_description.strip():
        try:
            cv_data = optimize_cv_for_jd(cv_data, body.job_description.strip())
        except Exception as e:
            print(f"[CVBuilder] JD optimization failed, using original content: {e}")

    try:
        pdf_bytes = render_cv_pdf(cv_data, template=body.template)
    except Exception as e:
        print(f"[CVBuilder] PDF render failed: {e}")
        raise HTTPException(status_code=500, detail="Could not generate PDF. Please try again.")

    _consume_quota(request, db, current_user)
    track(current_user.id if current_user else f"anon:{ip}", "cv_built", {
        "template": body.template,
        "jd_optimized": bool(body.job_description),
        "anonymous": current_user is None,
    })

    filename = f"{(cv_data.full_name or 'resume').replace(' ', '_')}_CV.pdf"
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )