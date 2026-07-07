import os
import random
import smtplib
from datetime import datetime, timedelta
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from passlib.context import CryptContext
from sqlalchemy.orm import Session

from models.database import get_db
from models.user import User

router = APIRouter(prefix="/auth", tags=["Auth"])
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

MAIL_USERNAME = os.getenv("MAIL_USERNAME", "")
MAIL_PASSWORD = os.getenv("MAIL_PASSWORD", "")
MAIL_FROM     = os.getenv("MAIL_FROM", MAIL_USERNAME)
MAIL_SERVER   = os.getenv("MAIL_SERVER", "smtp.gmail.com")
MAIL_PORT     = int(os.getenv("MAIL_PORT", "587"))

OTP_LENGTH = 5
OTP_EXPIRY_MINUTES = 10


class ForgotPasswordRequest(BaseModel):
    email: str


class ResetPasswordRequest(BaseModel):
    email: str
    otp: str
    new_password: str


def generate_otp(length: int = OTP_LENGTH) -> str:
    return ''.join(random.choices("0123456789", k=length))


def send_otp_email(to_email: str, otp: str, user_name: str):
    if not MAIL_PASSWORD or MAIL_PASSWORD == "your_gmail_app_password_here":
        print(f"[ForgotPassword] Email not configured. OTP for {to_email}: {otp}")
        return  # dev mode — just log it

    msg = MIMEMultipart("alternative")
    msg["Subject"] = "TalentIQ — Your Password Reset Code"
    msg["From"]    = MAIL_FROM
    msg["To"]      = to_email

    # Render OTP as individual boxed digits — table-based so it renders
    # consistently across mobile and desktop email clients (no letter-spacing
    # overflow issues on small screens).
    digit_cells = "".join(
        f'''<td style="width:44px;height:52px;background:#1e1e1b;border:1px solid rgba(255,255,255,.15);
                border-radius:8px;text-align:center;vertical-align:middle;
                font-family:monospace;font-size:22px;font-weight:700;color:#e2b04a;">{d}</td>
           <td style="width:8px;"></td>'''
        for d in otp
    )

    html = f"""
    <html>
    <head><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
    <body style="margin:0;padding:0;background:#0a0a08;">
    <div style="font-family:sans-serif;max-width:480px;width:100%;margin:0 auto;
                padding:32px 20px;background:#0a0a08;color:#fff;border-radius:12px;
                box-sizing:border-box;">
      <div style="font-size:22px;font-weight:700;margin-bottom:8px;">TalentIQ</div>
      <p style="color:rgba(255,255,255,.6);font-size:14px;">Hi {user_name},</p>
      <p style="color:rgba(255,255,255,.6);font-size:14px;">Use this code to reset your password:</p>

      <table role="presentation" cellpadding="0" cellspacing="0" style="margin:20px auto;">
        <tr>{digit_cells}</tr>
      </table>

      <p style="color:rgba(255,255,255,.4);font-size:13px;text-align:center;">This code expires in {OTP_EXPIRY_MINUTES} minutes.</p>
      <p style="color:rgba(255,255,255,.2);font-size:11px;margin-top:24px;">If you did not request this, ignore this email.</p>
    </div>
    </body>
    </html>
    """

    msg.attach(MIMEText(html, "html"))

    with smtplib.SMTP(MAIL_SERVER, MAIL_PORT) as server:
        server.starttls()
        server.login(MAIL_USERNAME, MAIL_PASSWORD)
        server.sendmail(MAIL_FROM, to_email, msg.as_string())


@router.post("/forgot-password")
def forgot_password(body: ForgotPasswordRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == body.email.strip().lower()).first()

    # Always return success — don't leak whether email exists
    generic_msg = {"message": "If this email is registered, a reset code has been sent."}

    if not user:
        return generic_msg

    otp = generate_otp()
    user.reset_otp_hash = pwd_context.hash(otp)
    user.reset_otp_expires_at = datetime.utcnow() + timedelta(minutes=OTP_EXPIRY_MINUTES)
    db.commit()

    try:
        send_otp_email(user.email, otp, user.name or "there")
    except Exception as e:
        print(f"[ForgotPassword] Email send failed: {e}")
        raise HTTPException(status_code=500, detail="Could not send reset code. Please try again.")

    return generic_msg


@router.post("/reset-password")
def reset_password(body: ResetPasswordRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == body.email.strip().lower()).first()

    if not user or not user.reset_otp_hash or not user.reset_otp_expires_at:
        raise HTTPException(status_code=400, detail="Invalid or expired code.")

    if datetime.utcnow() > user.reset_otp_expires_at:
        raise HTTPException(status_code=400, detail="Code has expired. Please request a new one.")

    if not pwd_context.verify(body.otp, user.reset_otp_hash):
        raise HTTPException(status_code=400, detail="Incorrect code.")

    if len(body.new_password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters.")

    user.password_hash = pwd_context.hash(body.new_password)
    user.reset_otp_hash = None
    user.reset_otp_expires_at = None
    db.commit()

    return {"message": "Password reset successful. You can now log in."}