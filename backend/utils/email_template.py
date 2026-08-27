"""
One shared, email-client-safe HTML shell used by every TalentIQ email
sender (utils/otp_mailer.py, routes/bulk.py). Fixes the readability bug
across all of them at once instead of patching each dark-themed template
individually — light background, dark readable text, all styles inline
(no external stylesheet — most email clients strip those anyway).

Only the visual wrapper lives here. Every sender still owns its own
subject line, body copy, links, and tokens exactly as before — this module
never touches what an email says, only how it's presented.
"""

# Palette — restrained, professional, matches TalentIQ's gold accent from
# the product UI but swapped to light-mode-safe values (the product's dark
# theme #e2b04a-on-black doesn't carry over to a white email background).
BG = "#f4f3ef"            # page background behind the card
CARD_BG = "#ffffff"       # the card itself
BORDER = "#e5e2d9"
TEXT_HEADING = "#1a1815"  # near-black, not pure #000 (softer, still very high contrast)
TEXT_BODY = "#4a473f"
TEXT_MUTED = "#8a8678"
GOLD = "#b8862c"          # darkened from the product's #e2b04a for AA contrast on white
GOLD_BG = "#b8862c"


def render_email(
    heading: str,
    body_html: str,
    subheading: str | None = None,
    cta_label: str | None = None,
    cta_url: str | None = None,
    footer_note: str | None = None,
    preheader: str | None = None,
) -> str:
    """
    heading      — the main H1-style line (e.g. "You're invited to interview")
    body_html    — the pre-built inner HTML for this specific email (paragraphs,
                    a score table, OTP digit boxes, etc.) — caller's own content,
                    unchanged from before; this function only wraps it.
    subheading   — optional small line under the TalentIQ label (e.g. a role title)
    cta_label/cta_url — optional single primary button
    footer_note  — optional small print under the CTA
    preheader    — optional hidden preview text shown in inbox lists
    """
    preheader_html = (
        f'<div style="display:none;max-height:0;overflow:hidden;opacity:0;">{preheader}</div>'
        if preheader else ""
    )
    subheading_html = (
        f'<p style="margin:2px 0 0;font-size:13px;color:{TEXT_MUTED};">{subheading}</p>'
        if subheading else ""
    )
    cta_html = ""
    if cta_label and cta_url:
        cta_html = f"""
        <table role="presentation" cellpadding="0" cellspacing="0" style="margin:24px 0 4px;">
        <tr><td style="border-radius:8px;background:{GOLD_BG};">
            <a href="{cta_url}" style="display:inline-block;padding:12px 28px;font-size:14px;font-weight:700;
            color:#ffffff;text-decoration:none;border-radius:8px;font-family:'Segoe UI',Arial,sans-serif;">{cta_label}</a>
        </td></tr>
        </table>"""
    footer_html = (
        f'<p style="margin:20px 0 0;font-size:12px;color:{TEXT_MUTED};line-height:1.6;">{footer_note}</p>'
        if footer_note else ""
    )

    return f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
<title>TalentIQ</title>
</head>
<body style="margin:0;padding:0;background:{BG};-webkit-text-size-adjust:100%;">
{preheader_html}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:{BG};padding:32px 16px;">
    <tr>
    <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
            style="max-width:520px;width:100%;background:{CARD_BG};border:1px solid {BORDER};
                    border-radius:12px;overflow:hidden;font-family:'Segoe UI',Arial,Helvetica,sans-serif;">
        <tr>
            <td style="padding:28px 32px 20px;border-bottom:1px solid {BORDER};">
            <div style="font-size:12px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:{GOLD};">TalentIQ</div>
            <h1 style="margin:10px 0 0;font-size:21px;font-weight:700;color:{TEXT_HEADING};line-height:1.35;">{heading}</h1>
            {subheading_html}
            </td>
        </tr>
        <tr>
            <td style="padding:24px 32px 30px;">
            <div style="font-size:14px;color:{TEXT_BODY};line-height:1.65;">{body_html}</div>
            {cta_html}
            {footer_html}
            </td>
        </tr>
        </table>
        <p style="max-width:520px;margin:18px 0 0;font-size:11px;color:{TEXT_MUTED};text-align:center;font-family:'Segoe UI',Arial,sans-serif;">
        TalentIQ &middot; This is an automated message.
        </p>
    </td>
    </tr>
</table>
</body>
</html>"""