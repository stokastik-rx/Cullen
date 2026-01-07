"""
Application configuration management
"""
from typing import List
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings loaded from environment variables"""
    
    # Project Information
    PROJECT_NAME: str = "FastAPI Production Starter"
    VERSION: str = "0.1.0"
    DESCRIPTION: str = "A production-ready FastAPI starter application"
    API_V1_STR: str = "/api/v1"
    
    # Server Configuration
    HOST: str = "0.0.0.0"
    PORT: int = 8000
    DEBUG: bool = False
  
    # CORS Configuration
    CORS_ORIGINS: List[str] = ["http://localhost:3000", "http://localhost:8000"]
    
    # Security
    SECRET_KEY: str = "your-secret-key-change-in-production"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    
    # Database Configuration
    # PostgreSQL (SQLAlchemy + psycopg v3):
    # postgresql+psycopg://user:password@localhost:5432/dbname
    DATABASE_URL: str = "postgresql+psycopg://postgres:postgres@localhost:5432/cullen"
    
    # Logging
    LOG_LEVEL: str = "INFO"

    # Billing / Stripe (do not hardcode secrets; use env vars)
    STRIPE_SECRET_KEY: str | None = None
    STRIPE_WEBHOOK_SECRET: str | None = None
    STRIPE_PRICE_ID_PREMIUM: str | None = None
    APP_BASE_URL: str = "http://localhost:8000"

    # Plan enforcement constants
    BASE_MAX_CHATS: int = 5
    BASE_CONTEXT_MAX_MESSAGES: int = 12
    MAX_MESSAGES_PER_CHAT: int = 100  # Maximum messages per chat thread (all plans)
    
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore",
    )


settings = Settings()

