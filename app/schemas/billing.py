"""
Billing / subscription schemas.
"""

from __future__ import annotations

from datetime import datetime
from typing import Any, Optional

from pydantic import BaseModel, Field


class CheckoutSessionResponse(BaseModel):
    url: str


class PortalSessionResponse(BaseModel):
    url: str


class BillingFeatures(BaseModel):
    max_chats: Optional[int] = Field(None, description="Maximum chats allowed (None = unlimited)")
    context_limit: Optional[int] = Field(None, description="Max messages used as model context (None = full)")
    premium_features: bool = Field(False, description="Whether premium features are enabled")


class BillingMeResponse(BaseModel):
    plan: str
    status: Optional[str] = None
    renews_at: Optional[datetime] = None
    features: BillingFeatures


class StripeWebhookAck(BaseModel):
    ok: bool = True
    received: bool = True


