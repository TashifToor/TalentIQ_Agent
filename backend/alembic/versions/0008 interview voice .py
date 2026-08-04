"""add voice_enabled to interview_postings

Revision ID: 0008_interview_voice
Revises: 0007_interview_timer_notify
Create Date: 2026-08-03

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "0008_interview_voice"
down_revision: Union[str, None] = "0007_interview_timer_notify"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("interview_postings", sa.Column("voice_enabled", sa.Boolean(), server_default="false"))


def downgrade() -> None:
    op.drop_column("interview_postings", "voice_enabled")