from core.faiss import VectorStore
import json
from core.llm import llm
from core.state import ScreeningState


class TalentIQAgent:
    def __init__(self):
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

        prompt = f"""You are TalentIQ — a senior technical recruiter AI with 15+ years of hiring experience at FAANG-level companies. Your analysis is trusted to make real hiring decisions. Be ruthlessly accurate.

<job_description>
{jd}
</job_description>

<candidate_cv>
{cv_context}
</candidate_cv>

Conduct a structured 4-step screening analysis. For each step, start with the exact heading shown, then write 2-4 sentences of sharp, specific analysis. Reference actual details from the CV — never generalize.

**Step 1: Technical Stack Alignment**
Evaluate how precisely the candidate's tech stack matches the JD requirements. Name specific technologies from both the JD and CV. Identify depth vs surface-level exposure.

**Step 2: Experience Quality & Project Impact**
Assess the complexity and real-world impact of their projects. Did they build systems at scale? Quantify outcomes where visible (e.g. "reduced latency by X%", "handled N users"). Flag if experience is shallow or tutorial-level.

**Step 3: Skill Gaps & Red Flags**
List specific skills the JD requires that the candidate lacks entirely or partially. Be direct — do not soften gaps. Also flag any inconsistencies, employment gaps, or vague claims.

**Step 4: Hiring Recommendation**
Give a clear final assessment: Strong Hire / Conditional Hire / Reject. State the single most decisive factor (positive or negative) that drives this recommendation.

Write only the 4 steps above. No preamble, no summary after Step 4."""

        response = llm.invoke(prompt)
        return {**state, "retrieved_cv_context": cv_context, "screening_analysis": response.content}

    def _rank_candidate(self, state: ScreeningState) -> ScreeningState:
        print("Executing Candidate Ranking Node...")
        jd = state["job_description"]
        analysis = state["screening_analysis"]

        prompt = f"""You are a scoring engine for an ATS (Applicant Tracking System). Based on the job description and screening analysis below, output a precise JSON score.

SCORING RULES — read carefully:
- Score must reflect ACTUAL fit, not round numbers. Use the full 0-100 range. Examples of valid scores: 23, 47, 61, 78, 91. Invalid: 50, 60, 70, 80.
- Score breakdown: Technical match (40pts) + Experience quality (25pts) + Project complexity (20pts) + Communication/soft signals (15pts)
- matched_skills: only skills explicitly evidenced in CV that JD requires
- missing_skills: only skills JD explicitly requires that are absent from CV
- final_verdict: "Highly Shortlisted" (score >= 82), "Good Fit for Interview" (score 60-81), "Rejected" (score < 60)
- is_shortlisted: true only if score >= 75
- trigger_interview: true only if score >= 85 AND no critical skill gaps

Respond ONLY with valid JSON. No markdown, no explanation, no backticks.

{{
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