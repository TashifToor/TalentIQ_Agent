"""add notifications table

Revision ID: 0017_notifications
Revises: 0016_application_decision
Create Date: 2026-08-22

A notification always belongs to exactly one user (never a team/org), so
there is no organization_id here — isolation is enforced by every query
filtering on user_id == the authenticated user, same as everywhere else in
this codebase filters ownership. related_id/related_type/action_url are all
nullable since not every notification type has (or needs) a click-through
target.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "0017_notifications"
down_revision: Union[str, None] = "0016_application_decision"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "notifications",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, index=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False, index=True),
        sa.Column("type", sa.String(), nullable=False),
        sa.Column("title", sa.String(), nullable=False),
        sa.Column("message", sa.Text(), nullable=False),
        sa.Column("is_read", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("related_id", sa.String(), nullable=True),
        sa.Column("related_type", sa.String(), nullable=True),
        sa.Column("action_url", sa.String(), nullable=True),
    )
    op.create_index("ix_notifications_user_created", "notifications", ["user_id", "created_at"])
    op.create_index("ix_notifications_user_unread", "notifications", ["user_id", "is_read"])


def downgrade() -> None:
    op.drop_index("ix_notifications_user_unread", table_name="notifications")
    op.drop_index("ix_notifications_user_created", table_name="notifications")
    op.drop_table("notifications")