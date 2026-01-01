"""
Conversation/message schemas for the /api/conversations endpoints.
"""

from datetime import datetime
from typing import List, Literal, Optional

from pydantic import BaseModel, Field, ConfigDict

ConversationRole = Literal["user", "assistant"]


class ConversationCreateResponse(BaseModel):
    """Response for POST /api/conversations."""

    conversation_id: int


class ConversationOut(BaseModel):
    """Conversation list item."""

    id: int
    title: Optional[str] = None
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ConversationMessageIn(BaseModel):
    """Body for POST /api/conversations/{conversation_id}/messages."""

    role: ConversationRole
    content: str = Field(..., min_length=1)


class ConversationMessageOut(BaseModel):
    """Stored message response."""

    id: int
    conversation_id: int
    role: ConversationRole
    content: str
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ConversationMessageCreateResponse(BaseModel):
    """Response for POST message: includes updated title."""

    message: ConversationMessageOut
    conversation_title: Optional[str] = None


class ConversationMessagesOut(BaseModel):
    """Wrapper for GET messages."""

    messages: List[ConversationMessageOut]


