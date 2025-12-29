from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.dependencies import get_db
from app.core.security import hash_password, verify_password, create_access_token
from app.models.user import User

router = APIRouter(prefix="/api/v1/auth", tags=["auth"])

class SignupIn(BaseModel):
    email: str
    username: str
    password: str

class LoginIn(BaseModel):
    username: str
    password: str

class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"
    username: str
    tier: str

@router.post("/signup", response_model=TokenOut)
def signup(payload: SignupIn, db: Session = Depends(get_db)):
    email = payload.email.strip().lower()
    username = payload.username.strip()

    if db.query(User).filter(User.email == email).first():
        raise HTTPException(status_code=400, detail="Email already in use")
    if db.query(User).filter(User.username == username).first():
        raise HTTPException(status_code=400, detail="Username already in use")

    user = User(
        email=email,
        username=username,
        hashed_password=hash_password(payload.password),
        subscription_tier="BASE",
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    token = create_access_token(subject=user.username, extra={"uid": user.id})
    return TokenOut(access_token=token, username=user.username, tier=user.subscription_tier)

@router.post("/login", response_model=TokenOut)
def login(payload: LoginIn, db: Session = Depends(get_db)):
    username = payload.username.strip()
    user = db.query(User).filter(User.username == username).first()
    if not user or not verify_password(payload.password, user.hashed_password):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")

    token = create_access_token(subject=user.username, extra={"uid": user.id})
    return TokenOut(access_token=token, username=user.username, tier=user.subscription_tier)
