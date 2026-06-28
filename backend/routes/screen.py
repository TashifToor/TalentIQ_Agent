from fastapi import APIRouter, HTTPException, status, Depends
from sqlalchemy.orm import Session

from models.user import User
from models.database import get_db
from models.scan_history import ScanHistory
from middleware.auth import get_current_user
from schemas.screening import ScreeningRequest
from core.graph import TalentIQGraph
from datetime import datetime, timezone

router = APIRouter(prefix="/Rating", tags=["CV Screening"])

FREE_SCANS = 3
TRIAL_DAYS = 7


async def check_screening_access(user: User):
    """
    Candidate: 3 free scans, then must pay
    HR: 7 day trial, then must pay
    """
    now = datetime.now(timezone.utc)

    if user.role == "candidate":
        if user.subscription_status == "active":
            return  # paid — allow
        if (user.scans_used or 0) >= FREE_SCANS:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"FREE_LIMIT_REACHED|You have used all {FREE_SCANS} free scans. Upgrade to Candidate Pro for unlimited screening."
            )
    elif user.role == "hr":
        if user.subscription_status == "active":
            return
        if user.subscription_status == "trial" and user.trial_started_at:
            trial_start = user.trial_started_at
            if trial_start.tzinfo is None:
                trial_start = trial_start.replace(tzinfo=timezone.utc)
            days_elapsed = (now - trial_start).days
            if days_elapsed < TRIAL_DAYS:
                return  # still in trial — allow
            else:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="TRIAL_EXPIRED|Your 7-day free trial has ended. Upgrade to HR Suite to continue."
                )
        else:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="TRIAL_EXPIRED|Your trial has ended. Upgrade to HR Suite to continue."
            )


@router.post("/screen")
async def screen_candidate(
    payload: ScreeningRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    print(f"[Screen] User: {current_user.email} | Role: {current_user.role} | Scans: {current_user.scans_used}")

    await check_screening_access(current_user)

    if not payload.cv_text or not payload.cv_text.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="cv_text is required. Upload a CV first."
        )

    try:
        # Fresh agent on every request — loads latest FAISS from default path
        # (same path upload.py writes to: backend/data/faiss_index)
        screening_agent = TalentIQGraph()

        final_report = screening_agent.run_screening(
            job_description=payload.job_description
        )
        print(f"[Screen DEBUG] final_report keys: {list(final_report.keys()) if final_report else None}")
        print(f"[Screen DEBUG] screening_analysis length: {len(final_report.get('screening_analysis', '') or '')}")

        if not final_report:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Graph returned no result."
            )
        if current_user.role == "candidate":
            current_user.scans_used = (current_user.scans_used or 0) + 1
            db.add(current_user)
            db.commit()
            print(f"[Screen] Updated scans_used for {current_user.email}: {current_user.scans_used}")

        scans_remaining = None
        if current_user.role == "candidate" and current_user.subscription_status != "active":
            scans_remaining = max(0, FREE_SCANS - (current_user.scans_used or 0))

        metrics = {
            "candidate_score": final_report.get("candidate_score", 0),
            "matched_skills": final_report.get("matched_skills", []),
            "missing_skills": final_report.get("missing_skills", []),
            "final_verdict": final_report.get("final_verdict", "Rejected"),
        }
        flags = {
            "is_shortlisted": final_report.get("is_shortlisted", False),
            "has_min_experience": final_report.get("has_min_experience",
                                   final_report.get("has_minimum_qualifications", False)),
            "trigger_interview": final_report.get("trigger_interview", False),
        }
        deep_analysis = final_report.get("screening_analysis", "")

        # --- Persist this scan to history (so /scans/history can show it later) ---
        try:
            jd = (payload.job_description or "").strip()
            import re
            title_match = re.search(r"Job\s*Title:\s*(.+)", jd, re.IGNORECASE)
            role_title = (title_match.group(1).strip() if title_match else jd.split("\n")[0].strip())[:150]
            history_entry = ScanHistory(
                user_id=current_user.id,
                role_title=role_title or "Untitled Role",
                candidate_score=metrics["candidate_score"],
                final_verdict=metrics["final_verdict"],
                matched_skills=metrics["matched_skills"],
                missing_skills=metrics["missing_skills"],
                is_shortlisted=str(flags["is_shortlisted"]),
                trigger_interview=str(flags["trigger_interview"]),
                deep_analysis=deep_analysis,
            )
            db.add(history_entry)
            db.commit()
        except Exception as hist_err:
            # Never let history logging break the actual screening response
            print(f"[Screen WARNING] Failed to save scan history: {str(hist_err)}")
            db.rollback()

        return {
            "status": "success",
            "metrics": metrics,
            "flags": flags,
            "deep_analysis": deep_analysis,
            "scans_remaining": scans_remaining,  # frontend shows warning
        }

    except HTTPException:
        raise
    except Exception as e:
        print(f"[Screen ERROR] {str(e)}")
        raise HTTPException(status_code=500, detail=f"Screening failed: {str(e)}")