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


def _category_split(total: int) -> dict:
    """Proportional allocation across the fixed category mix — always sums to `total`."""
    weights = {
        "aptitude": 0.15,       # general reasoning / character / workplace judgement
        "dsa": 0.25,            # data structures & algorithms / problem solving
        "language": 0.25,       # specific to the JD's primary programming language
        "framework": 0.20,      # specific to the JD's stated framework(s)/tools
        "collaboration": 0.15,  # team workflows, git scenarios, code review judgement
    }
    counts = {k: max(1, round(total * w)) for k, w in weights.items()}
    # Rounding can drift the total slightly off — correct against the largest bucket.
    diff = total - sum(counts.values())
    if diff != 0:
        biggest = max(counts, key=counts.get)
        counts[biggest] += diff
    return counts


def generate_assessment_questions(job_description: str, num_questions: int) -> list[dict]:
    """
    Generates a fixed MCQ set for a posting — same questions for every
    candidate who takes this assessment, so scores are comparable.
    Returns list of {id, question, options[4], correct_index, topic}.
    """
    num_questions = max(MIN_QUESTIONS, min(MAX_QUESTIONS, num_questions))
    counts = _category_split(num_questions)

    prompt = f"""You are building a technical screening assessment (multiple choice, single correct answer each) for this role. Read the job description and infer the primary programming language(s) and framework(s)/tools it requires — use those to write the language- and framework-specific questions.

<job_description>
{job_description}
</job_description>

Generate EXACTLY this many questions per category:
- "aptitude": {counts['aptitude']} — general workplace reasoning, logical judgement, prioritization scenarios. Not language-specific.
- "dsa": {counts['dsa']} — data structures & algorithms, complexity analysis, problem-solving. Language-agnostic where possible (pseudocode or plain description), unless the JD's language makes a language-specific question more natural.
- "language": {counts['language']} — specific to the JD's primary programming language's syntax, semantics, gotchas, standard library.
- "framework": {counts['framework']} — specific to the JD's named framework(s)/tools (e.g. the actual framework mentioned in the JD — if none is named, use the most relevant common framework for that language/domain instead).
- "collaboration": {counts['collaboration']} — git workflows (merge conflicts, rebasing, branching strategy), code review judgement, working in a team, resolving disagreements on an issue/PR.

RULES:
- Each question has EXACTLY 4 options, exactly one correct.
- Make wrong options plausible, not obviously silly — this should genuinely differentiate skill level.
- Vary difficulty across each category (some easy, some hard) rather than making them all the same difficulty.
- Keep each question and each option concise — one or two sentences max.

Respond ONLY with a valid JSON array, no markdown, no backticks, no commentary. Each item exactly:
{{"question": "...", "options": ["...", "...", "...", "..."], "correct_index": 0, "topic": "aptitude|dsa|language|framework|collaboration"}}"""

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

    return questions[:num_questions]


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