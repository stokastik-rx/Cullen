"""
Chat service - business logic for thread and message operations
"""
from typing import List, Optional, Tuple
import re
from sqlalchemy.orm import Session
from sqlalchemy import desc, func

from app.models.chat import ChatThread, ChatMessage
from app.models.user import User
from app.schemas.chat import ChatThreadUpdate, ThreadMessageCreate
from app.core.config import settings
from app.services.plan_limits import get_limits_for_plan, raise_plan_limit


class ChatLimitError(Exception):
    """Raised when a BASE user hits the maximum allowed chat threads."""


class MessageLimitError(Exception):
    """Raised when a chat thread hits the maximum allowed messages."""


class ChatService:
    """Service for chat operations with normalized table structure"""

    @staticmethod
    def _effective_plan(user: User) -> str:
        """
        Determine effective plan for enforcement.

        Premium is granted ONLY when:
        - user.plan == "premium" AND
        - user.plan_status is active-ish (active/past_due/trialing)

        Everything else is treated as base to avoid accidental unlimited access.
        """
        plan = (getattr(user, "plan", None) or "base").strip().lower()
        status = (getattr(user, "plan_status", None) or "").strip().lower()

        if plan == "premium" and status in ("active", "past_due", "trialing"):
            return "premium"
        # Back-compat: allow premium only if legacy tier is PREMIUM AND a subscription id exists.
        legacy_tier = (getattr(user, "subscription_tier", "") or "").strip().upper()
        if legacy_tier == "PREMIUM" and getattr(user, "stripe_subscription_id", None):
            return "premium"
        return "base"

    @staticmethod
    def _title_from_first_user_message(message: str, max_len: int = 40) -> str:
        """
        Create a title from the first user message.
        Rules:
        - Trim and collapse whitespace
        - Truncate to ~max_len characters (adds '...' if truncated)
        - If empty after normalization -> 'New Chat'
        """
        normalized = re.sub(r"\s+", " ", (message or "")).strip()
        if not normalized:
            return "New Chat"
        if len(normalized) > max_len:
            return normalized[:max_len] + "..."
        return normalized

    @staticmethod
    def _is_title_set(title: Optional[str]) -> bool:
        """True if a title is meaningfully set (non-empty)."""
        return bool((title or "").strip())

    def get_user_threads(self, user_id: int, db: Session, roster_card_id: Optional[str] = None) -> List[ChatThread]:
        """
        Get all chat threads for a user, sorted by most recent activity.
        """
        q = db.query(ChatThread).filter(ChatThread.user_id == user_id)
        if roster_card_id is not None:
            q = q.filter(ChatThread.roster_card_id == roster_card_id)
        return q.order_by(desc(ChatThread.updated_at)).all()

    def get_thread(self, thread_id: int, user_id: int, db: Session) -> Optional[ChatThread]:
        """
        Get a specific thread by ID with ownership check.
        """
        return db.query(ChatThread).filter(
            ChatThread.id == thread_id, 
            ChatThread.user_id == user_id
        ).first()

    def get_thread_any(self, thread_id: int, db: Session) -> Optional[ChatThread]:
        """Get a thread without ownership filter (for 403 vs 404 decisions)."""
        return db.query(ChatThread).filter(ChatThread.id == thread_id).first()

    def create_thread(self, user_id: int, db: Session, title: Optional[str] = None) -> ChatThread:
        """
        Create a new empty chat thread.
        """
        # Enforce plan limits server-side (BASE max chats)
        user = db.query(User).filter(User.id == user_id).first()
        if not user:
            raise ValueError("User not found")

        plan = self._effective_plan(user)
        limits = get_limits_for_plan(plan)
        if limits.max_threads is not None:
            count = db.query(ChatThread).filter(ChatThread.user_id == user_id).count()
            if count >= limits.max_threads:
                raise_plan_limit(
                    "PLAN_MAX_CHATS",
                    "Base plan allows only 5 chats. Upgrade for unlimited.",
                    {"max_chats": limits.max_threads},
                )

        db_thread = ChatThread(user_id=user_id, title=title)
        db.add(db_thread)
        db.commit()
        db.refresh(db_thread)
        return db_thread

    def create_thread_with_first_user_message(
        self,
        user_id: int,
        first_user_message: str,
        db: Session,
    ) -> Tuple[ChatThread, ChatMessage]:
        """
        Atomically create a thread and insert its first USER message.
        Title is derived from that first user message.
        """
        # Enforce plan limits server-side (BASE max chats) before opening transaction
        user = db.query(User).filter(User.id == user_id).first()
        if not user:
            raise ValueError("User not found")

        plan = self._effective_plan(user)
        limits = get_limits_for_plan(plan)
        if limits.max_threads is not None:
            count = db.query(ChatThread).filter(ChatThread.user_id == user_id).count()
            if count >= limits.max_threads:
                raise_plan_limit(
                    "PLAN_MAX_CHATS",
                    "Base plan allows only 5 chats. Upgrade for unlimited.",
                    {"max_chats": limits.max_threads},
                )

        with db.begin():
            thread = ChatThread(user_id=user_id, title=None)
            db.add(thread)
            db.flush()  # get thread.id

            # Set title exactly once from the first user message
            thread.title = self._title_from_first_user_message(first_user_message)
            thread.updated_at = func.now()

            msg = ChatMessage(thread_id=thread.id, role="user", content=first_user_message)
            db.add(msg)
            db.flush()  # get msg.id

        # Refresh outside transaction block for return
        db.refresh(thread)
        db.refresh(msg)
        return thread, msg

    def get_context_messages(self, thread_id: int, user_id: int, db: Session) -> List[ChatMessage]:
        """
        Get messages to use as model context.

        - BASE: returns only the most recent N messages (settings.BASE_CONTEXT_MAX_MESSAGES)
        - PREMIUM: returns full context

        This does NOT affect message persistence or message-list endpoints.
        """
        user = db.query(User).filter(User.id == user_id).first()
        plan = self._effective_plan(user) if user else "base"

        q = (
            db.query(ChatMessage)
            .filter(ChatMessage.thread_id == thread_id)
            .order_by(ChatMessage.created_at.asc())
        )
        msgs = q.all()
        if plan == "base" and len(msgs) > settings.BASE_CONTEXT_MAX_MESSAGES:
            return msgs[-settings.BASE_CONTEXT_MAX_MESSAGES :]
        return msgs

    def update_thread(self, thread_id: int, user_id: int, data: ChatThreadUpdate, db: Session) -> Optional[ChatThread]:
        """
        Update thread metadata (title and/or roster_card_id).
        """
        db_thread = self.get_thread(thread_id, user_id, db)
        if not db_thread:
            return None

        # Only update fields explicitly provided (PATCH semantics)
        if "title" in data.model_fields_set:
            db_thread.title = data.title

        if "roster_card_id" in data.model_fields_set:
            rcid = (data.roster_card_id or "").strip() if data.roster_card_id is not None else None
            # Empty string means clear association
            if rcid == "":
                rcid = None

            if rcid is not None:
                # Ownership enforcement: roster_card_id must belong to this user.
                # Roster cards are stored in RosterState.cards as a JSON list.
                from app.models.roster import RosterState

                state = db.query(RosterState).filter(RosterState.user_id == user_id).first()
                cards = (state.cards if state is not None else []) or []
                if not any(isinstance(c, dict) and c.get("id") == rcid for c in cards):
                    raise ValueError("Invalid roster_card_id for this user")

            db_thread.roster_card_id = rcid

        db.commit()
        db.refresh(db_thread)
        return db_thread

    def delete_thread(self, thread_id: int, user_id: int, db: Session) -> bool:
        """
        Delete a thread and all its messages.
        """
        db_thread = self.get_thread(thread_id, user_id, db)
        if not db_thread:
            return False
        
        db.delete(db_thread)
        db.commit()
        return True

    def get_thread_messages(self, thread_id: int, user_id: int, db: Session) -> List[ChatMessage]:
        """
        Get all messages for a thread after verifying ownership.
        """
        db_thread = self.get_thread(thread_id, user_id, db)
        if not db_thread:
            return []
        return db_thread.messages

    def add_message(self, thread_id: int, user_id: int, msg_data: ThreadMessageCreate, db: Session) -> Optional[ChatMessage]:
        """
        Add a message to a thread, updating the thread's timestamp and potentially its title.
        Enforces BASE plan max messages per thread (counting user+assistant; ignoring system).
        """
        db_thread = self.get_thread(thread_id, user_id, db)
        if not db_thread:
            return None

        # Enforce message limit (base only)
        user = db.query(User).filter(User.id == user_id).first()
        if not user:
            raise ValueError("User not found")
        plan = self._effective_plan(user)
        limits = get_limits_for_plan(plan)
        if limits.max_messages_per_thread is not None:
            message_count = (
                db.query(ChatMessage)
                .filter(
                    ChatMessage.thread_id == thread_id,
                    ChatMessage.role.in_(["user", "assistant"]),
                )
                .count()
            )
            if message_count >= limits.max_messages_per_thread:
                raise_plan_limit(
                    "PLAN_MAX_MESSAGES",
                    "Base plan allows only 30 messages per chat. Upgrade for unlimited.",
                    {"max_messages": limits.max_messages_per_thread, "thread_id": str(thread_id)},
                )

        # Title rules:
        # - Only USER messages can set a title
        # - Only if title is currently None (never set)
        # - Only if this is the FIRST user message
        if msg_data.role == "user" and db_thread.title is None:
            first_user_msg = (
                db.query(ChatMessage)
                .filter(ChatMessage.thread_id == thread_id, ChatMessage.role == "user")
                .order_by(ChatMessage.id.asc())
                .first()
            )
            if first_user_msg is None:
                db_thread.title = self._title_from_first_user_message(msg_data.content)

        db_message = ChatMessage(
            thread_id=thread_id,
            role=msg_data.role,
            content=msg_data.content
        )
        db.add(db_message)
        
        # Update thread's updated_at timestamp
        db_thread.updated_at = func.now()
        
        db.commit()
        db.refresh(db_message)
        return db_message

    def add_image_message(
        self,
        thread_id: int,
        user_id: int,
        *,
        role: str,
        content: str,
        image_url: str,
        image_mime_type: str,
        image_size_bytes: int,
        db: Session,
    ) -> Optional[ChatMessage]:
        """
        Add a message with an image attachment.

        Title rules:
        - Only USER messages can set a title
        - Only if title is currently None (never set)
        - Only if this is the FIRST user message
        - Only if content is non-empty after trimming (image-only messages do not force "New Chat")
        
        Enforces BASE plan max messages per thread (counting user+assistant; ignoring system).
        """
        db_thread = self.get_thread(thread_id, user_id, db)
        if not db_thread:
            return None

        # Enforce message limit (base only)
        user = db.query(User).filter(User.id == user_id).first()
        if not user:
            raise ValueError("User not found")
        plan = self._effective_plan(user)
        limits = get_limits_for_plan(plan)
        if limits.max_messages_per_thread is not None:
            message_count = (
                db.query(ChatMessage)
                .filter(
                    ChatMessage.thread_id == thread_id,
                    ChatMessage.role.in_(["user", "assistant"]),
                )
                .count()
            )
            if message_count >= limits.max_messages_per_thread:
                raise_plan_limit(
                    "PLAN_MAX_MESSAGES",
                    "Base plan allows only 30 messages per chat. Upgrade for unlimited.",
                    {"max_messages": limits.max_messages_per_thread, "thread_id": str(thread_id)},
                )

        normalized_content = (content or "").strip()
        if role == "user" and db_thread.title is None and normalized_content:
            first_user_msg = (
                db.query(ChatMessage)
                .filter(ChatMessage.thread_id == thread_id, ChatMessage.role == "user")
                .order_by(ChatMessage.id.asc())
                .first()
            )
            if first_user_msg is None:
                db_thread.title = self._title_from_first_user_message(normalized_content)

        db_message = ChatMessage(
            thread_id=thread_id,
            role=role,
            content=normalized_content or "",  # keep non-null DB constraint
            image_url=image_url,
            image_mime_type=image_mime_type,
            image_size_bytes=image_size_bytes,
        )
        db.add(db_message)
        db_thread.updated_at = func.now()
        db.commit()
        db.refresh(db_message)
        return db_message

    def replace_messages(
        self,
        thread_id: int,
        user_id: int,
        messages: List[ThreadMessageCreate],
        db: Session,
    ) -> Optional[List[ChatMessage]]:
        """
        Replace the full message list for a thread (legacy UI "save chat").
        """
        db_thread = self.get_thread(thread_id, user_id, db)
        if not db_thread:
            return None

        db.query(ChatMessage).filter(ChatMessage.thread_id == thread_id).delete(synchronize_session=False)
        for m in messages:
            db.add(ChatMessage(thread_id=thread_id, role=m.role, content=m.content))

        db_thread.updated_at = func.now()
        db.commit()
        db.refresh(db_thread)
        return db_thread.messages

    def get_last_message_preview(self, thread_id: int, db: Session) -> Optional[str]:
        """
        Get a preview of the last message in a thread.
        """
        last_msg = (
            db.query(ChatMessage)
            .filter(ChatMessage.thread_id == thread_id)
            .order_by(desc(ChatMessage.created_at))
            .first()
        )
        return last_msg.content[:100] if last_msg else None
