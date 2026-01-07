"""
Billing service: Stripe subscription checkout + webhook processing.
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Dict, Optional

from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.stripe import StripeConfigError, stripe_get, stripe_post_form
from app.models.user import User


def _dt_from_unix(ts: Optional[int]) -> Optional[datetime]:
    if not ts:
        return None
    return datetime.fromtimestamp(int(ts), tz=timezone.utc)


def _map_plan_status(stripe_status: Optional[str]) -> Optional[str]:
    if not stripe_status:
        return None
    s = stripe_status.lower()
    if s in ("active", "trialing"):
        return "active"
    if s in ("past_due", "unpaid", "incomplete", "incomplete_expired"):
        return "past_due"
    if s in ("canceled",):
        return "canceled"
    # default: keep raw-ish but constrained
    return "past_due"


class BillingService:
    def ensure_customer(self, user: User, db: Session) -> str:
        if user.stripe_customer_id:
            return user.stripe_customer_id

        customer = stripe_post_form(
            "/customers",
            {
                "email": user.email,
                "metadata[user_id]": str(user.id),
                "metadata[username]": user.username,
            },
        )
        user.stripe_customer_id = customer.get("id")
        db.commit()
        db.refresh(user)
        return user.stripe_customer_id  # type: ignore[return-value]

    def create_checkout_session(self, user: User, db: Session) -> str:
        if not settings.STRIPE_PRICE_ID_PREMIUM:
            raise StripeConfigError("STRIPE_PRICE_ID_PREMIUM is not configured")

        customer_id = self.ensure_customer(user, db)
        base = settings.APP_BASE_URL.rstrip("/")

        session = stripe_post_form(
            "/checkout/sessions",
            {
                "mode": "subscription",
                "customer": customer_id,
                "line_items[0][price]": settings.STRIPE_PRICE_ID_PREMIUM,
                "line_items[0][quantity]": "1",
                "success_url": f"{base}/?billing=success",
                "cancel_url": f"{base}/?billing=cancel",
                "client_reference_id": str(user.id),
                "metadata[user_id]": str(user.id),
            },
        )
        return session["url"]

    def create_billing_portal_session(self, user: User, db: Session) -> str:
        """
        Create a Stripe Customer Portal session URL so the user can manage/cancel their subscription.
        """
        customer_id = self.ensure_customer(user, db)
        base = settings.APP_BASE_URL.rstrip("/")
        portal = stripe_post_form(
            "/billing_portal/sessions",
            {
                "customer": customer_id,
                "return_url": f"{base}/",
            },
        )
        return portal["url"]

    def _apply_premium(self, user: User, *, status: Optional[str], renews_at: Optional[datetime], db: Session) -> None:
        user.plan = "premium"
        user.plan_status = status or user.plan_status or "active"
        user.plan_renews_at = renews_at
        # keep legacy field in sync for existing UI
        user.subscription_tier = "PREMIUM"
        db.commit()

    def _apply_base(self, user: User, *, status: Optional[str], db: Session) -> None:
        user.plan = "base"
        user.plan_status = status or "active"
        user.plan_renews_at = None
        user.stripe_subscription_id = None
        user.subscription_tier = "BASE"
        db.commit()

    def handle_event(self, event: Dict[str, Any], db: Session) -> None:
        """
        Handle Stripe webhook event dict.
        """
        event_type = (event.get("type") or "").strip()
        data_obj = (((event.get("data") or {}).get("object")) or {})

        # Find user by customer id (preferred) or user_id metadata / client_reference_id
        customer_id = data_obj.get("customer")
        user: Optional[User] = None
        if customer_id:
            user = db.query(User).filter(User.stripe_customer_id == customer_id).first()

        if user is None:
            meta = data_obj.get("metadata") or {}
            user_id = meta.get("user_id") or data_obj.get("client_reference_id")
            if user_id:
                try:
                    user = db.query(User).filter(User.id == int(user_id)).first()
                except Exception:
                    user = None

        if user is None:
            # Unknown customer/user; ignore
            return

        if event_type == "checkout.session.completed":
            subscription_id = data_obj.get("subscription")
            customer_id = data_obj.get("customer")
            if customer_id and not user.stripe_customer_id:
                user.stripe_customer_id = customer_id
            if subscription_id:
                user.stripe_subscription_id = subscription_id
            # Mark premium active; subscription.updated will set renew date/status
            self._apply_premium(user, status="active", renews_at=user.plan_renews_at, db=db)
            return

        if event_type in ("customer.subscription.created", "customer.subscription.updated"):
            sub_id = data_obj.get("id")
            sub_status = _map_plan_status(data_obj.get("status"))
            period_end = data_obj.get("current_period_end")
            renews_at = _dt_from_unix(period_end)

            if sub_id:
                user.stripe_subscription_id = sub_id
            if customer_id and not user.stripe_customer_id:
                user.stripe_customer_id = customer_id

            # If subscription is canceled, drop to base; else premium
            if sub_status == "canceled":
                self._apply_base(user, status="canceled", db=db)
            else:
                self._apply_premium(user, status=sub_status or "active", renews_at=renews_at, db=db)
            return

        if event_type == "customer.subscription.deleted":
            self._apply_base(user, status="canceled", db=db)
            return

        if event_type == "invoice.paid":
            # invoice object has customer + subscription
            sub_id = data_obj.get("subscription")
            if sub_id:
                user.stripe_subscription_id = sub_id
            self._apply_premium(user, status="active", renews_at=user.plan_renews_at, db=db)
            return

        if event_type == "invoice.payment_failed":
            # Keep premium but mark past_due
            self._apply_premium(user, status="past_due", renews_at=user.plan_renews_at, db=db)
            return


