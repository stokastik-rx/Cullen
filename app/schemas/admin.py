"""
Admin-only response schemas.

These are intentionally "view" models and must never include secrets like hashed passwords.
"""

from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, EmailStr, ConfigDict


class AdminUser(BaseModel):
    id: int
    email: EmailStr
    username: str
    subscription_tier: str
    plan: str
    plan_status: Optional[str] = None
    stripe_customer_id: Optional[str] = None
    stripe_subscription_id: Optional[str] = None
    is_admin: bool
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class AdminThread(BaseModel):
    id: int
    user_id: int
    title: Optional[str] = None
    roster_card_id: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    message_count: int


class AdminMessage(BaseModel):
    id: int
    thread_id: int
    role: str
    content: str
    created_at: datetime
    image_url: Optional[str] = None
    image_mime_type: Optional[str] = None
    image_size_bytes: Optional[int] = None

    model_config = ConfigDict(from_attributes=True)


class AdminThreadDetail(BaseModel):
    thread: AdminThread
    messages: List[AdminMessage]


