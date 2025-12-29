from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.dependencies import get_db, get_current_user
from app.models.user import User
from app.models.roster_card import RosterCard
from app.schemas.roster_card import RosterCardCreate, RosterCardUpdate, RosterCardOut

router = APIRouter(prefix="/api/v1/roster", tags=["roster"])

@router.get("", response_model=list[RosterCardOut])
def list_roster(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return (
        db.query(RosterCard)
        .filter(RosterCard.user_id == user.id)
        .order_by(RosterCard.id.asc())
        .all()
    )

@router.post("", response_model=RosterCardOut)
def create_roster(card: RosterCardCreate, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    obj = RosterCard(user_id=user.id, name=card.name.strip(), bg=(card.bg or "").strip())
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj

@router.put("/{card_id}", response_model=RosterCardOut)
def update_roster(card_id: int, card: RosterCardUpdate, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    obj = db.query(RosterCard).filter(RosterCard.id == card_id, RosterCard.user_id == user.id).first()
    if not obj:
        return None  # frontend treats as missing

    obj.name = card.name.strip()
    obj.bg = (card.bg or "").strip()
    db.commit()
    db.refresh(obj)
    return obj

@router.delete("/{card_id}")
def delete_roster(card_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    obj = db.query(RosterCard).filter(RosterCard.id == card_id, RosterCard.user_id == user.id).first()
    if not obj:
        return {"ok": True}
    db.delete(obj)
    db.commit()
    return {"ok": True}
