import io
from reportlab.lib.pagesizes import letter
from reportlab.lib.units import inch
from reportlab.lib.enums import TA_LEFT, TA_CENTER
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, HRFlowable
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib import colors

from schemas.cv_builder import CVData

# ATS-safe by design: single column, no tables, no text boxes, no images,
# standard fonts only. Multi-column/graphic-heavy resumes routinely fail
# to parse correctly in real-world ATS systems — this is deliberate.
#
# "modern" and "classic" are genuinely different layouts, not just a color
# swap: different fonts, header alignment, section-heading treatment, and
# bullet style.


def _build_modern_styles():
    accent = colors.HexColor("#1f4e5f")
    styles = getSampleStyleSheet()
    styles.add(ParagraphStyle(name="CVName", fontName="Helvetica-Bold", fontSize=21, textColor=accent, alignment=TA_LEFT, spaceAfter=2))
    styles.add(ParagraphStyle(name="CVContact", fontName="Helvetica", fontSize=9.5, textColor=colors.HexColor("#444444"), alignment=TA_LEFT, spaceAfter=12))
    styles.add(ParagraphStyle(name="CVSectionHeading", fontName="Helvetica-Bold", fontSize=12, textColor=accent, spaceBefore=14, spaceAfter=6, alignment=TA_LEFT))
    styles.add(ParagraphStyle(name="CVBody", fontName="Helvetica", fontSize=10, leading=14, textColor=colors.HexColor("#222222")))
    styles.add(ParagraphStyle(name="CVEntryTitle", fontName="Helvetica-Bold", fontSize=10.5, textColor=colors.HexColor("#111111"), spaceBefore=8))
    styles.add(ParagraphStyle(name="CVEntrySub", fontName="Helvetica-Oblique", fontSize=9.5, textColor=colors.HexColor("#555555"), spaceAfter=4))
    styles.add(ParagraphStyle(name="CVBullet", fontName="Helvetica", fontSize=9.5, leading=13, leftIndent=12, textColor=colors.HexColor("#222222"), bulletIndent=0))
    return styles, accent, "•"


def _build_classic_styles():
    ink = colors.HexColor("#1a1a1a")
    styles = getSampleStyleSheet()
    styles.add(ParagraphStyle(name="CVName", fontName="Times-Bold", fontSize=22, textColor=ink, alignment=TA_CENTER, spaceAfter=2, tracking=1))
    styles.add(ParagraphStyle(name="CVContact", fontName="Times-Roman", fontSize=9.5, textColor=colors.HexColor("#333333"), alignment=TA_CENTER, spaceAfter=12))
    styles.add(ParagraphStyle(name="CVSectionHeading", fontName="Times-Bold", fontSize=11.5, textColor=ink, spaceBefore=14, spaceAfter=4, alignment=TA_LEFT))
    styles.add(ParagraphStyle(name="CVBody", fontName="Times-Roman", fontSize=10.5, leading=14.5, textColor=colors.HexColor("#1a1a1a")))
    styles.add(ParagraphStyle(name="CVEntryTitle", fontName="Times-Bold", fontSize=10.5, textColor=colors.HexColor("#1a1a1a"), spaceBefore=8))
    styles.add(ParagraphStyle(name="CVEntrySub", fontName="Times-Italic", fontSize=9.5, textColor=colors.HexColor("#444444"), spaceAfter=4))
    styles.add(ParagraphStyle(name="CVBullet", fontName="Times-Roman", fontSize=10, leading=13.5, leftIndent=14, textColor=colors.HexColor("#1a1a1a")))
    return styles, ink, "—"


def render_cv_pdf(cv: CVData, template: str = "modern") -> bytes:
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer, pagesize=letter,
        topMargin=0.65 * inch, bottomMargin=0.6 * inch,
        leftMargin=0.75 * inch, rightMargin=0.75 * inch,
    )

    if template == "classic":
        styles, accent, bullet_char = _build_classic_styles()
    else:
        styles, accent, bullet_char = _build_modern_styles()

    story = []

    # --- Header ---
    story.append(Paragraph((cv.full_name or "Your Name").upper() if template == "classic" else (cv.full_name or "Your Name"), styles["CVName"]))
    contact_parts = [p for p in [cv.email, cv.phone, cv.location, cv.linkedin, cv.github] if p]
    if contact_parts:
        story.append(Paragraph(" &nbsp;|&nbsp; ".join(contact_parts), styles["CVContact"]))

    if template == "classic":
        story.append(HRFlowable(width="100%", thickness=1.4, color=accent, spaceAfter=10))
    else:
        story.append(HRFlowable(width="35%", thickness=2.5, color=accent, spaceAfter=10, hAlign="LEFT"))

    def section_heading(title):
        if template == "classic":
            story.append(Paragraph(f'<u>{title}</u>', styles["CVSectionHeading"]))
        else:
            story.append(Paragraph(title, styles["CVSectionHeading"]))

    # --- Summary ---
    if cv.summary:
        section_heading("SUMMARY")
        story.append(Paragraph(cv.summary, styles["CVBody"]))

    # --- Experience ---
    if cv.experience:
        section_heading("EXPERIENCE")
        for exp in cv.experience:
            title_line = f"{exp.title or 'Role'} — {exp.company or 'Company'}"
            story.append(Paragraph(title_line, styles["CVEntryTitle"]))
            date_line = " – ".join([d for d in [exp.start_date, exp.end_date] if d])
            if date_line:
                story.append(Paragraph(date_line, styles["CVEntrySub"]))
            for bullet in exp.bullets:
                story.append(Paragraph(f"{bullet_char} {bullet}", styles["CVBullet"]))

    # --- Projects ---
    if cv.projects:
        section_heading("PROJECTS")
        for proj in cv.projects:
            story.append(Paragraph(proj.name or "Project", styles["CVEntryTitle"]))
            if proj.tech_stack:
                story.append(Paragraph(proj.tech_stack, styles["CVEntrySub"]))
            if proj.description:
                story.append(Paragraph(proj.description, styles["CVBody"]))

    # --- Education ---
    if cv.education:
        section_heading("EDUCATION")
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

    # --- Skills ---
    if cv.skills:
        section_heading("SKILLS")
        story.append(Paragraph(", ".join(cv.skills), styles["CVBody"]))

    doc.build(story)
    buffer.seek(0)
    return buffer.read()