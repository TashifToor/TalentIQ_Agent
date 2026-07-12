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


class CVData(BaseModel):
    full_name: str = ""
    email: str = ""
    phone: str = ""
    location: str = ""
    linkedin: str = ""
    github: str = ""
    summary: str = ""
    skills: List[str] = []
    education: List[EducationEntry] = []
    experience: List[ExperienceEntry] = []
    projects: List[ProjectEntry] = []
    photo_base64: Optional[str] = None  # data URL or raw base64 — only used by "with photo" templates


TEMPLATES_WITH_PHOTO = {"executive", "visual-sidebar", "visual-decorative"}  # photo optional on all, but these are designed around it
ALL_TEMPLATES = {"modern", "classic", "minimal", "banded", "elegant", "bold", "compact", "executive", "visual-sidebar", "visual-decorative"}
ATS_SAFE_TEMPLATES = {"modern", "classic", "minimal", "banded", "elegant", "bold", "compact", "executive"}


class GenerateCVRequest(BaseModel):
    cv_data: CVData
    template: str = "modern"          # one of ALL_TEMPLATES
    job_description: Optional[str] = None   # if provided, content gets rewritten for ATS fit