from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session

from models.database import get_db
from models.user import User
from middleware.auth import get_current_user
from schemas.candidate_intelligence import CandidateAnalysisRequest, CandidateAnalysisResponse
from core.candidate_intelligence import run_candidate_analysis
from core.ai_provider import AIProviderError
from core.redis_client import check_rate_limit
from routes.screen import check_screening_access  # reuse the existing scan-quota gate — no second entitlement system

router = APIRouter(prefix="/candidate-intelligence", tags=["Candidate Intelligence"])


def _client_ip(request: Request) -> str:
    fwd = request.headers.get("x-forwarded-for")
    return fwd.split(",")[0].strip() if fwd else (request.client.host if request.client else "unknown")


async def _run(request: Request, body: CandidateAnalysisRequest, db: Session, current_user: User, cooldown_key: str) -> CandidateAnalysisResponse:
    ip = _client_ip(request)
    allowed, wait_seconds = check_rate_limit(f"{cooldown_key}:{current_user.id if current_user else ip}", cooldown_seconds=5)
    if not allowed:
        raise HTTPException(status_code=429, detail=f"Please wait {wait_seconds}s and try again.")

    # Reuses the exact same access rule as the standalone CV Optimizer /
    # Job Match Lab (free-scan limit, trial, unlimited-access allowlist) —
    # this is a new UI on the same underlying entitlement, not a new one.
    await check_screening_access(current_user, db)

    try:
        result = run_candidate_analysis(body.cv_text, body.job_description)
    except AIProviderError as e:
        raise HTTPException(status_code=502, detail=str(e))

    return CandidateAnalysisResponse(**result)


@router.post("/optimize", response_model=CandidateAnalysisResponse)
async def optimize(
    request: Request,
    body: CandidateAnalysisRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """CV Optimizer — requires a job description; the whole analysis is scoped to that specific role."""
    if not body.job_description or not body.job_description.strip():
        raise HTTPException(status_code=400, detail="A job description is required for CV Optimizer analysis.")
    return await _run(request, body, db, current_user, "candidate-intel-optimize")


@router.post("/screening", response_model=CandidateAnalysisResponse)
async def screening(
    request: Request,
    body: CandidateAnalysisRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Candidate Screening — job description optional; without one, analysis reflects general CV/ATS strength."""
    return await _run(request, body, db, current_user, "candidate-intel-screening")