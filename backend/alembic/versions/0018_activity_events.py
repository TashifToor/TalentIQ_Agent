"""add activity_events table (manual planner entries)

Revision ID: 0018_activity_events
Revises: 0017_notifications
Create Date: 2026-08-30

Manually-created planner entries ("Personal Plan"), separate from the
automatic activity feed which is derived at request time and never stored.
Per-user only, same isolation pattern as notifications — no organization_id.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "0018_activity_events"
down_revision: Union[str, None] = "0017_notifications"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "activity_events",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, index=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False, index=True),
        sa.Column("activity_type", sa.String(), nullable=False),
        sa.Column("title", sa.String(), nullable=False),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("event_date", sa.Date(), nullable=False, index=True),
        sa.Column("event_time", sa.Time(), nullable=True),
        sa.Column("company", sa.String(), nullable=True),
        sa.Column("role", sa.String(), nullable=True),
        sa.Column("location_or_link", sa.String(), nullable=True),
        sa.Column("status", sa.String(), nullable=False, server_default="planned"),
        sa.Column("reminder_offset_minutes", sa.Integer(), nullable=True),
        sa.Column("reminder_task_id", sa.String(), nullable=True),
        sa.Column("reminder_sent", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_activity_events_user_date", "activity_events", ["user_id", "event_date"])


def downgrade() -> None:
    op.drop_index("ix_activity_events_user_date", table_name="activity_events")
    op.drop_table("activity_events")