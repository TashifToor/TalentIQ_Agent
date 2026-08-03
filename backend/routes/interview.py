import json
import os
import random
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from models.database import get_db
from middleware.auth import get_current_user
from models.user import User
from models.interview import InterviewPosting, InterviewSession
from core.org_scope import get_org_scoped_user_ids
from core.assessment import generate_assessment_questions, score_assessment, MIN_QUESTIONS, MAX_QUESTIONS
from schemas.interview import (
    InterviewPostingCreate, InterviewPostingResponse,
    InterviewSessionSummary, InterviewSessionReport,
)

router = APIRouter(prefix="/interview", tags=["AI Interviewer"])

FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:3000")
DEFAULT_INTERVIEWER_NAMES = ["Kelly", "Alex", "Sarah", "Sam", "Emma", "Jordan"]
PROCTORING_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "uploads", "proctoring")


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
        "interviewer_name": posting.interviewer_name or "Kelly",
        "interview_enabled": posting.interview_enabled,
        "assessment_enabled": posting.assessment_enabled,
        "assessment_source": posting.assessment_source,
        "assessment_question_count": len(json.loads(posting.assessment_questions or "[]")),
        "assessment_seconds_per_question": posting.assessment_seconds_per_question or 60,
        "notify_hr_on_completion": posting.notify_hr_on_completion if posting.notify_hr_on_completion is not None else True,
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

    if not payload.interview_enabled and not payload.assessment_enabled:
        raise HTTPException(status_code=400, detail="Enable at least one of the interview or the assessment.")

    assessment_questions = []
    if payload.assessment_enabled:
        if payload.assessment_source not in ("ai", "bank"):
            raise HTTPException(status_code=400, detail="assessment_source must be 'ai' or 'bank' when the assessment is enabled.")

        if payload.assessment_source == "bank":
            if not payload.assessment_bank or len(payload.assessment_bank) < MIN_QUESTIONS:
                raise HTTPException(status_code=400, detail=f"Provide at least {MIN_QUESTIONS} questions for a question bank.")
            if len(payload.assessment_bank) > MAX_QUESTIONS:
                raise HTTPException(status_code=400, detail=f"Maximum {MAX_QUESTIONS} questions allowed.")
            for q in payload.assessment_bank:
                if len(q.options) != 4 or not (0 <= q.correct_index <= 3):
                    raise HTTPException(status_code=400, detail=f"Question '{q.question[:40]}...' needs exactly 4 options and a valid correct_index (0-3).")
            import uuid as _uuid
            assessment_questions = [
                {"id": str(_uuid.uuid4())[:8], "question": q.question, "options": q.options,
                 "correct_index": q.correct_index, "topic": q.topic or "general"}
                for q in payload.assessment_bank
            ]
        else:  # "ai"
            counts = {
                "dsa": max(0, payload.assessment_count_dsa),
                "job_desc": max(0, payload.assessment_count_job_desc),
                "problem_solving": max(0, payload.assessment_count_problem_solving),
                "teamwork": max(0, payload.assessment_count_teamwork),
                "hr": max(0, payload.assessment_count_hr),
            }
            total_q = sum(counts.values())
            if not (MIN_QUESTIONS <= total_q <= MAX_QUESTIONS):
                raise HTTPException(status_code=400, detail=f"Total questions across all categories must be between {MIN_QUESTIONS} and {MAX_QUESTIONS} (currently {total_q}).")
            assessment_questions = generate_assessment_questions(payload.job_description.strip(), counts)
            if not assessment_questions:
                raise HTTPException(status_code=500, detail="Could not generate assessment questions. Please try again.")

    posting = InterviewPosting(
        hr_user_id=current_user.id,
        title=payload.title.strip() or "Untitled Role",
        company=payload.company,
        job_description=payload.job_description.strip(),
        extra_questions=json.dumps([q.strip() for q in payload.extra_questions if q.strip()]),
        interviewer_name=(payload.interviewer_name.strip() if payload.interviewer_name and payload.interviewer_name.strip() else random.choice(DEFAULT_INTERVIEWER_NAMES)),
        interview_enabled=payload.interview_enabled,
        assessment_enabled=payload.assessment_enabled,
        assessment_source=payload.assessment_source if payload.assessment_enabled else None,
        assessment_num_questions=len(assessment_questions) if assessment_questions else 0,
        assessment_questions=json.dumps(assessment_questions),
        assessment_seconds_per_question=max(5, min(600, payload.assessment_seconds_per_question or 60)),
        notify_hr_on_completion=payload.notify_hr_on_completion,
    )
    db.add(posting)
    db.commit()
    db.refresh(posting)

    return _posting_to_response(posting, candidate_count=0)


# ── DELETE /interview/postings/{id} — permanently delete a posting + all its candidate sessions ──
@router.delete("/postings/{posting_id}")
def delete_posting(
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

    db.query(InterviewSession).filter(InterviewSession.posting_id == posting.id).delete()
    db.delete(posting)
    db.commit()
    return {"deleted": True}


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
            "assessment_score": s.assessment_score,
            "proctoring_flag_count": len(json.loads(s.assessment_flags or "[]")),
            "terminated_reason": s.terminated_reason,
            "created_at": s.created_at.isoformat() if s.created_at else "",
            "completed_at": s.completed_at.isoformat() if s.completed_at else None,
        }
        for s in sessions
    ]


# ── GET /interview/candidates — ALL completed interview candidates across every posting, for the History tab ──
@router.get("/candidates")
def list_all_candidates(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    require_hr(current_user)
    scoped_ids = get_org_scoped_user_ids(current_user, db)

    rows = (
        db.query(InterviewSession, InterviewPosting)
        .join(InterviewPosting, InterviewSession.posting_id == InterviewPosting.id)
        .filter(InterviewPosting.hr_user_id.in_(scoped_ids))
        .order_by(InterviewSession.created_at.desc())
        .limit(100)
        .all()
    )

    return [
        {
            "id": str(s.id),
            "posting_id": str(p.id),
            "posting_title": p.title,
            "candidate_name": s.candidate_name,
            "candidate_email": s.candidate_email,
            "status": s.status,
            "ai_score": s.ai_score,
            "final_verdict": s.final_verdict,
            "assessment_score": s.assessment_score,
            "experience_assessment": s.experience_assessment,
            "deep_analysis": s.deep_analysis,
            "created_at": s.created_at.isoformat() if s.created_at else "",
            "completed_at": s.completed_at.isoformat() if s.completed_at else None,
        }
        for s, p in rows
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

    assessment_breakdown = None
    if session.assessment_score is not None:
        questions = json.loads(posting.assessment_questions or "[]")
        answers = json.loads(session.assessment_answers or "[]")
        if questions:
            assessment_breakdown = score_assessment(questions, answers)["breakdown_by_topic"]

    return {
        "id": str(session.id),
        "candidate_name": session.candidate_name,
        "candidate_email": session.candidate_email,
        "status": session.status,
        "stage": session.stage,
        "ai_score": session.ai_score,
        "final_verdict": session.final_verdict,
        "experience_assessment": session.experience_assessment,
        "deep_analysis": session.deep_analysis,
        "transcript": json.loads(session.transcript or "[]"),
        "assessment_score": session.assessment_score,
        "assessment_breakdown": assessment_breakdown,
        "assessment_flags": json.loads(session.assessment_flags or "[]"),
        "assessment_photos": json.loads(session.assessment_photos or "[]"),
        "terminated_reason": session.terminated_reason,
        "created_at": session.created_at.isoformat() if session.created_at else "",
        "completed_at": session.completed_at.isoformat() if session.completed_at else None,
    }


# ── GET /interview/sessions/{id}/photos/{filename} — HR views a proctoring snapshot ──
@router.get("/sessions/{session_id}/photos/{filename}")
def get_proctoring_photo(
    session_id: str,
    filename: str,
    token: str = None,
    db: Session = Depends(get_db),
):
    # A plain <img src> can't send an Authorization header, so this endpoint
    # accepts the JWT as a query param too — everything else about auth
    # (signature, expiry, org scoping below) is identical either way.
    from jose import jwt, JWTError
    from middleware.auth import SECRET_KEY, ALGORITHM
    if not token:
        raise HTTPException(status_code=401, detail="Missing token.")
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = payload.get("user_id")
    except JWTError:
        raise HTTPException(status_code=401, detail="Token expired or invalid.")
    current_user = db.query(User).filter(User.id == user_id).first()
    if not current_user:
        raise HTTPException(status_code=401, detail="Invalid token.")

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

    photos = json.loads(session.assessment_photos or "[]")
    matching = [p for p in photos if os.path.basename(p) == filename]
    if not matching:
        raise HTTPException(status_code=404, detail="Photo not found.")

    path = os.path.join(PROCTORING_DIR, session_id, filename)
    if not os.path.isfile(path):
        raise HTTPException(status_code=404, detail="Photo file missing on disk.")
    return FileResponse(path, media_type="image/jpeg")