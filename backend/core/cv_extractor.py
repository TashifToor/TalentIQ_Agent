import json
from core.llm import llm
from schemas.cv_builder import CVData


EXTRACTION_PROMPT_TEMPLATE = """You are a CV parsing engine. Extract structured information from the raw CV text below into EXACT JSON matching this schema.

HARD RULE: Only extract what is ACTUALLY present in the text below. If a field isn't present, use an empty string "" or empty list [] — never invent, guess, or add a placeholder/example entry (e.g. do NOT add a generic "Role — Company" experience entry if the CV only lists one job). Every experience/education/project entry in your output must correspond to a real entry you can point to in the source text.

Respond ONLY with valid JSON. No markdown, no explanation, no backticks.

{{
    "full_name": "",
    "email": "",
    "phone": "",
    "location": "",
    "linkedin": "",
    "github": "",
    "summary": "<2-3 sentence professional summary — write one if the CV lacks an explicit summary, based only on the actual content below>",
    "skills": ["skill1", "skill2"],
    "education": [
        {{"degree": "", "institution": "", "start_year": "", "end_year": "", "details": ""}}
    ],
    "experience": [
        {{"title": "", "company": "", "start_date": "", "end_date": "", "bullets": ["achievement 1", "achievement 2"]}}
    ],
    "projects": [
        {{"name": "", "description": "", "tech_stack": ""}}
    ]
}}

<raw_cv_text>
{cv_text}
</raw_cv_text>"""


def extract_cv_data(cv_text: str) -> CVData:
    prompt = EXTRACTION_PROMPT_TEMPLATE.format(cv_text=cv_text[:12000])  # guard against extremely long CVs blowing the context
    response = llm.invoke(prompt)

    clean = response.content.strip()
    if clean.startswith("```"):
        clean = clean.replace("```json", "").replace("```", "").strip()

    try:
        parsed = json.loads(clean)
    except json.JSONDecodeError as e:
        print(f"[CVExtractor] JSON parse failed: {e} | raw: {clean[:300]}")
        parsed = {}

    return CVData(**parsed) 