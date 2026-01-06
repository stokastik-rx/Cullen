"""
Roster endpoints (per-account roster cards)
"""

from typing import List

import logging
from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.dependencies import get_current_active_user
from app.models.user import User
from app.schemas.roster import RosterCard
from app.services.roster_service import RosterService

router = APIRouter()

logger = logging.getLogger(__name__)


@router.get("/cards", response_model=List[RosterCard], status_code=status.HTTP_200_OK)
async def get_roster_cards(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """
    Get roster cards for the current user (requires JWT).
    """
    # Roster feature is not released yet, but the frontend still calls this endpoint
    # during auth/bootstrap flows. Return a safe empty list instead of 403 to avoid
    # breaking signup/login UX.
    _ = (current_user, db)  # keep deps in place (auth-required)
    return []


@router.put("/cards", response_model=List[RosterCard], status_code=status.HTTP_200_OK)
async def put_roster_cards(
    cards: List[RosterCard],
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """
    Replace roster cards for the current user (requires JWT).

    The frontend can treat this like "save roster" and just PUT the whole list.
    """
    # No-op persistence until roster is released.
    # Return the payload so the client can continue operating without errors.
    logger.info("Roster PUT ignored (feature disabled) user_id=%s cards=%s", current_user.id, len(cards))
    _ = db
    return cards


