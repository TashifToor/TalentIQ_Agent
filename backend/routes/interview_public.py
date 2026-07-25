import json
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from models.database import get_db
from models.interview import InterviewPosting, InterviewSession
from core.interviewer import get_next_turn, generate_report
from core.redis_client import check_rate_limit
from schemas.interview import (
    PublicPostingInfo, InterviewStartRequest, InterviewStartResponse,
    InterviewMessageRequest, InterviewMessageResponse,
)

router = APIRouter(prefix="/interview/public", tags=["AI Interviewer — Public"])


def _get_active_posting(slug: str, db: Session) -> InterviewPosting:
    posting = db.query(InterviewPosting).filter(InterviewPosting.public_slug == slug).first()
    if not posting or not posting.is_active:
        raise HTTPException(status_code=404, detail="This interview link is no longer active.")
    return posting


# ── GET /interview/public/{slug} — landing page info, no login ──────────
@router.get("/{slug}", response_model=PublicPostingInfo)
def get_posting_info(slug: str, db: Session = Depends(get_db)):
    posting = _get_active_posting(slug, db)
    return {"title": posting.title, "company": posting.company, "is_active": posting.is_active}


# ── POST /interview/public/{slug}/start — candidate enters name+email ───
@router.post("/{slug}/start", response_model=InterviewStartResponse, status_code=status.HTTP_201_CREATED)
def start_interview(slug: str, payload: InterviewStartRequest, request: Request, db: Session = Depends(get_db)):
    posting = _get_active_posting(slug, db)

    name = payload.candidate_name.strip()
    email = payload.candidate_email.strip()
    if not name or not email or "@" not in email:
        raise HTTPException(status_code=400, detail="A valid name and email are required to start the interview.")

    ip = request.client.host if request.client else "unknown"
    allowed, wait_seconds = check_rate_limit(f"interview-start:{ip}", cooldown_seconds=5)
    if not allowed:
        raise HTTPException(status_code=429, detail=f"Please wait {wait_seconds}s before trying again.")

    extra_questions = json.loads(posting.extra_questions or "[]")
    opening = get_next_turn(posting.job_description, extra_questions, transcript=[], turn_count=0)

    transcript = [{"role": "assistant", "content": opening["message"]}]

    session = InterviewSession(
        posting_id=posting.id,
        candidate_name=name,
        candidate_email=email,
        transcript=json.dumps(transcript),
        turn_count=0,
        status="in_progress",
    )
    db.add(session)
    db.commit()
    db.refresh(session)

    return {"session_id": str(session.id), "message": opening["message"]}


# ── POST /interview/public/{slug}/{session_id}/message — candidate answers ──
@router.post("/{slug}/{session_id}/message", response_model=InterviewMessageResponse)
def send_message(
    slug: str,
    session_id: str,
    payload: InterviewMessageRequest,
    request: Request,
    db: Session = Depends(get_db),
):
    posting = _get_active_posting(slug, db)

    session = db.query(InterviewSession).filter(
        InterviewSession.id == session_id,
        InterviewSession.posting_id == posting.id,
    ).first()
    if not session:
        raise HTTPException(status_code=404, detail="Interview session not found.")

    if session.status == "completed":
        raise HTTPException(status_code=400, detail="This interview has already been completed.")

    answer = payload.message.strip()
    if len(answer) < 2:
        raise HTTPException(status_code=400, detail="Please provide an actual answer to continue.")

    ip = request.client.host if request.client else "unknown"
    allowed, wait_seconds = check_rate_limit(f"interview-msg:{session_id}", cooldown_seconds=2)
    if not allowed:
        raise HTTPException(status_code=429, detail=f"Please wait {wait_seconds}s before sending your next message.")

    transcript = json.loads(session.transcript or "[]")
    transcript.append({"role": "candidate", "content": answer})
    session.turn_count = (session.turn_count or 0) + 1

    extra_questions = json.loads(posting.extra_questions or "[]")
    next_turn = get_next_turn(posting.job_description, extra_questions, transcript, session.turn_count)

    transcript.append({"role": "assistant", "content": next_turn["message"]})
    session.transcript = json.dumps(transcript)

    if next_turn["action"] == "conclude":
        session.status = "completed"
        session.completed_at = datetime.now(timezone.utc)

        report = generate_report(posting.job_description, extra_questions, transcript)
        session.ai_score = report.get("candidate_score")
        session.final_verdict = report.get("final_verdict")
        session.experience_assessment = report.get("experience_assessment")
        session.deep_analysis = report.get("deep_analysis")

        db.commit()
        return {"message": next_turn["message"], "status": "completed", "turn_count": session.turn_count}

    db.commit()
    return {"message": next_turn["message"], "status": "in_progress", "turn_count": session.turn_count}