"""Credential issuance, listing, and selective sharing endpoints."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.security import get_current_user
from app.db import models
from app.db.session import get_db
from app.schemas.credentials import (
    CredentialResponse,
    IssueCredentialRequest,
    ShareRequest,
    ShareResponse,
)
from app.services.credential_service import (
    CredentialError,
    issue_for_user,
    share_credential,
)

router = APIRouter(prefix="/api/credentials", tags=["credentials"])
_settings = get_settings()


def _to_response(c: models.Credential) -> CredentialResponse:
    return CredentialResponse(
        id=c.id,
        credential_type=c.credential_type,
        issuer_name=c.issuer_name,
        issuer_public_key=c.issuer_public_key_hex,
        merkle_root=c.merkle_root_hex,
        signature=c.signature_hex,
        claims=c.claims,
        leaf_order=list(c.leaf_order),
        issued_at=c.issued_at,
    )


@router.post("/issue", response_model=CredentialResponse, status_code=status.HTTP_201_CREATED)
def issue(
    request: Request,
    body: IssueCredentialRequest,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
) -> CredentialResponse:
    """Issue a new verifiable credential to the authenticated holder."""
    keys = request.app.state.issuer_keys
    credential = issue_for_user(
        db=db,
        holder=user,
        claims=body.claims,
        credential_type=body.credential_type,
        issuer_signing_key=keys["signing"],
        issuer_public_key=keys["public"],
        issuer_name=_settings.issuer_name,
    )
    return _to_response(credential)


@router.get("", response_model=list[CredentialResponse])
def list_my_credentials(
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
) -> list[CredentialResponse]:
    rows = (
        db.query(models.Credential)
        .filter(models.Credential.holder_id == user.id)
        .order_by(models.Credential.issued_at.desc())
        .all()
    )
    return [_to_response(c) for c in rows]


@router.get("/{credential_id}", response_model=CredentialResponse)
def get_credential(
    credential_id: str,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
) -> CredentialResponse:
    c = db.get(models.Credential, credential_id)
    if not c or c.holder_id != user.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "credential not found")
    return _to_response(c)


@router.post("/share", response_model=ShareResponse, status_code=status.HTTP_201_CREATED)
def share(
    body: ShareRequest,
    request: Request,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
) -> ShareResponse:
    """Create a selective-disclosure share link revealing only chosen fields."""
    try:
        disclosure = share_credential(
            db=db,
            holder=user,
            credential_id=body.credential_id,
            fields=body.fields,
            expires_in_minutes=body.expires_in_minutes,
        )
    except CredentialError as exc:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, str(exc)) from exc

    share_url = f"{_settings.public_frontend_url}/verify/{disclosure.share_token}"
    return ShareResponse(
        share_token=disclosure.share_token,
        share_url=share_url,
        expires_at=disclosure.expires_at,
        revealed_fields=list(disclosure.revealed_fields),
    )
