"""JWT + password hashing primitives.

All auth secrets are pulled from ``Settings``; this module never reads env
directly.
"""
from __future__ import annotations

from datetime import datetime, timedelta, timezone

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from passlib.context import CryptContext
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.db import models
from app.db.session import get_db

_settings = get_settings()
_pwd = CryptContext(schemes=["bcrypt"], deprecated="auto", bcrypt__rounds=12)
_oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login", auto_error=False)


# ---------------------------------------------------------------------------
# Passwords
# ---------------------------------------------------------------------------


def hash_password(plain: str) -> str:
    return _pwd.hash(plain)


def verify_password(plain: str, hashed: str) -> bool:
    try:
        return _pwd.verify(plain, hashed)
    except (ValueError, TypeError):
        return False


# ---------------------------------------------------------------------------
# JWTs
# ---------------------------------------------------------------------------


def create_access_token(subject: str, expires_minutes: int | None = None) -> str:
    """Issue an access token whose ``sub`` is the user ID."""
    expire_min = expires_minutes or _settings.jwt_access_token_expire_minutes
    now = datetime.now(timezone.utc)
    payload = {
        "sub": subject,
        "iat": int(now.timestamp()),
        "exp": int((now + timedelta(minutes=expire_min)).timestamp()),
        "type": "access",
    }
    return jwt.encode(payload, _settings.jwt_secret_key, algorithm=_settings.jwt_algorithm)


def decode_token(token: str) -> dict:
    """Decode and validate a JWT. Raises ``HTTPException`` on any error."""
    try:
        return jwt.decode(token, _settings.jwt_secret_key, algorithms=[_settings.jwt_algorithm])
    except JWTError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        ) from exc


# ---------------------------------------------------------------------------
# Current user dependency
# ---------------------------------------------------------------------------


def get_current_user(
    token: str | None = Depends(_oauth2_scheme),
    db: Session = Depends(get_db),
) -> models.User:
    """FastAPI dependency that resolves the authenticated holder.

    Returns 401 on missing/invalid token or unknown user.
    """
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="missing bearer token",
            headers={"WWW-Authenticate": "Bearer"},
        )
    payload = decode_token(token)
    user_id = payload.get("sub")
    if not user_id or payload.get("type") != "access":
        raise HTTPException(status_code=401, detail="invalid token payload")
    user = db.get(models.User, user_id)
    if not user:
        raise HTTPException(status_code=401, detail="user not found")
    return user
