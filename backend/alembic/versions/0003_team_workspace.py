"""add organizations table + team workspace fields on users

Revision ID: 0003_team_workspace
Revises: 0002_cv_builds_used
Create Date: 2026-07-09

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "0003_team_workspace"
down_revision: Union[str, None] = "0002_cv_builds_used"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "organizations",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("name", sa.String(), nullable=False),
        sa.Column("owner_user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("max_seats", sa.Integer(), server_default="5"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.add_column("users", sa.Column("organization_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("organizations.id"), nullable=True))
    op.add_column("users", sa.Column("is_org_owner", sa.Boolean(), nullable=True, server_default="false"))


def downgrade() -> None:
    op.drop_column("users", "is_org_owner")
    op.drop_column("users", "organization_id")
    op.drop_table("organizations")