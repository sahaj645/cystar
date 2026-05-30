"""Public verification endpoints.

These endpoints are rate-limited per IP because they're unauthenticated and
expose cryptographic verification compute.

Note: no ``from __future__ import annotations`` — see app/api/auth.py for the
explanation. Body parameters need concrete runtime annotations to play nicely
with slowapi's decorator.
"""
from typing import Annotated

from fastapi import APIRouter, Body, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.crypto import verify_presentation
from app.db.session import get_db
from app.middleware.rate_limit import limiter
from app.schemas.credentials import (
    PresentationDocument,
    VerifyRequest,
    VerifyResponse,
)
from app.services.credential_service import CredentialError, build_share_presentation

router = APIRouter(prefix="/api/credentials", tags=["verify"])
_settings = get_settings()


def _compute_trust_score(verified: bool, revealed_count: int) -> int:
    """Cosmetic confidence score for the UI.

    Cryptographic verification is binary, but verifiers like a number. We map
    success to 90+ and scale gently with the number of revealed fields.
    """
    if not verified:
        return 0
    return min(100, 90 + revealed_count)


@router.get("/share/{share_token}", response_model=PresentationDocument)
@limiter.limit(_settings.rate_limit_verify)
def fetch_share(
    request: Request,
    share_token: str,
    db: Session = Depends(get_db),
) -> PresentationDocument:
    """Return the presentation document associated with a share token."""
    try:
        credential, disclosure, presentation = build_share_presentation(db, share_token)
    except CredentialError as exc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, str(exc)) from exc

    return PresentationDocument(
        credential_type=credential.credential_type,
        issuer_name=credential.issuer_name,
        issuer_public_key=presentation["issuer_public_key"],
        merkle_root=presentation["merkle_root"],
        signature=presentation["signature"],
        leaf_order=presentation["leaf_order"],
        revealed_claims=presentation["revealed_claims"],
        salts=presentation["salts"],
        merkle_proofs=presentation["merkle_proofs"],
        issued_at=credential.issued_at,
        expires_at=disclosure.expires_at,
    )


@router.post("/verify", response_model=VerifyResponse)
@limiter.limit(_settings.rate_limit_verify)
def verify(
    request: Request,
    body: Annotated[VerifyRequest, Body()],
    db: Session = Depends(get_db),
) -> VerifyResponse:
    """Verify a presentation cryptographically.

    Accepts either a ``share_token`` (we fetch the presentation) or an inline
    ``presentation`` document (the verifier passes everything themselves).
    """
    issuer_name: str | None = None
    issued_at = None
    expires_at = None
    revealed_claims: dict | None = None
    presentation_dict: dict

    if body.share_token:
        try:
            credential, disclosure, presentation_dict = build_share_presentation(
                db, body.share_token
            )
        except CredentialError as exc:
            return VerifyResponse(
                verified=False, fields_verified=[], failure_reason=str(exc)
            )
        issuer_name = credential.issuer_name
        issued_at = credential.issued_at
        expires_at = disclosure.expires_at
        revealed_claims = presentation_dict["revealed_claims"]
    elif body.presentation:
        presentation_dict = body.presentation.model_dump()
        issuer_name = body.presentation.issuer_name
        issued_at = body.presentation.issued_at
        expires_at = body.presentation.expires_at
        revealed_claims = body.presentation.revealed_claims
    else:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST, "must supply share_token or presentation"
        )

    result = verify_presentation(presentation_dict)

    return VerifyResponse(
        verified=result.verified,
        fields_verified=result.fields_verified,
        failure_reason=result.failure_reason,
        issuer_name=issuer_name,
        issued_at=issued_at,
        expires_at=expires_at,
        revealed_claims=revealed_claims if result.verified else None,
        trust_score=_compute_trust_score(result.verified, len(result.fields_verified)),
    )
