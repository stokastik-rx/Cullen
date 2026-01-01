"""
Roster service - business logic for roster operations
"""

from typing import List
from sqlalchemy.orm import Session

from app.models.roster import RosterState
from app.schemas.roster import RosterCard


class RosterService:
    """Service for roster operations"""

    def get_cards(self, user_id: int, db: Session) -> List[RosterCard]:
        state = db.query(RosterState).filter(RosterState.user_id == user_id).first()
        if state is None or not state.cards:
            return []
        # Validate/normalize through Pydantic
        cards: List[RosterCard] = []
        for raw in state.cards:
            try:
                cards.append(RosterCard(**raw))
            except Exception:
                # Skip malformed entries rather than breaking the entire roster
                continue
        return cards

    def put_cards(self, user_id: int, cards: List[RosterCard], db: Session) -> List[RosterCard]:
        # Normalize and drop empty names defensively
        normalized: List[RosterCard] = []
        seen_ids: set[str] = set()
        for c in cards:
            name = (c.name or "").strip()
            if not name:
                continue
            card_id = (c.id or "").strip()
            if not card_id:
                continue
            if card_id in seen_ids:
                continue
            seen_ids.add(card_id)
            normalized.append(RosterCard(id=card_id, name=name, bg=(c.bg or "").strip()))

        # Simple safety limit
        normalized = normalized[:500]

        state = db.query(RosterState).filter(RosterState.user_id == user_id).first()
        if state is None:
            state = RosterState(user_id=user_id, cards=[c.model_dump() for c in normalized])
            db.add(state)
        else:
            state.cards = [c.model_dump() for c in normalized]

        db.commit()
        db.refresh(state)
        return normalized


