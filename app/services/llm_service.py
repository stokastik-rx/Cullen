from typing import Dict, List

from sqlalchemy.orm import Session

from app.models.chat import ChatMessage
from app.services.chat_service import ChatService

SYSTEM_PROMPT = """
You are Ed.

You are an expert analytical assistant.
Use retrieved context when relevant.
If context is insufficient, say so explicitly.
Do not hallucinate sources.
""".strip()


def build_messages(
    context_messages: List[ChatMessage],
    user_message: str,
) -> List[Dict[str, str]]:
    """
    Convert DB messages into Grok/OpenAI-style message list.
    """
    messages: List[Dict[str, str]] = [{"role": "system", "content": SYSTEM_PROMPT}]

    for m in context_messages:
        if m.role in ("user", "assistant"):
            messages.append({"role": m.role, "content": m.content})

    messages.append({"role": "user", "content": user_message})
    return messages


async def generate_assistant_reply(
    *,
    thread_id: int,
    user_id: int,
    user_message: str,
    db: Session,
) -> str:
    """
    Single source of truth for LLM calls.
    Pulls plan-aware context from DB, builds messages, and returns assistant text.

    NOTE: This currently returns a stub string. Replace the stub with the real Grok+RAG call.
    """
    service = ChatService()

    # 1) Get context (plan-aware truncation already handled)
    context_messages = service.get_context_messages(thread_id, user_id, db)

    # 2) Convert to model messages
    _messages = build_messages(context_messages, user_message)

    # 3) TODO: Plug in RAG + Grok call here using `messages`
    # For now: stub response proves wiring works end-to-end.
    return "MODEL PIPELINE CONNECTED SUCCESSFULLY"


