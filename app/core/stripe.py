"""
Minimal Stripe helpers (no external stripe SDK required).

We use direct HTTPS calls (via httpx) and implement webhook signature verification
per Stripe's docs to avoid adding new dependencies.
"""

from __future__ import annotations

import hmac
import hashlib
import logging
import time
from typing import Any, Dict, Optional, Tuple

import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)


class StripeConfigError(RuntimeError):
    pass


class StripeAPIError(RuntimeError):
    """
    Raised when Stripe returns a non-2xx response.

    Contains a safe, user-displayable message (no secrets).
    """

    def __init__(
        self,
        *,
        status_code: int,
        message: str,
        stripe_type: str | None = None,
        stripe_code: str | None = None,
    ) -> None:
        super().__init__(message)
        self.status_code = status_code
        self.message = message
        self.stripe_type = stripe_type
        self.stripe_code = stripe_code


def _require_stripe_secret_key() -> str:
    if not settings.STRIPE_SECRET_KEY:
        raise StripeConfigError("STRIPE_SECRET_KEY is not configured")
    return settings.STRIPE_SECRET_KEY


def _raise_stripe_api_error(resp: httpx.Response) -> None:
    status_code = resp.status_code
    message = "Stripe request failed"
    stripe_type: str | None = None
    stripe_code: str | None = None
    try:
        data = resp.json()
        if isinstance(data, dict) and isinstance(data.get("error"), dict):
            err = data["error"]
            message = err.get("message") or message
            stripe_type = err.get("type")
            stripe_code = err.get("code")
        else:
            # fallback: keep short text
            message = (resp.text or message)[:300]
    except Exception:
        message = (resp.text or message)[:300]

    logger.warning(
        "Stripe API error status=%s type=%s code=%s msg=%s",
        status_code,
        stripe_type,
        stripe_code,
        message,
    )
    raise StripeAPIError(
        status_code=status_code,
        message=message,
        stripe_type=stripe_type,
        stripe_code=stripe_code,
    )


def stripe_post_form(path: str, data: Dict[str, Any]) -> Dict[str, Any]:
    """
    POST form-encoded data to Stripe API.
    """
    key = _require_stripe_secret_key()
    url = f"https://api.stripe.com/v1{path}"
    headers = {
        "Authorization": f"Bearer {key}",
        "Content-Type": "application/x-www-form-urlencoded",
    }
    with httpx.Client(timeout=20) as client:
        resp = client.post(url, data=data, headers=headers)
        try:
            resp.raise_for_status()
        except httpx.HTTPStatusError:
            _raise_stripe_api_error(resp)
        return resp.json()


def stripe_get(path: str, params: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    key = _require_stripe_secret_key()
    url = f"https://api.stripe.com/v1{path}"
    headers = {
        "Authorization": f"Bearer {key}",
    }
    with httpx.Client(timeout=20) as client:
        resp = client.get(url, params=params, headers=headers)
        try:
            resp.raise_for_status()
        except httpx.HTTPStatusError:
            _raise_stripe_api_error(resp)
        return resp.json()


def verify_stripe_signature(
    payload: bytes,
    sig_header: str | None,
    *,
    tolerance_seconds: int = 300,
) -> bool:
    """
    Verify Stripe webhook signature.
    """
    secret = settings.STRIPE_WEBHOOK_SECRET
    if not secret:
        raise StripeConfigError("STRIPE_WEBHOOK_SECRET is not configured")
    if not sig_header:
        return False

    parts = [p.strip() for p in sig_header.split(",") if p.strip()]
    timestamp = None
    signatures: list[str] = []
    for p in parts:
        if p.startswith("t="):
            try:
                timestamp = int(p.split("=", 1)[1])
            except Exception:
                timestamp = None
        elif p.startswith("v1="):
            signatures.append(p.split("=", 1)[1])

    if timestamp is None or not signatures:
        return False

    now = int(time.time())
    if abs(now - timestamp) > tolerance_seconds:
        return False

    signed_payload = f"{timestamp}.".encode("utf-8") + payload
    expected = hmac.new(secret.encode("utf-8"), signed_payload, hashlib.sha256).hexdigest()
    return any(hmac.compare_digest(expected, s) for s in signatures)


