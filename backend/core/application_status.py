"""
Single source of truth for turning an Application row's existing columns
into the lifecycle status ("Applied / Screening / Interview / Rejected /
Selected") and a dated timeline shown on the candidate's My Applications
page and on marketplace job cards.

No new columns, no invented dates -- every value here is read straight off
Application (decision, decision_at, screened_at, ai_screening_status,
invited_posting_id, trigger_interview, created_at). If a date genuinely
doesn't exist yet (e.g. no interview invite), the timeline step is marked
reached/not-reached but carries date=None rather than a fabricated date.
"""
from typing import Optional

STATUS_LABELS = {
    "applied":   "Applied",
    "screening": "Screening",
    "interview": "Interview",
    "rejected":  "Rejected",
    "selected":  "Selected",
}


def derive_status(app) -> str:
    if app.decision == "accepted":
        return "selected"
    if app.decision == "rejected":
        return "rejected"
    if app.invited_posting_id is not None or app.trigger_interview == "yes":
        return "interview"
    # ATS screening runs synchronously at apply time (see routes/apply.py) --
    # by the time the Application row exists it's almost always already
    # screened. "applied" only covers the narrow case where no screening
    # signal has landed on the row at all yet.
    has_screening_signal = (
        app.screened_at is not None
        or (app.ai_score or 0) > 0
        or app.final_verdict is not None
        or app.ai_screening_status not in (None, "not_analyzed")
    )
    return "screening" if has_screening_signal else "applied"


def build_timeline(app) -> list[dict]:
    steps = [
        {
            "key": "applied", "label": "Application Submitted",
            "date": app.created_at.isoformat() if app.created_at else None,
            "reached": True,
        },
        {
            "key": "screening", "label": "Resume Screened",
            "date": app.screened_at.isoformat() if app.screened_at else None,
            "reached": app.screened_at is not None or (app.ai_score or 0) > 0 or app.final_verdict is not None,
        },
        {
            "key": "interview", "label": "Interview Invitation",
            "date": app.interview_invited_at.isoformat() if getattr(app, "interview_invited_at", None) else None,
            "reached": app.invited_posting_id is not None or app.trigger_interview == "yes",
        },
        {
            "key": "decision", "label": "Accepted" if app.decision == "accepted" else ("Rejected" if app.decision == "rejected" else "Final Decision"),
            "date": app.decision_at.isoformat() if app.decision_at else None,
            "reached": app.decision in ("accepted", "rejected"),
        },
    ]
    return steps