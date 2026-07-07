"""baseline — marks existing DB schema as the Alembic starting point

This migration is intentionally a no-op. The database already has all
current tables/columns (created previously via Base.metadata.create_all()
and a few manual ALTER TABLE statements). Instead of re-creating anything,
run `alembic stamp head` once to tell Alembic "the DB is already at this
revision" — from that point on, all NEW schema changes go through
`alembic revision --autogenerate` + `alembic upgrade head` instead of
manual ALTER TABLE / create_all.

Revision ID: 0001_baseline
Revises:
Create Date: 2026-07-08

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "0001_baseline"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass  # schema already exists — see docstring above


def downgrade() -> None:
    pass