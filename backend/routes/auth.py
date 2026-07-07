from fastapi import APIRouter, Depends, HTTPException, status
from passlib.context import CryptContext
from passlib.exc import UnknownHashError, MissingBackendError
from pydantic import BaseModel
from models.database import get_db
from schemas.auth import LoginRequest, RegisterRequest, UserResponse, TokenResponse
from middleware.auth import create_access_token, get_current_user
from models.user import User
from sqlalchemy.orm import Session
from datetime import datetime, timedelta, timezone
from utils.email_utils import normalize_email
from utils.otp_mailer import generate_otp, send_otp_email, OTP_EXPIRY_MINUTES

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


class VerifySignupRequest(BaseModel):
    email: str
    otp: str


class ResendVerificationRequest(BaseModel):
    email: str


@router.post("/signup", status_code=status.HTTP_201_CREATED)
async def signup(body: RegisterRequest, db: Session = Depends(get_db)):
    clean_email = body.email.strip().lower()
    norm_email = normalize_email(clean_email)

    # Block duplicate signups via Gmail dot/+tag aliasing (a.li@gmail.com,
    # ali+hr@gmail.com, ali@gmail.com all resolve to the same inbox).
    existing = db.query(User).filter(
        (User.email == clean_email) | (User.normalized_email == norm_email)
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")

    if body.role not in ["candidate", "hr"]:
        raise HTTPException(status_code=400, detail="Role must be 'candidate' or 'hr'")

    otp = generate_otp()
    user = User(
        name=body.name,
        email=clean_email,
        normalized_email=norm_email,
        password_hash=pwd_context.hash(body.password),
        role=body.role,
        is_active=False,  # not verified yet
        reset_otp_hash=pwd_context.hash(otp),
        reset_otp_expires_at=datetime.utcnow() + timedelta(minutes=OTP_EXPIRY_MINUTES),
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    try:
        send_otp_email(user.email, otp, user.name or "there", purpose="verify")
    except Exception as e:
        print(f"[Signup] Verification email failed: {e}")
        # Roll back the pending account so the email can be retried cleanly.
        db.delete(user)
        db.commit()
        raise HTTPException(status_code=500, detail="Could not send verification code. Please try again.")

    return {"message": "Verification code sent to your email.", "email": user.email}


@router.post("/verify-signup", response_model=TokenResponse)
async def verify_signup(body: VerifySignupRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == body.email.strip().lower()).first()

    if not user or not user.reset_otp_hash or not user.reset_otp_expires_at:
        raise HTTPException(status_code=400, detail="Invalid or expired code.")

    if datetime.utcnow() > user.reset_otp_expires_at:
        raise HTTPException(status_code=400, detail="Code has expired. Please request a new one.")

    if not pwd_context.verify(body.otp, user.reset_otp_hash):
        raise HTTPException(status_code=400, detail="Incorrect code.")

    user.is_active = True
    user.reset_otp_hash = None
    user.reset_otp_expires_at = None
    db.commit()

    token = await create_access_token(user.id)
    return TokenResponse(access_token=token, token_type="bearer", role=user.role)


@router.post("/resend-verification")
async def resend_verification(body: ResendVerificationRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == body.email.strip().lower()).first()
    generic_msg = {"message": "If this account needs verification, a new code has been sent."}

    if not user or user.is_active:
        return generic_msg

    otp = generate_otp()
    user.reset_otp_hash = pwd_context.hash(otp)
    user.reset_otp_expires_at = datetime.utcnow() + timedelta(minutes=OTP_EXPIRY_MINUTES)
    db.commit()

    try:
        send_otp_email(user.email, otp, user.name or "there", purpose="verify")
    except Exception as e:
        print(f"[ResendVerification] Email failed: {e}")
        raise HTTPException(status_code=500, detail="Could not send verification code. Please try again.")

    return generic_msg


@router.post("/login", response_model=TokenResponse)
async def login(body: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == body.email.strip().lower()).first()

    if not user:
        raise HTTPException(status_code=401, detail="Invalid email or password")

    try:
        is_valid = pwd_context.verify(body.password, user.password_hash)
    except (UnknownHashError, MissingBackendError):
        # Do not leak hashing internals to client.
        raise HTTPException(status_code=401, detail="Invalid email or password")

    if not is_valid:
        raise HTTPException(status_code=401, detail="Invalid email or password")

    if not user.is_active:
        raise HTTPException(status_code=403, detail="EMAIL_NOT_VERIFIED|Please verify your email before logging in.")

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