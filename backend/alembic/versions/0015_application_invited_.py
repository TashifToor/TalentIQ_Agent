"""add invited_posting_id to applications (real Application -> InterviewPosting link)

Revision ID: 0015_application_invited_posting
Revises: 0014_job_source_task_id
Create Date: 2026-08-16

Fixes the gap flagged in the previous pass: move_to_interview() had no
persistent way to remember WHICH posting a candidate was invited to, so an
"invited, not started yet" candidate could never have their exact interview
link re-surfaced later — only an honest "invited, link unavailable" state.

Set exactly once, by move_to_interview(), to the real posting.id it just
verified ownership of and sent the invite for. Never inferred from
candidate name/email. Nullable — every existing Application row (all of
which predate this column) remains valid with it null; no backfill is
performed, since there's no reliable non-inferred source to backfill an
already-sent invitation's posting from.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "0015_application_invited_posting"
down_revision: Union[str, None] = "0014_job_source_task_id"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("applications", sa.Column("invited_posting_id", postgresql.UUID(as_uuid=True), nullable=True))
    op.create_foreign_key(
        "fk_applications_invited_posting_id", "applications", "interview_postings",
        ["invited_posting_id"], ["id"],
    )
    op.create_index("ix_applications_invited_posting_id", "applications", ["invited_posting_id"])


def downgrade() -> None:
    op.drop_index("ix_applications_invited_posting_id", table_name="applications")
    op.drop_constraint("fk_applications_invited_posting_id", "applications", type_="foreignkey")
    op.drop_column("applications", "invited_posting_id")