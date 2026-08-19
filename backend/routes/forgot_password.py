from datetime import datetime, timedelta

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from passlib.context import CryptContext
from sqlalchemy.orm import Session

from models.database import get_db
from models.user import User
from utils.otp_mailer import generate_otp, send_otp_email, OTP_EXPIRY_MINUTES
from core.redis_client import check_rate_limit, record_failed_attempt, is_attempt_locked, clear_failed_attempts

router = APIRouter(prefix="/auth", tags=["Auth"])
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


class ForgotPasswordRequest(BaseModel):
    email: str


class ResetPasswordRequest(BaseModel):
    email: str
    otp: str
    new_password: str


@router.post("/forgot-password")
def forgot_password(body: ForgotPasswordRequest, db: Session = Depends(get_db)):
    email = body.email.strip().lower()

    allowed, wait_seconds = check_rate_limit(f"forgot-password:{email}", cooldown_seconds=45)
    if not allowed:
        raise HTTPException(status_code=429, detail=f"Please wait {wait_seconds}s before requesting another code.")

    user = db.query(User).filter(User.email == email).first()

    # Always return success — don't leak whether email exists
    generic_msg = {"message": "If this email is registered, a reset code has been sent."}

    if not user:
        return generic_msg

    otp = generate_otp()
    user.reset_otp_hash = pwd_context.hash(otp)
    user.reset_otp_expires_at = datetime.utcnow() + timedelta(minutes=OTP_EXPIRY_MINUTES)
    db.commit()

    try:
        send_otp_email(user.email, otp, user.name or "there", purpose="reset")
    except Exception as e:
        print(f"[ForgotPassword] Email send failed: {e}")
        raise HTTPException(status_code=500, detail="Could not send reset code. Please try again.")

    return generic_msg


@router.post("/reset-password")
def reset_password(body: ResetPasswordRequest, db: Session = Depends(get_db)):
    email = body.email.strip().lower()

    # A 5-digit numeric OTP has only 100,000 combinations — without a limit
    # on verification attempts here, this endpoint was directly brute-forceable
    # (the /forgot-password cooldown only throttled *requesting* a new code,
    # not guessing the existing one). Same lockout shape as login.
    lock_key = f"otpfail:reset:{email}"
    locked, ttl = is_attempt_locked(lock_key)
    if locked:
        raise HTTPException(status_code=429, detail=f"Too many attempts. Try again in {ttl}s.")

    user = db.query(User).filter(User.email == email).first()

    if not user or not user.reset_otp_hash or not user.reset_otp_expires_at:
        record_failed_attempt(lock_key)
        raise HTTPException(status_code=400, detail="Invalid or expired code.")

    if datetime.utcnow() > user.reset_otp_expires_at:
        raise HTTPException(status_code=400, detail="Code has expired. Please request a new one.")

    if not pwd_context.verify(body.otp, user.reset_otp_hash):
        count, now_locked = record_failed_attempt(lock_key)
        if now_locked:
            raise HTTPException(status_code=429, detail="Too many attempts. Try again in 5 minutes.")
        raise HTTPException(status_code=400, detail="Incorrect code.")

    clear_failed_attempts(lock_key)

    if len(body.new_password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters.")

    user.password_hash = pwd_context.hash(body.new_password)
    user.reset_otp_hash = None
    user.reset_otp_expires_at = None
    db.commit()

    return {"message": "Password reset successful. You can now log in."}