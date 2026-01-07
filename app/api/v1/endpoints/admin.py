"""
Admin endpoints.

These endpoints are protected by `require_admin` and allow viewing user + chat data.
They must never expose hashed passwords or tokens.
"""

from typing import List

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.core.admin import require_admin
from app.core.database import get_db
from app.models.user import User
from app.models.chat import ChatThread, ChatMessage
from app.schemas.admin import AdminUser, AdminThread, AdminMessage, AdminThreadDetail

router = APIRouter()


@router.get("/users", response_model=List[AdminUser], status_code=status.HTTP_200_OK)
async def list_users(
    _admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
    limit: int = Query(200, ge=1, le=1000),
    offset: int = Query(0, ge=0),
):
    users = (
        db.query(User)
        .order_by(User.id.asc())
        .offset(offset)
        .limit(limit)
        .all()
    )
    return users


@router.get("/users/{user_id}", response_model=AdminUser, status_code=status.HTTP_200_OK)
async def get_user(
    user_id: int,
    _admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    user = db.query(User).filter(User.id == user_id).first()
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    return user


@router.get("/users/{user_id}/threads", response_model=List[AdminThread], status_code=status.HTTP_200_OK)
async def list_user_threads(
    user_id: int,
    _admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
    limit: int = Query(200, ge=1, le=1000),
    offset: int = Query(0, ge=0),
):
    # Verify user exists
    if db.query(User.id).filter(User.id == user_id).first() is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    threads = (
        db.query(ChatThread)
        .filter(ChatThread.user_id == user_id)
        .order_by(ChatThread.updated_at.desc())
        .offset(offset)
        .limit(limit)
        .all()
    )

    results: List[AdminThread] = []
    for t in threads:
        msg_count = db.query(ChatMessage.id).filter(ChatMessage.thread_id == t.id).count()
        results.append(
            AdminThread(
                id=t.id,
                user_id=t.user_id,
                title=t.title,
                roster_card_id=getattr(t, "roster_card_id", None),
                created_at=t.created_at,
                updated_at=t.updated_at,
                message_count=msg_count,
            )
        )
    return results


@router.get("/threads/{thread_id}", response_model=AdminThreadDetail, status_code=status.HTTP_200_OK)
async def get_thread_detail(
    thread_id: int,
    _admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
    limit: int = Query(500, ge=1, le=5000),
    offset: int = Query(0, ge=0),
):
    thread = db.query(ChatThread).filter(ChatThread.id == thread_id).first()
    if thread is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Thread not found")

    messages = (
        db.query(ChatMessage)
        .filter(ChatMessage.thread_id == thread_id)
        .order_by(ChatMessage.created_at.asc())
        .offset(offset)
        .limit(limit)
        .all()
    )

    msg_count = db.query(ChatMessage.id).filter(ChatMessage.thread_id == thread_id).count()
    thread_view = AdminThread(
        id=thread.id,
        user_id=thread.user_id,
        title=thread.title,
        roster_card_id=getattr(thread, "roster_card_id", None),
        created_at=thread.created_at,
        updated_at=thread.updated_at,
        message_count=msg_count,
    )
    return AdminThreadDetail(
        thread=thread_view,
        messages=[AdminMessage.model_validate(m) for m in messages],
    )


