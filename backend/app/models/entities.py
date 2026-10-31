
from datetime import datetime, timezone

from sqlalchemy import (
    String, Integer, Boolean, DateTime, ForeignKey,
    ForeignKeyConstraint, UniqueConstraint, Index, JSON, Text
)
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


def utc_now():
    return datetime.now(timezone.utc)


class Organization(Base):
    __tablename__ = "organizations"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(150), nullable=False)
    slug: Mapped[str] = mapped_column(String(180), unique=True, index=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utc_now
    )


class Tenant(Base):
    __tablename__ = "tenants"
    __table_args__ = (
        UniqueConstraint("id", "organization_id"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    organization_id: Mapped[int] = mapped_column(
        ForeignKey("organizations.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    name: Mapped[str] = mapped_column(String(150), nullable=False)
    slug: Mapped[str] = mapped_column(String(180), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utc_now
    )


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    email: Mapped[str] = mapped_column(
        String(255), unique=True, index=True, nullable=False
    )
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utc_now
    )


class Membership(Base):
    __tablename__ = "memberships"
    __table_args__ = (
        ForeignKeyConstraint(
            ["tenant_id", "organization_id"],
            ["tenants.id", "tenants.organization_id"],
            ondelete="CASCADE",
        ),
        UniqueConstraint(
            "user_id", "organization_id", "tenant_id",
            name="uq_user_org_tenant_membership",
        ),
        Index("ix_membership_user_org", "user_id", "organization_id"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    organization_id: Mapped[int] = mapped_column(
        ForeignKey("organizations.id", ondelete="CASCADE"),
        nullable=False,
    )
    # NULL means organization-level membership.
    tenant_id: Mapped[int | None] = mapped_column(nullable=True)
    role: Mapped[str] = mapped_column(String(30), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utc_now
    )


class Board(Base):
    __tablename__ = "boards"
    __table_args__ = (
        UniqueConstraint("tenant_id", "id"),
        ForeignKeyConstraint(
            ["tenant_id", "organization_id"],
            ["tenants.id", "tenants.organization_id"],
            ondelete="CASCADE",
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    organization_id: Mapped[int] = mapped_column(nullable=False)
    tenant_id: Mapped[int] = mapped_column(nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(150), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_by: Mapped[int] = mapped_column(
        ForeignKey("users.id"), nullable=False
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utc_now
    )


class BoardColumn(Base):
    __tablename__ = "columns"
    __table_args__ = (
        UniqueConstraint("tenant_id", "board_id", "id"),
        ForeignKeyConstraint(
            ["tenant_id", "board_id"],
            ["boards.tenant_id", "boards.id"],
            ondelete="CASCADE",
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    tenant_id: Mapped[int] = mapped_column(nullable=False, index=True)
    board_id: Mapped[int] = mapped_column(nullable=False)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    position: Mapped[int] = mapped_column(Integer, default=1000)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utc_now
    )


class Task(Base):
    __tablename__ = "tasks"
    __table_args__ = (
        ForeignKeyConstraint(
            ["tenant_id", "board_id", "column_id"],
            ["columns.tenant_id", "columns.board_id", "columns.id"],
            ondelete="CASCADE",
        ),
        Index("ix_tasks_column_position", "tenant_id", "column_id", "position"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    tenant_id: Mapped[int] = mapped_column(nullable=False, index=True)
    board_id: Mapped[int] = mapped_column(nullable=False)
    column_id: Mapped[int] = mapped_column(nullable=False)

    title: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    priority: Mapped[str] = mapped_column(String(20), default="medium")
    position: Mapped[int] = mapped_column(Integer, default=1000)

    assigned_to: Mapped[int | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )

    version: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utc_now
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utc_now, onupdate=utc_now
    )


class ActivityLog(Base):
    __tablename__ = "activity_logs"
    __table_args__ = (
        Index("ix_activity_tenant_created", "tenant_id", "created_at"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    organization_id: Mapped[int] = mapped_column(nullable=False)
    tenant_id: Mapped[int] = mapped_column(nullable=False, index=True)
    actor_id: Mapped[int] = mapped_column(
        ForeignKey("users.id"), nullable=False
    )
    entity_type: Mapped[str] = mapped_column(String(50), nullable=False)
    entity_id: Mapped[int] = mapped_column(Integer, nullable=False)
    action: Mapped[str] = mapped_column(String(50), nullable=False)
    details: Mapped[dict] = mapped_column(JSON, default=dict)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utc_now
    )
