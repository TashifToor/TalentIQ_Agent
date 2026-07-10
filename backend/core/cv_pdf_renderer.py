import io
from reportlab.lib.pagesizes import letter
from reportlab.lib.units import inch
from reportlab.lib.enums import TA_LEFT
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, HRFlowable
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib import colors

from schemas.cv_builder import CVData

# ATS-safe by design: single column, no tables, no text boxes, no images,
# standard fonts only. Multi-column/graphic-heavy resumes routinely fail
# to parse correctly in real-world ATS systems — this is deliberate, not
# a design limitation.

TEMPLATE_ACCENTS = {
    "modern":  colors.HexColor("#1f4e5f"),
    "classic": colors.HexColor("#1a1a1a"),
}


def _build_styles(template: str):
    accent = TEMPLATE_ACCENTS.get(template, TEMPLATE_ACCENTS["modern"])
    styles = getSampleStyleSheet()

    styles.add(ParagraphStyle(
        name="CVName", fontName="Helvetica-Bold", fontSize=20,
        textColor=accent, spaceAfter=2, alignment=TA_LEFT,
    ))
    styles.add(ParagraphStyle(
        name="CVContact", fontName="Helvetica", fontSize=9.5,
        textColor=colors.HexColor("#444444"), spaceAfter=12,
    ))
    styles.add(ParagraphStyle(
        name="CVSectionHeading", fontName="Helvetica-Bold", fontSize=12,
        textColor=accent, spaceBefore=14, spaceAfter=6,
    ))
    styles.add(ParagraphStyle(
        name="CVBody", fontName="Helvetica", fontSize=10, leading=14,
        textColor=colors.HexColor("#222222"),
    ))
    styles.add(ParagraphStyle(
        name="CVEntryTitle", fontName="Helvetica-Bold", fontSize=10.5,
        textColor=colors.HexColor("#111111"), spaceBefore=8,
    ))
    styles.add(ParagraphStyle(
        name="CVEntrySub", fontName="Helvetica-Oblique", fontSize=9.5,
        textColor=colors.HexColor("#555555"), spaceAfter=4,
    ))
    styles.add(ParagraphStyle(
        name="CVBullet", fontName="Helvetica", fontSize=9.5, leading=13,
        leftIndent=12, textColor=colors.HexColor("#222222"),
    ))
    return styles, accent


def render_cv_pdf(cv: CVData, template: str = "modern") -> bytes:
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer, pagesize=letter,
        topMargin=0.6 * inch, bottomMargin=0.6 * inch,
        leftMargin=0.7 * inch, rightMargin=0.7 * inch,
    )
    styles, accent = _build_styles(template)
    story = []

    # --- Header ---
    story.append(Paragraph(cv.full_name or "Your Name", styles["CVName"]))
    contact_parts = [p for p in [cv.email, cv.phone, cv.location, cv.linkedin, cv.github] if p]
    if contact_parts:
        story.append(Paragraph(" &nbsp;|&nbsp; ".join(contact_parts), styles["CVContact"]))
    story.append(HRFlowable(width="100%", thickness=1, color=accent, spaceAfter=8))

    # --- Summary ---
    if cv.summary:
        story.append(Paragraph("SUMMARY", styles["CVSectionHeading"]))
        story.append(Paragraph(cv.summary, styles["CVBody"]))

    # --- Experience ---
    if cv.experience:
        story.append(Paragraph("EXPERIENCE", styles["CVSectionHeading"]))
        for exp in cv.experience:
            title_line = f"{exp.title or 'Role'} — {exp.company or 'Company'}"
            story.append(Paragraph(title_line, styles["CVEntryTitle"]))
            date_line = " – ".join([d for d in [exp.start_date, exp.end_date] if d])
            if date_line:
                story.append(Paragraph(date_line, styles["CVEntrySub"]))
            for bullet in exp.bullets:
                story.append(Paragraph(f"• {bullet}", styles["CVBullet"]))

    # --- Projects ---
    if cv.projects:
        story.append(Paragraph("PROJECTS", styles["CVSectionHeading"]))
        for proj in cv.projects:
            story.append(Paragraph(proj.name or "Project", styles["CVEntryTitle"]))
            if proj.tech_stack:
                story.append(Paragraph(proj.tech_stack, styles["CVEntrySub"]))
            if proj.description:
                story.append(Paragraph(proj.description, styles["CVBody"]))

    # --- Education ---
    if cv.education:
        story.append(Paragraph("EDUCATION", styles["CVSectionHeading"]))
        for edu in cv.education:
            story.append(Paragraph(edu.degree or "Degree", styles["CVEntryTitle"]))
            sub = f"{edu.institution or ''}"
            years = " – ".join([y for y in [edu.start_year, edu.end_year] if y])
            if years:
                sub += f"  ({years})" if sub else years
            if sub:
                story.append(Paragraph(sub, styles["CVEntrySub"]))
            if edu.details:
                story.append(Paragraph(edu.details, styles["CVBody"]))

    # --- Skills (kept as plain comma-separated text, not a table/graphic —
    # this is the single most ATS-parseable way to present a skills list) ---
    if cv.skills:
        story.append(Paragraph("SKILLS", styles["CVSectionHeading"]))
        story.append(Paragraph(", ".join(cv.skills), styles["CVBody"]))

    doc.build(story)
    buffer.seek(0)
    return buffer.read()