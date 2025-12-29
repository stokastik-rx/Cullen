"""
Chat endpoints
"""
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.models.user import User
from app.schemas.chat import Chat, ChatCreate, ChatUpdate, ChatMessage
from app.services.chat_service import ChatService

router = APIRouter()


class ChatRequest(BaseModel):
    """Chat message request schema"""
    message: str = Field(..., min_length=1, max_length=4000, description="User message")
    chat_id: int = Field(None, description="Chat ID (optional, creates new chat if not provided)")


class ChatResponse(BaseModel):
    """Chat response schema"""
    response: str = Field(..., description="Assistant response")


@router.get("", response_model=List[Chat], status_code=status.HTTP_200_OK)
async def list_chats(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Get all chats for the current user
    """
    chat_service = ChatService()
    chats = chat_service.get_user_chats(current_user.id, db)
    return chats


@router.get("/{chat_id}", response_model=Chat, status_code=status.HTTP_200_OK)
async def get_chat(
    chat_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Get a specific chat by ID
    """
    chat_service = ChatService()
    chat = chat_service.get_chat(chat_id, current_user.id, db)
    
    if chat is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Chat not found",
        )
    
    return chat


@router.post("", response_model=Chat, status_code=status.HTTP_201_CREATED)
async def create_chat(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Create a new chat for the current user
    """
    chat_service = ChatService()
    chat = chat_service.create_chat(current_user.id, db)
    return chat


@router.put("/{chat_id}", response_model=Chat, status_code=status.HTTP_200_OK)
async def update_chat(
    chat_id: int,
    chat_data: ChatUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Update a chat (title and/or messages)
    """
    chat_service = ChatService()
    chat = chat_service.update_chat(chat_id, current_user.id, chat_data, db)
    
    if chat is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Chat not found",
        )
    
    return chat


@router.delete("/{chat_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_chat(
    chat_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Delete a chat
    """
    chat_service = ChatService()
    deleted = chat_service.delete_chat(chat_id, current_user.id, db)
    
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Chat not found",
        )


@router.post("/message", response_model=ChatResponse, status_code=status.HTTP_200_OK)
async def send_message(
    request: ChatRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Process a chat message and update the chat (requires authentication).
    
    This is a placeholder endpoint. You can connect your local model here.
    """
    chat_service = ChatService()
    
    # Get or create chat
    if request.chat_id:
        chat = chat_service.get_chat(request.chat_id, current_user.id, db)
        if chat is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Chat not found",
            )
    else:
        chat = chat_service.create_chat(current_user.id, db)
    
    # Add user message
    messages = chat.messages if chat.messages else []
    messages.append(ChatMessage(role="user", content=request.message).model_dump())
    
    # Generate assistant response (placeholder)
    response_text = f"I received your message: '{request.message}'. This is a placeholder response. Connect your local model to generate real responses."
    messages.append(ChatMessage(role="assistant", content=response_text).model_dump())
    
    # Update chat title from first user message if it's still "New chat"
    if chat.title == "New chat" and messages:
        first_user_msg = next((msg for msg in messages if msg.get("role") == "user"), None)
        if first_user_msg:
            title = first_user_msg.get("content", "New chat")[:50]
            chat.title = title + ("..." if len(first_user_msg.get("content", "")) > 50 else "")
    
    # Update chat with new messages
    chat_update = ChatUpdate(messages=[ChatMessage(**msg) for msg in messages])
    updated_chat = chat_service.update_chat(chat.id, current_user.id, chat_update, db)
    
    return ChatResponse(response=response_text)


@router.post("/message/guest", response_model=ChatResponse, status_code=status.HTTP_200_OK)
async def send_guest_message(
    request: ChatRequest,
):
    """
    Process a chat message for guest users (no authentication required, messages not saved).
    
    This is a placeholder endpoint. You can connect your local model here.
    """
    # Generate assistant response (placeholder)
    # Note: Guest messages are not saved to the database
    response_text = f"I received your message: '{request.message}'. This is a placeholder response. Connect your local model to generate real responses. (Note: Guest messages are not saved. Please sign up to save your conversations.)"
    
    return ChatResponse(response=response_text)

