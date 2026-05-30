"""Authentication endpoints: register, login, current user."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.security import (
    create_access_token,
    get_current_user,
    hash_password,
    verify_password,
)
from app.db import models
from app.db.session import get_db
from app.middleware.rate_limit import limiter
from app.schemas.auth import LoginRequest, RegisterRequest, TokenResponse, UserResponse

router = APIRouter(prefix="/api/auth", tags=["auth"])
_settings = get_settings()


@router.post("/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
@limiter.limit(_settings.rate_limit_auth)
def register(request: Request, body: RegisterRequest, db: Session = Depends(get_db)) -> TokenResponse:
    """Create a holder account and return a JWT."""
    existing = db.query(models.User).filter(models.User.email == body.email).first()
    if existing:
        raise HTTPException(status.HTTP_409_CONFLICT, "email already registered")

    user = models.User(
        email=body.email,
        password_hash=hash_password(body.password),
        full_name=body.full_name,
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    return TokenResponse(
        access_token=create_access_token(user.id),
        expires_in_minutes=_settings.jwt_access_token_expire_minutes,
    )


@router.post("/login", response_model=TokenResponse)
@limiter.limit(_settings.rate_limit_auth)
def login(request: Request, body: LoginRequest, db: Session = Depends(get_db)) -> TokenResponse:
    """Exchange email + password for a JWT.

    Uses a constant-message error to avoid email-enumeration leaks.
    """
    user = db.query(models.User).filter(models.User.email == body.email).first()
    if not user or not verify_password(body.password, user.password_hash):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "invalid email or password")

    return TokenResponse(
        access_token=create_access_token(user.id),
        expires_in_minutes=_settings.jwt_access_token_expire_minutes,
    )


@router.get("/me", response_model=UserResponse)
def me(user: models.User = Depends(get_current_user)) -> UserResponse:
    return UserResponse(id=user.id, email=user.email, full_name=user.full_name)
