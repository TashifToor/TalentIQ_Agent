"""
AI-assisted job posting helpers for the Jobs Marketplace.

Two things live here:
  1. structure_job_draft() -- turns HR's rough/unstructured job text into
     clean structured fields (title, description, skills, experience,
     interview focus areas). Reuses the exact same provider-selection
     shim (core.ai_provider.get_analysis_llm) as the existing Candidate
     Intelligence feature -- no second LLM client, no second
     provider-failure path.
  2. score_job_against_skills() -- a cheap, deterministic (zero-LLM-call)
     keyword-overlap scorer used for the "Recommended For You" list, where
     scoring every published job with a full LLM call per render would be
     both slow and expensive. The one real per-job LLM analysis is
     GET/POST /jobs/{id}/match, run only when a candidate opens that
     specific job.

Every suggestion here must be traceable to the HR-provided text -- never
invents company info, never fabricates a percentage without underlying
data.
"""
import json
import logging
import re

from core.ai_provider import get_analysis_llm, AIProviderError

logger = logging.getLogger("job_intelligence")

STRUCTURE_PROMPT = """You are a job-posting assistant for a hiring platform. You will be given HR's rough, possibly messy draft of a job posting. Turn it into clean, structured fields.

HARD RULES:
- Never invent company information, benefits, or requirements that are not implied by the draft.
- If a field genuinely cannot be determined from the draft, return an empty string / empty list for it -- do not guess.
- description should be a polished, professional 2-4 paragraph job description, written only from what's in the draft.
- required_skills vs preferred_skills: only split them if the draft actually distinguishes "must have" from "nice to have" language; otherwise put everything reasonably certain into required_skills.

DRAFT:
{raw_text}

Respond ONLY with valid JSON matching exactly this shape, no markdown fences, no extra commentary:
{{
  "title": "<best-guess clean job title, or empty string if unclear>",
  "description": "<polished professional job description>",
  "responsibilities": "<bullet-style responsibilities as a single string with newlines, or empty string>",
  "required_skills": ["<skill>", ...],
  "preferred_skills": ["<skill>", ...],
  "experience_required": "<e.g. '3-5 years', or empty string if not stated>",
  "interview_focus_areas": ["<topic an interviewer should probe>", ...],
  "suggested_evaluation_criteria": ["<what to evaluate candidates on>", ...]
}}"""


def _parse_json_response(raw: str) -> dict:
    clean = raw.strip()
    if clean.startswith("```"):
        clean = clean.split("```")[1] if "```" in clean[3:] else clean
        clean = clean.replace("json", "", 1).strip() if clean.lower().startswith("json") else clean
    if not clean.startswith("{"):
        start = clean.find("{")
        end = clean.rfind("}")
        if start != -1 and end != -1:
            clean = clean[start:end + 1]
    return json.loads(clean)


def structure_job_draft(raw_text: str) -> dict:
    """Raises AIProviderError on any provider failure or malformed response."""
    if not raw_text or not raw_text.strip():
        raise AIProviderError("No draft text to structure.")

    prompt = STRUCTURE_PROMPT.format(raw_text=raw_text.strip()[:6000])

    try:
        llm = get_analysis_llm()
        response = llm.invoke(prompt)
        raw = response.content if hasattr(response, "content") else str(response)
        data = _parse_json_response(raw)
    except AIProviderError:
        raise
    except Exception as e:
        logger.error(f"[job_intelligence] structure_job_draft failed: {e}")
        raise AIProviderError("Couldn't structure this draft right now.") from e

    data.setdefault("title", "")
    data.setdefault("responsibilities", "")
    data.setdefault("required_skills", [])
    data.setdefault("preferred_skills", [])
    data.setdefault("experience_required", "")
    data.setdefault("interview_focus_areas", [])
    data.setdefault("suggested_evaluation_criteria", [])
    data.setdefault("description", raw_text.strip()[:2000])
    return data


_WORD_RE = re.compile(r"[a-zA-Z0-9+#.]+")


def _tokenize(text: str) -> set[str]:
    return {w.lower() for w in _WORD_RE.findall(text or "") if len(w) > 1}


def score_job_against_skills(job, cv_text: str) -> tuple[int, list[str]]:
    """
    Deterministic, zero-LLM-call overlap score between a candidate's resume
    text and one job's structured skills -- used only for ranking/filtering
    the "Recommended For You" list across many jobs at once. The precise
    per-job AI Job Match (with real strengths/gaps/readiness) happens
    separately, on demand, via the LLM-backed /jobs/{id}/match endpoint.

    Returns (match_percent, reasons). If the job has no structured skills
    at all, returns (0, []) so the caller can treat it as "not enough data"
    rather than fabricating a score.
    """
    required = job.get("required_skills") or []
    preferred = job.get("preferred_skills") or []
    if not required and not preferred:
        return 0, []

    cv_tokens = _tokenize(cv_text)
    reasons = []

    matched_required = [s for s in required if s and s.lower() in cv_tokens]
    matched_preferred = [s for s in preferred if s and s.lower() in cv_tokens]

    total_skills = len(required) + len(preferred)
    matched_count = len(matched_required) + len(matched_preferred)
    percent = round((matched_count / total_skills) * 100) if total_skills else 0

    for s in matched_required[:3]:
        reasons.append(f"Matches your {s} experience")
    for s in matched_preferred[:2]:
        reasons.append(f"You also have {s}")

    location_pref = (job.get("work_arrangement") or "").lower()
    if location_pref and location_pref in (cv_text or "").lower():
        reasons.append("Work arrangement fits your profile")

    return percent, reasons


def compute_fit_signals(job, analysis_result: dict, db=None, candidate_id=None) -> list[dict]:
    """
    Breaks the single AI Job Match score into a few understandable signals,
    WITHOUT any extra LLM call -- everything here is derived from data that
    already exists: the job's own structured skills (real, HR-entered) and
    the analysis_result run_candidate_analysis already returned for this
    exact match, plus (optionally) the candidate's most recent CV scan
    score if one exists.

    Only includes a signal when it can actually be calculated. "Role Fit"
    from the spec's example is deliberately NOT included here -- with no
    independent data source beyond the overall AI score itself, a separate
    "Role Fit %" would just be restating overall_score under a new label,
    which is exactly the fabricated-precision this function exists to avoid.
    """
    signals = []

    # Skills -- deterministic count against the job's own required_skills list.
    required = _parse_job_skills(job)["required_skills"]
    if required:
        skill_gaps = analysis_result.get("skill_gaps", {}) or {}
        missing_required = set(s.lower() for s in (skill_gaps.get("required") or []))
        matched_count = sum(1 for s in required if s.lower() not in missing_required)
        percent = round((matched_count / len(required)) * 100)
        signals.append({
            "key": "skills", "label": "Skills", "percent": percent, "qualitative": None,
            "source": f"{matched_count} of {len(required)} required skills found in your resume",
        })

    # Experience -- the analysis genuinely only gives a qualitative read
    # (a list of gap descriptions, not a number), so a percent here would
    # be fabricated precision. Show the qualitative state instead, per spec.
    experience_gaps = analysis_result.get("experience_gaps") or []
    signals.append({
        "key": "experience", "label": "Experience",
        "percent": None,
        "qualitative": "Good Match" if not experience_gaps else "Potential Match",
        "source": "AI Job Match experience assessment",
    })

    # Resume -- only if the candidate has an actual, real, previously
    # computed ATS scan on file. Never runs a new scan just for this.
    if db is not None and candidate_id is not None:
        from models.scan_history import ScanHistory
        latest_scan = (
            db.query(ScanHistory)
            .filter(ScanHistory.user_id == candidate_id)
            .order_by(ScanHistory.created_at.desc())
            .first()
        )
        if latest_scan:
            signals.append({
                "key": "resume", "label": "Resume", "percent": round(latest_scan.candidate_score),
                "qualitative": None, "source": "Your most recent CV scan's ATS score",
            })

    return signals
    """
    Real, legitimate-signal candidate list for the "job published" notification
    -- not "notify everyone". A candidate is only included if their own most
    recent application's real cv_text scores at/above `threshold` against this
    job's actual structured skills (score_job_against_skills, the same
    zero-LLM-call scorer used for Recommended For You). Jobs with no
    structured skills at all match nobody, by design -- there's no real
    signal to notify on.

    Bounded to the `limit_candidates` most recently active candidates (by
    their latest application) rather than scanning every candidate ever --
    this runs synchronously inside POST /jobs/{id}/publish and the scoring
    itself is cheap CPU, but the candidate pool isn't assumed to stay small
    forever.

    Returns a list of (candidate_id, match_percent, reasons) tuples.
    """
    from sqlalchemy import func
    from models.application import Application

    required = _parse_job_skills(job)
    if not required["required_skills"] and not required["preferred_skills"]:
        return []

    latest_per_candidate = (
        db.query(Application.candidate_id, func.max(Application.created_at).label("latest"))
        .filter(Application.cv_text.isnot(None))
        .group_by(Application.candidate_id)
        .order_by(func.max(Application.created_at).desc())
        .limit(limit_candidates)
        .subquery()
    )
    latest_apps = (
        db.query(Application)
        .join(
            latest_per_candidate,
            (Application.candidate_id == latest_per_candidate.c.candidate_id)
            & (Application.created_at == latest_per_candidate.c.latest),
        )
        .all()
    )

    results = []
    for app in latest_apps:
        if not app.cv_text or not app.cv_text.strip():
            continue
        percent, reasons = score_job_against_skills(required, app.cv_text)
        if percent >= threshold:
            results.append((app.candidate_id, percent, reasons))
    return results


def _parse_job_skills(job) -> dict:
    """job may be an ORM Job row or a plain dict -- normalize to the dict
    shape score_job_against_skills expects."""
    import json as _json
    if isinstance(job, dict):
        return job

    def _load(val):
        if not val:
            return []
        try:
            parsed = _json.loads(val)
            return parsed if isinstance(parsed, list) else []
        except Exception:
            return []

    return {
        "required_skills": _load(job.required_skills),
        "preferred_skills": _load(job.preferred_skills),
        "work_arrangement": job.work_arrangement,
    }