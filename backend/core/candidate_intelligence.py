"""
The analysis engine behind both CV Optimizer and Candidate Screening.
Deliberately ONE engine — the task itself says "some information may
overlap internally, but the presentation and purpose must be different."
The difference between Optimizer and Screening is entirely in how the
frontend frames and orders these same structured fields, not in two
separate AI pipelines. This also means there is exactly one prompt to
maintain, one provider-failure path to handle, and one schema to trust.

Never calls out to TalentIQGraph (core/graph.py) or the CrewAI Screening
Committee — those are HR's own scoring/committee pipelines, used
elsewhere, and are not touched or duplicated here. This is a separate,
additive capability for the candidate-facing product.
"""
import json
import logging

from core.ai_provider import get_analysis_llm, AIProviderError

logger = logging.getLogger("candidate_intelligence")

ANALYSIS_PROMPT = """You are a career analysis engine for a candidate-facing product. You will be given a candidate's real CV text and (optionally) a real job description. Analyze ONLY what is actually written — never invent skills, experience, employers, metrics, or job requirements that aren't present in the text given to you.

HARD RULES:
- Every strength, gap, and claim must be traceable to the actual CV text or JD text below.
- If the job description is missing, base fit/gaps on general strength of the CV alone — do not invent a job to compare against.
- If you genuinely cannot determine something, use the string "Not enough information" for that field rather than guessing.
- Never claim or imply a guaranteed interview or hiring outcome. Use readiness/fit language only.
- skill_gaps must distinguish "required" vs "nice_to_have" based on how the JD phrases them (or omit nice_to_have entries if the JD doesn't distinguish).
- For each skill gap, do not tell the candidate to simply add the skill — the required_gaps/nice_to_have_gaps text should note it's only worth adding "if you genuinely have this experience."

CV TEXT:
{cv_text}

JOB DESCRIPTION:
{jd_text}

Respond ONLY with valid JSON matching exactly this shape, no markdown fences, no extra commentary:
{{
  "overall_score": <integer 0-100, your best real estimate of match/fit quality — omit precision you don't have, round to nearest 5 if unsure>,
  "fit_level": "<one of: Strong Fit | Good Fit | Needs Improvement | Weak Fit>",
  "score_explanation": "<1-2 sentences, concrete and specific>",
  "strengths": ["<short skill/strength phrase grounded in the CV>", ...],
  "skill_gaps": {{
    "required": ["<missing required skill, phrased plainly>", ...],
    "nice_to_have": ["<missing nice-to-have skill>", ...]
  }},
  "experience_gaps": ["<1-2 sentence evidence-based gap, e.g. 'Role asks for X years of Y experience; CV demonstrates Z but not Y'>", ...],
  "recruiter_impression": "<2-3 sentence realistic recruiter-style read of this CV>",
  "ats_signals": [
    {{"label": "Keyword alignment", "status": "<Strong|Moderate|Weak>", "note": "<short note>"}},
    {{"label": "Section completeness", "status": "<Strong|Moderate|Weak>", "note": "<short note>"}},
    {{"label": "Measurable achievements", "status": "<Strong|Moderate|Weak>", "note": "<short note>"}},
    {{"label": "Role-specific terminology", "status": "<Strong|Moderate|Weak>", "note": "<short note>"}}
  ],
  "interview_readiness": "<one of: Ready | Almost Ready | Needs Preparation>",
  "interview_readiness_reason": "<1-2 sentences explaining why>",
  "focus_areas": ["<specific topic to practice, grounded in the actual gap>", ...],
  "next_actions": ["<one concrete, specific action — not generic advice>", ...]
}}"""


def _parse_json_response(raw: str) -> dict:
    clean = raw.strip()
    if clean.startswith("```"):
        clean = clean.split("```")[1] if "```" in clean[3:] else clean
        clean = clean.replace("json", "", 1).strip() if clean.lower().startswith("json") else clean
    # Fallback: extract the outermost {...} block if the model added any stray text
    if not clean.startswith("{"):
        start = clean.find("{")
        end = clean.rfind("}")
        if start != -1 and end != -1:
            clean = clean[start:end + 1]
    return json.loads(clean)


def run_candidate_analysis(cv_text: str, job_description: str | None) -> dict:
    """
    Returns the structured analysis dict. Raises AIProviderError on any
    provider failure or malformed response — callers must catch this and
    return the generic user-facing error message, never the raw exception.
    """
    if not cv_text or not cv_text.strip():
        raise AIProviderError("No CV content to analyze.")

    prompt = ANALYSIS_PROMPT.format(
        cv_text=cv_text.strip()[:6000],
        jd_text=(job_description or "").strip()[:3000] or "Not provided — analyze CV strength generally.",
    )

    try:
        llm = get_analysis_llm()
        response = llm.invoke(prompt)
        raw = response.content if hasattr(response, "content") else str(response)
        data = _parse_json_response(raw)
    except AIProviderError:
        raise
    except Exception as e:
        # Every other failure (auth, rate limit, timeout, malformed JSON,
        # network) collapses to one clean, logged, non-leaking error.
        logger.error(f"[candidate_intelligence] analysis failed: {e}")
        raise AIProviderError("Analysis couldn't be completed.") from e

    # Minimal shape-guarding — fill only structurally-required defaults,
    # never invent content for a field the model actually omitted.
    data.setdefault("strengths", [])
    data.setdefault("skill_gaps", {"required": [], "nice_to_have": []})
    data.setdefault("experience_gaps", [])
    data.setdefault("ats_signals", [])
    data.setdefault("focus_areas", [])
    data.setdefault("next_actions", [])
    return data