"""
Candidate identity linking — connects an anonymous interview-posting candidate
(InterviewSession, which has no login) to their real registered candidate
account (User), when one exists, so their real resume/ATS history can be
pulled into Talent Intelligence ranking.

Deliberately NOT fuzzy: this reuses the exact same normalize_email() function
already used for signup/login dedup (utils/email_utils.py), so "the same
inbox" is defined identically everywhere in the app. No name matching, no
partial/substring matching, no scoring of "how similar" two emails are.

If no user account matches, the candidate simply has no linked resume
profile — never guessed, never approximated.
"""
from sqlalchemy.orm import Session
from models.user import User
from utils.email_utils import normalize_email


def resolve_candidate_user(db: Session, candidate_email: str) -> User | None:
    if not candidate_email:
        return None
    norm = normalize_email(candidate_email)
    if not norm:
        return None
    return db.query(User).filter(
        User.normalized_email == norm,
        User.role == "candidate",
    ).first()


def resolve_application_identity(db: Session, application) -> tuple[str | None, str | None, bool]:
    """
    Returns (name, email, is_real_account) for a bulk-screening Application row.

    Two ingestion paths write into the same `applications` table:
      - /apply/{job_id}: candidate_id is a REAL logged-in candidate's User.id —
        the best possible identity, so we prefer it when it actually resolves
        to a candidate account.
      - /bulk/screen (HR-uploaded CVs): candidate_id is a placeholder (set to
        the HR user's own id — there's no logged-in candidate at all), so we
        fall back to whatever was explicitly captured on the Application row
        itself (candidate_name from CV-text extraction, candidate_email only
        if an HR user typed it in). Never guessed beyond that.
    """
    candidate_user = db.query(User).filter(User.id == application.candidate_id, User.role == "candidate").first()
    if candidate_user:
        return candidate_user.name, candidate_user.email, True

    return application.candidate_name, application.candidate_email, False


# Interview status values, in the order they progress:
INTERVIEW_STATUS_UNKNOWN = "unknown"           # identity can't be established — never guessed
INTERVIEW_STATUS_NOT_INVITED = "not_invited"
INTERVIEW_STATUS_INVITED = "invited"           # trigger_interview set, but candidate hasn't started a session yet
INTERVIEW_STATUS_IN_PROGRESS = "in_progress"
INTERVIEW_STATUS_COMPLETED = "completed"


def resolve_interview_status(application, email: str | None, has_linked_account: bool, org_sessions: list) -> dict:
    """
    Matches an Application to at most one real InterviewSession, using exact
    normalized-email comparison only — never by name, never fuzzy.

    Identity preference order per the product spec: a linked candidate
    account's own email is the most authoritative signal we have (it's a
    verified account, not free text), then the application's stored
    candidate_email. Both ultimately resolve to the same `email` value passed
    in by the caller — this function doesn't re-decide identity, it just
    matches sessions once that decision has been made.

    org_sessions must already be scoped to the caller's own org (prefetched
    once by the caller, not re-queried per candidate — avoids N+1).
    """
    if not email:
        return {"status": INTERVIEW_STATUS_UNKNOWN, "session": None}

    norm = normalize_email(email)
    session = next((s for s in org_sessions if normalize_email(s.candidate_email) == norm), None)

    if session:
        status = INTERVIEW_STATUS_COMPLETED if session.status == "completed" else INTERVIEW_STATUS_IN_PROGRESS
        return {"status": status, "session": session}

    if application.trigger_interview == "yes":
        return {"status": INTERVIEW_STATUS_INVITED, "session": None}

    return {"status": INTERVIEW_STATUS_NOT_INVITED, "session": None}