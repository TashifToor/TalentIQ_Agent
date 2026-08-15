"""
Deterministic candidate fit-scoring for the Talent Intelligence ranking feature.

No LLM calls here — every number is either a real stored field (ai_score,
assessment_score, final_verdict, resume/ATS data from the candidate's own
scan history) or a plain, transparent weighted-average combination of them.
The per-category interview skill breakdown is computed by the existing
core.assessment.score_assessment() function, reused as-is. Resume signals
come from core.resume_intelligence, reused as-is.

Weighting is intentionally a plain module-level constant (not learned, not
hidden) so it's auditable in code review: WEIGHTS below is the entire model.
A component is included in the blend ONLY when real data exists for it —
missing components are omitted and the remaining weights are re-normalized,
never zero-filled. A candidate is never penalized for a step they simply
haven't reached yet (e.g. no interview yet).
"""

# Deterministic point mapping for the AI's own final_verdict label — used only
# as ONE input into the blended fit score, never displayed as if it were a
# separately-measured score.
VERDICT_POINTS = {
    "Strong Hire": 95,
    "Hire": 75,
    "Borderline": 50,
    "No Hire": 15,
}

# The entire weighting model. Change these four numbers to retune ranking —
# nothing else in this file encodes priority.
WEIGHTS = {
    "resume": 30,      # Resume / Job Match (ATS score + skill match, from the candidate's real scan history)
    "assessment": 25,  # MCQ Assessment Performance
    "interview": 25,   # AI Interview Performance
    "verdict": 20,     # The AI's own final_verdict, encoded to points
}

STRONG_MIN = 80
GOOD_MIN = 65
POSSIBLE_MIN = 45


def fit_tier_for_score(score: int | None) -> str:
    """
    Shared tier banding — the single source of truth for what counts as
    Strong/Good/Possible/Low, reused anywhere a 0-100 fit-style score needs a
    tier label (interview-posting ranking here, ATS-only bulk-screening
    scores in core.candidate_identity / routes.bulk).
    """
    if score is None:
        return "not_enough_data"
    if score >= STRONG_MIN:
        return "strong"
    if score >= GOOD_MIN:
        return "good"
    if score >= POSSIBLE_MIN:
        return "possible"
    return "low"


def compute_candidate_fit(
    ai_score: int | None,
    assessment_score: int | None,
    final_verdict: str | None,
    assessment_breakdown: dict | None,
    proctoring_flag_count: int,
    status: str,
    resume_profile: dict | None = None,
) -> dict:
    """
    Returns a dict ready to spread into the RankedCandidate schema.
    resume_profile is the dict shape produced by
    core.resume_intelligence.resume_profile_to_dict() — pass None if the
    candidate has no linked account.
    """
    resume_profile = resume_profile or {"resume_available": False}

    components: list[tuple[str, int, int]] = []   # (label, value 0-100, weight)

    resume_value = None
    if resume_profile.get("resume_available"):
        parts = [v for v in (resume_profile.get("ats_score"), resume_profile.get("skill_match_pct")) if v is not None]
        if parts:
            resume_value = round(sum(parts) / len(parts))
    if resume_value is not None:
        components.append(("Resume / Job Match", resume_value, WEIGHTS["resume"]))

    if assessment_score is not None:
        components.append(("Assessment", assessment_score, WEIGHTS["assessment"]))

    if ai_score is not None:
        components.append(("Interview", ai_score, WEIGHTS["interview"]))

    verdict_points = VERDICT_POINTS.get(final_verdict) if final_verdict else None
    if verdict_points is not None:
        components.append(("Final Verdict", verdict_points, WEIGHTS["verdict"]))

    if components:
        total_weight = sum(w for _, _, w in components)
        fit_score = round(sum(v * w for _, v, w in components) / total_weight)
    else:
        fit_score = None

    fit_tier = fit_tier_for_score(fit_score)

    # ── Evidence — every line traces to a real stored field, nothing generated ──
    evidence: list[str] = []

    if resume_profile.get("resume_available"):
        if resume_profile.get("ats_score") is not None:
            evidence.append(f"Resume ATS Score: {resume_profile['ats_score']}")
        matched = resume_profile.get("matched_skills") or []
        missing = resume_profile.get("missing_skills") or []
        if matched or missing:
            evidence.append(f"{len(matched)}/{len(matched) + len(missing)} skills matched in resume")
        if matched:
            evidence.append(f"Matched: {', '.join(matched[:4])}")
        if missing:
            evidence.append(f"Missing: {', '.join(missing[:3])}")
        role_ctx = resume_profile.get("resume_role_title")
        if resume_profile.get("exact_job_match"):
            evidence.append(f"Resume scored directly against this job{f' ({role_ctx})' if role_ctx else ''}")
        else:
            evidence.append(f"From candidate's most recent CV scan{f' (against: {role_ctx})' if role_ctx else ''} — may not be scored against this exact posting")
    else:
        evidence.append("No linked resume/CV scan found for this candidate")

    if assessment_score is not None:
        evidence.append(f"Assessment: {assessment_score}%")
    if ai_score is not None:
        evidence.append(f"Interview: {ai_score}")
    if final_verdict:
        evidence.append(f"AI Verdict: {final_verdict}")

    if assessment_breakdown:
        for topic, stat in assessment_breakdown.items():
            if stat.get("total", 0) == 0:
                continue
            pct = round((stat["correct"] / stat["total"]) * 100)
            evidence.append(f"{topic.replace('_', ' ').title()}: {pct}%")

    if proctoring_flag_count:
        evidence.append(f"{proctoring_flag_count} proctoring flag{'s' if proctoring_flag_count != 1 else ''} recorded")
    if status not in ("completed", "not_started"):
        evidence.append("Interview still in progress — score may change")
    if not components:
        evidence = ["No resume, assessment, interview, or verdict data yet"]

    # Skill match surfaced separately for the UI's dedicated "Skills" column —
    # always the resume-derived figure when available (a real, job-agnostic
    # signal), never the MCQ job_desc category (that's shown via evidence only).
    skill_match_pct = resume_profile.get("skill_match_pct") if resume_profile.get("resume_available") else None

    return {
        "fit_score": fit_score,
        "fit_tier": fit_tier,
        "recommendation": final_verdict,  # real passthrough only — never fabricated
        "resume_available": resume_profile.get("resume_available", False),
        "ats_score": resume_profile.get("ats_score"),
        "matched_skills": resume_profile.get("matched_skills") or [],
        "missing_skills": resume_profile.get("missing_skills") or [],
        "skill_match_pct": skill_match_pct,
        "resume_verdict": resume_profile.get("resume_verdict"),
        "resume_role_title": resume_profile.get("resume_role_title"),
        "resume_scanned_at": resume_profile.get("resume_scanned_at"),
        "resume_matches_current_context": bool(resume_profile.get("exact_job_match")),
        "evidence": evidence,
    }