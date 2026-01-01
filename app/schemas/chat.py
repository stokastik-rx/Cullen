"""
Chat schemas for request/response validation
"""
from datetime import datetime
from typing import List, Optional, Literal
from pydantic import BaseModel, Field, ConfigDict


ChatRole = Literal["user", "assistant"]


# ---------------------------------------------------------------------------
# Legacy schemas (used by existing frontend + tests under /api/v1/chat/*)
# ---------------------------------------------------------------------------

class ChatMessage(BaseModel):
    """Single message (legacy response shape)."""
    role: ChatRole = Field(..., description="Message role: 'user' or 'assistant'")
    content: str = Field(..., min_length=1, description="Message content")
    image_url: Optional[str] = Field(None, description="Optional image URL attachment")


class ChatUpdate(BaseModel):
    """Legacy update payload for PUT /api/v1/chat/{id}."""
    title: Optional[str] = Field(None, min_length=1, max_length=255, description="Chat title")
    messages: Optional[List[ChatMessage]] = Field(None, description="Full message list")


class Chat(BaseModel):
    """Legacy chat object used by the UI."""
    id: int
    user_id: int
    title: str
    messages: List[ChatMessage]
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)

class ChatRequest(BaseModel):
    """Legacy request payload for POST /api/v1/chat/message."""
    message: str = Field(..., min_length=1, max_length=4000, description="User message")
    chat_id: Optional[int] = Field(None, description="Chat ID (optional)")

class ChatResponse(BaseModel):
    """Legacy response payload for message endpoints."""
    response: str = Field(..., description="Assistant response")
    thread_id: Optional[int] = Field(None, description="Thread ID (if new thread created)")


# ---------------------------------------------------------------------------
# Normalized schemas (used by /api/v1/chats/* and /api/conversations/*)
# ---------------------------------------------------------------------------

class ThreadMessageCreate(BaseModel):
    role: ChatRole = Field(..., description="Role of the message sender")
    content: str = Field(..., min_length=1, description="Content of the message")


class ThreadMessage(ThreadMessageCreate):
    id: int
    thread_id: int
    created_at: datetime
    image_url: Optional[str] = None
    image_mime_type: Optional[str] = None
    image_size_bytes: Optional[int] = None

    model_config = ConfigDict(from_attributes=True)

class ChatThreadCreate(BaseModel):
    title: Optional[str] = Field(None, max_length=255)


class ChatThreadUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=1, max_length=255)
    roster_card_id: Optional[str] = Field(
        None,
        min_length=1,
        max_length=80,
        description="Optional roster card id to associate this chat with",
    )


class ChatThread(BaseModel):
    id: int
    user_id: int
    title: Optional[str] = None
    roster_card_id: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)

class ChatThreadCreateResponse(BaseModel):
    """
    Response for POST /api/v1/chats.

    Includes both `id` and `chat_id` for compatibility with clients that expect either field.
    """

    id: int
    chat_id: int
    title: Optional[str] = None
    roster_card_id: Optional[str] = None
    created_at: datetime
    updated_at: datetime


class ChatThreadListItem(ChatThread):
    last_message_preview: Optional[str] = None


class ChatSendRequest(BaseModel):
    """Request payload for POST /api/v1/chats/send."""
    message: str = Field(..., min_length=1, max_length=4000)
    thread_id: Optional[int] = None


class ChatSendResponse(BaseModel):
    response: str
    thread_id: int


class ImageUploadResponse(BaseModel):
    image_url: str
    mime_type: str
    size_bytes: int
