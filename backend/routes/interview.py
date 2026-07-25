import json
import os
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from models.database import get_db
from middleware.auth import get_current_user
from models.user import User
from models.interview import InterviewPosting, InterviewSession
from core.org_scope import get_org_scoped_user_ids
from schemas.interview import (
    InterviewPostingCreate, InterviewPostingResponse,
    InterviewSessionSummary, InterviewSessionReport,
)

router = APIRouter(prefix="/interview", tags=["AI Interviewer"])

FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:3000")


def require_hr(current_user: User):
    if current_user.role != "hr":
        raise HTTPException(status_code=403, detail="HR only.")
    return current_user


def _posting_to_response(posting: InterviewPosting, candidate_count: int) -> dict:
    return {
        "id": str(posting.id),
        "title": posting.title,
        "company": posting.company,
        "job_description": posting.job_description,
        "extra_questions": json.loads(posting.extra_questions or "[]"),
        "public_slug": posting.public_slug,
        "public_link": f"{FRONTEND_URL}/interview/{posting.public_slug}",
        "is_active": posting.is_active,
        "candidate_count": candidate_count,
        "created_at": posting.created_at.isoformat() if posting.created_at else "",
    }


# ── POST /interview/postings — HR creates a posting, gets a public link ──
@router.post("/postings", response_model=InterviewPostingResponse, status_code=status.HTTP_201_CREATED)
def create_posting(
    payload: InterviewPostingCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    require_hr(current_user)

    if not payload.job_description.strip():
        raise HTTPException(status_code=400, detail="Job description cannot be empty.")

    posting = InterviewPosting(
        hr_user_id=current_user.id,
        title=payload.title.strip() or "Untitled Role",
        company=payload.company,
        job_description=payload.job_description.strip(),
        extra_questions=json.dumps([q.strip() for q in payload.extra_questions if q.strip()]),
    )
    db.add(posting)
    db.commit()
    db.refresh(posting)

    return _posting_to_response(posting, candidate_count=0)


# ── GET /interview/postings — HR lists their (org-scoped) postings ──────
@router.get("/postings", response_model=list[InterviewPostingResponse])
def list_postings(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    require_hr(current_user)
    scoped_ids = get_org_scoped_user_ids(current_user, db)

    postings = (
        db.query(InterviewPosting)
        .filter(InterviewPosting.hr_user_id.in_(scoped_ids))
        .order_by(InterviewPosting.created_at.desc())
        .all()
    )

    result = []
    for posting in postings:
        count = db.query(InterviewSession).filter(InterviewSession.posting_id == posting.id).count()
        result.append(_posting_to_response(posting, candidate_count=count))
    return result


# ── PATCH /interview/postings/{id}/toggle — activate/deactivate link ────
@router.patch("/postings/{posting_id}/toggle", response_model=InterviewPostingResponse)
def toggle_posting(
    posting_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    require_hr(current_user)
    scoped_ids = get_org_scoped_user_ids(current_user, db)

    posting = db.query(InterviewPosting).filter(
        InterviewPosting.id == posting_id,
        InterviewPosting.hr_user_id.in_(scoped_ids),
    ).first()
    if not posting:
        raise HTTPException(status_code=404, detail="Posting not found.")

    posting.is_active = not posting.is_active
    db.commit()
    db.refresh(posting)

    count = db.query(InterviewSession).filter(InterviewSession.posting_id == posting.id).count()
    return _posting_to_response(posting, candidate_count=count)


# ── GET /interview/postings/{id}/candidates — list candidate sessions ───
@router.get("/postings/{posting_id}/candidates", response_model=list[InterviewSessionSummary])
def list_candidates(
    posting_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    require_hr(current_user)
    scoped_ids = get_org_scoped_user_ids(current_user, db)

    posting = db.query(InterviewPosting).filter(
        InterviewPosting.id == posting_id,
        InterviewPosting.hr_user_id.in_(scoped_ids),
    ).first()
    if not posting:
        raise HTTPException(status_code=404, detail="Posting not found.")

    sessions = (
        db.query(InterviewSession)
        .filter(InterviewSession.posting_id == posting_id)
        .order_by(InterviewSession.ai_score.desc().nullslast())
        .all()
    )

    return [
        {
            "id": str(s.id),
            "candidate_name": s.candidate_name,
            "candidate_email": s.candidate_email,
            "status": s.status,
            "ai_score": s.ai_score,
            "final_verdict": s.final_verdict,
            "created_at": s.created_at.isoformat() if s.created_at else "",
            "completed_at": s.completed_at.isoformat() if s.completed_at else None,
        }
        for s in sessions
    ]


# ── GET /interview/sessions/{id} — full transcript + report for one candidate ──
@router.get("/sessions/{session_id}", response_model=InterviewSessionReport)
def get_session_report(
    session_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    require_hr(current_user)
    scoped_ids = get_org_scoped_user_ids(current_user, db)

    session = db.query(InterviewSession).filter(InterviewSession.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found.")

    posting = db.query(InterviewPosting).filter(
        InterviewPosting.id == session.posting_id,
        InterviewPosting.hr_user_id.in_(scoped_ids),
    ).first()
    if not posting:
        raise HTTPException(status_code=404, detail="Session not found.")

    return {
        "id": str(session.id),
        "candidate_name": session.candidate_name,
        "candidate_email": session.candidate_email,
        "status": session.status,
        "ai_score": session.ai_score,
        "final_verdict": session.final_verdict,
        "experience_assessment": session.experience_assessment,
        "deep_analysis": session.deep_analysis,
        "transcript": json.loads(session.transcript or "[]"),
        "created_at": session.created_at.isoformat() if session.created_at else "",
        "completed_at": session.completed_at.isoformat() if session.completed_at else None,
    }