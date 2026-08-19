"""add candidate_name and candidate_email to applications (bulk screening identity)

Revision ID: 0012_application_candidate_identity
Revises: 0011_question_timer
Create Date: 2026-08-12

candidate_name: the screening pipeline already extracts this per CV
(tasks/screening_task.py extract_name_from_text) but was discarding it —
this just persists what already gets computed, nothing new is inferred.

candidate_email: no email signal exists anywhere in the bulk-screening
pipeline today (resumes aren't parsed for contact info). This column is
populated only when an HR user explicitly types it in — e.g. when using
"Move to Interview" and the app needs somewhere to send the interview link.
Never auto-filled, never guessed.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "0012_application_candidate_identity"
down_revision: Union[str, None] = "0011_question_timer"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("applications", sa.Column("candidate_name", sa.String(), nullable=True))
    op.add_column("applications", sa.Column("candidate_email", sa.String(), nullable=True))


def downgrade() -> None:
    op.drop_column("applications", "candidate_email")
    op.drop_column("applications", "candidate_name")