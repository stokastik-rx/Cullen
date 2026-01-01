"""
Authentication endpoints - signup and login
"""
from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from fastapi.security import OAuth2PasswordRequestForm
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.dependencies import get_current_active_user
from app.core.security import create_access_token, create_refresh_token, decode_access_token
from app.models.user import User
from app.schemas.user import UserCreate, User, Token, UserProfile, RefreshTokenRequest, TokenUser
from app.services.user_service import UserService

router = APIRouter()

ACCESS_COOKIE_NAME = "access_token"
REFRESH_COOKIE_NAME = "refresh_token"

def _set_auth_cookies(response: Response, access_token: str, refresh_token: str | None) -> None:
    """
    Set auth cookies for clients/pages that rely on cookies instead of Authorization headers.

    This is additive and does not break existing localStorage/Bearer-token clients.
    """
    # Access token cookie (short-lived)
    response.set_cookie(
        key=ACCESS_COOKIE_NAME,
        value=access_token,
        httponly=True,
        samesite="lax",
        secure=False,
        max_age=60 * 60,  # 1h safety default; token itself has exp
        path="/",
    )
    if refresh_token:
        # Refresh token cookie (longer-lived)
        response.set_cookie(
            key=REFRESH_COOKIE_NAME,
            value=refresh_token,
            httponly=True,
            samesite="lax",
            secure=False,
            max_age=60 * 60 * 24 * 7,
            path="/",
        )


@router.post("/signup", response_model=User, status_code=status.HTTP_201_CREATED)
async def signup(
    user_data: UserCreate,
    db: Session = Depends(get_db),
):
    """
    Register a new user
    
    Args:
        user_data: User registration data (email, username, password)
        db: Database session
        
    Returns:
        Created user object (without password)
        
    Raises:
        HTTPException: If email or username already exists
    """
    user_service = UserService()
    
    try:
        user = user_service.create_user(user_data, db)
        return user
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )
    except Exception as e:
        # Catch password hashing errors and other unexpected errors
        error_msg = str(e)
        error_type = type(e).__name__
        
        # Log the error for debugging
        import logging
        logger = logging.getLogger(__name__)
        logger.error(f"Signup error: {error_type}: {error_msg}", exc_info=True)
        
        if "password" in error_msg.lower() and "72" in error_msg:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Password processing error. Please try a different password.",
            )
        
        # Check for database-related errors (like missing column)
        if "no such column" in error_msg.lower() or "subscription_tier" in error_msg.lower():
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Database schema error. Please restart the server to update the database schema.",
            )
        
        # Return more detailed error for debugging (in development)
        # In production, you might want to hide this
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"An unexpected error occurred during signup: {error_type}: {error_msg}",
        )


@router.post("/register", response_model=User, status_code=status.HTTP_201_CREATED)
async def register(
    user_data: UserCreate,
    db: Session = Depends(get_db),
):
    """
    Register a new user.

    Alias for `/signup` to match the required endpoint naming.
    """
    return await signup(user_data=user_data, db=db)


@router.post("/login", response_model=Token, status_code=status.HTTP_200_OK)
async def login(
    form_data: OAuth2PasswordRequestForm = Depends(),
    response: Response = None,  # type: ignore[assignment]
    db: Session = Depends(get_db),
):
    """
    Authenticate user and return JWT token
    
    Args:
        form_data: OAuth2 form data containing username (can be email or username) and password
        db: Database session
        
    Returns:
        JWT access token
        
    Raises:
        HTTPException: If credentials are invalid
    """
    user_service = UserService()
    
    # OAuth2PasswordRequestForm uses 'username' field for both username and email
    user = user_service.authenticate_user(form_data.username, form_data.password, db)
    
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username/email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # Create tokens with username as subject
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


@router.get("/me", response_model=UserProfile, status_code=status.HTTP_200_OK)
async def get_current_user_profile(
    current_user: User = Depends(get_current_active_user),
):
    """
    Get current user profile (username and subscription tier)
    
    Returns:
        User profile with username and subscription_tier
    """
    return UserProfile(
        username=current_user.username,
        subscription_tier=current_user.subscription_tier,
    )


class AuthMeStatus(BaseModel):
    """
    Stable auth status shape (matches /api/auth/me) without breaking /api/v1/auth/me.
    """

    authenticated: bool
    username: str | None = None
    user_id: int | None = None
    email: str | None = None
    subscription_tier: str | None = None


@router.get("/me_status", response_model=AuthMeStatus, status_code=status.HTTP_200_OK)
async def me_status(request: Request, db: Session = Depends(get_db)):
    """
    Alias of /api/auth/me under the /api/v1/auth/* namespace.

    Validates JWT from Authorization header OR cookie.
    """
    auth = request.headers.get("authorization") or request.headers.get("Authorization") or ""
    token: str | None = None
    if auth.lower().startswith("bearer "):
        token = auth.split(" ", 1)[1].strip() or None
    if not token:
        token = request.cookies.get(ACCESS_COOKIE_NAME) or request.cookies.get("token")
    if not token:
        return AuthMeStatus(authenticated=False)

    payload = decode_access_token(token)
    if not payload:
        return AuthMeStatus(authenticated=False)

    sub = payload.get("sub")
    if not sub:
        return AuthMeStatus(authenticated=False)

    user = db.query(User).filter(User.username == sub).first()
    if user is None:
        user = db.query(User).filter(User.email == sub).first()
    if user is None:
        return AuthMeStatus(authenticated=False)

    return AuthMeStatus(
        authenticated=True,
        username=user.username,
        user_id=user.id,
        email=user.email,
        subscription_tier=getattr(user, "subscription_tier", None),
    )


@router.post("/refresh", response_model=Token, status_code=status.HTTP_200_OK)
async def refresh_token(
    payload: RefreshTokenRequest,
    response: Response = None,  # type: ignore[assignment]
    db: Session = Depends(get_db),
):
    """
    Exchange a refresh token for a new access token.
    """
    decoded = decode_access_token(payload.refresh_token)
    if not decoded or decoded.get("type") != "refresh":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid refresh token",
            headers={"WWW-Authenticate": "Bearer"},
        )

    username = decoded.get("sub")
    if not username:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid refresh token",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Ensure user still exists
    user = db.query(User).filter(User.username == username).first()
    if user is None:
        user = db.query(User).filter(User.email == username).first()
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid refresh token",
            headers={"WWW-Authenticate": "Bearer"},
        )

    access_token = create_access_token(data={"sub": user.username})
    refresh_token = create_refresh_token(data={"sub": user.username})
    if response is not None:
        _set_auth_cookies(response, access_token=access_token, refresh_token=refresh_token)
    return Token(access_token=access_token, refresh_token=refresh_token, token_type="bearer")


@router.post("/logout", status_code=status.HTTP_200_OK)
async def logout(response: Response):
    """
    Logout alias under /api/v1/auth/logout.

    For stateless JWT: frontend should clear stored tokens.
    If cookies are used, this clears them.
    """
    response.delete_cookie(ACCESS_COOKIE_NAME, path="/")
    response.delete_cookie(REFRESH_COOKIE_NAME, path="/")
    response.delete_cookie("token", path="/")
    return {"ok": True}

