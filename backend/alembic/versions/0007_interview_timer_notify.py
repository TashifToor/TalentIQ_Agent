"""add assessment timer, HR notify toggle, and cheating termination fields

Revision ID: 0007_interview_timer_notify
Revises: 0006_interview_assessment
Create Date: 2026-08-02

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "0007_interview_timer_notify"
down_revision: Union[str, None] = "0006_interview_assessment"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("interview_postings", sa.Column("assessment_seconds_per_question", sa.Integer(), server_default="60"))
    op.add_column("interview_postings", sa.Column("notify_hr_on_completion", sa.Boolean(), server_default="true"))
    op.add_column("interview_sessions", sa.Column("terminated_reason", sa.String(), nullable=True))


def downgrade() -> None:
    op.drop_column("interview_sessions", "terminated_reason")
    op.drop_column("interview_postings", "notify_hr_on_completion")
    op.drop_column("interview_postings", "assessment_seconds_per_question")