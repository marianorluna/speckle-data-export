"""add processed_commits for Speckle ingest idempotency

Revision ID: a1b2c3d4e5f6
Revises: 09fbee34b117
Create Date: 2026-08-06 19:30:00.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "a1b2c3d4e5f6"
down_revision: Union[str, Sequence[str], None] = "09fbee34b117"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "processed_commits",
        sa.Column("commit_id", sa.String(length=128), nullable=False),
        sa.Column("stream_id", sa.String(length=128), nullable=False),
        sa.Column(
            "processed_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("(CURRENT_TIMESTAMP)"),
            nullable=False,
        ),
        sa.Column("elements_count", sa.Integer(), nullable=False, server_default="0"),
        sa.PrimaryKeyConstraint("commit_id"),
    )
    with op.batch_alter_table("processed_commits", schema=None) as batch_op:
        batch_op.create_index(
            batch_op.f("ix_processed_commits_stream_id"),
            ["stream_id"],
            unique=False,
        )


def downgrade() -> None:
    with op.batch_alter_table("processed_commits", schema=None) as batch_op:
        batch_op.drop_index(batch_op.f("ix_processed_commits_stream_id"))
    op.drop_table("processed_commits")
