"""SQLAlchemy 2.0 ORM models mapped to domain entities."""

from __future__ import annotations

from datetime import datetime

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Integer, String, Text, func
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


class Base(DeclarativeBase):
    """Declarative base for all ORM models."""


class BimElementModel(Base):
    """Persisted BIM element keyed by Revit UniqueId (`element_id`)."""

    __tablename__ = "bim_elements"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    element_id: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    category: Mapped[str] = mapped_column(String(128), index=True)
    family: Mapped[str | None] = mapped_column(String(255), nullable=True)
    type_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    level: Mapped[str | None] = mapped_column(String(128), nullable=True, index=True)
    parameters: Mapped[str] = mapped_column(Text, default="{}")
    volume: Mapped[float | None] = mapped_column(Float, nullable=True)
    area: Mapped[float | None] = mapped_column(Float, nullable=True)
    length: Mapped[float | None] = mapped_column(Float, nullable=True)
    source: Mapped[str] = mapped_column(String(32), default="speckle")
    commit_id: Mapped[str | None] = mapped_column(String(128), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
    )


class ParameterSnapshotModel(Base):
    """Historical parameter snapshot linked to a Speckle commit."""

    __tablename__ = "parameter_snapshots"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    element_id: Mapped[str] = mapped_column(
        String(255),
        ForeignKey("bim_elements.element_id"),
        index=True,
    )
    commit_id: Mapped[str] = mapped_column(String(128))
    parameters: Mapped[str] = mapped_column(Text, default="{}")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
    )


class QcFindingModel(Base):
    """Quality-control finding for a BIM element."""

    __tablename__ = "qc_findings"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    element_id: Mapped[str] = mapped_column(
        String(255),
        ForeignKey("bim_elements.element_id"),
        index=True,
    )
    rule: Mapped[str] = mapped_column(String(128))
    severity: Mapped[str] = mapped_column(String(32))
    message: Mapped[str] = mapped_column(Text)
    resolved: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
    )


class UserModel(Base):
    """Application user row for JWT authentication (admin | guest)."""

    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(255))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    role: Mapped[str] = mapped_column(String(32), default="admin")


class ProcessedCommitModel(Base):
    """Speckle commits already ingested (polling / ingest idempotency)."""

    __tablename__ = "processed_commits"

    commit_id: Mapped[str] = mapped_column(String(128), primary_key=True)
    stream_id: Mapped[str] = mapped_column(String(128), index=True)
    processed_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
    )
    elements_count: Mapped[int] = mapped_column(Integer, default=0)
