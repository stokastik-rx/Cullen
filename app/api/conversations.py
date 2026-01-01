"""
Conversation endpoints (ChatGPT-like persistence).

These endpoints intentionally live at `/api/conversations/*` (no /v1) per product requirement.
They are backed by the existing normalized chat tables (`chat_threads`, `chat_messages`).
"""

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.dependencies import get_current_active_user
from app.models.chat import ChatThread
from app.models.user import User
from app.schemas.conversation import (
    ConversationCreateResponse,
    ConversationMessageCreateResponse,
    ConversationMessageIn,
    ConversationMessageOut,
    ConversationMessagesOut,
    ConversationOut,
)
from app.services.chat_service import ChatService
from app.schemas.chat import ThreadMessageCreate

router = APIRouter()


def _get_conversation_or_404_403(
    service: ChatService,
    conversation_id: int,
    current_user: User,
    db: Session,
) -> ChatThread:
    """
    Conversation access rule:
    - 404 if conversation doesn't exist
    - 403 if it exists but belongs to a different user
    """
    conv = service.get_thread_any(conversation_id, db)
    if conv is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Conversation not found")
    if conv.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")
    return conv


@router.post("/conversations", response_model=ConversationCreateResponse, status_code=status.HTTP_201_CREATED)
async def create_conversation(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """
    Create a new conversation for the authenticated user.
    """
    service = ChatService()
    # Plan limits are enforced inside ChatService (raises HTTP 402 with required detail payload).
    conv = service.create_thread(current_user.id, db, title=None)
    return ConversationCreateResponse(conversation_id=conv.id)


@router.get("/conversations", response_model=list[ConversationOut], status_code=status.HTTP_200_OK)
async def list_conversations(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """
    List all user conversations, newest to oldest by updated_at.
    """
    service = ChatService()
    threads = service.get_user_threads(current_user.id, db)
    return [ConversationOut(id=t.id, title=t.title, updated_at=t.updated_at) for t in threads]


@router.post(
    "/conversations/{conversation_id}/messages",
    response_model=ConversationMessageCreateResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_message(
    conversation_id: int,
    body: ConversationMessageIn,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """
    Save a message to DB. If this is the FIRST user message, set conversation title.
    """
    service = ChatService()
    conv = _get_conversation_or_404_403(service, conversation_id, current_user, db)

    msg = service.add_message(
        conversation_id,
        current_user.id,
        ThreadMessageCreate(role=body.role, content=body.content),
        db,
    )

    if msg is None:
        # Should not happen once ownership was checked, but keep safe
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to save message")

    # Refresh conversation to get updated title after auto-title logic
    db.refresh(conv)

    out_msg = ConversationMessageOut(
        id=msg.id,
        conversation_id=msg.thread_id,
        role=msg.role,  # type: ignore[arg-type]
        content=msg.content,
        created_at=msg.created_at,
    )
    return ConversationMessageCreateResponse(message=out_msg, conversation_title=conv.title)


@router.get(
    "/conversations/{conversation_id}/messages",
    response_model=ConversationMessagesOut,
    status_code=status.HTTP_200_OK,
)
async def get_messages(
    conversation_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """
    Return all messages in order for a conversation.
    """
    service = ChatService()
    conv = _get_conversation_or_404_403(service, conversation_id, current_user, db)

    # Use relationship ordering for stable ordering
    messages = []
    for m in conv.messages or []:
        messages.append(
            ConversationMessageOut(
                id=m.id,
                conversation_id=m.thread_id,
                role=m.role,  # type: ignore[arg-type]
                content=m.content,
                created_at=m.created_at,
            )
        )

    return ConversationMessagesOut(messages=messages)


