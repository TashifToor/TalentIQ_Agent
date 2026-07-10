"""add cv_builds_used column for CV Builder free tier

Revision ID: 0002_cv_builds_used
Revises: 0001_baseline
Create Date: 2026-07-08

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "0002_cv_builds_used"
down_revision: Union[str, None] = "0001_baseline"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("users", sa.Column("cv_builds_used", sa.Integer(), nullable=True, server_default="0"))


def downgrade() -> None:
    op.drop_column("users", "cv_builds_used")