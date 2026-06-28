from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import desc
from models.database import get_db
from models.user import User
from models.scan_history import ScanHistory
from middleware.auth import get_current_user

router = APIRouter(prefix="/scans", tags=["Scan History"])


@router.get("/history")
async def get_scan_history(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    records = (
        db.query(ScanHistory)
        .filter(ScanHistory.user_id == current_user.id)
        .order_by(desc(ScanHistory.created_at))
        .limit(50)
        .all()
    )

    return [
        {
            "id": r.id,
            "role_title": r.role_title,
            "candidate_score": r.candidate_score,
            "final_verdict": r.final_verdict,
            "matched_skills": r.matched_skills,
            "missing_skills": r.missing_skills,
            "is_shortlisted": r.is_shortlisted,
            "trigger_interview": r.trigger_interview,
            "created_at": r.created_at.isoformat() if r.created_at else None,
        }
        for r in records
    ]