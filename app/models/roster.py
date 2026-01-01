"""
Roster persistence models (per-user roster cards)
"""

from datetime import datetime
from typing import Any, Dict, List

from sqlalchemy import DateTime, ForeignKey, JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

from app.core.database import Base


class RosterState(Base):
    """
    Stores a user's roster cards as a JSON list.

    We use a single row per user to keep the frontend simple (GET/PUT full list).
    """

    __tablename__ = "roster_states"

    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), primary_key=True)
    cards: Mapped[List[Dict[str, Any]]] = mapped_column(JSON, nullable=False, default=list)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    user: Mapped["User"] = relationship("User", back_populates="roster_state")


