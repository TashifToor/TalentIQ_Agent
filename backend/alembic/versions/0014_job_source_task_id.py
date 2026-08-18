"""add source_task_id to jobs (bulk-screening idempotency)

Revision ID: 0014_job_source_task_id
Revises: 0013_application_ai_screening
Create Date: 2026-08-15

celery_app.conf has task_acks_late=True + task_reject_on_worker_lost=True
(intentional — a stuck/crashed worker shouldn't silently lose a candidate's
screening). The tradeoff: if a worker dies AFTER run_bulk_screening commits
its Job+Applications but BEFORE it acks the message, Celery redelivers the
same task to another worker, which would otherwise run the entire screening
again from scratch — a second Job, a second full set of Applications, for
the same original upload. source_task_id lets the task recognize "I've
already done this exact run" and skip re-creating anything.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "0014_job_source_task_id"
down_revision: Union[str, None] = "0013_application_ai_screening"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("jobs", sa.Column("source_task_id", sa.String(), nullable=True))
    op.create_index("ix_jobs_source_task_id", "jobs", ["source_task_id"])


def downgrade() -> None:
    op.drop_index("ix_jobs_source_task_id", table_name="jobs")
    op.drop_column("jobs", "source_task_id")