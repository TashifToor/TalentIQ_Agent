"""add decision + notification tracking to applications (Decision Center)

Revision ID: 0016_application_decision
Revises: 0015_application_invited_posting
Create Date: 2026-08-19

Decision and notification are deliberately separate concerns: a decision
(accept/reject) can be correctly recorded even if the email announcing it
fails to send, and the UI must be able to show "Rejected — Notification
Failed, Retry" without ever implying the decision itself is in doubt.

notification_subject/notification_body persist exactly what was actually
sent (or the last edited draft before sending), so a HR user reviewing a
past decision sees the real email, never a regenerated approximation.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "0016_application_decision"
down_revision: Union[str, None] = "0015_application_invited_posting"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("applications", sa.Column("decision", sa.String(), nullable=False, server_default="pending"))
    op.add_column("applications", sa.Column("decision_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("applications", sa.Column("notification_status", sa.String(), nullable=False, server_default="not_sent"))
    op.add_column("applications", sa.Column("notification_sent_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("applications", sa.Column("notification_subject", sa.Text(), nullable=True))
    op.add_column("applications", sa.Column("notification_body", sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column("applications", "notification_body")
    op.drop_column("applications", "notification_subject")
    op.drop_column("applications", "notification_sent_at")
    op.drop_column("applications", "notification_status")
    op.drop_column("applications", "decision_at")
    op.drop_column("applications", "decision")