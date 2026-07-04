import os
import random
import string
import smtplib
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


class ForgotPasswordRequest(BaseModel):
    email: str


def generate_temp_password(length=10) -> str:
    chars = string.ascii_letters + string.digits + "!@#$"
    return ''.join(random.choices(chars, k=length))


def send_email(to_email: str, temp_password: str, user_name: str):
    if not MAIL_PASSWORD or MAIL_PASSWORD == "your_gmail_app_password_here":
        print(f"[ForgotPassword] Email not configured. Temp password for {to_email}: {temp_password}")
        return  # dev mode — just log it

    msg = MIMEMultipart("alternative")
    msg["Subject"] = "TalentIQ — Your Temporary Password"
    msg["From"]    = MAIL_FROM
    msg["To"]      = to_email

    html = f"""
    <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px;background:#0a0a08;color:#fff;border-radius:12px;">
      <div style="font-size:24px;font-weight:700;margin-bottom:8px;">TalentIQ</div>
      <p style="color:rgba(255,255,255,.6)">Hi {user_name},</p>
      <p style="color:rgba(255,255,255,.6)">Here is your temporary password:</p>
      <div style="background:#161614;border:1px solid rgba(255,255,255,.1);border-radius:8px;padding:16px;text-align:center;margin:20px 0;">
        <span style="font-family:monospace;font-size:22px;font-weight:700;letter-spacing:4px;color:#e2b04a">{temp_password}</span>
      </div>
      <p style="color:rgba(255,255,255,.4);font-size:13px;">Login with this password, then change it from Settings.</p>
      <p style="color:rgba(255,255,255,.2);font-size:11px;margin-top:24px;">If you did not request this, ignore this email.</p>
    </div>
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
    if not user:
        return { "message": "If this email is registered, a temporary password has been sent." }

    temp_password = generate_temp_password()
    user.password_hash = pwd_context.hash(temp_password)
    db.commit()

    try:
        send_email(user.email, temp_password, user.name or "there")
    except Exception as e:
        print(f"[ForgotPassword] Email send failed: {e}")
        raise HTTPException(status_code=500, detail="Password reset failed. Please try again.")

    return { "message": "If this email is registered, a temporary password has been sent." }