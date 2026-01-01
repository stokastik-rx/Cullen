"""
User data model
"""
from datetime import datetime
from typing import List, Optional, TYPE_CHECKING
from sqlalchemy import String, DateTime
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

from app.core.database import Base

if TYPE_CHECKING:
    from app.models.chat import ChatThread
    from app.models.roster import RosterState


class User(Base):
    """
    User SQLAlchemy model.
    Normalized relationships to threads and roster state.
    """
    
    __tablename__ = "users"
    
    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    username: Mapped[str] = mapped_column(String(50), unique=True, index=True, nullable=False)
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)
    subscription_tier: Mapped[str] = mapped_column(String(20), default="BASE", nullable=False)

    # Billing / plan fields (additive, migration-safe)
    # plan: "base" | "premium"
    plan: Mapped[str] = mapped_column(String(20), default="base", nullable=False, index=True)
    stripe_customer_id: Mapped[Optional[str]] = mapped_column(String(255), nullable=True, index=True)
    stripe_subscription_id: Mapped[Optional[str]] = mapped_column(String(255), nullable=True, index=True)
    # plan_status: "active" | "past_due" | "canceled"
    plan_status: Mapped[Optional[str]] = mapped_column(String(20), nullable=True, index=True)
    plan_renews_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
    
    # Relationship to chat threads
    chat_threads: Mapped[List["ChatThread"]] = relationship(
        "ChatThread", back_populates="user", cascade="all, delete-orphan"
    )

    # Relationship to roster state (one per user)
    roster_state: Mapped["RosterState"] = relationship(
        "RosterState",
        back_populates="user",
        cascade="all, delete-orphan",
        uselist=False,
    )
# (Resolved merge conflict: no extraneous code remains, as this was likely an accidental artifact.)
