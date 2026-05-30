"""SQLAlchemy ORM models.

Schema overview:

- ``users``           — authenticated holder accounts.
- ``credentials``     — issued verifiable credentials (signed Merkle roots).
- ``disclosures``     — selective-disclosure share tokens with expiry.

We store the full claims dict + per-claim salts so the holder can produce
fresh presentations later. Salts are sensitive — they bind a leaf to a claim
value — but they are stored alongside the claim values which are equally
sensitive, so a single tier of access control covers both.
"""
from __future__ import annotations

import secrets
import uuid
from datetime import datetime, timezone

from sqlalchemy import JSON, DateTime, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.session import Base


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _new_uuid() -> str:
    return str(uuid.uuid4())


def _new_share_token() -> str:
    """URL-safe random token. 22 chars of base64 ~ 128 bits of entropy."""
    return secrets.token_urlsafe(16)


class User(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_new_uuid)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    full_name: Mapped[str] = mapped_column(String(255), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)

    credentials: Mapped[list[Credential]] = relationship(
        "Credential", back_populates="holder", cascade="all, delete-orphan"
    )


class Credential(Base):
    __tablename__ = "credentials"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_new_uuid)
    holder_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)

    # The issued claims (visible to the holder).
    claims: Mapped[dict] = mapped_column(JSON, nullable=False)
    # Per-claim salts (sensitive — required to recompute leaves).
    salts: Mapped[dict] = mapped_column(JSON, nullable=False)
    # Canonical leaf ordering used during issuance.
    leaf_order: Mapped[list] = mapped_column(JSON, nullable=False)
    # Pre-computed leaf hashes, hex-encoded (avoids recomputation on share).
    leaves_hex: Mapped[list] = mapped_column(JSON, nullable=False)

    merkle_root_hex: Mapped[str] = mapped_column(String(64), nullable=False)
    signature_hex: Mapped[str] = mapped_column(String(128), nullable=False)
    issuer_public_key_hex: Mapped[str] = mapped_column(String(64), nullable=False)

    issuer_name: Mapped[str] = mapped_column(String(255), nullable=False)
    credential_type: Mapped[str] = mapped_column(String(100), default="VerifiableCredential")
    issued_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)

    holder: Mapped[User] = relationship("User", back_populates="credentials")
    disclosures: Mapped[list[Disclosure]] = relationship(
        "Disclosure", back_populates="credential", cascade="all, delete-orphan"
    )


class Disclosure(Base):
    __tablename__ = "disclosures"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_new_uuid)
    credential_id: Mapped[str] = mapped_column(
        ForeignKey("credentials.id", ondelete="CASCADE"), index=True
    )
    share_token: Mapped[str] = mapped_column(
        String(32), unique=True, index=True, default=_new_share_token
    )
    revealed_fields: Mapped[list] = mapped_column(JSON, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    revoked: Mapped[int] = mapped_column(Integer, default=0)  # 0/1 for SQLite portability
    view_count: Mapped[int] = mapped_column(Integer, default=0)

    credential: Mapped[Credential] = relationship("Credential", back_populates="disclosures")

    @property
    def is_expired(self) -> bool:
        expires = self.expires_at
        if expires.tzinfo is None:
            expires = expires.replace(tzinfo=timezone.utc)
        return _utcnow() >= expires
