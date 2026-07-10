import json
from core.llm import llm
from schemas.cv_builder import CVData


OPTIMIZE_PROMPT_TEMPLATE = """You are an ATS resume optimization engine. Rewrite the CV content below so it is better aligned with the target job description — improved phrasing, action verbs, and keyword alignment WHERE TRUTHFULLY APPLICABLE.

HARD RULE — INTEGRITY: You may only rephrase, reorder, and emphasize what already exists in the CV data. You must NEVER:
- invent new skills, tools, employers, titles, dates, or years of experience
- exaggerate scope (e.g. turning "helped with" into "led")
- add quantified metrics that aren't present or reasonably implied by the original text
If the CV genuinely lacks something the JD wants, leave it out — do not fabricate it to look like a match. This tool helps people present real experience well; it does not help them lie.

Return the SAME JSON structure as the input, with these fields improved:
- "summary": rewritten to speak directly to what this JD wants, using only real information from the CV
- "skills": same underlying skills, reordered to put JD-relevant ones first (do not add skills not in the original list)
- "experience[].bullets": rephrased with stronger action verbs and clearer impact — same underlying facts, better wording

Respond ONLY with valid JSON matching the exact schema of the input. No markdown, no explanation, no backticks.

<job_description>
{job_description}
</job_description>

<current_cv_json>
{cv_json}
</current_cv_json>"""


def optimize_cv_for_jd(cv_data: CVData, job_description: str) -> CVData:
    prompt = OPTIMIZE_PROMPT_TEMPLATE.format(
        job_description=job_description[:4000],
        cv_json=cv_data.model_dump_json(),
    )
    response = llm.invoke(prompt)

    clean = response.content.strip()
    if clean.startswith("```"):
        clean = clean.replace("```json", "").replace("```", "").strip()

    try:
        parsed = json.loads(clean)
        return CVData(**parsed)
    except (json.JSONDecodeError, Exception) as e:
        print(f"[CVGenerator] Optimization failed, returning original CV: {e}")
        return cv_data