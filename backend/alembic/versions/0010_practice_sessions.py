"""create practice_sessions table (candidate-owned, independent domain)

Revision ID: 0010_practice_sessions
Revises: 0009_interview_mode
Create Date: 2026-08-06

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "0010_practice_sessions"
down_revision: Union[str, None] = "0009_interview_mode"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "practice_sessions",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, index=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False, index=True),

        sa.Column("mode", sa.String(), nullable=False),
        sa.Column("target_role", sa.String(), nullable=False),
        sa.Column("experience_level", sa.String(), nullable=True),
        sa.Column("difficulty", sa.String(), nullable=True),
        sa.Column("length_minutes", sa.Integer(), server_default="15"),
        sa.Column("skills_focus", sa.Text(), server_default="[]"),
        sa.Column("job_description", sa.Text(), nullable=True),
        sa.Column("resume_text", sa.Text(), nullable=True),
        sa.Column("interviewer_name", sa.String(), server_default="Kelly"),

        sa.Column("stage", sa.String(), server_default="interview"),
        sa.Column("transcript", sa.Text(), server_default="[]"),
        sa.Column("turn_count", sa.Integer(), server_default="0"),

        sa.Column("assessment_questions", sa.Text(), server_default="[]"),
        sa.Column("assessment_answers", sa.Text(), server_default="[]"),
        sa.Column("assessment_current_index", sa.Integer(), server_default="0"),

        sa.Column("ai_score", sa.Integer(), nullable=True),
        sa.Column("assessment_score", sa.Integer(), nullable=True),
        sa.Column("assessment_breakdown", sa.Text(), nullable=True),
        sa.Column("final_verdict", sa.String(), nullable=True),
        sa.Column("experience_assessment", sa.Text(), nullable=True),
        sa.Column("deep_analysis", sa.Text(), nullable=True),

        sa.Column("status", sa.String(), server_default="in_progress"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
    )


def downgrade() -> None:
    op.drop_table("practice_sessions")