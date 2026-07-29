"""add interviewer_name, awaiting_cv, cv_text to interview tables

Revision ID: 0005_interview_persona_cv
Revises: 0004_interview
Create Date: 2026-07-25

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "0005_interview_persona_cv"
down_revision: Union[str, None] = "0004_interview"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("interview_postings", sa.Column("interviewer_name", sa.String(), server_default="Kelly"))
    op.add_column("interview_sessions", sa.Column("awaiting_cv", sa.Boolean(), server_default="false"))
    op.add_column("interview_sessions", sa.Column("cv_text", sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column("interview_sessions", "cv_text")
    op.drop_column("interview_sessions", "awaiting_cv")
    op.drop_column("interview_postings", "interviewer_name")