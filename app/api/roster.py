"""
Roster API aliases under /api/roster/*.

The frontend currently uses /api/v1/roster/cards in some places.
This file provides a stable /api/roster/cards contract for other pages/clients.
"""

from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.dependencies import get_current_active_user
from app.models.user import User
from app.schemas.roster import RosterCard
from app.services.roster_service import RosterService

router = APIRouter()

_ROSTER_DISABLED_DETAIL = "Roster is not available until CullenPill 1.5"


@router.get("/roster/cards", response_model=List[RosterCard], status_code=status.HTTP_200_OK)
async def get_roster_cards_api(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """Alias of GET /api/v1/roster/cards."""
    raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=_ROSTER_DISABLED_DETAIL)


@router.put("/roster/cards", response_model=List[RosterCard], status_code=status.HTTP_200_OK)
async def put_roster_cards_api(
    cards: List[RosterCard],
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """Alias of PUT /api/v1/roster/cards."""
    raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=_ROSTER_DISABLED_DETAIL)


