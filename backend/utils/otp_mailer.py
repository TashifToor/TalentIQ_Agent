import os
import random
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from utils.email_template import render_email, TEXT_MUTED, TEXT_HEADING, GOLD, BORDER

MAIL_USERNAME = os.getenv("MAIL_USERNAME", "")
MAIL_PASSWORD = os.getenv("MAIL_PASSWORD", "")
MAIL_FROM     = os.getenv("MAIL_FROM", MAIL_USERNAME)
MAIL_SERVER   = os.getenv("MAIL_SERVER", "smtp.gmail.com")
MAIL_PORT     = int(os.getenv("MAIL_PORT", "587"))
FRONTEND_URL  = os.getenv("FRONTEND_URL", "http://localhost:3000")

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

    html = render_email(
        heading=f"You've been invited to join {org_name}",
        preheader=f"{inviter_name} invited you to join {org_name}'s hiring team on TalentIQ.",
        body_html=f"<p style=\"margin:0;\"><strong>{inviter_name}</strong> invited you to join <strong>{org_name}</strong>'s hiring team on TalentIQ.</p>",
        cta_label="Accept Invite",
        cta_url=invite_link,
        footer_note="This invite link expires in 7 days. If you weren't expecting this, you can ignore this email.",
    )
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
        f'''<td style="width:44px;height:52px;background:#f4f3ef;border:1px solid {BORDER};
                border-radius:8px;text-align:center;vertical-align:middle;
                font-family:monospace;font-size:22px;font-weight:700;color:{TEXT_HEADING};">{d}</td>
           <td style="width:8px;"></td>'''
        for d in otp
    )

    digit_table = (
        f'<table role="presentation" cellpadding="0" cellspacing="0" style="margin:20px 0;"><tr>{digit_cells}</tr></table>'
    )

    html = render_email(
        heading=subject.replace("TalentIQ — ", ""),
        preheader=intro,
        body_html=f"<p style=\"margin:0 0 4px;\">Hi {user_name},</p><p style=\"margin:0 0 4px;\">{intro}</p>{digit_table}"
                  f"<p style=\"margin:0;font-size:13px;color:{TEXT_MUTED};\">This code expires in {OTP_EXPIRY_MINUTES} minutes.</p>",
        footer_note="If you did not request this, you can safely ignore this email.",
    )

    msg.attach(MIMEText(html, "html"))

    with smtplib.SMTP(MAIL_SERVER, MAIL_PORT) as server:
        server.starttls()
        server.login(MAIL_USERNAME, MAIL_PASSWORD)
        server.sendmail(MAIL_FROM, to_email, msg.as_string())

def send_interview_completed_email(to_email: str, hr_name: str, candidate_name: str, candidate_email: str, role_title: str, score: int | None, verdict: str | None):
    """Notifies the HR user who owns an interview posting once a candidate finishes the AI interview."""
    if not MAIL_PASSWORD or MAIL_PASSWORD == "your_gmail_app_password_here":
        print(f"[OTP Mailer] Email not configured. Interview completed by {candidate_name} <{candidate_email}> for '{role_title}' — score {score}, verdict {verdict}.")
        return

    msg = MIMEMultipart("alternative")
    msg["Subject"] = f"New AI interview submitted: {candidate_name} — {role_title}"
    msg["From"]    = MAIL_FROM
    msg["To"]      = to_email

    score_display = str(score) if score is not None else "—"
    verdict_display = verdict or "Pending review"
    verdict_color = "#0e8f6b" if verdict in ("Strong Hire", "Proceed to Human Interview") else ("#b8862c" if verdict == "Borderline" else "#c0392b")

    score_card = f"""
      <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;margin:16px 0;background:#f4f3ef;border-radius:10px;border:1px solid {BORDER};">
        <tr>
          <td style="padding:16px 20px;">
            <div style="font-size:11px;color:{TEXT_MUTED};text-transform:uppercase;letter-spacing:.05em;margin-bottom:4px;">Score</div>
            <div style="font-size:28px;font-weight:700;color:{GOLD};">{score_display}</div>
            <div style="font-size:11px;color:{TEXT_MUTED};text-transform:uppercase;letter-spacing:.05em;margin:12px 0 4px;">Verdict</div>
            <div style="font-size:14px;font-weight:700;color:{verdict_color};">{verdict_display}</div>
          </td>
        </tr>
      </table>"""

    html = render_email(
        heading="New AI interview submitted",
        subheading=role_title,
        preheader=f"{candidate_name} just finished the AI screening interview for {role_title}.",
        body_html=f"<p style=\"margin:0 0 4px;\">Hi {hr_name},</p>"
                  f"<p style=\"margin:0;\"><strong>{candidate_name}</strong> ({candidate_email}) just finished the AI screening interview for <strong>{role_title}</strong>.</p>"
                  f"{score_card}",
        cta_label="View Full Report",
        cta_url=f"{FRONTEND_URL}/hr/dashboard",
        footer_note="Open the AI Interviewer tab in your dashboard to see the full transcript and analysis.",
    )
    msg.attach(MIMEText(html, "html"))

    with smtplib.SMTP(MAIL_SERVER, MAIL_PORT) as server:
        server.starttls()
        server.login(MAIL_USERNAME, MAIL_PASSWORD)
        server.sendmail(MAIL_FROM, to_email, msg.as_string())


def send_candidate_completion_email(to_email: str, candidate_name: str, role_title: str, company: str | None, what: str = "interview"):
    """Sent to the candidate themselves right after they finish an AI interview and/or assessment.
    `what` should be one of: "interview", "assessment", "interview and assessment"."""
    if not MAIL_PASSWORD or MAIL_PASSWORD == "your_gmail_app_password_here":
        print(f"[OTP Mailer] Email not configured. Would confirm completion with {candidate_name} <{to_email}> for '{role_title}'.")
        return

    company_line = f" at {company}" if company else ""

    msg = MIMEMultipart("alternative")
    msg["Subject"] = f"Thanks for completing your {what} — {role_title}"
    msg["From"]    = MAIL_FROM
    msg["To"]      = to_email

    html = render_email(
        heading=f"Thanks for completing your {what}",
        subheading=f"{role_title}{company_line}",
        preheader=f"Your responses for {role_title} have been submitted to the hiring team.",
        body_html=f"<p style=\"margin:0 0 4px;\">Hi {candidate_name},</p>"
                  f"<p style=\"margin:0 0 4px;\">Thanks for completing your {what} for <strong>{role_title}</strong>{company_line}. "
                  f"Your responses have been submitted to the hiring team for review.</p>"
                  f"<p style=\"margin:0;\">They'll be in touch if there's a next step. We appreciate the time you put into this.</p>",
        footer_note="This is an automated confirmation — no action needed from you right now.",
    )
    msg.attach(MIMEText(html, "html"))

    with smtplib.SMTP(MAIL_SERVER, MAIL_PORT) as server:
        server.starttls()
        server.login(MAIL_USERNAME, MAIL_PASSWORD)
        server.sendmail(MAIL_FROM, to_email, msg.as_string())