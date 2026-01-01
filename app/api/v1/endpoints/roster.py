"""
Roster endpoints (per-account roster cards)
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


@router.get("/cards", response_model=List[RosterCard], status_code=status.HTTP_200_OK)
async def get_roster_cards(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """
    Get roster cards for the current user (requires JWT).
    """
    raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=_ROSTER_DISABLED_DETAIL)


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
    raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=_ROSTER_DISABLED_DETAIL)


