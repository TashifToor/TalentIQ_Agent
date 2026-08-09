import json
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, WebSocket, WebSocketDisconnect
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from models.database import get_db
from models.practice import PracticeSession
from models.user import User
from middleware.auth import get_current_user, decode_user_token
from schemas.practice import (
    PracticeSessionCreate, PracticeSessionStateResponse, PracticeQuestionPublic,
    PracticeMessageRequest, PracticeTurnResponse,
    PracticeAssessmentAnswerRequest, PracticeAssessmentAnswerResponse,
    PracticeTranscribeResponse, PracticeReportResponse, PracticeHistoryItem,
)
from core.interviewer import get_next_turn, stream_next_turn, generate_report
from core.assessment import generate_assessment_questions, score_assessment, MIN_QUESTIONS, MAX_QUESTIONS
from core.voice import transcribe_audio
from core.voice_session import VoiceSession

router = APIRouter(prefix="/practice", tags=["Practice Sessions"])

CATEGORIES = ["job_desc", "dsa", "problem_solving", "teamwork", "hr"]


# ── helpers ──────────────────────────────────────────────────────

def _get_owned_session(session_id: str, user: User, db: Session) -> PracticeSession:
    session = db.query(PracticeSession).filter(PracticeSession.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Practice session not found")
    if session.user_id != user.id:
        raise HTTPException(status_code=403, detail="Not your practice session")
    return session


def _synth_job_description(session: PracticeSession) -> str:
    """
    Practice sessions don't require a JD — if the candidate didn't paste one,
    build a minimal stand-in from their config so the (unmodified) interview
    engine still has something concrete to ground questions in.
    """
    if session.job_description and session.job_description.strip():
        return session.job_description.strip()
    skills = json.loads(session.skills_focus or "[]")
    parts = [f"Practice interview for a {session.experience_level or ''} {session.target_role} role.".replace("  ", " ")]
    if skills:
        parts.append(f"Focus areas: {', '.join(skills)}.")
    if session.difficulty:
        parts.append(f"Target difficulty: {session.difficulty}.")
    return " ".join(parts)


def _turns_for_length(minutes: int) -> tuple[int, int]:
    if minutes <= 10:
        return 3, 5
    if minutes <= 20:
        return 5, 9
    return 8, 14


def _question_counts_for_length(minutes: int) -> dict:
    total = max(MIN_QUESTIONS, min(MAX_QUESTIONS, minutes))
    base, remainder = divmod(total, len(CATEGORIES))
    counts = {cat: base for cat in CATEGORIES}
    for i in range(remainder):
        counts[CATEGORIES[i]] += 1
    return counts


def _state_response(session: PracticeSession) -> PracticeSessionStateResponse:
    questions = json.loads(session.assessment_questions or "[]")
    public_questions = [
        PracticeQuestionPublic(id=q["id"], question=q["question"], options=q["options"], topic=q.get("topic", "general"))
        for q in questions
    ] if session.mode == "mcq" else None
    return PracticeSessionStateResponse(
        id=str(session.id), mode=session.mode, stage=session.stage, status=session.status,
        target_role=session.target_role, interviewer_name=session.interviewer_name or "Kelly",
        transcript=json.loads(session.transcript or "[]"), turn_count=session.turn_count,
        assessment_questions=public_questions, assessment_current_index=session.assessment_current_index,
        assessment_total=len(questions),
    )


# ── lifecycle ────────────────────────────────────────────────────

@router.post("/sessions", response_model=PracticeSessionStateResponse)
def create_practice_session(payload: PracticeSessionCreate, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    if not payload.target_role.strip():
        raise HTTPException(status_code=400, detail="Target role is required.")

    session = PracticeSession(
        user_id=user.id, mode=payload.mode, target_role=payload.target_role.strip(),
        experience_level=payload.experience_level, difficulty=payload.difficulty,
        length_minutes=max(5, min(60, payload.length_minutes or 15)),
        skills_focus=json.dumps(payload.skills_focus or []),
        job_description=payload.job_description, resume_text=payload.resume_text,
        interviewer_name="Kelly",
    )

    if payload.mode == "mcq":
        counts = _question_counts_for_length(session.length_minutes)
        questions = generate_assessment_questions(_synth_job_description(session), counts)
        if not questions:
            raise HTTPException(status_code=502, detail="Could not generate practice questions — try again.")
        session.assessment_questions = json.dumps(questions)
        session.stage = "assessment"
    else:
        # chatbot / voice_agent — same hardcoded opening as the recruiter flow (turn_count=0)
        first = get_next_turn(session.interviewer_name, _synth_job_description(session), payload.skills_focus or [], [], 0)
        session.transcript = json.dumps([{"role": "assistant", "content": first["message"]}])
        session.stage = "interview"

    db.add(session)
    db.commit()
    db.refresh(session)
    return _state_response(session)


@router.get("/sessions/{session_id}", response_model=PracticeSessionStateResponse)
def get_practice_session(session_id: str, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    session = _get_owned_session(session_id, user, db)
    return _state_response(session)


@router.post("/sessions/{session_id}/message", response_model=PracticeTurnResponse)
def send_practice_message(session_id: str, payload: PracticeMessageRequest, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    session = _get_owned_session(session_id, user, db)
    if session.mode == "mcq":
        raise HTTPException(status_code=409, detail="This session is an MCQ assessment — use the assessment/answer endpoint.")
    if session.status != "in_progress" or session.stage != "interview":
        raise HTTPException(status_code=409, detail="This session isn't accepting messages right now.")
    if not payload.message.strip():
        raise HTTPException(status_code=400, detail="Message can't be empty.")

    transcript = json.loads(session.transcript or "[]")
    transcript.append({"role": "candidate", "content": payload.message.strip()})
    session.turn_count += 1

    skills = json.loads(session.skills_focus or "[]")
    min_turns, max_turns = _turns_for_length(session.length_minutes)
    turn = get_next_turn(session.interviewer_name, _synth_job_description(session), skills, transcript, session.turn_count, min_turns=min_turns, max_turns=max_turns)
    transcript.append({"role": "assistant", "content": turn["message"]})
    session.transcript = json.dumps(transcript)

    if turn["action"] == "conclude":
        report = generate_report(session.interviewer_name, _synth_job_description(session), skills, transcript, cv_text=session.resume_text)
        session.ai_score = report.get("candidate_score")
        session.final_verdict = report.get("final_verdict")
        session.experience_assessment = report.get("experience_assessment")
        session.deep_analysis = report.get("deep_analysis")
        session.stage = "done"
        session.status = "completed"
        session.completed_at = datetime.now(timezone.utc)

    db.commit()
    return PracticeTurnResponse(message=turn["message"], action=turn["action"], stage=session.stage, turn_count=session.turn_count)


@router.post("/sessions/{session_id}/message/stream")
def send_practice_message_stream(session_id: str, payload: PracticeMessageRequest, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    """
    SSE variant of /message — same validation and same DB writes, but the
    interviewer's reply is genuinely streamed token-by-token from Groq as
    it's generated, instead of being returned as one blob after the fact.
    Event format (one JSON object per `data:` line):
        {"type":"delta","text":"..."}   — zero or more
        {"type":"done","action":"continue"|"conclude","stage":"...","turn_count":N}  — exactly once, last
        {"type":"error","detail":"..."} — only on failure, ends the stream
    """
    session = _get_owned_session(session_id, user, db)
    if session.mode == "mcq":
        raise HTTPException(status_code=409, detail="This session is an MCQ assessment — use the assessment/answer endpoint.")
    if session.status != "in_progress" or session.stage != "interview":
        raise HTTPException(status_code=409, detail="This session isn't accepting messages right now.")
    if not payload.message.strip():
        raise HTTPException(status_code=400, detail="Message can't be empty.")

    transcript = json.loads(session.transcript or "[]")
    transcript.append({"role": "candidate", "content": payload.message.strip()})
    session.turn_count += 1
    skills = json.loads(session.skills_focus or "[]")
    min_turns, max_turns = _turns_for_length(session.length_minutes)
    jd = _synth_job_description(session)

    def event_stream():
        full_message = ""
        action = "continue"
        try:
            for event in stream_next_turn(session.interviewer_name, jd, skills, transcript, session.turn_count, min_turns=min_turns, max_turns=max_turns):
                if event["type"] == "delta":
                    yield f"data: {json.dumps({'type': 'delta', 'text': event['text']})}\n\n"
                else:
                    full_message = event["message"]
                    action = event["action"]
        except Exception as e:
            yield f"data: {json.dumps({'type': 'error', 'detail': str(e)})}\n\n"
            return

        transcript.append({"role": "assistant", "content": full_message})
        session.transcript = json.dumps(transcript)

        if action == "conclude":
            report = generate_report(session.interviewer_name, jd, skills, transcript, cv_text=session.resume_text)
            session.ai_score = report.get("candidate_score")
            session.final_verdict = report.get("final_verdict")
            session.experience_assessment = report.get("experience_assessment")
            session.deep_analysis = report.get("deep_analysis")
            session.stage = "done"
            session.status = "completed"
            session.completed_at = datetime.now(timezone.utc)

        db.commit()
        yield f"data: {json.dumps({'type': 'done', 'action': action, 'stage': session.stage, 'turn_count': session.turn_count})}\n\n"

    return StreamingResponse(event_stream(), media_type="text/event-stream")


@router.post("/sessions/{session_id}/assessment/answer", response_model=PracticeAssessmentAnswerResponse)
def answer_practice_question(session_id: str, payload: PracticeAssessmentAnswerRequest, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    session = _get_owned_session(session_id, user, db)
    if session.mode != "mcq" or session.status != "in_progress" or session.stage != "assessment":
        raise HTTPException(status_code=409, detail="This session isn't accepting assessment answers right now.")

    questions = json.loads(session.assessment_questions or "[]")
    answers = json.loads(session.assessment_answers or "[]")
    if not any(a["question_id"] == payload.question_id for a in answers):
        answers.append({"question_id": payload.question_id, "selected_index": payload.selected_index})
    session.assessment_answers = json.dumps(answers)
    session.assessment_current_index += 1

    if session.assessment_current_index >= len(questions):
        result = score_assessment(questions, answers)
        session.assessment_score = result["score"]
        session.assessment_breakdown = json.dumps(result["breakdown_by_topic"])
        session.stage = "done"
        session.status = "completed"
        session.completed_at = datetime.now(timezone.utc)
        db.commit()
        return PracticeAssessmentAnswerResponse(stage="done", assessment_current_index=session.assessment_current_index, assessment_total=len(questions), next_question=None)

    db.commit()
    nq = questions[session.assessment_current_index]
    return PracticeAssessmentAnswerResponse(
        stage="assessment", assessment_current_index=session.assessment_current_index, assessment_total=len(questions),
        next_question=PracticeQuestionPublic(id=nq["id"], question=nq["question"], options=nq["options"], topic=nq.get("topic", "general")),
    )


@router.post("/sessions/{session_id}/transcribe", response_model=PracticeTranscribeResponse)
async def transcribe_practice_audio(session_id: str, file: UploadFile = File(...), db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    session = _get_owned_session(session_id, user, db)
    if session.mode != "voice_agent":
        raise HTTPException(status_code=409, detail="This session isn't a voice practice session.")
    audio_bytes = await file.read()
    try:
        text = transcribe_audio(audio_bytes, filename=file.filename or "audio.webm")
    except Exception:
        raise HTTPException(status_code=502, detail="Transcription failed — please try recording again.")
    return PracticeTranscribeResponse(text=text)


@router.get("/sessions/{session_id}/report", response_model=PracticeReportResponse)
def get_practice_report(session_id: str, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    session = _get_owned_session(session_id, user, db)
    return PracticeReportResponse(
        id=str(session.id), mode=session.mode, target_role=session.target_role, status=session.status,
        ai_score=session.ai_score, assessment_score=session.assessment_score,
        assessment_breakdown=json.loads(session.assessment_breakdown) if session.assessment_breakdown else None,
        final_verdict=session.final_verdict, experience_assessment=session.experience_assessment, deep_analysis=session.deep_analysis,
        created_at=session.created_at.isoformat() if session.created_at else "",
        completed_at=session.completed_at.isoformat() if session.completed_at else None,
    )


@router.websocket("/sessions/{session_id}/voice/ws")
async def practice_voice_ws(websocket: WebSocket, session_id: str, db: Session = Depends(get_db)):
    """
    Real-time voice — browser streams mic audio in as binary frames,
    receives {"type":...} JSON control messages plus binary synthesized
    audio frames back. First message from the client MUST be
    {"type":"auth","token":"<jwt>"} (browsers can't set Authorization
    headers on a WS handshake) — connection is closed if that fails.
    Falls back to the existing REST /message + /transcribe endpoints if
    this connection can't be established; those are untouched.
    """
    await websocket.accept()
    try:
        first = json.loads(await websocket.receive_text())
        if first.get("type") != "auth" or not first.get("token"):
            await websocket.send_text(json.dumps({"type": "error", "detail": "First message must be {type: 'auth', token: ...}"}))
            await websocket.close(code=4401)
            return
        user = decode_user_token(first["token"], db)
    except HTTPException as e:
        await websocket.send_text(json.dumps({"type": "error", "detail": e.detail}))
        await websocket.close(code=4401)
        return
    except Exception:
        await websocket.close(code=4400)
        return

    session = db.query(PracticeSession).filter(PracticeSession.id == session_id).first()
    if not session or session.user_id != user.id:
        await websocket.send_text(json.dumps({"type": "error", "detail": "Practice session not found or not yours."}))
        await websocket.close(code=4404)
        return
    if session.mode != "voice_agent" or session.status != "in_progress" or session.stage != "interview":
        await websocket.send_text(json.dumps({"type": "error", "detail": "This session isn't a live voice interview right now."}))
        await websocket.close(code=4409)
        return

    skills = json.loads(session.skills_focus or "[]")
    min_turns, max_turns = _turns_for_length(session.length_minutes)
    jd = _synth_job_description(session)

    async def on_turn(transcript: list, turn_count: int):
        session.transcript = json.dumps(transcript)
        session.turn_count = turn_count
        db.commit()

    async def on_conclude(transcript: list):
        report = generate_report(session.interviewer_name, jd, skills, transcript, cv_text=session.resume_text)
        session.ai_score = report.get("candidate_score")
        session.final_verdict = report.get("final_verdict")
        session.experience_assessment = report.get("experience_assessment")
        session.deep_analysis = report.get("deep_analysis")
        session.stage = "done"
        session.status = "completed"
        session.completed_at = datetime.now(timezone.utc)
        db.commit()
        return report

    voice_session = VoiceSession(
        websocket, interviewer_name=session.interviewer_name or "Kelly", job_description=jd,
        extra_questions=skills, transcript=json.loads(session.transcript or "[]"), turn_count=session.turn_count,
        min_turns=min_turns, max_turns=max_turns, on_turn=on_turn, on_conclude=on_conclude,
    )
    await voice_session.run()


@router.get("/history", response_model=list[PracticeHistoryItem])
def get_practice_history(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    sessions = db.query(PracticeSession).filter(PracticeSession.user_id == user.id).order_by(PracticeSession.created_at.desc()).all()
    return [
        PracticeHistoryItem(
            id=str(s.id), mode=s.mode, target_role=s.target_role, status=s.status,
            ai_score=s.ai_score, assessment_score=s.assessment_score, final_verdict=s.final_verdict,
            created_at=s.created_at.isoformat() if s.created_at else "",
            completed_at=s.completed_at.isoformat() if s.completed_at else None,
        ) for s in sessions
    ]


@router.delete("/sessions/{session_id}")
def delete_practice_session(session_id: str, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    session = _get_owned_session(session_id, user, db)
    db.delete(session)
    db.commit()
    return {"deleted": True}