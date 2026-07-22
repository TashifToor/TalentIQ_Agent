import io
import base64
from reportlab.lib.pagesizes import letter
from reportlab.lib.units import inch
from reportlab.lib.enums import TA_LEFT, TA_CENTER
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, HRFlowable, Table, TableStyle, Image
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib import colors

from schemas.cv_builder import CVData

# ============================================================================
# ATS-safe templates are single-column by design: real-world ATS parsers read
# PDF text in stream order, and multi-column layouts frequently scramble that
# order. The 2 "visual" templates are Table-based two-column layouts and are
# intentionally excluded from ATS_SAFE_TEMPLATES.
# ============================================================================

ATS_SAFE_TEMPLATES = {"modern", "classic", "minimal", "banded", "elegant", "bold", "compact", "executive", "professional"}
VISUAL_ONLY_TEMPLATES = {"visual-sidebar", "visual-decorative"}
ALL_TEMPLATES = ATS_SAFE_TEMPLATES | VISUAL_ONLY_TEMPLATES


def _photo_flowable(photo_base64: str, size=1.0 * inch):
    try:
        if "," in photo_base64:
            photo_base64 = photo_base64.split(",", 1)[1]
        img_bytes = base64.b64decode(photo_base64)
        img = Image(io.BytesIO(img_bytes), width=size, height=size)
        return img
    except Exception as e:
        print(f"[CVRenderer] Photo decode failed, skipping: {e}")
        return None


def _skills_paragraphs(cv: CVData, styles, body_style="CVBody", entry_title_style="CVEntryTitle"):
    """Renders skill_groups (categorized) if present, otherwise falls back to
    the flat skills list. Returns a list of Paragraph flowables."""
    flowables = []
    if cv.skill_groups:
        for group in cv.skill_groups:
            if not group.items:
                continue
            label = f"<b>{group.category}:</b> " if group.category else ""
            flowables.append(Paragraph(f"{label}{', '.join(group.items)}", styles[body_style]))
    elif cv.skills:
        flowables.append(Paragraph(", ".join(cv.skills), styles[body_style]))
    return flowables


# ---------------------------------------------------------------------------
# Shared single-column renderer, driven by a per-template style config.
# Covers all 9 ATS-safe templates — fonts/colors/rule-style/section-order
# differ per template via the config dict.
# ---------------------------------------------------------------------------
def _style_config(template: str):
    configs = {
        "modern": dict(font="Helvetica", font_b="Helvetica-Bold", font_i="Helvetica-Oblique",
                       ink="#222222", accent="#1f4e5f", name_align=TA_LEFT, name_size=21,
                       heading_style="color", rule="accent-short", bullet="•",
                       section_order=["summary", "skills", "experience", "projects", "education", "achievements"]),
        "classic": dict(font="Times-Roman", font_b="Times-Bold", font_i="Times-Italic",
                         ink="#1a1a1a", accent="#1a1a1a", name_align=TA_CENTER, name_size=22,
                         heading_style="underline", rule="full", bullet="—",
                         section_order=["summary", "skills", "experience", "projects", "education", "achievements"]),
        "minimal": dict(font="Helvetica", font_b="Helvetica-Bold", font_i="Helvetica-Oblique",
                         ink="#333333", accent="#888888", name_align=TA_LEFT, name_size=19,
                         heading_style="plain-caps", rule="thin-full", bullet="–",
                         section_order=["summary", "skills", "experience", "projects", "education", "achievements"]),
        "banded": dict(font="Helvetica", font_b="Helvetica-Bold", font_i="Helvetica-Oblique",
                        ink="#222222", accent="#4a4a4a", name_align=TA_LEFT, name_size=22,
                        heading_style="band", rule="none", bullet="•",
                        section_order=["summary", "skills", "experience", "projects", "education", "achievements"]),
        "elegant": dict(font="Times-Roman", font_b="Times-Bold", font_i="Times-Italic",
                         ink="#2a2a2a", accent="#7a6a58", name_align=TA_LEFT, name_size=20,
                         heading_style="band-light", rule="none", bullet="•",
                         section_order=["summary", "skills", "experience", "projects", "education", "achievements"]),
        "bold": dict(font="Helvetica", font_b="Helvetica-Bold", font_i="Helvetica-Oblique",
                      ink="#000000", accent="#000000", name_align=TA_LEFT, name_size=26,
                      heading_style="bold-caps", rule="thick-short", bullet="▪",
                      section_order=["summary", "skills", "experience", "projects", "education", "achievements"]),
        "compact": dict(font="Helvetica", font_b="Helvetica-Bold", font_i="Helvetica-Oblique",
                         ink="#222222", accent="#2f5d8a", name_align=TA_LEFT, name_size=17,
                         heading_style="color-small", rule="accent-short", bullet="•",
                         section_order=["summary", "skills", "experience", "projects", "education", "achievements"]),
        "executive": dict(font="Helvetica", font_b="Helvetica-Bold", font_i="Helvetica-Oblique",
                           ink="#f5f5f5", accent="#1a2332", name_align=TA_LEFT, name_size=23,
                           heading_style="color", rule="accent-short", bullet="•", dark_header=True,
                           section_order=["summary", "skills", "experience", "projects", "education", "achievements"]),
        # Matches the reference structure exactly: name centered, role under
        # name, contact line, rule, then Summary -> Skills -> Experience ->
        # Projects -> Education -> Achievements/Certifications, in that order.
        "professional": dict(font="Helvetica", font_b="Helvetica-Bold", font_i="Helvetica-Oblique",
                              ink="#1a1a1a", accent="#1a1a1a", name_align=TA_CENTER, name_size=20,
                              heading_style="underline-bold", rule="full", bullet="•",
                              section_order=["summary", "skills", "experience", "projects", "education", "achievements"]),
    }
    return configs.get(template, configs["modern"])


def _build_styles(cfg):
    accent = colors.HexColor(cfg["accent"])
    ink = colors.HexColor(cfg["ink"])
    styles = getSampleStyleSheet()
    name_color = colors.white if cfg.get("dark_header") else accent

    styles.add(ParagraphStyle(name="CVName", fontName=cfg["font_b"], fontSize=cfg["name_size"], textColor=name_color, alignment=cfg["name_align"], spaceAfter=2))
    styles.add(ParagraphStyle(name="CVRole", fontName=cfg["font"], fontSize=11.5, textColor=colors.white if cfg.get("dark_header") else colors.HexColor("#555555"), alignment=cfg["name_align"], spaceAfter=4))
    styles.add(ParagraphStyle(name="CVContact", fontName=cfg["font"], fontSize=9.5, textColor=colors.white if cfg.get("dark_header") else colors.HexColor("#444444"), alignment=cfg["name_align"], spaceAfter=10))

    if cfg["heading_style"] in ("underline", "underline-bold"):
        heading_size, heading_color = (12, ink) if cfg["heading_style"] == "underline-bold" else (11.5, ink)
    elif cfg["heading_style"] == "plain-caps":
        heading_size, heading_color = 10.5, colors.HexColor("#666666")
    elif cfg["heading_style"] in ("band", "band-light"):
        heading_size, heading_color = 11, colors.white if cfg["heading_style"] == "band" else ink
    elif cfg["heading_style"] == "bold-caps":
        heading_size, heading_color = 13, ink
    elif cfg["heading_style"] == "color-small":
        heading_size, heading_color = 10, accent
    else:
        heading_size, heading_color = 12, accent

    styles.add(ParagraphStyle(name="CVSectionHeading", fontName=cfg["font_b"], fontSize=heading_size, textColor=heading_color, spaceBefore=13, spaceAfter=6))
    styles.add(ParagraphStyle(name="CVBody", fontName=cfg["font"], fontSize=10, leading=14, textColor=ink))
    styles.add(ParagraphStyle(name="CVEntryTitle", fontName=cfg["font_b"], fontSize=10.5, textColor=ink, spaceBefore=7))
    styles.add(ParagraphStyle(name="CVEntrySub", fontName=cfg["font_i"], fontSize=9.5, textColor=colors.HexColor("#555555"), spaceAfter=4))
    styles.add(ParagraphStyle(name="CVBullet", fontName=cfg["font"], fontSize=9.5, leading=13, leftIndent=12, textColor=ink))
    return styles, accent, ink


def _section_heading(story, title, styles, cfg, accent):
    style = cfg["heading_style"]
    if style in ("underline", "underline-bold"):
        story.append(Paragraph(f"<u>{title}</u>", styles["CVSectionHeading"]))
    elif style in ("band", "band-light"):
        bg = accent if style == "band" else colors.HexColor("#f0ede8")
        t = Table([[Paragraph(title, styles["CVSectionHeading"])]], colWidths=[6.7 * inch])
        t.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, -1), bg),
            ("TOPPADDING", (0, 0), (-1, -1), 4), ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
            ("LEFTPADDING", (0, 0), (-1, -1), 8),
        ]))
        story.append(Spacer(1, 8))
        story.append(t)
        story.append(Spacer(1, 4))
    else:
        story.append(Paragraph(title, styles["CVSectionHeading"]))
        if style in ("color", "accent-short", "compact"):
            story.append(HRFlowable(width="100%", thickness=0.8, color=accent, spaceBefore=1, spaceAfter=6))


SECTION_TITLES = {
    "summary": "SUMMARY", "skills": "SKILLS", "experience": "EXPERIENCE",
    "projects": "PROJECTS", "education": "EDUCATION", "achievements": "ACHIEVEMENTS & CERTIFICATIONS",
}


def render_ats_safe_pdf(cv: CVData, template: str) -> bytes:
    cfg = _style_config(template)
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=letter, topMargin=0.6 * inch, bottomMargin=0.55 * inch,
                             leftMargin=0.75 * inch, rightMargin=0.75 * inch)
    styles, accent, ink = _build_styles(cfg)
    story = []

    # --- Header: built once, in final order, no post-hoc insertion (this is
    # what was causing the overlap bug — inserting a photo into an
    # already-built story after the fact shifted flowables unpredictably). ---
    header_flowables = []
    if cv.photo_base64:
        photo = _photo_flowable(cv.photo_base64)
        if photo:
            if cfg["name_align"] == TA_CENTER:
                photo.hAlign = "CENTER"
            header_flowables.append(photo)
            header_flowables.append(Spacer(1, 6))

    if cfg.get("dark_header"):
        rows = [[Paragraph(cv.full_name or "Your Name", styles["CVName"])]]
        if cv.role_title:
            rows.append([Paragraph(cv.role_title, styles["CVRole"])])
        contact_parts = [p for p in [cv.email, cv.phone, cv.location, cv.linkedin, cv.github] if p]
        if contact_parts:
            rows.append([Paragraph(" | ".join(contact_parts), styles["CVContact"])])
        t = Table(rows, colWidths=[6.7 * inch])
        t.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor(cfg["accent"])),
            ("TOPPADDING", (0, 0), (-1, 0), 14), ("BOTTOMPADDING", (0, -1), (-1, -1), 14),
            ("LEFTPADDING", (0, 0), (-1, -1), 10),
        ]))
        header_flowables.append(t)
        header_flowables.append(Spacer(1, 10))
    else:
        header_flowables.append(Paragraph(cv.full_name or "Your Name", styles["CVName"]))
        if cv.role_title:
            header_flowables.append(Paragraph(cv.role_title, styles["CVRole"]))
        contact_parts = [p for p in [cv.email, cv.phone, cv.location, cv.linkedin, cv.github] if p]
        if contact_parts:
            header_flowables.append(Paragraph(" &nbsp;|&nbsp; ".join(contact_parts), styles["CVContact"]))
        if cfg["rule"] == "full":
            header_flowables.append(HRFlowable(width="100%", thickness=1.4, color=accent, spaceAfter=8))
        elif cfg["rule"] == "thin-full":
            header_flowables.append(HRFlowable(width="100%", thickness=0.5, color=colors.HexColor("#cccccc"), spaceAfter=8))
        elif cfg["rule"] == "thick-short":
            header_flowables.append(HRFlowable(width="20%", thickness=3, color=accent, spaceAfter=10, hAlign="LEFT"))
        elif cfg["rule"] == "accent-short":
            header_flowables.append(HRFlowable(width="35%", thickness=2, color=accent, spaceAfter=8, hAlign="LEFT"))

    story.extend(header_flowables)

    def render_section(key):
        if key == "summary" and cv.summary:
            _section_heading(story, SECTION_TITLES["summary"], styles, cfg, accent)
            story.append(Paragraph(cv.summary, styles["CVBody"]))

        elif key == "skills" and (cv.skills or cv.skill_groups):
            _section_heading(story, SECTION_TITLES["skills"], styles, cfg, accent)
            for p in _skills_paragraphs(cv, styles):
                story.append(p)

        elif key == "experience" and cv.experience:
            _section_heading(story, SECTION_TITLES["experience"], styles, cfg, accent)
            for exp in cv.experience:
                story.append(Paragraph(f"{exp.title or 'Role'} — {exp.company or 'Company'}", styles["CVEntryTitle"]))
                date_line = " – ".join([d for d in [exp.start_date, exp.end_date] if d])
                if date_line:
                    story.append(Paragraph(date_line, styles["CVEntrySub"]))
                for bullet in exp.bullets:
                    story.append(Paragraph(f"{cfg['bullet']} {bullet}", styles["CVBullet"]))

        elif key == "projects" and cv.projects:
            _section_heading(story, SECTION_TITLES["projects"], styles, cfg, accent)
            for proj in cv.projects:
                story.append(Paragraph(proj.name or "Project", styles["CVEntryTitle"]))
                if proj.tech_stack:
                    story.append(Paragraph(proj.tech_stack, styles["CVEntrySub"]))
                if proj.description:
                    story.append(Paragraph(proj.description, styles["CVBody"]))

        elif key == "education" and cv.education:
            _section_heading(story, SECTION_TITLES["education"], styles, cfg, accent)
            for edu in cv.education:
                story.append(Paragraph(edu.degree or "Degree", styles["CVEntryTitle"]))
                sub = edu.institution or ""
                years = " – ".join([y for y in [edu.start_year, edu.end_year] if y])
                if years:
                    sub += f"  ({years})" if sub else years
                if sub:
                    story.append(Paragraph(sub, styles["CVEntrySub"]))
                if edu.details:
                    story.append(Paragraph(edu.details, styles["CVBody"]))

        elif key == "achievements" and cv.achievements:
            _section_heading(story, SECTION_TITLES["achievements"], styles, cfg, accent)
            for a in cv.achievements:
                story.append(Paragraph(f"{cfg['bullet']} {a}", styles["CVBullet"]))

    for section_key in cfg["section_order"]:
        render_section(section_key)

    doc.build(story)
    buffer.seek(0)
    return buffer.read()


# ---------------------------------------------------------------------------
# Visual-only templates — genuinely 2-column (Table-based), photo-forward.
# NOT ATS-safe by design; intended for direct human review.
# ---------------------------------------------------------------------------
def render_visual_sidebar_pdf(cv: CVData, accent_hex="#a97155") -> bytes:
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=letter, topMargin=0.5 * inch, bottomMargin=0.5 * inch,
                             leftMargin=0.5 * inch, rightMargin=0.5 * inch)
    accent = colors.HexColor(accent_hex)
    styles = getSampleStyleSheet()
    styles.add(ParagraphStyle(name="VName", fontName="Helvetica-Bold", fontSize=24, textColor=accent))
    styles.add(ParagraphStyle(name="VRole", fontName="Helvetica", fontSize=13, textColor=colors.HexColor("#333333"), spaceAfter=14))
    styles.add(ParagraphStyle(name="VHeading", fontName="Helvetica-Bold", fontSize=11, textColor=colors.HexColor("#1a1a1a"), spaceBefore=10, spaceAfter=4))
    styles.add(ParagraphStyle(name="VBody", fontName="Helvetica", fontSize=9.5, leading=13, textColor=colors.HexColor("#333333")))
    styles.add(ParagraphStyle(name="VSub", fontName="Helvetica-Oblique", fontSize=9, textColor=colors.HexColor("#666666")))
    styles.add(ParagraphStyle(name="VBullet", fontName="Helvetica", fontSize=9, leading=12.5, leftIndent=10, textColor=colors.HexColor("#333333")))

    left_col = []
    if cv.photo_base64:
        photo = _photo_flowable(cv.photo_base64, size=1.6 * inch)
        if photo:
            left_col.append(photo)
            left_col.append(Spacer(1, 10))
    left_col.append(Paragraph("CONTACT", styles["VHeading"]))
    for p in [cv.email, cv.phone, cv.location, cv.linkedin, cv.github]:
        if p:
            left_col.append(Paragraph(p, styles["VBody"]))
    if cv.skills or cv.skill_groups:
        left_col.append(Paragraph("SKILLS", styles["VHeading"]))
        for p in _skills_paragraphs(cv, styles, body_style="VBody"):
            left_col.append(p)
    if cv.achievements:
        left_col.append(Paragraph("CERTIFICATIONS", styles["VHeading"]))
        for a in cv.achievements:
            left_col.append(Paragraph(f"• {a}", styles["VBullet"]))

    right_col = [Paragraph(cv.full_name or "Your Name", styles["VName"])]
    if cv.role_title:
        right_col.append(Paragraph(cv.role_title, styles["VRole"]))
    if cv.summary:
        right_col.append(Paragraph("Professional Summary", styles["VHeading"]))
        right_col.append(Paragraph(cv.summary, styles["VBody"]))
    if cv.experience:
        right_col.append(Paragraph("Experience", styles["VHeading"]))
        for exp in cv.experience:
            right_col.append(Paragraph(f"<b>{exp.title or 'Role'}</b> — {exp.company or 'Company'}", styles["VBody"]))
            date_line = " – ".join([d for d in [exp.start_date, exp.end_date] if d])
            if date_line:
                right_col.append(Paragraph(date_line, styles["VSub"]))
            for b in exp.bullets:
                right_col.append(Paragraph(f"• {b}", styles["VBullet"]))
    if cv.projects:
        right_col.append(Paragraph("Projects", styles["VHeading"]))
        for p in cv.projects:
            right_col.append(Paragraph(f"<b>{p.name}</b>", styles["VBody"]))
            if p.description:
                right_col.append(Paragraph(p.description, styles["VBullet"]))
    if cv.education:
        right_col.append(Paragraph("Education", styles["VHeading"]))
        for edu in cv.education:
            right_col.append(Paragraph(f"<b>{edu.degree or 'Degree'}</b> — {edu.institution or ''}", styles["VBody"]))

    table = Table([[left_col, right_col]], colWidths=[2.1 * inch, 5.1 * inch])
    table.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (0, 0), 0), ("RIGHTPADDING", (0, 0), (0, 0), 14),
        ("LEFTPADDING", (1, 0), (1, 0), 14), ("LINEBEFORE", (1, 0), (1, 0), 0.6, colors.HexColor("#dddddd")),
    ]))
    doc.build([table])
    buffer.seek(0)
    return buffer.read()


def render_visual_decorative_pdf(cv: CVData) -> bytes:
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=letter, topMargin=0.6 * inch, bottomMargin=0.5 * inch,
                             leftMargin=0.6 * inch, rightMargin=0.6 * inch)
    ink = colors.HexColor("#2a2a2a")
    styles = getSampleStyleSheet()
    styles.add(ParagraphStyle(name="DName", fontName="Times-Bold", fontSize=26, textColor=ink, alignment=TA_CENTER, spaceAfter=2))
    styles.add(ParagraphStyle(name="DRole", fontName="Times-Italic", fontSize=13, textColor=colors.HexColor("#666666"), alignment=TA_CENTER, spaceAfter=14))
    styles.add(ParagraphStyle(name="DHeading", fontName="Times-Bold", fontSize=11, textColor=ink, spaceBefore=8, spaceAfter=4))
    styles.add(ParagraphStyle(name="DBody", fontName="Times-Roman", fontSize=9.5, leading=13.5, textColor=ink))
    styles.add(ParagraphStyle(name="DSub", fontName="Times-Italic", fontSize=9, textColor=colors.HexColor("#666666")))
    styles.add(ParagraphStyle(name="DBullet", fontName="Times-Roman", fontSize=9.5, leading=13, leftIndent=10, textColor=ink))

    story = []
    if cv.photo_base64:
        photo = _photo_flowable(cv.photo_base64, size=1.3 * inch)
        if photo:
            photo.hAlign = "CENTER"
            story.append(photo)
            story.append(Spacer(1, 8))
    story.append(Paragraph(cv.full_name or "Your Name", styles["DName"]))
    role_and_contact = [cv.role_title] if cv.role_title else []
    role_and_contact += [p for p in [cv.email, cv.phone, cv.location] if p]
    if role_and_contact:
        story.append(Paragraph(" &nbsp;•&nbsp; ".join(role_and_contact), styles["DRole"]))
    story.append(HRFlowable(width="60%", thickness=0.6, color=colors.HexColor("#999999"), spaceAfter=10, hAlign="CENTER"))

    left_col, right_col = [], []
    if cv.education:
        left_col.append(Paragraph("EDUCATION", styles["DHeading"]))
        for edu in cv.education:
            left_col.append(Paragraph(f"<b>{edu.degree or ''}</b>", styles["DBody"]))
            left_col.append(Paragraph(edu.institution or "", styles["DSub"]))
    if cv.skills or cv.skill_groups:
        left_col.append(Paragraph("SKILLS", styles["DHeading"]))
        for p in _skills_paragraphs(cv, styles, body_style="DBody"):
            left_col.append(p)
    if cv.achievements:
        left_col.append(Paragraph("CERTIFICATIONS", styles["DHeading"]))
        for a in cv.achievements:
            left_col.append(Paragraph(f"• {a}", styles["DBullet"]))

    if cv.summary:
        right_col.append(Paragraph("PROFILE SUMMARY", styles["DHeading"]))
        right_col.append(Paragraph(cv.summary, styles["DBody"]))
    if cv.experience:
        right_col.append(Paragraph("EXPERIENCE", styles["DHeading"]))
        for exp in cv.experience:
            right_col.append(Paragraph(f"<b>{exp.title or ''}</b> — {exp.company or ''}", styles["DBody"]))
            for b in exp.bullets:
                right_col.append(Paragraph(f"• {b}", styles["DBullet"]))
    if cv.projects:
        right_col.append(Paragraph("PROJECTS", styles["DHeading"]))
        for p in cv.projects:
            right_col.append(Paragraph(f"<b>{p.name}</b>", styles["DBody"]))

    table = Table([[left_col, right_col]], colWidths=[2.3 * inch, 4.6 * inch])
    table.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (1, 0), (1, 0), 16), ("LINEBEFORE", (1, 0), (1, 0), 0.6, colors.HexColor("#dddddd")),
    ]))
    story.append(table)
    doc.build(story)
    buffer.seek(0)
    return buffer.read()


def render_cv_pdf(cv: CVData, template: str = "modern") -> bytes:
    if template == "visual-sidebar":
        return render_visual_sidebar_pdf(cv)
    if template == "visual-decorative":
        return render_visual_decorative_pdf(cv)
    return render_ats_safe_pdf(cv, template if template in ATS_SAFE_TEMPLATES else "modern")