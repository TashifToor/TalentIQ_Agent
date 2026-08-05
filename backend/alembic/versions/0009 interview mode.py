"""replace interview stage toggles with a single mode column

Revision ID: 0009_interview_mode
Revises: 0008_interview_voice
Create Date: 2026-08-04

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "0009_interview_mode"
down_revision: Union[str, None] = "0008_interview_voice"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("interview_postings", sa.Column("mode", sa.String(), nullable=False, server_default="chatbot"))

    conn = op.get_bind()
    # Backfill mode from the old three booleans for existing postings:
    # voice_enabled wins (it used to layer over interview/assessment),
    # else assessment-only postings become "mcq", everything else "chatbot".
    conn.execute(sa.text("UPDATE interview_postings SET mode = 'voice_agent' WHERE voice_enabled IS TRUE"))
    conn.execute(sa.text(
        "UPDATE interview_postings SET mode = 'mcq' "
        "WHERE voice_enabled IS NOT TRUE AND assessment_enabled IS TRUE AND interview_enabled IS NOT TRUE"
    ))

    op.drop_column("interview_postings", "interview_enabled")
    op.drop_column("interview_postings", "assessment_enabled")
    op.drop_column("interview_postings", "voice_enabled")


def downgrade() -> None:
    op.add_column("interview_postings", sa.Column("interview_enabled", sa.Boolean(), server_default="true"))
    op.add_column("interview_postings", sa.Column("assessment_enabled", sa.Boolean(), server_default="false"))
    op.add_column("interview_postings", sa.Column("voice_enabled", sa.Boolean(), server_default="false"))

    conn = op.get_bind()
    conn.execute(sa.text("UPDATE interview_postings SET voice_enabled = TRUE WHERE mode = 'voice_agent'"))
    conn.execute(sa.text("UPDATE interview_postings SET interview_enabled = TRUE WHERE mode IN ('chatbot','voice_agent')"))
    conn.execute(sa.text("UPDATE interview_postings SET assessment_enabled = TRUE, interview_enabled = FALSE WHERE mode = 'mcq'"))

    op.drop_column("interview_postings", "mode")