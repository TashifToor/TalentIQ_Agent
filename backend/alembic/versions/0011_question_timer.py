"""add current_question_started_at for server-authoritative MCQ timing

Revision ID: 0011_question_timer
Revises: 0010_practice_sessions
Create Date: 2026-08-09

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "0011_question_timer"
down_revision: Union[str, None] = "0010_practice_sessions"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("interview_sessions", sa.Column("current_question_started_at", sa.DateTime(timezone=True), nullable=True))


def downgrade() -> None:
    op.drop_column("interview_sessions", "current_question_started_at")