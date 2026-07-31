import os
import secrets
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from models.database import get_db
from models.user import User
from models.organization import Organization
from middleware.auth import get_current_user
from core.redis_client import create_invite_token, get_invite_token, delete_invite_token, check_rate_limit
from utils.otp_mailer import send_invite_email

router = APIRouter(prefix="/org", tags=["Team Workspace"])

FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:3000")


class CreateOrgRequest(BaseModel):
    name: str


class RenameOrgRequest(BaseModel):
    name: str


class InviteRequest(BaseModel):
    email: str


def _require_hr(user: User):
    if user.role != "hr":
        raise HTTPException(status_code=403, detail="Team Workspace is available for HR accounts only.")


def _require_org_owner(user: User):
    _require_hr(user)
    if not user.organization_id or not user.is_org_owner:
        raise HTTPException(status_code=403, detail="Only the workspace owner can do this.")


@router.post("/create")
async def create_organization(
    body: CreateOrgRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_hr(current_user)
    if current_user.organization_id:
        raise HTTPException(status_code=400, detail="You're already part of a workspace.")

    if not body.name.strip():
        raise HTTPException(status_code=400, detail="Workspace name is required.")

    org = Organization(name=body.name.strip(), owner_user_id=current_user.id)
    db.add(org)
    db.commit()
    db.refresh(org)

    current_user.organization_id = org.id
    current_user.is_org_owner = True
    db.add(current_user)
    db.commit()

    return {"id": str(org.id), "name": org.name, "max_seats": org.max_seats}


@router.patch("/rename")
async def rename_organization(
    body: RenameOrgRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_org_owner(current_user)

    if not body.name.strip():
        raise HTTPException(status_code=400, detail="Workspace name is required.")

    org = db.query(Organization).filter(Organization.id == current_user.organization_id).first()
    if not org:
        raise HTTPException(status_code=404, detail="Workspace not found.")

    org.name = body.name.strip()
    db.add(org)
    db.commit()

    return {"id": str(org.id), "name": org.name}


@router.get("/me")
async def get_my_organization(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_hr(current_user)
    if not current_user.organization_id:
        return {"organization": None}

    org = db.query(Organization).filter(Organization.id == current_user.organization_id).first()
    if not org:
        return {"organization": None}

    members = db.query(User).filter(User.organization_id == org.id).all()
    return {
        "organization": {
            "id": str(org.id),
            "name": org.name,
            "max_seats": org.max_seats,
            "seats_used": len(members),
            "is_owner": current_user.is_org_owner,
        },
        "members": [
            {"id": m.id, "name": m.name, "email": m.email, "is_owner": m.is_org_owner}
            for m in members
        ],
    }


@router.post("/invite")
async def invite_teammate(
    body: InviteRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_org_owner(current_user)

    email = body.email.strip().lower()
    allowed, wait_seconds = check_rate_limit(f"org-invite:{current_user.id}", cooldown_seconds=10)
    if not allowed:
        raise HTTPException(status_code=429, detail=f"Please wait {wait_seconds}s before sending another invite.")

    org = db.query(Organization).filter(Organization.id == current_user.organization_id).first()
    if not org:
        raise HTTPException(status_code=404, detail="Workspace not found.")

    seats_used = db.query(User).filter(User.organization_id == org.id).count()
    if seats_used >= org.max_seats:
        raise HTTPException(status_code=403, detail=f"Seat limit reached ({org.max_seats} max). Remove a teammate or contact us to expand your plan.")

    existing = db.query(User).filter(User.email == email).first()
    if existing and existing.organization_id == org.id:
        raise HTTPException(status_code=400, detail="This person is already on your team.")
    if existing and existing.organization_id and existing.organization_id != org.id:
        raise HTTPException(status_code=400, detail="This email already belongs to a different workspace.")

    token = secrets.token_urlsafe(24)
    stored = create_invite_token(token, str(org.id), email, org.name)
    if not stored:
        raise HTTPException(
            status_code=503,
            detail="Could not create the invite link right now (our cache service looks unreachable). "
                   "Please try again shortly — if this keeps happening, check that Redis is running."
        )

    invite_link = f"{FRONTEND_URL}/auth/login/hr?invite={token}"
    try:
        send_invite_email(email, org.name, current_user.name or "Your teammate", invite_link)
    except Exception as e:
        print(f"[OrgInvite] Email send failed: {e}")
        raise HTTPException(status_code=500, detail="Could not send invite email. Please try again.")

    return {"message": f"Invite sent to {email}.", "existing_account": bool(existing)}


@router.get("/invite/{token}")
async def check_invite(token: str):
    """Used by the signup page to show 'You're joining <Org Name>' before the person signs up."""
    data = get_invite_token(token)
    if not data:
        raise HTTPException(status_code=404, detail="This invite link is invalid or has expired.")
    return data


@router.delete("/members/{member_id}")
async def remove_member(
    member_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_org_owner(current_user)

    if member_id == current_user.id:
        raise HTTPException(status_code=400, detail="You can't remove yourself. Transfer ownership or delete the workspace instead.")

    member = db.query(User).filter(User.id == member_id, User.organization_id == current_user.organization_id).first()
    if not member:
        raise HTTPException(status_code=404, detail="Team member not found.")

    member.organization_id = None
    member.is_org_owner = False
    db.add(member)
    db.commit()

    return {"message": f"{member.name} has been removed from the workspace."}