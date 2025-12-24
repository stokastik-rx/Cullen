"""
Chat schemas for request/response validation
"""
from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, Field


class ChatMessage(BaseModel):
    """Schema for a single chat message"""
    role: str = Field(..., description="Message role: 'user' or 'assistant'")
    content: str = Field(..., description="Message content")


class ChatBase(BaseModel):
    """Base chat schema with common fields"""
    title: str = Field(..., min_length=1, max_length=255, description="Chat title")


class ChatCreate(ChatBase):
    """Schema for creating a new chat"""
    pass


class ChatUpdate(BaseModel):
    """Schema for updating a chat"""
    title: Optional[str] = Field(None, min_length=1, max_length=255, description="Chat title")
    messages: Optional[List[ChatMessage]] = Field(None, description="List of messages")


class Chat(ChatBase):
    """Schema for chat response"""
    id: int
    user_id: int
    messages: List[ChatMessage]
    created_at: datetime
    updated_at: datetime
    
    model_config = {"from_attributes": True}


class ChatList(BaseModel):
    """Schema for list of chats"""
    chats: List[Chat]

