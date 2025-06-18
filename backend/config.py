import os
from functools import lru_cache
from pydantic_settings import BaseSettings
from typing import Optional, Dict, Any

class Settings(BaseSettings):
    # App
    PROJECT_NAME: str = "BYOK Chat API"
    SECRET_KEY: str
    ENCRYPTION_KEY: str
    DEBUG: bool = False

    # API
    API_V1_STR: str = "/api"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24  # 24 hours

    # CORS
    BACKEND_CORS_ORIGINS: list = ["*"]

    # Database
    DATABASE_URL: str # Pydantic v2 can validate this as a URL string directly

    # OAuth
    GOOGLE_CLIENT_ID: str
    GOOGLE_CLIENT_SECRET: str
    GOOGLE_REDIRECT_URI: str

    # AI Keys
    GEMINI_API_KEY: str

    # JWT
    JWT_ALGORITHM: str = "HS256"

    class Config:
        env_file = ".env"
        case_sensitive = True

@lru_cache()
def get_settings() -> Settings:
    return Settings()

settings = get_settings()
