"""
/api/chats endpoints (no /v1) for the frontend sidebar + real-time updates.

These are thin wrappers around the existing normalized persistence:
- ChatThread -> conversations/chats
- ChatMessage -> messages

We keep /api/v1/chat/* and /api/v1/chats/* for backwards compatibility.
"""

from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.dependencies import get_current_active_user
from app.core.uploads import save_chat_image_upload
from app.models.user import User
from app.schemas.chat import ThreadMessage, ThreadMessageCreate
from app.services.chat_service import ChatService

router = APIRouter()


@router.post("/chats", status_code=status.HTTP_201_CREATED)
async def create_chat(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """
    Create chat row immediately (empty until first message).

    Response includes both `chat_id` and `id` for client compatibility.
    """
    service = ChatService()
    # Plan limits are enforced inside ChatService (raises HTTP 402 with required detail payload).
    thread = service.create_thread(current_user.id, db, title=None)
    return {
        "chat_id": thread.id,
        "id": thread.id,
        "title": thread.title,
        "created_at": thread.created_at,
        "updated_at": thread.updated_at,
    }


@router.get("/chats", status_code=status.HTTP_200_OK)
async def list_chats(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """
    List chats ordered by updated_at desc.
    """
    service = ChatService()
    threads = service.get_user_threads(current_user.id, db)
    return [
        {
            "id": t.id,
            "chat_id": t.id,
            "title": (t.title or "New chat"),
            "created_at": t.created_at,
            "updated_at": t.updated_at,
        }
        for t in threads
    ]


@router.get("/chats/{chat_id}/messages", response_model=List[ThreadMessage], status_code=status.HTTP_200_OK)
async def get_chat_messages(
    chat_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    service = ChatService()
    thread = service.get_thread(chat_id, current_user.id, db)
    if thread is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Chat not found")
    return [ThreadMessage.model_validate(m) for m in (thread.messages or [])]


@router.post("/chats/{chat_id}/messages", status_code=status.HTTP_201_CREATED)
async def add_chat_message(
    chat_id: int,
    payload: ThreadMessageCreate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """
    Append a message row.

    If this is the first USER message, the title is set once by ChatService.
    """
    service = ChatService()
    msg = service.add_message(chat_id, current_user.id, payload, db)
    if msg is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Chat not found")

    # refresh thread to get updated title (if set by first user message)
    thread = service.get_thread(chat_id, current_user.id, db)
    return {
        "message": ThreadMessage.model_validate(msg),
        "chat_title": (thread.title if thread else None),
    }


@router.post("/chats/{chat_id}/messages/image", status_code=status.HTTP_201_CREATED)
async def add_chat_image_message(
    chat_id: int,
    file: UploadFile = File(...),
    content: Optional[str] = Form(None),
    role: str = Form("user"),
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """
    /api (no /v1) helper for the UI: attach an image as a message.

    multipart/form-data:
    - file: image/*
    - content: optional
    - role: user|assistant (defaults to user)
    """
    if role not in ("user", "assistant"):
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Invalid role")

    image_url, mime, size = save_chat_image_upload(file)

    service = ChatService()
    msg = service.add_image_message(
        chat_id,
        current_user.id,
        role=role,
        content=content or "",
        image_url=image_url,
        image_mime_type=mime,
        image_size_bytes=size,
        db=db,
    )
    if msg is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Chat not found")

    thread = service.get_thread(chat_id, current_user.id, db)
    return {
        "message": ThreadMessage.model_validate(msg),
        "chat_title": (thread.title if thread else None),
    }


