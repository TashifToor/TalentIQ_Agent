from pydantic import BaseModel
from typing import List, Optional


class EducationEntry(BaseModel):
    degree: str = ""
    institution: str = ""
    start_year: str = ""
    end_year: str = ""
    details: str = ""


class ExperienceEntry(BaseModel):
    title: str = ""
    company: str = ""
    start_date: str = ""
    end_date: str = ""
    bullets: List[str] = []


class ProjectEntry(BaseModel):
    name: str = ""
    description: str = ""
    tech_stack: str = ""


class SkillGroup(BaseModel):
    """Optional categorized skills, e.g. category='Languages & Frameworks',
    items=['Python', 'Django', 'FastAPI']. Purely additive — if the person
    filling the form doesn't want categories, they just use the flat
    `skills` list on CVData instead. Whichever one has entries wins at
    render time (skill_groups takes priority if both are present)."""
    category: str = ""
    items: List[str] = []


class CVData(BaseModel):
    full_name: str = ""
    role_title: str = ""  # professional headline under the name, e.g. "Python Developer | AI & Backend Engineer"
    email: str = ""
    phone: str = ""
    location: str = ""
    linkedin: str = ""
    github: str = ""
    summary: str = ""
    skills: List[str] = []
    skill_groups: List[SkillGroup] = []  # optional categorized alternative to `skills`
    education: List[EducationEntry] = []
    experience: List[ExperienceEntry] = []
    projects: List[ProjectEntry] = []
    achievements: List[str] = []  # certifications, awards, publications, etc.
    photo_base64: Optional[str] = None  # data URL or raw base64 — only used by "with photo" templates


TEMPLATES_WITH_PHOTO = {"executive", "visual-sidebar", "visual-decorative"}  # photo optional on all, but these are designed around it
ALL_TEMPLATES = {"modern", "classic", "minimal", "banded", "elegant", "bold", "compact", "executive", "professional", "visual-sidebar", "visual-decorative"}
ATS_SAFE_TEMPLATES = {"modern", "classic", "minimal", "banded", "elegant", "bold", "compact", "executive", "professional"}


# 12 basic colors offered as an accent-color override for any ATS-safe
# template — independent of the template's own default accent.
BASIC_COLORS = {
    "black": "#1a1a1a", "gray": "#555555", "red": "#c0392b", "orange": "#d2691e",
    "yellow": "#c98a0a", "green": "#2e7d32", "teal": "#147a72", "blue": "#2f5d8a",
    "navy": "#1a2f5c", "purple": "#6c3fa0", "pink": "#c2185b", "brown": "#6b4226",
}


class GenerateCVRequest(BaseModel):
    cv_data: CVData
    template: str = "modern"          # one of ALL_TEMPLATES
    accent_color: Optional[str] = None  # hex string, or one of BASIC_COLORS keys — overrides the template's default accent
    job_description: Optional[str] = None   # if provided, content gets rewritten for ATS fit


class ATSScoreRequest(BaseModel):
    cv_data: CVData
    template: Optional[str] = None  # if provided, formatting checks account for the chosen template


class OptimizeForJobRequest(BaseModel):
    cv_data: CVData
    job_description: str


class AssistantRewriteRequest(BaseModel):
    text: str                                  # the exact bullet/summary text to rewrite — never invented
    instruction: str = "stronger"               # one of: stronger | concise | ats_friendly
    job_description: Optional[str] = None       # optional — used only to weave in real, already-present context