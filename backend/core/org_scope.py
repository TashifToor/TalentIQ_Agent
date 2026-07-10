from sqlalchemy.orm import Session
from models.user import User


def get_org_scoped_user_ids(current_user: User, db: Session) -> list[int]:
    """
    Returns the list of user IDs whose jobs/screenings the current HR user
    should see: just themselves if solo, or everyone in their Team Workspace
    if they're part of one. Used everywhere HR-owned data (jobs, bulk
    screening results) is queried, so teammates see shared data instead of
    only what they personally created.
    """
    if not current_user.organization_id:
        return [current_user.id]

    members = db.query(User.id).filter(User.organization_id == current_user.organization_id).all()
    return [m.id for m in members] or [current_user.id]