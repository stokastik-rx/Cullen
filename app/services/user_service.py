"""
User service - business logic for user operations
"""
from typing import Optional
from sqlalchemy.orm import Session

from app.models.user import User
from app.schemas.user import UserCreate
from app.core.security import get_password_hash, verify_password


class UserService:
    """Service for user operations"""
    
    def create_user(self, user_data: UserCreate, db: Session) -> User:
        """
        Create a new user
        
        Args:
            user_data: User creation data
            db: Database session
            
        Returns:
            Created User object
            
        Raises:
            ValueError: If email or username already exists
        """
        # Check if email already exists
        existing_user = db.query(User).filter(User.email == user_data.email).first()
        if existing_user:
            raise ValueError("Email already registered")
        
        # Check if username already exists
        existing_user = db.query(User).filter(User.username == user_data.username).first()
        if existing_user:
            raise ValueError("Username already taken")
        
        # Create new user
        hashed_password = get_password_hash(user_data.password)
        db_user = User(
            email=user_data.email,
            username=user_data.username,
            hashed_password=hashed_password,
            subscription_tier="BASE",
            plan="base",  # Explicitly set plan to base
        )
        db.add(db_user)
        db.commit()
        db.refresh(db_user)
        return db_user
    
    def get_user_by_email(self, email: str, db: Session) -> Optional[User]:
        """
        Get user by email
        
        Args:
            email: User email address
            db: Database session
            
        Returns:
            User object if found, None otherwise
        """
        return db.query(User).filter(User.email == email).first()
    
    def get_user_by_username(self, username: str, db: Session) -> Optional[User]:
        """
        Get user by username
        
        Args:
            username: Username
            db: Database session
            
        Returns:
            User object if found, None otherwise
        """
        return db.query(User).filter(User.username == username).first()
    
    def authenticate_user(self, username_or_email: str, password: str, db: Session) -> Optional[User]:
        """
        Authenticate a user by username/email and password
        
        Args:
            username_or_email: Username or email address
            password: Plain text password
            db: Database session
            
        Returns:
            User object if authentication successful, None otherwise
        """
        # Try to find user by username first
        user = self.get_user_by_username(username_or_email, db)
        
        # If not found, try email
        if user is None:
            user = self.get_user_by_email(username_or_email, db)
        
        # If user not found, return None
        if user is None:
            return None
        
        # Verify password
        if not verify_password(password, user.hashed_password):
            return None
        
        return user

