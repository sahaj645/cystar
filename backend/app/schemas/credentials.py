"""Pydantic schemas for credential endpoints."""
from __future__ import annotations

from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field, field_validator

# Hard limits to prevent abuse via giant payloads.
MAX_CLAIMS = 50
MAX_CLAIM_NAME_LEN = 64
MAX_CLAIM_VALUE_LEN = 1000


class IssueCredentialRequest(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    credential_type: str = Field(default="VerifiableCredential", max_length=100)
    claims: dict[str, Any] = Field(min_length=1)

    @field_validator("claims")
    @classmethod
    def _validate_claims(cls, v: dict[str, Any]) -> dict[str, Any]:
        if len(v) > MAX_CLAIMS:
            raise ValueError(f"too many claims (max {MAX_CLAIMS})")
        for name, value in v.items():
            if not name or not isinstance(name, str):
                raise ValueError("claim name must be non-empty string")
            if len(name) > MAX_CLAIM_NAME_LEN:
                raise ValueError(f"claim name '{name[:20]}…' too long")
            if isinstance(value, str) and len(value) > MAX_CLAIM_VALUE_LEN:
                raise ValueError(f"claim '{name}' value too long")
            if not isinstance(value, (str, int, float, bool)) and value is not None:
                raise ValueError(f"claim '{name}' must be a primitive value")
        return v


class CredentialResponse(BaseModel):
    id: str
    credential_type: str
    issuer_name: str
    issuer_public_key: str
    merkle_root: str
    signature: str
    claims: dict[str, Any]
    leaf_order: list[str]
    issued_at: datetime


class ShareRequest(BaseModel):
    credential_id: str
    fields: list[str] = Field(min_length=1)
    expires_in_minutes: int | None = Field(default=None, ge=1)

    @field_validator("fields")
    @classmethod
    def _no_duplicates(cls, v: list[str]) -> list[str]:
        if len(set(v)) != len(v):
            raise ValueError("duplicate fields in disclosure list")
        return v


class ShareResponse(BaseModel):
    share_token: str
    share_url: str
    expires_at: datetime
    revealed_fields: list[str]


class PresentationDocument(BaseModel):
    """The verifiable presentation a verifier inspects."""

    credential_type: str
    issuer_name: str
    issuer_public_key: str
    merkle_root: str
    signature: str
    leaf_order: list[str]
    revealed_claims: dict[str, Any]
    salts: dict[str, str]
    merkle_proofs: dict[str, list[dict[str, str]]]
    issued_at: datetime
    expires_at: datetime


class VerifyRequest(BaseModel):
    """Verify by share token (preferred) or by inline presentation."""

    share_token: str | None = None
    presentation: PresentationDocument | None = None

    @field_validator("share_token")
    @classmethod
    def _strip(cls, v: str | None) -> str | None:
        return v.strip() if v else v


class VerifyResponse(BaseModel):
    verified: bool
    fields_verified: list[str]
    failure_reason: str | None = None
    issuer_name: str | None = None
    issued_at: datetime | None = None
    expires_at: datetime | None = None
    revealed_claims: dict[str, Any] | None = None
    trust_score: int | None = None  # 0–100
