from __future__ import annotations

import os
from pydantic import BaseModel


class Settings(BaseModel):
    APP_NAME: str = "CULLEN.AI"

    # DB
    DATABASE_URL: str = os.getenv("DATABASE_URL", "sqlite:///./app.db")

    # JWT
    JWT_SECRET_KEY: str = os.getenv("JWT_SECRET_KEY", "CHANGE_ME_SUPER_SECRET")
    JWT_ALGORITHM: str = os.getenv("JWT_ALGORITHM", "HS256")
    ACCESS_TOKEN_EXPIRE_MINUTES: int = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "60"))


settings = Settings()
