"""
Billing endpoints (Stripe subscriptions).
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import get_db
from app.core.dependencies import get_current_active_user
from app.core.stripe import StripeConfigError, verify_stripe_signature
from app.models.user import User
from app.schemas.billing import (
    BillingFeatures,
    BillingMeResponse,
    CheckoutSessionResponse,
    PortalSessionResponse,
    StripeWebhookAck,
)
from app.services.billing_service import BillingService

router = APIRouter()


@router.post(
    "/create-checkout-session",
    response_model=CheckoutSessionResponse,
    status_code=status.HTTP_200_OK,
)
async def create_checkout_session(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """
    Start PREMIUM subscription via Stripe Checkout Session.
    """
    service = BillingService()
    try:
        url = service.create_checkout_session(current_user, db)
    except StripeConfigError as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=f"Stripe error: {type(e).__name__}")
    return CheckoutSessionResponse(url=url)


@router.post(
    "/create-portal-session",
    response_model=PortalSessionResponse,
    status_code=status.HTTP_200_OK,
)
async def create_portal_session(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """
    Create a Stripe Customer Portal session so the user can manage/cancel their subscription.
    """
    service = BillingService()
    try:
        url = service.create_billing_portal_session(current_user, db)
    except StripeConfigError as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=f"Stripe error: {type(e).__name__}")
    return PortalSessionResponse(url=url)


@router.post("/webhook", response_model=StripeWebhookAck, status_code=status.HTTP_200_OK)
async def stripe_webhook(request: Request, db: Session = Depends(get_db)):
    """
    Stripe webhook receiver.
    """
    payload = await request.body()
    sig = request.headers.get("stripe-signature")
    try:
        ok = verify_stripe_signature(payload, sig)
    except StripeConfigError as e:
        # misconfigured server: still return 500 so Stripe retries and we notice
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))
    if not ok:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid Stripe signature")

    try:
        event = await request.json()
    except Exception:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid JSON")

    try:
        BillingService().handle_event(event, db)
    except Exception:
        # Don't leak; Stripe will retry if we return 500
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Webhook processing failed")

    return StripeWebhookAck()


@router.get("/me", response_model=BillingMeResponse, status_code=status.HTTP_200_OK)
async def billing_me(current_user: User = Depends(get_current_active_user)):
    """
    Return current plan + feature flags.
    """
    # Admin accounts get premium feature flags (for testing).
    if getattr(current_user, "is_admin", False):
        return BillingMeResponse(
            plan="premium",
            status="active",
            renews_at=None,
            features=BillingFeatures(max_chats=None, context_limit=None, premium_features=True),
        )

    plan = (getattr(current_user, "plan", None) or "base").lower()
    status_val = getattr(current_user, "plan_status", None)
    renews_at = getattr(current_user, "plan_renews_at", None)

    if plan == "premium":
        features = BillingFeatures(max_chats=None, context_limit=None, premium_features=True)
    else:
        features = BillingFeatures(
            max_chats=settings.BASE_MAX_CHATS,
            context_limit=settings.BASE_CONTEXT_MAX_MESSAGES,
            premium_features=False,
        )

    return BillingMeResponse(plan=plan, status=status_val, renews_at=renews_at, features=features)


