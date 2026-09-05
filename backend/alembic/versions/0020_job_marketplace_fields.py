"""add job marketplace fields

Revision ID: 0018_job_marketplace
Revises: 0017_notifications
Create Date: 2026-08-29

Extends the existing `jobs` table (previously just a screening-batch
container: title/company/location/description/is_active) with the fields
the Jobs Marketplace needs — status lifecycle, structured requirements,
work/employment details, and lightweight analytics counters. Purely
additive: every new column is nullable or has a server_default, so every
existing row (created by bulk screening, before this feature existed)
stays valid with no backfill required beyond `status`, which is derived
directly from the existing `is_active` flag so current draft/published
semantics are preserved exactly.

`is_active` itself is kept, unmodified, for backward compatibility with
any code path still reading it directly (e.g. GET /jobs's old filter) —
it is now kept in sync with status by the application layer rather than
being the source of truth going forward.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "0018_job_marketplace"
down_revision: Union[str, None] = "0017_notifications"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("jobs", sa.Column("status", sa.String(), nullable=False, server_default="published"))
    op.add_column("jobs", sa.Column("responsibilities", sa.Text(), nullable=True))
    op.add_column("jobs", sa.Column("required_skills", sa.Text(), nullable=True))   # JSON list, e.g. ["Python","Django"]
    op.add_column("jobs", sa.Column("preferred_skills", sa.Text(), nullable=True))  # JSON list
    op.add_column("jobs", sa.Column("experience_required", sa.String(), nullable=True))  # free text, e.g. "3-5 years"
    op.add_column("jobs", sa.Column("work_arrangement", sa.String(), nullable=True))     # remote|hybrid|onsite
    op.add_column("jobs", sa.Column("employment_type", sa.String(), nullable=True))      # full_time|part_time|contract|internship
    op.add_column("jobs", sa.Column("salary_min", sa.Integer(), nullable=True))
    op.add_column("jobs", sa.Column("salary_max", sa.Integer(), nullable=True))
    op.add_column("jobs", sa.Column("salary_currency", sa.String(), nullable=True))
    op.add_column("jobs", sa.Column("application_deadline", sa.DateTime(timezone=True), nullable=True))
    op.add_column("jobs", sa.Column("openings", sa.Integer(), nullable=True))
    op.add_column("jobs", sa.Column("views_count", sa.Integer(), nullable=False, server_default="0"))
    op.add_column("jobs", sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("jobs", sa.Column("published_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("jobs", sa.Column("closed_at", sa.DateTime(timezone=True), nullable=True))

    op.create_index("ix_jobs_status", "jobs", ["status"])

    # Backfill: every job that predates this feature was implicitly "live"
    # (is_active True) or already soft-closed (is_active False) — map that
    # 1:1 onto the new status column instead of defaulting everything to
    # "published", so existing screening jobs keep their real state.
    op.execute("UPDATE jobs SET status = 'published' WHERE is_active = true")
    op.execute("UPDATE jobs SET status = 'closed' WHERE is_active = false")


def downgrade() -> None:
    op.drop_index("ix_jobs_status", table_name="jobs")
    op.drop_column("jobs", "closed_at")
    op.drop_column("jobs", "published_at")
    op.drop_column("jobs", "updated_at")
    op.drop_column("jobs", "views_count")
    op.drop_column("jobs", "openings")
    op.drop_column("jobs", "application_deadline")
    op.drop_column("jobs", "salary_currency")
    op.drop_column("jobs", "salary_max")
    op.drop_column("jobs", "salary_min")
    op.drop_column("jobs", "employment_type")
    op.drop_column("jobs", "work_arrangement")
    op.drop_column("jobs", "experience_required")
    op.drop_column("jobs", "preferred_skills")
    op.drop_column("jobs", "required_skills")
    op.drop_column("jobs", "responsibilities")
    op.drop_column("jobs", "status")