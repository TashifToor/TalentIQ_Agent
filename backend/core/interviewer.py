import json
import hashlib
from core.llm import llm

# Safety floor/ceiling around the AI's own judgement of when the interview is
# "done" — this is what makes the interview actually non-skippable instead of
# just prompt-engineered. The AI can't conclude before MIN_TURNS candidate
# answers no matter what it decides, and gets force-concluded at MAX_TURNS so
# a session can never run forever either.
MIN_TURNS = 6
MAX_TURNS = 12

FORMAT_RULE = (
    "Write like you're typing a real chat message to a person — plain, natural "
    "sentences only. NEVER use markdown formatting: no asterisks for bold/italic, "
    "no bullet points, no numbered lists, no headers, no backticks. Just talk normally."
)


def _clean_json(raw: str) -> dict:
    clean = raw.strip()
    if clean.startswith("```"):
        clean = clean.replace("```json", "").replace("```", "").strip()
    start = clean.find("{")
    end = clean.rfind("}") + 1
    if start >= 0 and end > start:
        clean = clean[start:end]
    return json.loads(clean)


def _format_transcript(transcript: list[dict]) -> str:
    lines = []
    for turn in transcript:
        speaker = "Interviewer" if turn["role"] == "assistant" else "Candidate"
        lines.append(f"{speaker}: {turn['content']}")
    return "\n".join(lines)


def _system_context(interviewer_name: str, job_description: str, extra_questions: list[str]) -> str:
    extra_block = ""
    if extra_questions:
        numbered = "\n".join(f"- {q}" for q in extra_questions)
        extra_block = f"\n\nThe HR team specifically wants these covered somewhere in the interview (work them in naturally, don't just read them out verbatim back to back):\n{numbered}"

    return f"""You are {interviewer_name}, a real recruiter conducting a live text-based screening interview on behalf of the hiring company, in the 2026 hiring market where only genuinely exceptional candidates should clear the bar. You're professional, warm, and genuinely curious about the candidate — but not a pushover. Talk like a real person sitting across the table would: react to what they say, don't just fire off a checklist. This is a real screening interview that determines whether this candidate gets a human interview slot, not a friendly chat.

<job_description>
{job_description}
</job_description>{extra_block}

RULES YOU MUST FOLLOW:
- {FORMAT_RULE}
- Ask ONE question or follow-up at a time. Never dump multiple questions in one message.
- Base your questions on the JD's actual requirements — skills, experience level, responsibilities — and probe for real depth (specifics, numbers, decisions made, trade-offs), not surface-level buzzwords.
- Ask natural follow-ups when an answer is vague, generic, or sounds rehearsed — push for concrete detail, the way a sharp human interviewer would.
- The candidate CANNOT skip, refuse, or deflect a question. If they try to ("skip this", "I'd rather not say", "next question", one-word non-answers, or silence padded with filler), do NOT move on — acknowledge briefly and firmly restate the question, explain that a substantive answer is needed to continue.
- If off-topic, hostile, or nonsensical input comes in, redirect politely back to the interview.
- Do not reveal scoring, verdicts, or how you're evaluating them at any point during the conversation.
- Refer to yourself as {interviewer_name} if the candidate asks your name.

GENERAL SHAPE OF THE INTERVIEW (adapt naturally, don't announce these as rigid sections):
1. Start with a brief self-introduction — let the candidate walk you through their background, current role/education, and what they do in their own words.
2. Move into their education/qualifications as relevant to this role.
3. Ask them to name the skills/technologies most relevant to the JD that they'd bring to this role.
4. Spend the bulk of the interview here: for each significant skill they claim, don't just take their word for it — ask them to walk you through a real project where they actually used it. Dig into their specific role in that project, technical decisions they made, problems they hit and how they solved them. This is how you actually verify a skill is real versus just a listed keyword — surface-level project summaries without technical specifics are a red flag.
5. Weave in the HR's extra questions (if any) naturally wherever they fit, rather than saving them all for the end."""


def get_next_turn(interviewer_name: str, job_description: str, extra_questions: list[str], transcript: list[dict], turn_count: int) -> dict:
    """
    Given the conversation so far, returns the interviewer's next message and
    whether the interview should conclude. Returns:
        {"message": str, "action": "continue" | "conclude"}
    """
    if turn_count == 0:
        # Hardcoded, not LLM-generated — guarantees every interview always
        # opens with a self-introduction ask, no dependence on the model
        # reliably following the "don't jump to skills/projects yet" rule.
        return {
            "message": f"Hi, I'm {interviewer_name} — thanks for joining, excited to chat with you today. Before we get into specifics, I'd love a quick introduction. Could you tell me a bit about your background, your current role or education, and a brief overview of what you do?",
            "action": "continue",
        }

    history = _format_transcript(transcript)
    force_conclude = turn_count >= MAX_TURNS
    force_continue = turn_count < MIN_TURNS

    if force_conclude:
        guidance = "You MUST conclude now — this is the final turn regardless of coverage. Thank the candidate warmly and let them know the conversation part of the interview is complete."
    elif force_continue:
        guidance = f"You must continue — at least {MIN_TURNS} candidate answers are required before the interview can end, and you're not there yet. Do not conclude no matter how the conversation is going."
    else:
        guidance = "Decide whether you have enough substantive coverage of the JD's key requirements (and the HR extra questions, if any) to conclude, or whether there are still important gaps to probe. Only conclude once genuinely satisfied, not just because a few questions were asked."

    prompt = f"""{_system_context(interviewer_name, job_description, extra_questions)}

<conversation_so_far>
{history}
</conversation_so_far>

{guidance}

Respond ONLY with valid JSON, no markdown, no backticks:
{{"message": "<your next question/follow-up, OR a brief warm thank-you if concluding>", "action": "continue" or "conclude"}}"""

    response = llm.invoke(prompt)
    try:
        data = _clean_json(response.content)
        message = data.get("message", "Could you tell me more about that?")
        action = data.get("action", "continue")
    except Exception as e:
        print(f"[Interviewer] JSON parse error on next-turn: {e}")
        message = "Could you expand on that with a specific example?"
        action = "continue"

    # Hard server-side enforcement — never trust the LLM's action alone
    if turn_count < MIN_TURNS:
        action = "continue"
    elif turn_count >= MAX_TURNS:
        action = "conclude"

    return {"message": message, "action": action}


def cv_request_message(interviewer_name: str) -> str:
    """
    Hardcoded, not LLM-generated, for the same reliability reason as the
    opening message — this is what triggers the frontend to switch from the
    text box to a CV upload control.
    """
    return (
        f"That covers everything I needed — thanks for such thorough answers. "
        f"One last thing: could you upload your CV (PDF, Word, whatever you have)? "
        f"It helps me cross-check what we discussed against your actual experience. "
        f"If you don't have one handy right now, that's okay, you can skip it."
    )


def generate_report(interviewer_name: str, job_description: str, extra_questions: list[str], transcript: list[dict], cv_text: str | None = None) -> dict:
    """
    Post-interview scoring — reuses the harsh-but-fair recruiter framing from
    core/agent.py's CV screening prompts, applied to the interview transcript
    (and the candidate's CV, if they uploaded one) as evidence.
    """
    history = _format_transcript(transcript)
    extra_block = ""
    if extra_questions:
        numbered = "\n".join(f"- {q}" for q in extra_questions)
        extra_block = f"\n\n<hr_required_questions>\n{numbered}\n</hr_required_questions>"

    cv_block = ""
    cv_instruction = ""
    if cv_text and cv_text.strip():
        cv_block = f"\n\n<candidate_cv>\n{cv_text.strip()}\n</candidate_cv>"
        cv_instruction = " Cross-check the CV against what the candidate actually said in the interview — a human recruiter would flag any place the CV claims something the candidate couldn't back up conversationally, or vice versa. Treat the interview transcript as the primary evidence; the CV is corroborating context."
    else:
        cv_instruction = " No CV was provided — score based on the interview transcript alone."

    prompt = f"""You are {interviewer_name} — a senior technical recruiter operating in the 2026 hiring market. Context you must internalize before scoring anything:

- FAANG-scale hiring has largely frozen. Headcount today is concentrated in smaller, leaner ("mango-tier") companies who cannot afford a bad hire — every seat has to earn its keep.
- Because of this, only genuinely exceptional candidates should clear the bar — not "good enough," not "trainable," not "close on paper."
- You are the last line of defense before a company wastes a human interview slot or makes a bad hire.
- This transcript is a live conversational interview, not a resume — judge substance, specificity, and depth of the candidate's actual answers, not politeness or fluency alone. Vague, generic, or rehearsed-sounding answers with no concrete detail are a red flag, not a pass.{cv_instruction}

<job_description>
{job_description}
</job_description>{extra_block}

<interview_transcript>
{history}
</interview_transcript>{cv_block}

Conduct a structured analysis, then score it. {FORMAT_RULE} Respond ONLY with valid JSON, no markdown, no backticks:

{{
    "experience_assessment": "<2-4 plain sentences: does the candidate's answers (and CV, if provided) demonstrate the level of hands-on experience the JD requires? Be explicit about years/depth vs what the JD demands — this is a hard constraint, strong communication cannot substitute for a real experience gap.>",
    "deep_analysis": "<4-6 plain sentences: sharp, specific, unsentimental breakdown of strengths and weaknesses actually evidenced in the transcript — reference specific answers, don't generalize. Call out any vague/deflected answers or CV-vs-interview mismatches explicitly.>",
    "candidate_score": <integer 0-100, NOT a multiple of 10, reflecting actual demonstrated fit>,
    "final_verdict": "<Strong Hire | Proceed to Human Interview | Borderline | Not a Fit>"
}}

SCORING RULE: if the experience_assessment concludes the candidate falls meaningfully short of the JD's required experience level, candidate_score MUST NOT exceed 54 and final_verdict MUST be "Not a Fit" — strong communication or enthusiasm cannot override a genuine experience gap."""

    response = llm.invoke(prompt)
    try:
        data = _clean_json(response.content)
        score = int(data.get("candidate_score", 47))
        if score % 10 == 0 and score > 0:
            h = int(hashlib.md5(history.encode()).hexdigest()[:4], 16) % 9 - 4
            score = max(1, min(99, score + h if h != 0 else score + 3))
        data["candidate_score"] = score
        return data
    except Exception as e:
        print(f"[Interviewer] JSON parse error on report: {e}")
        return {
            "experience_assessment": "Could not be determined — automated scoring failed.",
            "deep_analysis": "Report generation encountered an error. Please review the transcript manually.",
            "candidate_score": 0,
            "final_verdict": "Error",
        }