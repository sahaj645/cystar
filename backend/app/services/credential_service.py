"""Business logic for credential issuance and selective sharing."""
from __future__ import annotations

from datetime import datetime, timedelta, timezone

from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.crypto import (
    IssuedCredential,
    build_presentation,
    issue_credential,
)
from app.db import models

_settings = get_settings()


class CredentialError(Exception):
    """Raised for validation failures the API should translate to 4xx."""


def issue_for_user(
    db: Session,
    holder: models.User,
    claims: dict,
    credential_type: str,
    issuer_signing_key: str,
    issuer_public_key: str,
    issuer_name: str,
) -> models.Credential:
    """Build a signed Merkle credential and persist it."""
    issued: IssuedCredential = issue_credential(claims, issuer_signing_key, issuer_public_key)
    row = models.Credential(
        holder_id=holder.id,
        claims=issued.claims,
        salts=issued.salts,
        leaf_order=issued.leaf_order,
        leaves_hex=issued.leaves_hex,
        merkle_root_hex=issued.merkle_root_hex,
        signature_hex=issued.signature_hex,
        issuer_public_key_hex=issued.issuer_public_key_hex,
        issuer_name=issuer_name,
        credential_type=credential_type,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


def _to_issued(row: models.Credential) -> IssuedCredential:
    return IssuedCredential(
        claims=row.claims,
        salts=row.salts,
        leaf_order=list(row.leaf_order),
        leaves_hex=list(row.leaves_hex),
        merkle_root_hex=row.merkle_root_hex,
        signature_hex=row.signature_hex,
        issuer_public_key_hex=row.issuer_public_key_hex,
    )


def share_credential(
    db: Session,
    holder: models.User,
    credential_id: str,
    fields: list[str],
    expires_in_minutes: int | None,
) -> models.Disclosure:
    """Create a time-limited share token revealing a subset of fields."""
    credential = db.get(models.Credential, credential_id)
    if not credential or credential.holder_id != holder.id:
        raise CredentialError("credential not found")

    expires_min = expires_in_minutes or _settings.default_share_expiry_minutes
    if expires_min > _settings.max_share_expiry_minutes:
        raise CredentialError(
            f"expiry must not exceed {_settings.max_share_expiry_minutes} minutes"
        )

    # Validate fields against the credential's leaf order.
    unknown = set(fields) - set(credential.leaf_order)
    if unknown:
        raise CredentialError(f"unknown fields: {sorted(unknown)}")

    # Build the presentation eagerly to surface any crypto errors here, not on
    # the public verify endpoint.
    _ = build_presentation(_to_issued(credential), fields)

    disclosure = models.Disclosure(
        credential_id=credential.id,
        revealed_fields=list(fields),
        expires_at=datetime.now(timezone.utc) + timedelta(minutes=expires_min),
    )
    db.add(disclosure)
    db.commit()
    db.refresh(disclosure)
    return disclosure


def build_share_presentation(
    db: Session,
    share_token: str,
) -> tuple[models.Credential, models.Disclosure, dict]:
    """Return ``(credential, disclosure, presentation_dict)`` for a share token."""
    disclosure = (
        db.query(models.Disclosure).filter(models.Disclosure.share_token == share_token).first()
    )
    if not disclosure or disclosure.revoked:
        raise CredentialError("share not found")
    if disclosure.is_expired:
        raise CredentialError("share expired")
    credential = disclosure.credential
    presentation = build_presentation(_to_issued(credential), list(disclosure.revealed_fields))
    disclosure.view_count += 1
    db.commit()
    return credential, disclosure, presentation
