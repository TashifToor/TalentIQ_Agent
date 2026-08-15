"""
Resume / ATS intelligence — reads the candidate's own real scan history
(ScanHistory, already populated by the existing CV Optimizer feature) instead
of re-running any AI screening. No LLM call happens here.

Important honesty note: ScanHistory rows are scored against whatever job
description the candidate pasted into the Optimizer at the time — which may
or may not be the same posting a recruiter is now ranking them for. We never
claim it IS the same job; we always surface which role title it was actually
scanned against so a recruiter can judge relevance themselves.
"""
from sqlalchemy.orm import Session
from sqlalchemy import desc
from models.scan_history import ScanHistory


def get_latest_resume_profile(db: Session, user_id: int) -> ScanHistory | None:
    return (
        db.query(ScanHistory)
        .filter(ScanHistory.user_id == user_id)
        .order_by(desc(ScanHistory.created_at))
        .first()
    )


def resume_profile_to_dict(scan: ScanHistory | None) -> dict:
    if not scan:
        return {
            "resume_available": False,
            "ats_score": None,
            "matched_skills": [],
            "missing_skills": [],
            "skill_match_pct": None,
            "resume_verdict": None,
            "resume_role_title": None,
            "resume_scanned_at": None,
        }

    matched = scan.matched_skills or []
    missing = scan.missing_skills or []
    total = len(matched) + len(missing)
    skill_match_pct = round((len(matched) / total) * 100) if total > 0 else None

    return {
        "resume_available": True,
        "ats_score": int(scan.candidate_score) if scan.candidate_score is not None else None,
        "matched_skills": matched,
        "missing_skills": missing,
        "skill_match_pct": skill_match_pct,
        "resume_verdict": scan.final_verdict,
        "resume_role_title": scan.role_title,
        "resume_scanned_at": scan.created_at.isoformat() if scan.created_at else None,
    }