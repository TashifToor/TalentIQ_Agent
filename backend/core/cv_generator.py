import json
from core.llm import llm
from schemas.cv_builder import CVData


OPTIMIZE_PROMPT_TEMPLATE = """You are an ATS resume optimization engine. You will rewrite ONLY the wording of the CV content below to better align with the target job description — improved phrasing, action verbs, and keyword alignment WHERE TRUTHFULLY APPLICABLE.

HARD RULE — INTEGRITY: You may only rephrase what already exists. You must NEVER:
- invent new employers, job titles, skills, or projects
- exaggerate scope (e.g. turning "helped with" into "led")
- add quantified metrics that aren't present or reasonably implied by the original text
If the CV genuinely lacks something the JD wants, leave it out.

ATS WRITING RULES — apply these to every rewritten sentence:
- Start each bullet with a strong, specific action verb (Architected, Engineered, Reduced, Led, Automated, Optimized...) — avoid weak openers like "Responsible for" or "Worked on".
- Never repeat the same word or phrase across multiple bullets in the same entry (e.g. don't start three bullets with "Developed") — vary vocabulary so the text doesn't read as keyword-stuffed.
- Weave in JD keywords naturally, in context — never just append a raw list of JD terms. Keyword-stuffing hurts more than it helps with modern ATS ranking.
- Keep sentences concise and scannable — no filler words, no repeated ideas across bullets.
- Match the JD's terminology only where the candidate's real work genuinely used the equivalent thing (e.g. if the JD says "CI/CD pipelines" and the candidate's original bullet describes GitHub Actions automation, it's fair to say "CI/CD pipelines"; it is not fair to add a tool they never mentioned).

You are given a numbered list of the candidate's ACTUAL experience entries below. You must return EXACTLY the same number of entries, in the same order, rewriting ONLY the bullet text for each — do not add, remove, merge, or reorder entries, and do not invent an entry that isn't in the input list.

Respond ONLY with valid JSON in this EXACT shape. No markdown, no explanation, no backticks.

{{
    "summary": "<rewritten 2-3 sentence summary, based only on real information below>",
    "skills_reordered": ["<same skills as input, just reordered so JD-relevant ones come first — do not add or remove any>"],
    "experience_bullets": [
        ["<rewritten bullet 1 for experience entry 0>", "<rewritten bullet 2>"],
        ["<rewritten bullets for experience entry 1>"]
    ]
}}

<job_description>
{job_description}
</job_description>

<candidate_summary>
{summary}
</candidate_summary>

<candidate_skills>
{skills}
</candidate_skills>

<candidate_experience_entries_numbered>
{experience_entries}
</candidate_experience_entries_numbered>"""


def optimize_cv_for_jd(cv_data: CVData, job_description: str) -> CVData:
    experience_entries_text = "\n\n".join(
        f"[{i}] {exp.title} at {exp.company}\nBullets:\n" + "\n".join(f"- {b}" for b in exp.bullets)
        for i, exp in enumerate(cv_data.experience)
    ) or "(no experience entries)"

    if cv_data.skill_groups:
        skills_text = "\n".join(f"{g.category}: {', '.join(g.items)}" for g in cv_data.skill_groups if g.items) or "(none provided)"
    else:
        skills_text = ", ".join(cv_data.skills) or "(none provided)"

    prompt = OPTIMIZE_PROMPT_TEMPLATE.format(
        job_description=job_description[:4000],
        summary=cv_data.summary or "(none provided)",
        skills=skills_text,
        experience_entries=experience_entries_text,
    )

    try:
        response = llm.invoke(prompt)
        clean = response.content.strip()
        if clean.startswith("```"):
            clean = clean.replace("```json", "").replace("```", "").strip()
        result = json.loads(clean)
    except Exception as e:
        print(f"[CVGenerator] Optimization failed, returning original CV unchanged: {e}")
        return cv_data

    # Rebuild CVData programmatically — this is what actually prevents
    # hallucination, not the prompt wording alone. The LLM's output is only
    # ever used to fill in text fields on the EXACT structure we already
    # had; it can never add, remove, or rename an experience entry, and it
    # can never introduce a skill that wasn't already in the original list.
    new_cv = cv_data.model_copy(deep=True)

    if isinstance(result.get("summary"), str) and result["summary"].strip():
        new_cv.summary = result["summary"].strip()

    reordered = result.get("skills_reordered")
    if isinstance(reordered, list) and reordered:
        priority = {s: i for i, s in enumerate(reordered)}
        if cv_data.skill_groups:
            # Reorder items WITHIN each group by the model's JD-relevance
            # ranking — never move an item across groups or drop/add one.
            for group in new_cv.skill_groups:
                group.items = sorted(group.items, key=lambda s: priority.get(s, len(priority)))
        elif cv_data.skills:
            original_set = set(cv_data.skills)
            # Only accept items that were actually in the original list —
            # anything the model added or dropped gets silently discarded.
            safe_reordered = [s for s in reordered if s in original_set]
            safe_reordered += [s for s in cv_data.skills if s not in safe_reordered]
            if safe_reordered:
                new_cv.skills = safe_reordered

    bullets_by_entry = result.get("experience_bullets")
    if isinstance(bullets_by_entry, list) and len(bullets_by_entry) == len(new_cv.experience):
        for i, bullets in enumerate(bullets_by_entry):
            if isinstance(bullets, list) and all(isinstance(b, str) for b in bullets) and bullets:
                new_cv.experience[i].bullets = bullets
            # if the model returned something malformed for this entry, the
            # original bullets for that entry are left untouched

    return new_cv