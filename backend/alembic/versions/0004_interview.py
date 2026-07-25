"""add interview_postings + interview_sessions tables (AI Chatbot Interviewer)

Revision ID: 0004_interview
Revises: 0003_team_workspace
Create Date: 2026-07-23

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "0004_interview"
down_revision: Union[str, None] = "0003_team_workspace"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "interview_postings",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("hr_user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("title", sa.String(), nullable=False),
        sa.Column("company", sa.String(), nullable=True),
        sa.Column("job_description", sa.Text(), nullable=False),
        sa.Column("extra_questions", sa.Text(), server_default="[]"),
        sa.Column("public_slug", sa.String(), nullable=False, unique=True),
        sa.Column("is_active", sa.Boolean(), server_default="true"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_interview_postings_public_slug", "interview_postings", ["public_slug"], unique=True)

    op.create_table(
        "interview_sessions",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("posting_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("interview_postings.id"), nullable=False),
        sa.Column("candidate_name", sa.String(), nullable=False),
        sa.Column("candidate_email", sa.String(), nullable=False),
        sa.Column("transcript", sa.Text(), server_default="[]"),
        sa.Column("turn_count", sa.Integer(), server_default="0"),
        sa.Column("status", sa.String(), server_default="in_progress"),
        sa.Column("ai_score", sa.Integer(), nullable=True),
        sa.Column("final_verdict", sa.String(), nullable=True),
        sa.Column("experience_assessment", sa.Text(), nullable=True),
        sa.Column("deep_analysis", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_interview_sessions_candidate_email", "interview_sessions", ["candidate_email"])


def downgrade() -> None:
    op.drop_index("ix_interview_sessions_candidate_email", table_name="interview_sessions")
    op.drop_table("interview_sessions")
    op.drop_index("ix_interview_postings_public_slug", table_name="interview_postings")
    op.drop_table("interview_postings")