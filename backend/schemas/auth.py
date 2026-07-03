from pydantic import BaseModel, field_validator
from typing import Optional


class RegisterRequest(BaseModel):
    name:     str
    email:    str
    password: str
    role:     str = "candidate"  # "candidate" | "hr"
    company:  Optional[str] = None  # HR only

    @field_validator("role")
    @classmethod
    def validate_role(cls, v: str) -> str:
        normalized = v.strip().lower()
        if normalized not in ["candidate", "hr"]:
            raise ValueError("Role must be 'candidate' or 'hr'")
        return normalized  # always stored lowercase


class LoginRequest(BaseModel):
    email:    str
    password: str


class UserResponse(BaseModel):
    id:                  int
    name:                str
    email:               str
    is_active:           bool
    role:                str
    subscription_status: str
    scans_used:          int
    scans_remaining:     int
    trial_days_left:     Optional[int] = None
    can_screen:          bool


class TokenResponse(BaseModel):
    access_token: str
    token_type:   str
    role:         str

    model_config = {"arbitrary_types_allowed": True}