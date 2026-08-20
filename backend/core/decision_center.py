"""
Decision Center email content — deterministic, built entirely from real
stored fields. No LLM call: every line traces to a specific database value,
which is the only way to guarantee the "never invent scores/skills/next
steps/company info" requirement holds absolutely, not just "usually."

Kept strictly separate from anything internal-only: this module only ever
sees per-candidate fields (their own scores, their own skills), never
another candidate's data, a rank, a fit tier, or any internal note.
"""
from typing import Optional


def build_decision_email(
    candidate_name: Optional[str],
    job_title: str,
    company_name: Optional[str],
    decision: str,                          # "accepted" | "rejected"
    ats_score: Optional[int],
    matched_skills: list[str],
    missing_skills: list[str],
    assessment_weak_categories: list[str],   # e.g. ["System Design", "Async Python"] — from the candidate's OWN completed assessment only
) -> tuple[str, str]:
    """Returns (subject, plain-text body). Both are drafts — HR can edit
    before sending; nothing here is sent automatically."""
    name = candidate_name.strip() if candidate_name and candidate_name.strip() else "there"
    company_suffix = f" at {company_name}" if company_name else ""

    if decision == "accepted":
        subject = f"Congratulations — {job_title}{company_suffix}"
        lines = [
            f"Hi {name},",
            "",
            f"Thank you for taking the time to interview for the {job_title} position{company_suffix}.",
            "",
            "We're excited to let you know that we'd like to move forward with your application.",
            "",
            "We'll be in touch shortly with next steps.",
            "",
            "Best,",
            "The Hiring Team",
        ]
        return subject, "\n".join(lines)

    # rejected
    subject = f"Update on your application — {job_title}{company_suffix}"
    improvement_areas = list(dict.fromkeys(missing_skills[:5] + assessment_weak_categories[:3]))  # de-dup, real only

    lines = [
        f"Hi {name},",
        "",
        f"Thank you for taking the time to interview for the {job_title} position{company_suffix}.",
        "",
        "After reviewing your application, we've decided to move forward with another candidate.",
    ]
    if improvement_areas:
        lines += [
            "",
            "Areas you may want to continue developing:",
        ]
        lines += [f"• {area}" for area in improvement_areas]
    if matched_skills:
        lines += [
            "",
            f"We did note strong alignment in: {', '.join(matched_skills[:5])}.",
        ]
    lines += [
        "",
        "We appreciate the time you invested in the process and wish you the best in your search.",
        "",
        "Best,",
        "The Hiring Team",
    ]
    return subject, "\n".join(lines)