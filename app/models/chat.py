"""
Chat data models for thread persistence
"""
from datetime import datetime
from typing import List, Optional, TYPE_CHECKING
from sqlalchemy import String, DateTime, ForeignKey, Text, Index, Integer
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

from app.core.database import Base

if TYPE_CHECKING:
    from app.models.user import User


class ChatThread(Base):
    """
    ChatThread model representing a conversation sidebar entry.
    Sorted by updated_at for most recent activity.
    """
    __tablename__ = "chat_threads"
    __table_args__ = (
        # Fast filtering per-user per-roster card, plus recent ordering.
        Index("ix_chat_threads_user_roster_updated", "user_id", "roster_card_id", "updated_at"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    title: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    roster_card_id: Mapped[Optional[str]] = mapped_column(String(80), nullable=True, index=True)
    
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), index=True, nullable=False
    )

    # Relationships
    user: Mapped["User"] = relationship("User", back_populates="chat_threads")
    messages: Mapped[List["ChatMessage"]] = relationship(
        "ChatMessage", back_populates="thread", cascade="all, delete-orphan", order_by="ChatMessage.created_at"
    )


class ChatMessage(Base):
    """
    Individual message within a thread.
    """
    __tablename__ = "chat_messages"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    thread_id: Mapped[int] = mapped_column(ForeignKey("chat_threads.id"), nullable=False, index=True)
    role: Mapped[str] = mapped_column(String(20), nullable=False)  # 'user' or 'assistant'
    content: Mapped[str] = mapped_column(Text, nullable=False)

    # Optional image attachment support (additive; safe for existing clients)
    image_url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    image_mime_type: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    image_size_bytes: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    # Relationships
    thread: Mapped["ChatThread"] = relationship("ChatThread", back_populates="messages")
