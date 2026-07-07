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
from core.redis_client import check_rate_limit, record_failed_login, is_login_locked, clear_failed_logins
from core.analytics import track, identify

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


class DeleteAccountRequest(BaseModel):
    password: str


class ResendVerificationRequest(BaseModel):
    email: str


@router.post("/signup", status_code=status.HTTP_201_CREATED)
async def signup(body: RegisterRequest, db: Session = Depends(get_db)):
    clean_email = body.email.strip().lower()
    norm_email = normalize_email(clean_email)

    allowed, wait_seconds = check_rate_limit(f"signup:{clean_email}", cooldown_seconds=45)
    if not allowed:
        raise HTTPException(status_code=429, detail=f"Please wait {wait_seconds}s before trying again.")

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

    identify(user.id, {"email": user.email, "role": user.role, "name": user.name})
    track(user.id, "signup_completed", {"role": user.role})

    token = await create_access_token(user.id)
    return TokenResponse(access_token=token, token_type="bearer", role=user.role)


@router.post("/resend-verification")
async def resend_verification(body: ResendVerificationRequest, db: Session = Depends(get_db)):
    email = body.email.strip().lower()
    generic_msg = {"message": "If this account needs verification, a new code has been sent."}

    allowed, wait_seconds = check_rate_limit(f"resend-verify:{email}", cooldown_seconds=45)
    if not allowed:
        raise HTTPException(status_code=429, detail=f"Please wait {wait_seconds}s before requesting another code.")

    user = db.query(User).filter(User.email == email).first()

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
    email = body.email.strip().lower()

    locked, ttl = is_login_locked(email)
    if locked:
        raise HTTPException(status_code=429, detail=f"Too many failed attempts. Try again in {ttl}s.")

    user = db.query(User).filter(User.email == email).first()

    if not user:
        record_failed_login(email)
        raise HTTPException(status_code=401, detail="Invalid email or password")

    try:
        is_valid = pwd_context.verify(body.password, user.password_hash)
    except (UnknownHashError, MissingBackendError):
        # Do not leak hashing internals to client.
        record_failed_login(email)
        raise HTTPException(status_code=401, detail="Invalid email or password")

    if not is_valid:
        count, now_locked = record_failed_login(email)
        if now_locked:
            raise HTTPException(status_code=429, detail="Too many failed attempts. Try again in 5 minutes.")
        raise HTTPException(status_code=401, detail="Invalid email or password")

    clear_failed_logins(email)

    if not user.is_active:
        raise HTTPException(status_code=403, detail="EMAIL_NOT_VERIFIED|Please verify your email before logging in.")

    track(user.id, "login", {"role": user.role})

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
    body: DeleteAccountRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        is_valid = pwd_context.verify(body.password, current_user.password_hash)
    except (UnknownHashError, MissingBackendError):
        is_valid = False
    if not is_valid:
        raise HTTPException(status_code=400, detail="Incorrect password.")

    user_id = current_user.id
    role = current_user.role

    # Delete in FK-safe order — children before parent. Done at the
    # application level (rather than relying on DB-level ON DELETE CASCADE)
    # so the exact deletion order is explicit and auditable.
    from models.scan_history import ScanHistory
    from models.chat import Chat
    from models.application import Application
    from models.job import Job

    db.query(ScanHistory).filter(ScanHistory.user_id == user_id).delete()
    db.query(Chat).filter(Chat.user_id == user_id).delete()

    if role == "candidate":
        db.query(Application).filter(Application.candidate_id == user_id).delete()
    elif role == "hr":
        job_ids = [j.id for j in db.query(Job.id).filter(Job.hr_user_id == user_id).all()]
        if job_ids:
            db.query(Application).filter(Application.job_id.in_(job_ids)).delete(synchronize_session=False)
        db.query(Job).filter(Job.hr_user_id == user_id).delete()

    db.delete(current_user)
    db.commit()

    track(user_id, "account_deleted", {"role": role})

    print(f"[Account] Deleted account and all associated data for user_id={user_id} ({role})")
    return {"status": "success", "message": "Your account and all associated data have been permanently deleted."}