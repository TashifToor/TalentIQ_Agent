"""add MCQ assessment + proctoring fields to interview tables

Revision ID: 0006_interview_assessment
Revises: 0005_interview_persona_cv
Create Date: 2026-08-01

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "0006_interview_assessment"
down_revision: Union[str, None] = "0005_interview_persona_cv"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("interview_postings", sa.Column("interview_enabled", sa.Boolean(), server_default="true"))
    op.add_column("interview_postings", sa.Column("assessment_enabled", sa.Boolean(), server_default="false"))
    op.add_column("interview_postings", sa.Column("assessment_source", sa.String(), nullable=True))
    op.add_column("interview_postings", sa.Column("assessment_num_questions", sa.Integer(), server_default="20"))
    op.add_column("interview_postings", sa.Column("assessment_questions", sa.Text(), server_default="[]"))

    op.add_column("interview_sessions", sa.Column("stage", sa.String(), server_default="interview"))
    op.add_column("interview_sessions", sa.Column("assessment_answers", sa.Text(), server_default="[]"))
    op.add_column("interview_sessions", sa.Column("assessment_current_index", sa.Integer(), server_default="0"))
    op.add_column("interview_sessions", sa.Column("assessment_score", sa.Integer(), nullable=True))
    op.add_column("interview_sessions", sa.Column("assessment_flags", sa.Text(), server_default="[]"))
    op.add_column("interview_sessions", sa.Column("assessment_photos", sa.Text(), server_default="[]"))
    op.add_column("interview_sessions", sa.Column("assessment_started_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("interview_sessions", sa.Column("assessment_completed_at", sa.DateTime(timezone=True), nullable=True))


def downgrade() -> None:
    for col in ["assessment_completed_at", "assessment_started_at", "assessment_photos", "assessment_flags",
                "assessment_score", "assessment_current_index", "assessment_answers", "stage"]:
        op.drop_column("interview_sessions", col)
    for col in ["assessment_questions", "assessment_num_questions", "assessment_source",
                "assessment_enabled", "interview_enabled"]:
        op.drop_column("interview_postings", col)