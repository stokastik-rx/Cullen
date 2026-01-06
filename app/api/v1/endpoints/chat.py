"""
Chat endpoints.

This module exposes:
- Legacy routes under `/api/v1/chat/*` (used by the existing frontend + tests)
- New normalized routes under `/api/v1/chats/*`
"""

from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form
from fastapi.responses import JSONResponse
import httpx
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.dependencies import get_current_active_user
from app.core.uploads import save_chat_image_upload
from app.models.user import User
from app.schemas.chat import (
    Chat,
    ChatMessage,
    ChatRequest,
    ChatResponse,
    ChatUpdate,
    ChatSendRequest,
    ChatSendResponse,
    ChatThread,
    ChatThreadCreate,
    ChatThreadCreateResponse,
    ChatThreadListItem,
    ChatThreadUpdate,
    ThreadMessage,
    ThreadMessageCreate,
)
from app.services.chat_service import ChatService
from app.services.llm_service import generate_assistant_reply

# Backwards-compatible router mounted at /api/v1/chat
router = APIRouter()
# New normalized router mounted at /api/v1/chats
chats_router = APIRouter()

GROK_API_URL = "http://127.0.0.1:8011/ask"
GROK_TOP_K = 8


async def _call_grok(user_message: str) -> str:
    """
    Call the local Grok bridge and return the assistant answer.

    Expected response JSON:
      { "answer": "<string>" }
    """
    payload = {"user_message": user_message, "top_k": GROK_TOP_K, "system_prompt": None}
    try:
        async with httpx.AsyncClient(timeout=45.0) as client:
            resp = await client.post(GROK_API_URL, json=payload)
        resp.raise_for_status()
        data = resp.json()
    except httpx.HTTPError as e:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Grok bridge request failed: {type(e).__name__}",
        )

    answer = data.get("answer") if isinstance(data, dict) else None
    if not isinstance(answer, str) or not answer.strip():
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Invalid Grok response",
        )
    return answer


# Backwards-compatible alias (older internal name)
async def _call_grok_api(user_message: str) -> str:
    return await _call_grok(user_message)


def _legacy_title_from_first_user_message(message: str, max_len: int = 50) -> str:
    """Match frontend behavior: truncate to 50 chars + '...'."""
    normalized = (message or "").replace("\r", " ").replace("\n", " ").strip()
    if len(normalized) > max_len:
        return normalized[:max_len] + "..."
    return normalized


def _legacy_chat_from_thread(thread) -> Chat:
    msgs = [ChatMessage(role=m.role, content=m.content) for m in (thread.messages or [])]
    title = thread.title or "New chat"
    return Chat(
        id=thread.id,
        user_id=thread.user_id,
        title=title,
        messages=msgs,
        created_at=thread.created_at,
        updated_at=thread.updated_at,
    )


def _get_thread_or_404(service: ChatService, thread_id: int, user_id: int, db: Session):
    """
    Legacy behavior: return 404 for missing OR cross-user access (do not leak existence).
    """
    thread = service.get_thread(thread_id, user_id, db)
    if thread is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Chat not found")
    return thread


# ---------------------------------------------------------------------------
# Legacy /api/v1/chat/* endpoints (do not break existing frontend)
# ---------------------------------------------------------------------------

@router.get("", response_model=List[Chat], status_code=status.HTTP_200_OK)
async def list_chats(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    service = ChatService()
    threads = service.get_user_threads(current_user.id, db)
    return [_legacy_chat_from_thread(t) for t in threads]


@router.post("", response_model=Chat, status_code=status.HTTP_201_CREATED)
async def create_chat(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    service = ChatService()
    # Store title as NULL; UI will show fallback "New chat" until first user message sets it.
    # Plan limits enforced inside ChatService (raises HTTP 402 detail payload).
    thread = service.create_thread(current_user.id, db, title=None)
    return _legacy_chat_from_thread(thread)


@router.get("/{chat_id}", response_model=Chat, status_code=status.HTTP_200_OK)
async def get_chat(
    chat_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    service = ChatService()
    thread = _get_thread_or_404(service, chat_id, current_user.id, db)
    return _legacy_chat_from_thread(thread)


@router.put("/{chat_id}", response_model=Chat, status_code=status.HTTP_200_OK)
async def update_chat(
    chat_id: int,
    chat_data: ChatUpdate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    service = ChatService()
    thread = _get_thread_or_404(service, chat_id, current_user.id, db)

    if chat_data.title is not None:
        thread.title = chat_data.title

    if chat_data.messages is not None:
        msgs = [ThreadMessageCreate(role=m.role, content=m.content) for m in chat_data.messages]
        replaced = service.replace_messages(chat_id, current_user.id, msgs, db)
        if replaced is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Chat not found")

    return _legacy_chat_from_thread(thread)


@router.delete("/{chat_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_chat(
    chat_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    service = ChatService()
    _get_thread_or_404(service, chat_id, current_user.id, db)
    service.delete_thread(chat_id, current_user.id, db)


@router.post("/message", response_model=ChatResponse, status_code=status.HTTP_200_OK)
async def send_message(
    request: ChatRequest,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """
    Existing frontend uses this endpoint to append a user message + assistant response.
    Auto-updates title from first user message if still "New chat".
    """
    service = ChatService()

    # Atomic: create thread + first user message together
    if request.chat_id is not None:
        thread = _get_thread_or_404(service, request.chat_id, current_user.id, db)
        service.add_message(thread.id, current_user.id, ThreadMessageCreate(role="user", content=request.message), db)
    else:
        thread, _ = service.create_thread_with_first_user_message(current_user.id, request.message, db)

    response_text = await generate_assistant_reply(
        thread_id=thread.id,
        user_id=current_user.id,
        user_message=request.message,
        db=db,
    )
    # If the user message was allowed as the 30th, the assistant message may exceed limits; ignore.
    try:
        service.add_message(thread.id, current_user.id, ThreadMessageCreate(role="assistant", content=response_text), db)
    except HTTPException as e:
        if e.status_code != status.HTTP_402_PAYMENT_REQUIRED:
            raise

    return ChatResponse(
        response=response_text,
        thread_id=thread.id if request.chat_id is None else None
    )


@router.post("/message/guest", response_model=ChatResponse, status_code=status.HTTP_200_OK)
async def send_guest_message(request: ChatRequest):
    """
    Guest message endpoint: no auth, not saved.
    """
    response_text = (
        f"I received your message: '{request.message}'. This is a placeholder response. "
        "Connect your local model to generate real responses. "
        "(Note: Guest messages are not saved. Please sign up to save your conversations.)"
    )
    return ChatResponse(response=response_text)


# ---------------------------------------------------------------------------
# New /api/v1/chats/* endpoints (normalized thread/message API)
# ---------------------------------------------------------------------------

@chats_router.get("", response_model=List[ChatThreadListItem], status_code=status.HTTP_200_OK)
async def list_threads(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
    roster_card_id: Optional[str] = None,
):
    service = ChatService()
    threads = service.get_user_threads(current_user.id, db, roster_card_id=roster_card_id)
    items: List[ChatThreadListItem] = []
    for t in threads:
        item = ChatThreadListItem.model_validate(t)
        item.last_message_preview = service.get_last_message_preview(t.id, db)
        items.append(item)
    return items


@chats_router.post("", response_model=ChatThreadCreateResponse, status_code=status.HTTP_201_CREATED)
async def create_thread(
    data: ChatThreadCreate | None = None,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    service = ChatService()
    thread = service.create_thread(current_user.id, db, title=(data.title if data else None))
    return ChatThreadCreateResponse(
        id=thread.id,
        chat_id=thread.id,
        title=thread.title,
        roster_card_id=getattr(thread, "roster_card_id", None),
        created_at=thread.created_at,
        updated_at=thread.updated_at,
    )


@chats_router.get("/{thread_id}", response_model=ChatThread, status_code=status.HTTP_200_OK)
async def get_thread(
    thread_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    service = ChatService()
    thread = service.get_thread(thread_id, current_user.id, db)
    if thread is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Thread not found")
    return thread


@chats_router.get("/{thread_id}/messages", response_model=List[ThreadMessage], status_code=status.HTTP_200_OK)
async def get_thread_messages(
    thread_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    service = ChatService()
    thread = service.get_thread(thread_id, current_user.id, db)
    if thread is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Thread not found")
    return [ThreadMessage.model_validate(m) for m in (thread.messages or [])]


@chats_router.post("/{thread_id}/messages", response_model=ThreadMessage, status_code=status.HTTP_201_CREATED)
async def add_message(
    thread_id: int,
    message: ThreadMessageCreate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    service = ChatService()
    msg = service.add_message(thread_id, current_user.id, message, db)
    if msg is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Thread not found")
    return ThreadMessage.model_validate(msg)


@chats_router.post(
    "/{thread_id}/messages/image",
    response_model=ThreadMessage,
    status_code=status.HTTP_201_CREATED,
)
async def add_image_message(
    thread_id: int,
    file: UploadFile = File(...),
    content: Optional[str] = Form(None),
    role: str = Form("user"),
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """
    Add an image attachment as a message.

    Accepts multipart/form-data:
    - file: image/*
    - content: optional text content
    - role: user|assistant (defaults to user)
    """
    if role not in ("user", "assistant"):
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Invalid role")

    image_url, mime, size = save_chat_image_upload(file)

    service = ChatService()
    msg = service.add_image_message(
        thread_id,
        current_user.id,
        role=role,
        content=content or "",
        image_url=image_url,
        image_mime_type=mime,
        image_size_bytes=size,
        db=db,
    )
    if msg is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Thread not found")
    return ThreadMessage.model_validate(msg)


@chats_router.patch("/{thread_id}", response_model=ChatThread, status_code=status.HTTP_200_OK)
async def rename_thread(
    thread_id: int,
    data: ChatThreadUpdate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    service = ChatService()
    try:
        thread = service.update_thread(thread_id, current_user.id, data, db)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    if thread is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Thread not found")
    return thread


@chats_router.post("/send", response_model=ChatSendResponse, status_code=status.HTTP_200_OK)
async def chat_send(
    request: ChatSendRequest,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    service = ChatService()

    thread_id: Optional[int] = request.thread_id
    if thread_id is None:
        # Atomic: create thread + first user message together
        thread, _ = service.create_thread_with_first_user_message(current_user.id, request.message, db)
        thread_id = thread.id
    else:
        # Add user message
        service.add_message(thread_id, current_user.id, ThreadMessageCreate(role="user", content=request.message), db)
    
    assistant_content = await generate_assistant_reply(
        thread_id=thread_id,
        user_id=current_user.id,
        user_message=request.message,
        db=db,
    )
    try:
        service.add_message(
            thread_id, current_user.id, ThreadMessageCreate(role="assistant", content=assistant_content), db
        )
    except HTTPException as e:
        if e.status_code != status.HTTP_402_PAYMENT_REQUIRED:
            raise

    return ChatSendResponse(response=assistant_content, thread_id=thread_id)


@chats_router.delete("/{thread_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_thread(
    thread_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    service = ChatService()
    deleted = service.delete_thread(thread_id, current_user.id, db)
    if not deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Thread not found")
