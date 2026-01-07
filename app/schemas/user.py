"""
User schemas for request/response validation
"""
from datetime import datetime
from typing import Optional
from pydantic import BaseModel, EmailStr, Field


class UserBase(BaseModel):
    """Base user schema with common fields"""
    email: EmailStr = Field(..., description="User email address")
    username: str = Field(..., min_length=3, max_length=50, description="Username")


class UserCreate(UserBase):
    """Schema for creating a new user (signup)"""
    password: str = Field(..., min_length=8, max_length=100, description="User password")


class UserLogin(BaseModel):
    """Schema for user login"""
    username_or_email: str = Field(..., description="Username or email address")
    password: str = Field(..., description="User password")


class User(UserBase):
    """Schema for user response"""
    id: int
    subscription_tier: str
    is_admin: bool = False
    created_at: datetime
    updated_at: datetime
    
    model_config = {"from_attributes": True}


class UserProfile(BaseModel):
    """Schema for user profile (for user card display)"""
    username: str
    subscription_tier: str
    is_admin: bool = False
    
    model_config = {"from_attributes": True}


class Token(BaseModel):
    """Schema for JWT token response"""
    access_token: str
    token_type: str = "bearer"
    refresh_token: Optional[str] = None
    user: Optional["TokenUser"] = None


class TokenUser(BaseModel):
    """Minimal user info bundled with token responses for frontend convenience."""
    id: int
    username: str
    email: EmailStr


Token.model_rebuild()


class RefreshTokenRequest(BaseModel):
    """Schema for refreshing an access token using a refresh token"""
    refresh_token: str = Field(..., min_length=1)


class TokenData(BaseModel):
    """Schema for decoded token data"""
    username: Optional[str] = None

