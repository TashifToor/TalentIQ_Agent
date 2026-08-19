"""add ai_screening fields to applications (CrewAI screening committee)

Revision ID: 0013_application_ai_screening
Revises: 0012_application_candidate_identity
Create Date: 2026-08-14

Persists the CrewAI multi-agent screening committee's structured result per
Application, so HR can re-open a candidate without re-running the (expensive,
LLM-backed) crew every time, and so it can be explicitly re-run later.

Does NOT duplicate any existing ATS field — ai_score, matched_skills,
missing_skills, final_verdict all remain exactly where they already were
(deterministic, backend-controlled). This is qualitative committee output
only, stored separately and clearly labeled as "AI Analysis" vs "System
Score" everywhere it's shown.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "0013_application_ai_screening"
down_revision: Union[str, None] = "0012_application_candidate_identity"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("applications", sa.Column("ai_screening_status", sa.String(), nullable=False, server_default="not_analyzed"))
    op.add_column("applications", sa.Column("ai_screening_result", sa.Text(), nullable=True))
    op.add_column("applications", sa.Column("ai_screening_updated_at", sa.DateTime(timezone=True), nullable=True))


def downgrade() -> None:
    op.drop_column("applications", "ai_screening_updated_at")
    op.drop_column("applications", "ai_screening_result")
    op.drop_column("applications", "ai_screening_status")