"""
Plan limits and standardized limit errors.

Required behavior:
- Return HTTP 402 with JSON: { "detail": { ... } }
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Optional, Dict, Any

from fastapi import HTTPException, status


@dataclass(frozen=True)
class PlanLimits:
    max_threads: Optional[int]
    max_messages_per_thread: Optional[int]


def get_limits_for_plan(plan: str) -> PlanLimits:
    p = (plan or "base").strip().lower()
    if p == "premium":
        return PlanLimits(max_threads=None, max_messages_per_thread=None)
    # base default
    return PlanLimits(max_threads=5, max_messages_per_thread=30)


def raise_plan_limit(code: str, message: str, extra: Dict[str, Any]) -> None:
    """
    Raise a standardized 402 error, with FastAPI-default wrapper:
    { "detail": { ... } }
    """
    detail = {"code": code, "message": message, **(extra or {})}
    raise HTTPException(status_code=status.HTTP_402_PAYMENT_REQUIRED, detail=detail)


