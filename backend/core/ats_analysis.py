"""
Resume ATS structure analysis — deterministic, rule-based, zero LLM calls.

This is intentionally NOT the same engine as core/graph.py's TalentIQGraph
(which scores a resume against a specific job description via Groq). That
engine already IS the Job Match Lab's analysis engine and is reused as-is
for that feature.

This module answers a different, JD-independent question: "is this resume
structurally sound and ATS-parseable at all?" — formatting, section
completeness, contact info, bullet quality, keyword grounding. Every
number here is computed directly from the actual CVData the candidate is
editing. Nothing is invented, nothing calls out to an LLM, so there is
zero fabrication risk and it's free to re-run on every keystroke.
"""
import re
from schemas.cv_builder import CVData, ATS_SAFE_TEMPLATES

WEAK_OPENERS = (
    "responsible for", "worked on", "helped with", "duties included",
    "in charge of", "tasked with", "involved in", "assisted with",
    "participated in", "was part of",
)

STRONG_VERB_PATTERN = re.compile(
    r"^(built|led|designed|developed|engineered|architected|automated|optimized|"
    r"reduced|increased|improved|launched|shipped|implemented|created|deployed|"
    r"migrated|refactored|scaled|managed|delivered|drove|spearheaded|streamlined|"
    r"integrated|configured|debugged|resolved|analyzed|researched|mentored|"
    r"coordinated|established|initiated|owned|maintained|wrote|trained|"
    r"reviewed|tested|monitored|secured|negotiated|generated|produced)",
    re.IGNORECASE,
)

METRIC_PATTERN = re.compile(r"(\d+(\.\d+)?\s*%|\$\s?\d|\b\d{2,}\b|\d+x\b)", re.IGNORECASE)

EMAIL_PATTERN = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


def _category(score: int, issues: list[str], recommendations: list[str]) -> dict:
    return {
        "score": max(0, min(100, round(score))),
        "issues": issues,
        "recommendations": recommendations,
    }


def _contact_completeness(cv: CVData) -> dict:
    issues, recs = [], []
    fields_present = 0
    total_fields = 5  # email, phone, location, linkedin, one of github/portfolio

    if cv.email and EMAIL_PATTERN.match(cv.email.strip()):
        fields_present += 1
    else:
        issues.append("No valid email address found.")
        recs.append("Add a professional email address.")

    if cv.phone and cv.phone.strip():
        fields_present += 1
    else:
        issues.append("No phone number found.")
        recs.append("Add a phone number so recruiters can reach you.")

    if cv.location and cv.location.strip():
        fields_present += 1
    else:
        issues.append("No location listed.")
        recs.append("Add your city/region — many ATS filters and recruiters search by location.")

    if cv.linkedin and cv.linkedin.strip():
        fields_present += 1
    else:
        recs.append("Add your LinkedIn profile URL.")

    if cv.github and cv.github.strip():
        fields_present += 1
    else:
        recs.append("Add a GitHub/portfolio link if you have one.")

    score = (fields_present / total_fields) * 100
    return _category(score, issues, recs)


def _section_completeness(cv: CVData) -> dict:
    issues, recs = [], []
    checks = {
        "Summary": bool(cv.summary and cv.summary.strip()),
        "Skills": bool(cv.skills or cv.skill_groups),
        "Experience": bool(cv.experience),
        "Education": bool(cv.education),
    }
    present = sum(1 for v in checks.values() if v)
    for name, ok in checks.items():
        if not ok:
            issues.append(f"{name} section is empty.")
            article = "an" if name[0] in "AEIOU" else "a"
            recs.append(f"Add {article} {name.lower()} section — most ATS systems and recruiters expect it.")

    if not cv.projects and not cv.experience:
        issues.append("No experience or projects listed.")
        recs.append("Add at least your strongest project if you don't have work experience yet.")

    score = (present / len(checks)) * 100
    return _category(score, issues, recs)


def _skills_visibility(cv: CVData) -> dict:
    issues, recs = [], []
    all_skills = cv.skills or [item for g in cv.skill_groups for item in g.items]
    count = len(all_skills)

    if count == 0:
        issues.append("No skills listed.")
        recs.append("Add a skills section — ATS keyword matching relies heavily on this.")
        score = 0
    elif count < 5:
        issues.append(f"Only {count} skill(s) listed — likely too few for strong ATS keyword matching.")
        recs.append("List at least 8-15 relevant technical/professional skills.")
        score = 40 + count * 8
    elif count > 30:
        issues.append(f"{count} skills listed — may look like keyword-stuffing to both ATS and recruiters.")
        recs.append("Trim to your strongest 15-25 skills, most relevant ones first.")
        score = 75
    else:
        score = 90

    if cv.skill_groups and not cv.skills:
        score = min(100, score + 10)  # categorized skills read better in ATS parsers

    return _category(score, issues, recs)


def _experience_clarity(cv: CVData) -> dict:
    issues, recs = [], []
    if not cv.experience:
        return _category(0, ["No experience entries to evaluate."], ["Add your work experience."])

    total = len(cv.experience)
    well_formed = 0
    for i, exp in enumerate(cv.experience, start=1):
        entry_ok = True
        if not exp.title or not exp.company:
            issues.append(f"Experience #{i}: missing job title or company name.")
            entry_ok = False
        if not exp.start_date:
            issues.append(f"Experience #{i} ({exp.title or 'role'}): missing start date.")
            entry_ok = False
        bullets = [b for b in exp.bullets if b and b.strip()]
        if not bullets:
            issues.append(f"Experience #{i} ({exp.title or 'role'}): no bullet points describing the work.")
            entry_ok = False
        elif len(bullets) < 2:
            issues.append(f"Experience #{i} ({exp.title or 'role'}): only {len(bullets)} bullet — add more detail.")
            entry_ok = False
        elif len(bullets) > 8:
            issues.append(f"Experience #{i} ({exp.title or 'role'}): {len(bullets)} bullets — consider trimming to the strongest 4-6.")
        if entry_ok:
            well_formed += 1

    if not recs and well_formed < total:
        recs.append("Make sure every role has a title, company, start date, and 3-6 bullet points.")

    score = (well_formed / total) * 100
    return _category(score, issues, recs)


def _achievement_quality(cv: CVData) -> dict:
    issues, recs = [], []
    all_bullets = [b for exp in cv.experience for b in exp.bullets if b and b.strip()]

    if not all_bullets:
        return _category(0, ["No experience bullets to evaluate."], ["Add bullet points describing your work."])

    weak_count = 0
    strong_verb_count = 0
    metric_count = 0

    for b in all_bullets:
        low = b.strip().lower()
        if any(low.startswith(w) for w in WEAK_OPENERS):
            weak_count += 1
        if STRONG_VERB_PATTERN.match(b.strip()):
            strong_verb_count += 1
        if METRIC_PATTERN.search(b):
            metric_count += 1

    total = len(all_bullets)
    if weak_count > 0:
        issues.append(f"{weak_count} bullet(s) start with a weak phrase like \"responsible for\" or \"helped with\".")
        recs.append("Rewrite weak-opener bullets to start with a strong action verb (Built, Led, Reduced, Automated...).")

    if metric_count == 0:
        issues.append("No bullets include a measurable outcome (a number, percentage, or scale).")
        recs.append("Add a measurable result to at least a few bullets where you genuinely have one (e.g. \"reduced load time by 30%\").")

    strong_verb_pct = strong_verb_count / total
    metric_pct = metric_count / total
    weak_pct = weak_count / total

    score = (strong_verb_pct * 50) + (metric_pct * 30) + ((1 - weak_pct) * 20)
    return _category(score, issues, recs)


def _formatting_compatibility(cv: CVData, template: str | None) -> dict:
    issues, recs = [], []
    score = 100.0

    if template and template not in ATS_SAFE_TEMPLATES:
        issues.append(f'"{template}" is a visual template (columns/sidebar or heavy graphics) — some ATS parsers misread multi-column layouts.')
        recs.append("Switch to an ATS-safe template (Modern, Classic, Minimal, Professional...) before applying through an ATS portal.")
        score -= 40

    if cv.photo_base64 and template and template not in ATS_SAFE_TEMPLATES:
        issues.append("A profile photo is included — some ATS parsers choke on embedded images, and many regions advise against photos for bias reasons.")
        score -= 10

    if not cv.full_name or not cv.full_name.strip():
        issues.append("No name detected at the top of the resume.")
        recs.append("Make sure your full name is the very first line.")
        score -= 20

    return _category(score, issues, recs)


def _keyword_quality(cv: CVData) -> dict:
    """Checks whether the listed skills are actually grounded in the rest of
    the resume (mentioned in experience/project text) — a resume that lists
    skills nowhere else reads as keyword-stuffed to both ATS and recruiters."""
    issues, recs = [], []
    all_skills = cv.skills or [item for g in cv.skill_groups for item in g.items]
    if not all_skills:
        return _category(0, ["No skills to check for keyword grounding."], ["Add a skills section first."])

    body_text = " ".join(
        [cv.summary or ""]
        + [b for exp in cv.experience for b in exp.bullets]
        + [p.description for p in cv.projects]
    ).lower()

    grounded = sum(1 for s in all_skills if s and s.lower() in body_text)
    ratio = grounded / len(all_skills)

    if ratio < 0.3:
        issues.append(f"Only {grounded} of {len(all_skills)} listed skills also appear in your experience/project descriptions.")
        recs.append("Weave your key skills into experience and project bullets, not just the skills list — this is what most ATS keyword scans actually reward.")

    score = 30 + ratio * 70
    return _category(score, issues, recs)


WEIGHTS = {
    "formatting_compatibility": 15,
    "section_completeness": 15,
    "keyword_quality": 15,
    "skills_visibility": 10,
    "experience_clarity": 15,
    "achievement_quality": 20,
    "contact_completeness": 10,
}


def analyze_resume(cv: CVData, template: str | None = None) -> dict:
    categories = {
        "formatting_compatibility": _formatting_compatibility(cv, template),
        "section_completeness": _section_completeness(cv),
        "keyword_quality": _keyword_quality(cv),
        "skills_visibility": _skills_visibility(cv),
        "experience_clarity": _experience_clarity(cv),
        "achievement_quality": _achievement_quality(cv),
        "contact_completeness": _contact_completeness(cv),
    }

    overall = sum(categories[k]["score"] * WEIGHTS[k] for k in WEIGHTS) / sum(WEIGHTS.values())

    all_issues = [issue for cat in categories.values() for issue in cat["issues"]]
    all_recs = [rec for cat in categories.values() for rec in cat["recommendations"]]

    return {
        "overall_score": round(overall),
        "target_score": 85,
        "categories": categories,
        "top_issues": all_issues[:8],
        "recommendations": all_recs[:8],
    }