"""
Auth helper endpoints for frontend convenience.

These DO NOT replace the existing JWT flow under `/api/v1/auth/*`.
They provide stable, page-agnostic helpers under `/api/auth/*` for:
- checking logged-in status quickly
- logging out (client-side token removal + cookie clearing if used)
"""

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from fastapi.security import OAuth2PasswordRequestForm
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import create_access_token, create_refresh_token, decode_access_token
from app.models.user import User
from app.schemas.user import Token, TokenUser, UserCreate
from app.services.user_service import UserService

router = APIRouter()


class AuthMeResponse(BaseModel):
    authenticated: bool
    username: Optional[str] = None
    user_id: Optional[int] = None
    email: Optional[str] = None
    subscription_tier: Optional[str] = None


class LogoutResponse(BaseModel):
    ok: bool

ACCESS_COOKIE_NAME = "access_token"
REFRESH_COOKIE_NAME = "refresh_token"

def _set_auth_cookies(response: Response, access_token: str, refresh_token: str | None) -> None:
    """
    Mirror /api/v1/auth/login cookie behavior for clients that use /api/auth/login.
    """
    response.set_cookie(
        key=ACCESS_COOKIE_NAME,
        value=access_token,
        httponly=True,
        samesite="lax",
        secure=False,
        max_age=60 * 60,
        path="/",
    )
    if refresh_token:
        response.set_cookie(
            key=REFRESH_COOKIE_NAME,
            value=refresh_token,
            httponly=True,
            samesite="lax",
            secure=False,
            max_age=60 * 60 * 24 * 7,
            path="/",
        )


def _extract_bearer_or_cookie_token(request: Request) -> Optional[str]:
    """
    Extract token from:
    - Authorization: Bearer <token>
    - Cookie: access_token (or token)
    """
    auth = request.headers.get("authorization") or request.headers.get("Authorization") or ""
    if auth.lower().startswith("bearer "):
        token = auth.split(" ", 1)[1].strip()
        return token or None
    # Cookie fallback (only used if your frontend sets cookies)
    return request.cookies.get("access_token") or request.cookies.get("token")


def _get_user_from_token(token: str, db: Session) -> Optional[User]:
    payload = decode_access_token(token)
    if not payload:
        return None
    sub = payload.get("sub")
    if not sub:
        return None
    # sub is username in this project (but we also try email)
    user = db.query(User).filter(User.username == sub).first()
    if user is None:
        user = db.query(User).filter(User.email == sub).first()
    return user


@router.get("/auth/me", response_model=AuthMeResponse, status_code=status.HTTP_200_OK)
async def auth_me(request: Request, db: Session = Depends(get_db)):
    """
    Lightweight auth status endpoint.

    Returns authenticated=false if token is missing/invalid.
    """
    token = _extract_bearer_or_cookie_token(request)
    if not token:
        return AuthMeResponse(authenticated=False)
    user = _get_user_from_token(token, db)
    if not user:
        return AuthMeResponse(authenticated=False)
    return AuthMeResponse(
        authenticated=True,
        username=user.username,
        user_id=user.id,
        email=user.email,
        subscription_tier=getattr(user, "subscription_tier", None),
    )

@router.post("/auth/signup", status_code=status.HTTP_201_CREATED)
async def auth_signup(payload: UserCreate, db: Session = Depends(get_db)):
    """
    Alias for /api/v1/auth/signup for clients using /api/auth/signup.
    """
    service = UserService()
    try:
        user = service.create_user(payload, db)
        return {"id": user.id, "username": user.username, "email": user.email}
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.post("/auth/register", status_code=status.HTTP_201_CREATED)
async def auth_register(payload: UserCreate, db: Session = Depends(get_db)):
    """Alias for /api/auth/signup."""
    return await auth_signup(payload, db)


@router.post("/auth/login", response_model=Token, status_code=status.HTTP_200_OK)
async def auth_login(
    form_data: OAuth2PasswordRequestForm = Depends(),
    response: Response = None,  # type: ignore[assignment]
    db: Session = Depends(get_db),
):
    """
    Alias for /api/v1/auth/login for clients using /api/auth/login.
    Accepts x-www-form-urlencoded (username/password) like the v1 endpoint.
    """
    user_service = UserService()
    user = user_service.authenticate_user(form_data.username, form_data.password, db)
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username/email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    access_token = create_access_token(data={"sub": user.username})
    refresh_token = create_refresh_token(data={"sub": user.username})
    if response is not None:
        _set_auth_cookies(response, access_token=access_token, refresh_token=refresh_token)

    return Token(
        access_token=access_token,
        refresh_token=refresh_token,
        token_type="bearer",
        user=TokenUser(id=user.id, username=user.username, email=user.email),
    )


@router.post("/auth/logout", response_model=LogoutResponse, status_code=status.HTTP_200_OK)
async def auth_logout(response: Response):
    """
    Stateless JWT logout:
    - If using Authorization header tokens: frontend should delete stored token
    - If using cookies: we clear common cookie names
    """
    response.delete_cookie("access_token", path="/")
    response.delete_cookie("refresh_token", path="/")
    response.delete_cookie("token", path="/")
    return LogoutResponse(ok=True)


