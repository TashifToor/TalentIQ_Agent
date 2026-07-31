import json
import os
import tempfile
import shutil
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Request, UploadFile, File, status
from sqlalchemy.orm import Session

from models.database import get_db
from models.interview import InterviewPosting, InterviewSession
from models.user import User
from core.interviewer import get_next_turn, generate_report, cv_request_message
from core.redis_client import check_rate_limit
from core.loader import CvLoader
from utils.otp_mailer import send_interview_completed_email
from schemas.interview import (
    PublicPostingInfo, InterviewStartRequest, InterviewStartResponse,
    InterviewMessageRequest, InterviewMessageResponse,
)

router = APIRouter(prefix="/interview/public", tags=["AI Interviewer — Public"])

MAX_CV_SIZE_BYTES = 8 * 1024 * 1024
PDF_MAGIC_BYTES = b"%PDF-"


def _get_active_posting(slug: str, db: Session) -> InterviewPosting:
    posting = db.query(InterviewPosting).filter(InterviewPosting.public_slug == slug).first()
    if not posting or not posting.is_active:
        raise HTTPException(status_code=404, detail="This interview link is no longer active.")
    return posting


def _get_session(posting: InterviewPosting, session_id: str, db: Session) -> InterviewSession:
    session = db.query(InterviewSession).filter(
        InterviewSession.id == session_id,
        InterviewSession.posting_id == posting.id,
    ).first()
    if not session:
        raise HTTPException(status_code=404, detail="Interview session not found.")
    return session


def _finalize(session: InterviewSession, posting: InterviewPosting, transcript: list, db: Session):
    """Runs the scoring pass and marks the session completed."""
    extra_questions = json.loads(posting.extra_questions or "[]")
    report = generate_report(
        posting.interviewer_name or "Kelly", posting.job_description, extra_questions, transcript,
        cv_text=session.cv_text,
    )
    session.status = "completed"
    session.awaiting_cv = False
    session.completed_at = datetime.now(timezone.utc)
    session.ai_score = report.get("candidate_score")
    session.final_verdict = report.get("final_verdict")
    session.experience_assessment = report.get("experience_assessment")
    session.deep_analysis = report.get("deep_analysis")
    db.commit()

    # Notify the HR user this posting belongs to — best-effort, never block
    # the candidate's completion on an email hiccup.
    try:
        hr_user = db.query(User).filter(User.id == posting.hr_user_id).first()
        if hr_user and hr_user.email:
            send_interview_completed_email(
                to_email=hr_user.email,
                hr_name=hr_user.name or "there",
                candidate_name=session.candidate_name,
                candidate_email=session.candidate_email,
                role_title=posting.title,
                score=session.ai_score,
                verdict=session.final_verdict,
            )
    except Exception as e:
        print(f"[Interview] Could not send HR notification email: {e}")


# ── GET /interview/public/{slug} — landing page info, no login ──────────
@router.get("/{slug}", response_model=PublicPostingInfo)
def get_posting_info(slug: str, db: Session = Depends(get_db)):
    posting = _get_active_posting(slug, db)
    return {
        "title": posting.title,
        "company": posting.company,
        "interviewer_name": posting.interviewer_name or "Kelly",
        "is_active": posting.is_active,
    }


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
    interviewer_name = posting.interviewer_name or "Kelly"
    opening = get_next_turn(interviewer_name, posting.job_description, extra_questions, transcript=[], turn_count=0)

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
    session = _get_session(posting, session_id, db)

    if session.status == "completed":
        raise HTTPException(status_code=400, detail="This interview has already been completed.")
    if session.awaiting_cv:
        raise HTTPException(status_code=400, detail="Please upload your CV or skip that step to finish up.")

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
    interviewer_name = posting.interviewer_name or "Kelly"
    next_turn = get_next_turn(interviewer_name, posting.job_description, extra_questions, transcript, session.turn_count)

    if next_turn["action"] == "conclude":
        # Don't score yet — ask for the CV first (skippable), then finalize.
        cv_msg = cv_request_message(interviewer_name)
        transcript.append({"role": "assistant", "content": cv_msg})
        session.transcript = json.dumps(transcript)
        session.awaiting_cv = True
        db.commit()
        return {"message": cv_msg, "status": "in_progress", "turn_count": session.turn_count, "awaiting_cv": True}

    transcript.append({"role": "assistant", "content": next_turn["message"]})
    session.transcript = json.dumps(transcript)
    db.commit()
    return {"message": next_turn["message"], "status": "in_progress", "turn_count": session.turn_count, "awaiting_cv": False}


# ── POST /interview/public/{slug}/{session_id}/upload-cv — candidate attaches their CV ──
@router.post("/{slug}/{session_id}/upload-cv", response_model=InterviewMessageResponse)
async def upload_cv(
    slug: str,
    session_id: str,
    request: Request,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    posting = _get_active_posting(slug, db)
    session = _get_session(posting, session_id, db)

    if session.status == "completed":
        raise HTTPException(status_code=400, detail="This interview has already been completed.")
    if not session.awaiting_cv:
        raise HTTPException(status_code=400, detail="A CV wasn't requested for this session yet.")

    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are supported right now.")

    contents = await file.read()
    if len(contents) > MAX_CV_SIZE_BYTES:
        raise HTTPException(status_code=413, detail="File too large. Maximum size is 8MB.")
    if not contents.startswith(PDF_MAGIC_BYTES):
        raise HTTPException(status_code=400, detail="File is not a valid PDF.")

    tmp_dir = tempfile.mkdtemp()
    try:
        tmp_path = os.path.join(tmp_dir, "cv.pdf")
        with open(tmp_path, "wb") as f:
            f.write(contents)
        documents = CvLoader(data_path=tmp_dir).load()
        cv_text = "\n\n".join([d.page_content for d in documents])[:12000]  # keep prompt size sane
    finally:
        shutil.rmtree(tmp_dir, ignore_errors=True)

    session.cv_text = cv_text or None

    transcript = json.loads(session.transcript or "[]")
    _finalize(session, posting, transcript, db)

    closing = f"Thanks — got your CV, and that wraps up the interview. Your responses have been sent to the hiring team for {posting.title}. We'll be in touch with next steps soon!"
    return {"message": closing, "status": "completed", "turn_count": session.turn_count, "awaiting_cv": False}


# ── POST /interview/public/{slug}/{session_id}/skip-cv — candidate skips CV upload ──
@router.post("/{slug}/{session_id}/skip-cv", response_model=InterviewMessageResponse)
def skip_cv(slug: str, session_id: str, db: Session = Depends(get_db)):
    posting = _get_active_posting(slug, db)
    session = _get_session(posting, session_id, db)

    if session.status == "completed":
        raise HTTPException(status_code=400, detail="This interview has already been completed.")
    if not session.awaiting_cv:
        raise HTTPException(status_code=400, detail="A CV wasn't requested for this session yet.")

    transcript = json.loads(session.transcript or "[]")
    _finalize(session, posting, transcript, db)

    closing = f"No problem — that wraps up the interview. Your responses have been sent to the hiring team for {posting.title}. We'll be in touch with next steps soon!"
    return {"message": closing, "status": "completed", "turn_count": session.turn_count, "awaiting_cv": False}