"""Application configuration loaded from environment variables.

All configuration is centralized here. Production deployments should override
defaults via environment variables, never by editing this file.
"""
from __future__ import annotations

from functools import lru_cache
from typing import Literal

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Strongly-typed application settings."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # Application
    app_name: str = "CyStar Selective Disclosure"
    app_env: Literal["development", "staging", "production"] = "development"
    debug: bool = False

    # Security
    jwt_secret_key: str = Field(min_length=32)
    jwt_algorithm: Literal["HS256", "HS384", "HS512"] = "HS256"
    jwt_access_token_expire_minutes: int = Field(default=60, ge=1, le=1440)

    # Issuer (Ed25519). Hex-encoded. Empty values trigger auto-generation in dev.
    issuer_name: str = "CyStar Demo Issuer"
    issuer_signing_key: str = ""
    issuer_public_key: str = ""

    # Database
    database_url: str = "sqlite:///./data/cystar.db"

    # CORS
    cors_origins: str = "http://localhost:3000"

    # Sharing
    default_share_expiry_minutes: int = Field(default=15, ge=1)
    max_share_expiry_minutes: int = Field(default=10080, ge=1)  # 7 days

    # Rate limits (slowapi format: "<count>/<period>")
    rate_limit_verify: str = "30/minute"
    rate_limit_auth: str = "10/minute"

    # Public URLs
    public_frontend_url: str = "http://localhost:3000"

    @field_validator("cors_origins")
    @classmethod
    def _strip_origins(cls, v: str) -> str:
        return ",".join(origin.strip() for origin in v.split(",") if origin.strip())

    @property
    def cors_origin_list(self) -> list[str]:
        return [o for o in self.cors_origins.split(",") if o]

    @property
    def is_production(self) -> bool:
        return self.app_env == "production"


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    """Cached settings accessor. Import this everywhere instead of constructing Settings."""
    return Settings()  # type: ignore[call-arg]
