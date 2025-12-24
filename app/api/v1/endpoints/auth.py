"""
Authentication endpoints - signup and login
"""
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.dependencies import get_current_active_user
from app.core.security import create_access_token
from app.models.user import User
from app.schemas.user import UserCreate, User, Token, UserProfile
from app.services.user_service import UserService

router = APIRouter()


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


@router.post("/login", response_model=Token, status_code=status.HTTP_200_OK)
async def login(
    form_data: OAuth2PasswordRequestForm = Depends(),
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
    
    # Create access token with username as subject
    access_token = create_access_token(data={"sub": user.username})
    
    return Token(access_token=access_token, token_type="bearer")


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

