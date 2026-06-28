from fastapi import APIRouter, Depends, HTTPException, status
from passlib.context import CryptContext
from passlib.exc import UnknownHashError, MissingBackendError
from pydantic import BaseModel
from models.database import get_db
from schemas.auth import LoginRequest, RegisterRequest, UserResponse, TokenResponse
from middleware.auth import create_access_token, get_current_user
from models.user import User
from sqlalchemy.orm import Session
from datetime import datetime, timezone

FREE_SCANS = 3
TRIAL_DAYS = 7


async def build_user_response(user: User) -> dict:
    """Compute drives field for userResponse"""
    now = datetime.now(timezone.utc)

    if user.role == "candidate":
        scans_remaining = max(0, FREE_SCANS - (user.scans_used or 0))
        can_screen = (
            user.subscription_status == "active"
            or (user.scans_used or 0) < FREE_SCANS
        )

        trial_days_left = None
    else:
        scans_remaining = 999
        trial_days_left = None
        if user.subscription_status == "trial" and user.trial_started_at:
            trial_start = user.trial_started_at
            if trial_start.tzinfo is None:
                trial_start = trial_start.replace(tzinfo=timezone.utc)
            days_elapsed = (now - trial_start).days
            trial_days_left = max(0, TRIAL_DAYS - days_elapsed)
            if trial_days_left == 0:
                can_screen = False
            else:
                can_screen = True
        elif user.subscription_status == "active":
            can_screen = True
            trial_days_left = None
        else:
            can_screen = False
            trial_days_left = 0
    return {
        "id": user.id,
        "name": user.name,
        "email": user.email,
        "is_active": user.is_active,
        "role": user.role,
        "subscription_status": user.subscription_status,
        "scans_used": user.scans_used or 0,
        "scans_remaining": scans_remaining,
        "trial_days_left": trial_days_left,
        "can_screen": can_screen,
    }


router = APIRouter(prefix="/auth", tags=["Authentication"])
pwd_context = CryptContext(
    # Keep bcrypt first for compatibility with existing installs.
    schemes=["bcrypt", "argon2"],
    deprecated="auto",
)


@router.post("/signup", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def signup(body: RegisterRequest, db: Session = Depends(get_db)):
    existing = db.query(User).filter(User.email == body.email).first()
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")

    # Validate role
    if body.role not in ["candidate", "hr"]:
        raise HTTPException(status_code=400, detail="Role must be 'candidate' or 'hr'")

    user = User(
        name=body.name,
        email=body.email,
        password_hash=pwd_context.hash(body.password),
        role=body.role,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return await build_user_response(user)


@router.post("/login", response_model=TokenResponse)
async def login(body: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == body.email).first()

    if not user:
        raise HTTPException(status_code=401, detail="Invalid email or password")

    try:
        is_valid = pwd_context.verify(body.password, user.password_hash)
    except (UnknownHashError, MissingBackendError):
        # Do not leak hashing internals to client.
        raise HTTPException(status_code=401, detail="Invalid email or password")

    if not is_valid:
        raise HTTPException(status_code=401, detail="Invalid email or password")

    token = await create_access_token(user.id)

    # Return role so frontend knows where to redirect
    return TokenResponse(access_token=token, token_type="bearer", role=user.role)


@router.get("/me", response_model=UserResponse)
async def me(current_user: User = Depends(get_current_user)):
    return await build_user_response(current_user)


# ---------------------------------------------------------------------------
# Settings page routes: update name, change password, delete account
# ---------------------------------------------------------------------------

class UpdateProfileRequest(BaseModel):
    name: str


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str


@router.patch("/me", response_model=UserResponse)
async def update_profile(
    body: UpdateProfileRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if not body.name or not body.name.strip():
        raise HTTPException(status_code=400, detail="Name cannot be empty.")

    current_user.name = body.name.strip()
    db.add(current_user)
    db.commit()
    db.refresh(current_user)
    return await build_user_response(current_user)


@router.post("/change-password")
async def change_password(
    body: ChangePasswordRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        is_valid = pwd_context.verify(body.current_password, current_user.password_hash)
    except (UnknownHashError, MissingBackendError):
        is_valid = False

    if not is_valid:
        raise HTTPException(status_code=400, detail="Current password is incorrect.")

    if len(body.new_password) < 8:
        raise HTTPException(status_code=400, detail="New password must be at least 8 characters.")

    current_user.password_hash = pwd_context.hash(body.new_password)
    db.add(current_user)
    db.commit()
    return {"status": "success", "message": "Password updated successfully."}


@router.delete("/me")
async def delete_account(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    db.delete(current_user)
    db.commit()
    return {"status": "success", "message": "Account deleted."}