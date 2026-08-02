import json
import uuid
from core.llm import llm

MIN_QUESTIONS = 10
MAX_QUESTIONS = 50


def _clean_json(raw: str):
    clean = raw.strip()
    if clean.startswith("```"):
        clean = clean.replace("```json", "").replace("```", "").strip()
    start = clean.find("[") if clean.lstrip().startswith("[") else clean.find("{")
    end = (clean.rfind("]") if clean.lstrip().startswith("[") else clean.rfind("}")) + 1
    if start >= 0 and end > start:
        clean = clean[start:end]
    return json.loads(clean)


def generate_assessment_questions(job_description: str, counts: dict) -> list[dict]:
    """
    Generates a fixed MCQ set for a posting — same questions for every
    candidate who takes this assessment, so scores are comparable.

    counts: {"dsa": int, "job_desc": int, "problem_solving": int, "teamwork": int, "hr": int}
    Returns list of {id, question, options[4], correct_index, topic}.
    """
    total = sum(counts.values())
    total = max(MIN_QUESTIONS, min(MAX_QUESTIONS, total))

    prompt = f"""You are building a technical screening assessment (multiple choice, single correct answer each) for this role. Read the job description and infer the primary programming language(s) and framework(s)/tools it requires — use those for the job-description-specific questions.

<job_description>
{job_description}
</job_description>

Generate EXACTLY this many questions per category:
- "dsa" ({counts.get('dsa', 0)}): data structures & algorithms, complexity analysis, coding problem-solving. Language-agnostic where possible (pseudocode or plain description), unless the JD's language makes a language-specific question more natural.
- "job_desc" ({counts.get('job_desc', 0)}): specific to the JD's named programming language(s), framework(s), and tools — syntax, semantics, gotchas, standard library, framework-specific behavior.
- "problem_solving" ({counts.get('problem_solving', 0)}): general logical reasoning, prioritization, and workplace problem-solving scenarios — not language-specific, not coding.
- "teamwork" ({counts.get('teamwork', 0)}): git workflows (merge conflicts, rebasing, branching), code review judgement, resolving disagreements on an issue/PR, working in a team.
- "hr" ({counts.get('hr', 0)}): behavioral/motivational — why this role, why this company, handling feedback, work ethic, culture fit. Phrase as realistic workplace scenarios with 4 plausible responses, not generic trivia.

Skip any category above with a count of 0 — generate nothing for it.

RULES:
- Each question has EXACTLY 4 options, exactly one correct (for "hr" questions, "correct" means the most professional/effective response).
- Make wrong options plausible, not obviously silly — this should genuinely differentiate skill level.
- Vary difficulty across each category (some easy, some hard) rather than making them all the same difficulty.
- Keep each question and each option concise — one or two sentences max.

Respond ONLY with a valid JSON array, no markdown, no backticks, no commentary. Each item exactly:
{{"question": "...", "options": ["...", "...", "...", "..."], "correct_index": 0, "topic": "dsa|job_desc|problem_solving|teamwork|hr"}}"""

    response = llm.invoke(prompt)
    raw = _clean_json(response.content)

    questions = []
    for item in raw:
        try:
            opts = item["options"]
            if not isinstance(opts, list) or len(opts) != 4:
                continue
            ci = int(item["correct_index"])
            if not (0 <= ci <= 3):
                continue
            questions.append({
                "id": str(uuid.uuid4())[:8],
                "question": str(item["question"]).strip(),
                "options": [str(o).strip() for o in opts],
                "correct_index": ci,
                "topic": str(item.get("topic", "general")),
            })
        except (KeyError, TypeError, ValueError):
            continue  # skip anything malformed rather than failing the whole batch

    return questions[:total]


def score_assessment(questions: list[dict], answers: list[dict]) -> dict:
    """
    answers: list[{question_id, selected_index}]
    Returns {score, correct_count, total, breakdown_by_topic}
    """
    answer_map = {a["question_id"]: a["selected_index"] for a in answers}
    total = len(questions)
    correct = 0
    topic_stats: dict[str, dict[str, int]] = {}

    for q in questions:
        topic = q.get("topic", "general")
        topic_stats.setdefault(topic, {"correct": 0, "total": 0})
        topic_stats[topic]["total"] += 1
        selected = answer_map.get(q["id"])
        if selected is not None and int(selected) == q["correct_index"]:
            correct += 1
            topic_stats[topic]["correct"] += 1

    score = round((correct / total) * 100) if total else 0
    return {
        "score": score,
        "correct_count": correct,
        "total": total,
        "breakdown_by_topic": topic_stats,
    }