from fastapi import APIRouter, HTTPException, status, Depends
from sqlalchemy.orm import Session

from models.user import User
from models.database import get_db
from middleware.auth import get_current_user
from schemas.screening import ScreeningRequest
from core.graph import TalentIQGraph

router = APIRouter(prefix="/Rating", tags=["CV Score"])


@router.post("/screen")
async def screen_candidate(
    payload: ScreeningRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    print(f"[Screen] Triggered by: {current_user.email}")

    if not payload.cv_text or not payload.cv_text.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="cv_text is required. Upload a CV first."
        )

    try:
        # ✅ Fresh agent on every request — loads latest FAISS from default path
        # (same path upload.py writes to: backend/data/faiss_index)
        screening_agent = TalentIQGraph()

        final_report = screening_agent.run_screening(
            job_description=payload.job_description
        )

        if not final_report:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Graph returned no result."
            )

        return {
            "status": "success",
            "metrics": {
                "candidate_score":  final_report.get("candidate_score", 0),
                "matched_skills":   final_report.get("matched_skills", []),
                "missing_skills":   final_report.get("missing_skills", []),
                "final_verdict":    final_report.get("final_verdict", "Rejected"),
            },
            "flags": {
                "is_shortlisted":    final_report.get("is_shortlisted", False),
                "has_min_experience": final_report.get("has_min_experience",
                                       final_report.get("has_minimum_qualifications", False)),
                "trigger_interview": final_report.get("trigger_interview", False),
            },
            "deep_analysis": final_report.get("screening_analysis", ""),
        }

    except HTTPException:
        raise
    except Exception as e:
        print(f"[Screen ERROR] {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Screening failed: {str(e)}"
        )
