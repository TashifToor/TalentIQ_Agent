from core.faiss import VectorStore
import json
from core.llm import llm
from core.state import ScreeningState


class TalentIQAgent:
    def __init__(self, user_id: int = None):
        # user_id-scoped persist_directory — critical for multi-tenant isolation.
        # Without this, ALL candidates share one global FAISS index on disk,
        # meaning the last person to upload silently overwrites everyone else's
        # CV data and other users' scans start returning wrong/leaked results.
        if user_id is not None:
            import os
            base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
            persist_dir = os.path.join(base_dir, "data", "faiss_index", f"user_{user_id}")
            self.vector_store_manager = VectorStore(persist_directory=persist_dir)
        else:
            self.vector_store_manager = VectorStore()
        self.faiss_db = self.vector_store_manager.load_store()

        if self.faiss_db:
            self.retriever = self.faiss_db.as_retriever(search_kwargs={"k": 4})
        else:
            self.retriever = None
            print("FAISS DB not found.")

    def _analyze_cv_node(self, state: ScreeningState) -> ScreeningState:
        print("Executing CV Analysis Node...")
        jd = state["job_description"]

        if not self.retriever:
            return {**state, "screening_analysis": "No FAISS DB found."}

        docs = self.retriever.invoke(jd)
        cv_context = "\n\n".join([doc.page_content for doc in docs])

        prompt = f"""You are TalentIQ — a senior technical recruiter operating in the 2026 hiring market. Context you must internalize before scoring anything:

- FAANG-scale hiring has largely frozen. Headcount today is concentrated in smaller, leaner ("mango-tier") companies who cannot afford a bad hire — every seat has to earn its keep.
- The market is flooded with AI-polished resumes that look impressive on the surface but collapse under scrutiny. Keyword overlap with the JD is no longer a signal of anything.
- Because of this, only genuinely exceptional candidates should clear the bar — not "good enough," not "trainable," not "close on paper."
- At the same time, do NOT fall into lazy-HR failure modes: do not screen primarily on years-of-experience or degree/pedigree while ignoring actual skill depth, and do not screen primarily on skills while ignoring whether the required experience level is actually met. Evaluate BOTH — experience requirement compliance AND real technical/project depth — together, not as a substitute for each other.
- You are not a "pass everyone who vaguely matches" agent. You are the last line of defense before a company wastes an interview slot or a bad hire.

MANDATORY EXPERIENCE CHECK — do this explicitly, every time:
1. Extract the minimum years of experience stated or implied in the JD (e.g. "4+ years", "Senior", "3-5 years").
2. Estimate the candidate's actual demonstrable professional experience from the CV (not internships-as-full-years, not project count as a proxy — actual paid/professional time in relevant roles).
3. If the candidate falls meaningfully short (e.g. JD wants 4 years, CV shows 1.5 years), state this explicitly and treat it as a hard constraint — strong skills or side projects do NOT cancel this out. Say plainly: "JD requires X years; candidate has approximately Y — this is a experience gap, not a skills gap, and cannot be waived."
4. If the candidate meets or exceeds the requirement, confirm it explicitly rather than skipping past it.

<job_description>
{jd}
</job_description>

<candidate_cv>
{cv_context}
</candidate_cv>

Conduct a structured 4-step screening analysis. For each step, start with the exact heading shown below (used verbatim, do not rename), then write 3-5 sentences of sharp, specific, unsentimental analysis. Reference actual details from the CV — never generalize, never pad with encouragement the evidence doesn't support.

**Step 1: Overall Summary**
Identify the candidate by name if it appears in the CV (otherwise refer to "the candidate"). Give a one-paragraph snapshot: what role/level they're realistically positioned for, and your gut-level read on fit for THIS specific JD before the detailed breakdown. Be direct about whether this looks like a serious contender or a filtered-out application.

**Step 2: Strengths**
List the genuinely strong, evidenced points — specific technologies, quantified project outcomes, scale handled, leadership/ownership shown. Do not manufacture strengths that aren't clearly backed by the CV text.

**Step 3: Weaknesses**
This is where the mandatory experience check above lives — state the years-required-vs-actual comparison explicitly here first, then list other gaps: missing required skills, shallow/tutorial-level projects, vague or unquantified claims, employment gaps, or inconsistencies. Be direct — do not soften gaps to spare feelings.

**Step 4: Interview Readiness Verdict**
Give one of: "Interview Ready" / "Borderline — Proceed with Caution" / "Not Ready". State the single most decisive factor driving this verdict. If the experience gap from Step 3 is severe, it should dominate this verdict regardless of how strong the skills look — a company hiring for a Senior role cannot use a Junior, no matter how talented.

Write only the 4 steps above, each starting with its exact bolded heading. No preamble, no summary after Step 4."""

        response = llm.invoke(prompt)
        return {**state, "retrieved_cv_context": cv_context, "screening_analysis": response.content}

    def _rank_candidate(self, state: ScreeningState) -> ScreeningState:
        print("Executing Candidate Ranking Node...")
        jd = state["job_description"]
        analysis = state["screening_analysis"]

        prompt = f"""You are a scoring engine for an ATS (Applicant Tracking System), operating in the 2026 hiring market where only genuinely exceptional candidates should score high. Based on the job description and screening analysis below, output a precise JSON score.

SCORING RULES — read carefully:
- Score must reflect ACTUAL fit, not round numbers. Use the full 0-100 range. Examples of valid scores: 23, 47, 61, 78, 91. Invalid: 50, 60, 70, 80.
- Score breakdown: Technical match (40pts) + Experience quality (25pts) + Project complexity (20pts) + Communication/soft signals (15pts)

CALIBRATION — this is what actually stops scores from clustering. Think of each candidate as landing somewhere on this spectrum, and score the specific point that matches them, not just "good" or "bad":
- 85-99: Exceptional — hits nearly every JD requirement with strong evidence, ready to interview immediately.
- 70-84: Strong — covers most core requirements well, one or two minor gaps, clearly worth a look.
- 50-69: Partial fit — a real, genuine mix: covers some important requirements but has notable gaps (missing a key skill, junior on one axis, etc.). This band should be used often — most real-world candidates who aren't a clean yes or no belong here, not compressed into either extreme.
- 30-49: Weak fit — meaningful overlap exists but the gaps outweigh the strengths; not shortlist-worthy but not irrelevant either.
- 1-29: Poor fit — reserve this only for CVs with little to no genuine overlap with the JD (wrong field entirely, no relevant skills at all). Don't default here just because a candidate isn't exceptional — a candidate with some real but insufficient overlap belongs in the 30-49 or 50-69 bands instead, not here.

Do not let the presence of the 82+ and sub-30 verdict thresholds below pull you toward only ever picking scores near those cutoffs — most candidates, especially in a large batch, should legitimately fall in the 30-69 range, and that's fine. Two different candidates with two different levels of partial fit should get two different scores from each other, not the same number.

- matched_skills: only skills explicitly evidenced in CV that JD requires
- missing_skills: only skills JD explicitly requires that are absent from CV
- final_verdict: "Highly Shortlisted" (score >= 82), "Good Fit for Interview" (score 60-81), "Rejected" (score < 60)
- is_shortlisted: true only if score >= 75
- trigger_interview: true only if score >= 85 AND no critical skill gaps

HARD RULE — EXPERIENCE GAP OVERRIDE (this takes priority over everything else):
The <screening_analysis> below explicitly calls out whether the candidate meets the JD's stated years-of-experience requirement (see its Weaknesses section). If it states the candidate falls meaningfully short of the required experience (e.g. JD wants 4 years, candidate has ~1.5), this is a HARD CAP:
- candidate_score MUST NOT exceed 54
- final_verdict MUST be "Rejected"
- has_min_experience MUST be false
- trigger_interview MUST be false
Strong skills, impressive side-projects, or good communication CANNOT override this — a company hiring for a role requiring X years of experience cannot substitute that with junior talent, no matter how promising. Only skip this cap if the analysis explicitly confirms the experience requirement IS met or exceeded.

Respond ONLY with valid JSON. No markdown, no explanation, no backticks.

{{
    "job_title": "<the actual job title/role name for this position, extracted from the JD — e.g. 'Senior Backend Engineer'. Ignore boilerplate lines like 'Apply At', company taglines, or headers — find the real title even if it's not the first line.>",
    "candidate_score": <integer 0-100, NOT a multiple of 10>,
    "matched_skills": ["skill1", "skill2"],
    "missing_skills": ["skill1", "skill2"],
    "final_verdict": "<Highly Shortlisted | Good Fit for Interview | Rejected>",
    "is_shortlisted": <true|false>,
    "has_min_experience": <true|false>,
    "trigger_interview": <true|false>
}}

<job_description>
{jd}
</job_description>

<screening_analysis>
{analysis}
</screening_analysis>"""

        response = llm.invoke(prompt)

        try:
            clean = response.content.strip()
            if clean.startswith("```"):
                clean = clean.replace("```json", "").replace("```", "").strip()
            # Extract JSON if there's any extra text
            start = clean.find("{")
            end = clean.rfind("}") + 1
            if start >= 0 and end > start:
                clean = clean[start:end]
            metrics = json.loads(clean)

            # Enforce non-round score — if LLM still returned a multiple of 10, adjust slightly
            score = int(metrics.get("candidate_score", 50))
            if score % 10 == 0 and score > 0:
                import hashlib
                # deterministic nudge based on analysis content
                h = int(hashlib.md5(analysis.encode()).hexdigest()[:4], 16) % 9 - 4
                score = max(1, min(99, score + h if h != 0 else score + 3))
            metrics["candidate_score"] = score

        except Exception as e:
            print(f"JSON parse error: {e}")
            metrics = {
                "candidate_score": 47, "matched_skills": [], "missing_skills": [],
                "final_verdict": "Error", "is_shortlisted": False,
                "has_min_experience": False, "trigger_interview": False
            }

        return {
            **state,
            "candidate_score": metrics.get("candidate_score", 0),
            "matched_skills": metrics.get("matched_skills", []),
            "missing_skills": metrics.get("missing_skills", []),
            "final_verdict": metrics.get("final_verdict", "Rejected"),
            "is_shortlisted": metrics.get("is_shortlisted", False),
            "has_min_experience": metrics.get("has_min_experience", False), 
            "trigger_interview": metrics.get("trigger_interview", False),
        }