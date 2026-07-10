import os
import random
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

MAIL_USERNAME = os.getenv("MAIL_USERNAME", "")
MAIL_PASSWORD = os.getenv("MAIL_PASSWORD", "")
MAIL_FROM     = os.getenv("MAIL_FROM", MAIL_USERNAME)
MAIL_SERVER   = os.getenv("MAIL_SERVER", "smtp.gmail.com")
MAIL_PORT     = int(os.getenv("MAIL_PORT", "587"))

OTP_LENGTH = 5
OTP_EXPIRY_MINUTES = 10


def generate_otp(length: int = OTP_LENGTH) -> str:
    return ''.join(random.choices("0123456789", k=length))


def send_invite_email(to_email: str, org_name: str, inviter_name: str, invite_link: str):
    if not MAIL_PASSWORD or MAIL_PASSWORD == "your_gmail_app_password_here":
        print(f"[OTP Mailer] Email not configured. Invite link for {to_email}: {invite_link}")
        return

    msg = MIMEMultipart("alternative")
    msg["Subject"] = f"You've been invited to join {org_name} on TalentIQ"
    msg["From"] = MAIL_FROM
    msg["To"] = to_email

    html = f"""
    <html>
    <head><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
    <body style="margin:0;padding:0;background:#0a0a08;">
    <div style="font-family:sans-serif;max-width:480px;width:100%;margin:0 auto;
                padding:32px 20px;background:#0a0a08;color:#fff;border-radius:12px;
                box-sizing:border-box;">
      <div style="font-size:22px;font-weight:700;margin-bottom:8px;">TalentIQ</div>
      <p style="color:rgba(255,255,255,.6);font-size:14px;">
        <strong>{inviter_name}</strong> invited you to join <strong>{org_name}</strong>'s hiring team on TalentIQ.
      </p>
      <div style="text-align:center;margin:24px 0;">
        <a href="{invite_link}" style="background:#e2b04a;color:#0a0a08;padding:12px 28px;border-radius:8px;
           text-decoration:none;font-weight:700;font-size:14px;display:inline-block;">Accept Invite</a>
      </div>
      <p style="color:rgba(255,255,255,.4);font-size:12px;">This invite link expires in 7 days.</p>
      <p style="color:rgba(255,255,255,.2);font-size:11px;margin-top:24px;">If you weren't expecting this, you can ignore this email.</p>
    </div>
    </body>
    </html>
    """
    msg.attach(MIMEText(html, "html"))

    with smtplib.SMTP(MAIL_SERVER, MAIL_PORT) as server:
        server.starttls()
        server.login(MAIL_USERNAME, MAIL_PASSWORD)
        server.sendmail(MAIL_FROM, to_email, msg.as_string())


def send_otp_email(to_email: str, otp: str, user_name: str, purpose: str = "reset"):
    """
    purpose: "reset" (password reset code) or "verify" (signup email verification)
    """
    if not MAIL_PASSWORD or MAIL_PASSWORD == "your_gmail_app_password_here":
        print(f"[OTP Mailer] Email not configured. OTP for {to_email}: {otp}")
        return  # dev mode — just log it, don't fail the request

    if purpose == "verify":
        subject = "TalentIQ — Verify Your Email"
        intro = "Use this code to verify your email and activate your account:"
    else:
        subject = "TalentIQ — Your Password Reset Code"
        intro = "Use this code to reset your password:"

    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"]    = MAIL_FROM
    msg["To"]      = to_email

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
      <p style="color:rgba(255,255,255,.6);font-size:14px;">{intro}</p>

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