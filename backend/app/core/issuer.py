"""Issuer key management.

In development we auto-generate an Ed25519 keypair on startup and persist it
in a JSON file inside the data directory. In production the keys must be
provided via environment variables and never written to disk.
"""
from __future__ import annotations

import json
import logging
import os
from pathlib import Path

from app.core.config import get_settings
from app.core.crypto import generate_signing_keypair

_log = logging.getLogger(__name__)
_settings = get_settings()


class IssuerKeyError(RuntimeError):
    """Raised when issuer keys cannot be loaded or generated."""


def _persisted_key_path() -> Path:
    db_path = _settings.database_url.replace("sqlite:///", "")
    return Path(db_path).resolve().parent / "issuer_keys.json"


def load_or_create_issuer_keys() -> tuple[str, str]:
    """Return ``(signing_key_hex, public_key_hex)``.

    Resolution order:
    1. Both keys supplied via environment.
    2. In dev, load from the persisted ``issuer_keys.json``.
    3. In dev, generate a fresh pair and persist.
    4. In production, raise.
    """
    if _settings.issuer_signing_key and _settings.issuer_public_key:
        return _settings.issuer_signing_key, _settings.issuer_public_key

    if _settings.is_production:
        raise IssuerKeyError(
            "ISSUER_SIGNING_KEY and ISSUER_PUBLIC_KEY must be set in production"
        )

    path = _persisted_key_path()
    if path.exists():
        try:
            data = json.loads(path.read_text())
            return data["signing_key"], data["public_key"]
        except (KeyError, json.JSONDecodeError) as exc:
            raise IssuerKeyError(f"corrupt issuer keys file at {path}") from exc

    sk, pk = generate_signing_keypair()
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps({"signing_key": sk, "public_key": pk}))
    try:
        os.chmod(path, 0o600)
    except OSError:
        # Best-effort on platforms without POSIX permissions (Windows).
        pass
    _log.warning("Generated new issuer keypair at %s (development only)", path)
    return sk, pk
