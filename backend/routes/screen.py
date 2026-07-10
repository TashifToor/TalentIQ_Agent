import asyncio
from fastapi import APIRouter, HTTPException, status, Depends
from sqlalchemy.orm import Session

from models.user import User
from models.database import get_db
from models.scan_history import ScanHistory
from middleware.auth import get_current_user
from schemas.screening import ScreeningRequest
from core.graph import TalentIQGraph
from core.redis_client import get_cached_screening, set_cached_screening, check_rate_limit
from core.analytics import track
from datetime import datetime, timezone

router = APIRouter(prefix="/Rating", tags=["CV Screening"])

FREE_SCANS = 3
TRIAL_DAYS = 7
SCREENING_TIMEOUT_SECONDS = 45


async def check_screening_access(user: User, db: Session):
    """
    Candidate: 3 free scans, then must pay
    HR: 7 day trial, then must pay (or covered by their Team Workspace owner's paid plan)
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

        # Part of a Team Workspace and not the owner? Check if the workspace
        # owner has a paid plan — teammates ride on the owner's subscription.
        if user.organization_id and not user.is_org_owner:
            from models.organization import Organization
            org = db.query(Organization).filter(Organization.id == user.organization_id).first()
            if org:
                owner = db.query(User).filter(User.id == org.owner_user_id).first()
                if owner and owner.subscription_status == "active":
                    return  # covered by team's paid plan

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

    allowed, wait_seconds = check_rate_limit(f"scan:{current_user.id}", cooldown_seconds=5)
    if not allowed:
        raise HTTPException(status_code=429, detail=f"Please wait {wait_seconds}s before scanning again.")

    await check_screening_access(current_user, db)

    if not payload.cv_text or not payload.cv_text.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="cv_text is required. Upload a CV first."
        )

    try:
        # Same CV + same JD scanned before? Skip the Groq LLM call entirely —
        # it's by far the slowest and most expensive part of a scan.
        cached = get_cached_screening(payload.cv_text, payload.job_description)
        if cached:
            print(f"[Screen] Cache HIT — skipping LLM call for {current_user.email}")
            final_report = cached
        else:
            # Fresh agent scoped to THIS user's uploaded CV/FAISS index — never
            # shares state with other users' concurrent scans.
            screening_agent = TalentIQGraph(user_id=current_user.id)

            try:
                # run_screening is a blocking call (LLM + retrieval) — run it in
                # a worker thread with a hard timeout so a slow/hung Groq call
                # can't hang the request (and the whole event loop) forever.
                final_report = await asyncio.wait_for(
                    asyncio.to_thread(screening_agent.run_screening, payload.job_description),
                    timeout=SCREENING_TIMEOUT_SECONDS,
                )
            except asyncio.TimeoutError:
                raise HTTPException(
                    status_code=status.HTTP_504_GATEWAY_TIMEOUT,
                    detail="Screening is taking longer than expected. Please try again."
                )

            print(f"[Screen DEBUG] final_report keys: {list(final_report.keys()) if final_report else None}")
            print(f"[Screen DEBUG] screening_analysis length: {len(final_report.get('screening_analysis', '') or '')}")

            if final_report:
                set_cached_screening(payload.cv_text, payload.job_description, final_report)

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

        track(current_user.id, "scan_completed", {
            "role": current_user.role,
            "score": metrics["candidate_score"],
            "verdict": metrics["final_verdict"],
            "cache_hit": bool(cached),
        })

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