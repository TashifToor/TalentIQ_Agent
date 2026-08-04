import json
import os
import tempfile
import shutil
import uuid
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Request, UploadFile, File, status
from sqlalchemy.orm import Session

from models.database import get_db
from models.interview import InterviewPosting, InterviewSession
from models.user import User
from core.interviewer import get_next_turn, generate_report, cv_request_message
from core.assessment import score_assessment
from core.voice import transcribe_audio
from core.redis_client import check_rate_limit
from core.loader import CvLoader
from utils.otp_mailer import send_interview_completed_email, send_candidate_completion_email
from schemas.interview import (
    PublicPostingInfo, InterviewStartRequest, InterviewStartResponse,
    InterviewMessageRequest, InterviewMessageResponse,
    AssessmentQuestionOut, AssessmentAnswerRequest, AssessmentAnswerResponse, AssessmentFlagRequest,
    TerminateResponse, VoiceTranscribeResponse,
)

router = APIRouter(prefix="/interview/public", tags=["AI Interviewer — Public"])

MAX_CV_SIZE_BYTES = 8 * 1024 * 1024
PDF_MAGIC_BYTES = b"%PDF-"
MAX_PHOTO_SIZE_BYTES = 2 * 1024 * 1024
PROCTORING_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "uploads", "proctoring")


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


def _assessment_question_out(posting: InterviewPosting, index: int) -> AssessmentQuestionOut | None:
    questions = json.loads(posting.assessment_questions or "[]")
    if index >= len(questions):
        return None
    q = questions[index]
    return AssessmentQuestionOut(id=q["id"], index=index + 1, total=len(questions), question=q["question"], options=q["options"], seconds_allowed=posting.assessment_seconds_per_question or 60)


def _finalize(session: InterviewSession, posting: InterviewPosting, transcript: list, db: Session):
    """Runs the scoring pass(es) and marks the session completed. Handles
    interview-only, assessment-only, and combined postings."""
    if posting.interview_enabled and transcript:
        extra_questions = json.loads(posting.extra_questions or "[]")
        report = generate_report(
            posting.interviewer_name or "Kelly", posting.job_description, extra_questions, transcript,
            cv_text=session.cv_text,
        )
        session.ai_score = report.get("candidate_score")
        session.final_verdict = report.get("final_verdict")
        session.experience_assessment = report.get("experience_assessment")
        session.deep_analysis = report.get("deep_analysis")
    elif session.assessment_score is not None:
        # Assessment-only posting — derive a verdict straight from the MCQ score.
        s = session.assessment_score
        session.final_verdict = "Strong Hire" if s >= 80 else "Proceed to Human Interview" if s >= 60 else "Borderline" if s >= 40 else "Not a Fit"

    session.status = "completed"
    session.awaiting_cv = False
    session.stage = "done"
    session.completed_at = datetime.now(timezone.utc)
    db.commit()

    if posting.notify_hr_on_completion:
        try:
            hr_user = db.query(User).filter(User.id == posting.hr_user_id).first()
            if hr_user and hr_user.email:
                send_interview_completed_email(
                    to_email=hr_user.email,
                    hr_name=hr_user.name or "there",
                    candidate_name=session.candidate_name,
                    candidate_email=session.candidate_email,
                    role_title=posting.title,
                    score=session.ai_score if session.ai_score is not None else session.assessment_score,
                    verdict=session.final_verdict,
                )
        except Exception as e:
            print(f"[Interview] Could not send HR notification email: {e}")

    try:
        what = "interview and assessment" if (posting.interview_enabled and posting.assessment_enabled) else "assessment" if posting.assessment_enabled else "interview"
        send_candidate_completion_email(
            to_email=session.candidate_email,
            candidate_name=session.candidate_name,
            role_title=posting.title,
            company=posting.company,
            what=what,
        )
    except Exception as e:
        print(f"[Interview] Could not send candidate confirmation email: {e}")


def _finish_assessment_and_advance(session: InterviewSession, posting: InterviewPosting, db: Session) -> dict:
    """Called once the candidate has answered every assessment question."""
    questions = json.loads(posting.assessment_questions or "[]")
    answers = json.loads(session.assessment_answers or "[]")
    result = score_assessment(questions, answers)
    session.assessment_score = result["score"]
    session.assessment_completed_at = datetime.now(timezone.utc)

    # CV upload always comes last, regardless of what stages ran before it.
    session.awaiting_cv = True
    db.commit()
    return {"status": "completed", "next_question": None, "score": result["score"]}


# ── GET /interview/public/{slug} — landing page info, no login ──────────
@router.get("/{slug}", response_model=PublicPostingInfo)
def get_posting_info(slug: str, db: Session = Depends(get_db)):
    posting = _get_active_posting(slug, db)
    return {
        "title": posting.title,
        "company": posting.company,
        "interviewer_name": posting.interviewer_name or "Kelly",
        "is_active": posting.is_active,
        "interview_enabled": posting.interview_enabled,
        "assessment_enabled": posting.assessment_enabled,
        "assessment_seconds_per_question": posting.assessment_seconds_per_question or 60,
        "voice_enabled": posting.voice_enabled or False,
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

    session = InterviewSession(
        posting_id=posting.id,
        candidate_name=name,
        candidate_email=email,
        turn_count=0,
        status="in_progress",
    )

    if posting.interview_enabled:
        extra_questions = json.loads(posting.extra_questions or "[]")
        interviewer_name = posting.interviewer_name or "Kelly"
        opening = get_next_turn(interviewer_name, posting.job_description, extra_questions, transcript=[], turn_count=0)
        session.transcript = json.dumps([{"role": "assistant", "content": opening["message"]}])
        session.stage = "interview"
        db.add(session)
        db.commit()
        db.refresh(session)
        return {"session_id": str(session.id), "stage": "interview", "message": opening["message"]}

    # Assessment-only posting — skip straight to the MCQ stage.
    session.stage = "assessment"
    session.assessment_started_at = datetime.now(timezone.utc)
    db.add(session)
    db.commit()
    db.refresh(session)
    return {"session_id": str(session.id), "stage": "assessment", "message": None}


# ── POST /interview/public/{slug}/{session_id}/message — candidate answers (interview stage) ──
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
    if session.stage != "interview":
        raise HTTPException(status_code=400, detail="The conversational interview stage isn't active for this session.")

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
        if posting.assessment_enabled:
            closing = f"{next_turn['message']} Next up: a short skills assessment ({len(json.loads(posting.assessment_questions or '[]'))} questions). Your camera will be used to take periodic snapshots during it — please stay on this page until it's done."
            transcript.append({"role": "assistant", "content": closing})
            session.transcript = json.dumps(transcript)
            session.stage = "assessment"
            session.assessment_started_at = datetime.now(timezone.utc)
            db.commit()
            return {"message": closing, "status": "in_progress", "turn_count": session.turn_count, "awaiting_cv": False, "next_stage": "assessment"}

        cv_msg = cv_request_message(interviewer_name)
        transcript.append({"role": "assistant", "content": cv_msg})
        session.transcript = json.dumps(transcript)
        session.awaiting_cv = True
        db.commit()
        return {"message": cv_msg, "status": "in_progress", "turn_count": session.turn_count, "awaiting_cv": True, "next_stage": None}

    transcript.append({"role": "assistant", "content": next_turn["message"]})
    session.transcript = json.dumps(transcript)
    db.commit()
    return {"message": next_turn["message"], "status": "in_progress", "turn_count": session.turn_count, "awaiting_cv": False, "next_stage": None}


# ── POST /interview/public/{slug}/{session_id}/voice/transcribe — speech-to-text for a spoken turn ──
MAX_AUDIO_SIZE_BYTES = 10 * 1024 * 1024


@router.post("/{slug}/{session_id}/voice/transcribe", response_model=VoiceTranscribeResponse)
async def transcribe_voice_turn(
    slug: str,
    session_id: str,
    request: Request,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    posting = _get_active_posting(slug, db)
    session = _get_session(posting, session_id, db)

    if session.status == "completed":
        raise HTTPException(status_code=400, detail="This session has already been completed.")

    ip = request.client.host if request.client else "unknown"
    allowed, wait_seconds = check_rate_limit(f"voice-transcribe:{session_id}", cooldown_seconds=1)
    if not allowed:
        raise HTTPException(status_code=429, detail=f"Please wait {wait_seconds}s.")

    contents = await file.read()
    if len(contents) > MAX_AUDIO_SIZE_BYTES:
        raise HTTPException(status_code=413, detail="Recording too long.")
    if len(contents) < 500:
        raise HTTPException(status_code=400, detail="Didn't catch that — the recording was empty.")

    try:
        text = transcribe_audio(contents, filename=file.filename or "audio.webm")
    except Exception as e:
        print(f"[Voice] Transcription failed: {e}")
        raise HTTPException(status_code=502, detail="Could not transcribe that — please try again.")

    if not text:
        raise HTTPException(status_code=400, detail="Didn't catch that — please try again.")

    return {"text": text}


# ── GET /interview/public/{slug}/{session_id}/assessment/current — current MCQ ──
@router.get("/{slug}/{session_id}/assessment/current", response_model=AssessmentQuestionOut)
def get_current_assessment_question(slug: str, session_id: str, db: Session = Depends(get_db)):
    posting = _get_active_posting(slug, db)
    session = _get_session(posting, session_id, db)

    if session.stage != "assessment" or session.status == "completed":
        raise HTTPException(status_code=400, detail="The assessment isn't active for this session.")

    q = _assessment_question_out(posting, session.assessment_current_index or 0)
    if not q:
        raise HTTPException(status_code=400, detail="No more questions.")
    return q


# ── POST /interview/public/{slug}/{session_id}/assessment/answer ────────
@router.post("/{slug}/{session_id}/assessment/answer", response_model=AssessmentAnswerResponse)
def answer_assessment_question(
    slug: str,
    session_id: str,
    payload: AssessmentAnswerRequest,
    request: Request,
    db: Session = Depends(get_db),
):
    posting = _get_active_posting(slug, db)
    session = _get_session(posting, session_id, db)

    if session.stage != "assessment" or session.status == "completed":
        raise HTTPException(status_code=400, detail="The assessment isn't active for this session.")
    if not (-1 <= payload.selected_index <= 3):
        raise HTTPException(status_code=400, detail="selected_index must be -1 (timeout) or 0-3.")

    ip = request.client.host if request.client else "unknown"
    allowed, wait_seconds = check_rate_limit(f"assessment-answer:{session_id}", cooldown_seconds=1)
    if not allowed:
        raise HTTPException(status_code=429, detail=f"Please wait {wait_seconds}s.")

    current_q = _assessment_question_out(posting, session.assessment_current_index or 0)
    if not current_q or current_q.id != payload.question_id:
        raise HTTPException(status_code=400, detail="This isn't the current question — refresh and try again.")

    answers = json.loads(session.assessment_answers or "[]")
    answers.append({"question_id": payload.question_id, "selected_index": payload.selected_index})
    session.assessment_answers = json.dumps(answers)
    session.assessment_current_index = (session.assessment_current_index or 0) + 1
    db.commit()

    next_q = _assessment_question_out(posting, session.assessment_current_index)
    if next_q is None:
        return _finish_assessment_and_advance(session, posting, db)

    return {"status": "in_progress", "next_question": next_q, "score": None}


# ── POST /interview/public/{slug}/{session_id}/assessment/photo — proctoring snapshot ──
@router.post("/{slug}/{session_id}/assessment/photo")
async def upload_proctoring_photo(
    slug: str,
    session_id: str,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    posting = _get_active_posting(slug, db)
    session = _get_session(posting, session_id, db)

    if session.stage != "assessment":
        raise HTTPException(status_code=400, detail="Proctoring is only active during the assessment.")

    contents = await file.read()
    if len(contents) > MAX_PHOTO_SIZE_BYTES:
        raise HTTPException(status_code=413, detail="Snapshot too large.")

    session_dir = os.path.join(PROCTORING_DIR, session_id)
    os.makedirs(session_dir, exist_ok=True)
    filename = f"{datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%S')}_{uuid.uuid4().hex[:6]}.jpg"
    with open(os.path.join(session_dir, filename), "wb") as f:
        f.write(contents)

    photos = json.loads(session.assessment_photos or "[]")
    photos.append(f"{session_id}/{filename}")
    session.assessment_photos = json.dumps(photos)
    db.commit()
    return {"saved": True}


# ── POST /interview/public/{slug}/{session_id}/assessment/flag — proctoring event ──
@router.post("/{slug}/{session_id}/assessment/flag")
def report_proctoring_flag(slug: str, session_id: str, payload: AssessmentFlagRequest, db: Session = Depends(get_db)):
    posting = _get_active_posting(slug, db)
    session = _get_session(posting, session_id, db)

    flags = json.loads(session.assessment_flags or "[]")
    flags.append({
        "type": payload.type,
        "detail": payload.detail,
        "at": datetime.now(timezone.utc).isoformat(),
    })
    session.assessment_flags = json.dumps(flags)
    db.commit()
    return {"logged": True}


# ── POST /interview/public/{slug}/{session_id}/assessment/terminate — immediate end for suspected cheating ──
@router.post("/{slug}/{session_id}/assessment/terminate", response_model=TerminateResponse)
def terminate_for_cheating(slug: str, session_id: str, payload: AssessmentFlagRequest, db: Session = Depends(get_db)):
    posting = _get_active_posting(slug, db)
    session = _get_session(posting, session_id, db)

    if session.status == "completed":
        return {"status": "terminated", "message": "Session already ended."}
    if session.stage != "assessment":
        raise HTTPException(status_code=400, detail="Termination only applies during the assessment.")

    flags = json.loads(session.assessment_flags or "[]")
    flags.append({"type": payload.type, "detail": payload.detail or "Session terminated for leaving the page during the assessment.", "at": datetime.now(timezone.utc).isoformat()})
    session.assessment_flags = json.dumps(flags)

    session.terminated_reason = payload.type
    session.final_verdict = "Flagged — Possible Cheating"
    session.assessment_score = 0  # an interrupted assessment is not a valid completed score
    session.status = "completed"
    session.stage = "done"
    session.awaiting_cv = False
    session.completed_at = datetime.now(timezone.utc)
    db.commit()

    if posting.notify_hr_on_completion:
        try:
            hr_user = db.query(User).filter(User.id == posting.hr_user_id).first()
            if hr_user and hr_user.email:
                send_interview_completed_email(
                    to_email=hr_user.email,
                    hr_name=hr_user.name or "there",
                    candidate_name=session.candidate_name,
                    candidate_email=session.candidate_email,
                    role_title=posting.title,
                    score=0,
                    verdict="⚠ Flagged — Possible Cheating (left the page during the proctored assessment)",
                )
        except Exception as e:
            print(f"[Interview] Could not send HR cheating-flag email: {e}")

    return {"status": "terminated", "message": "Your session was ended because you left the page during the proctored assessment. This has been flagged for the hiring team."}


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
        cv_text = "\n\n".join([d.page_content for d in documents])[:12000]
    finally:
        shutil.rmtree(tmp_dir, ignore_errors=True)

    session.cv_text = cv_text or None

    transcript = json.loads(session.transcript or "[]")
    _finalize(session, posting, transcript, db)

    closing = f"Thanks — got your CV, and that wraps up everything. Your responses have been sent to the hiring team for {posting.title}. We'll be in touch with next steps soon!"
    return {"message": closing, "status": "completed", "turn_count": session.turn_count, "awaiting_cv": False, "next_stage": None}


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

    closing = f"No problem — that wraps up everything. Your responses have been sent to the hiring team for {posting.title}. We'll be in touch with next steps soon!"
    return {"message": closing, "status": "completed", "turn_count": session.turn_count, "awaiting_cv": False, "next_stage": None}