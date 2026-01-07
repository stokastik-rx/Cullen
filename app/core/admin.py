"""
Admin authorization helpers.

We intentionally keep admin access server-side only. Never allow clients to set `is_admin`.
"""

from fastapi import Depends, HTTPException, status

from app.core.dependencies import get_current_active_user
from app.models.user import User


def require_admin(current_user: User = Depends(get_current_active_user)) -> User:
    """
    Dependency that allows only admin users.
    """
    if not getattr(current_user, "is_admin", False):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required")
    return current_user


