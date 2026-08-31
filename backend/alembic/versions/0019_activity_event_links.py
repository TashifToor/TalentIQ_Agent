"""add related_type/related_id to activity_events (entity linking)

Revision ID: 0019_activity_event_links
Revises: 0018_activity_events
Create Date: 2026-08-31

Lets a manually-created planner event optionally point at a real existing
Application or Job (candidate: their own Application; HR: their org-scoped
Job or Application), same loose related_id/related_type convention already
used by Notification. Nullable/additive — existing rows are unaffected.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "0019_activity_event_links"
down_revision: Union[str, None] = "0018_activity_events"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("activity_events", sa.Column("related_type", sa.String(), nullable=True))
    op.add_column("activity_events", sa.Column("related_id", sa.String(), nullable=True))


def downgrade() -> None:
    op.drop_column("activity_events", "related_id")
    op.drop_column("activity_events", "related_type")