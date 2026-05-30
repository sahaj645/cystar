"""Cryptographic primitives for selective disclosure.

This module implements two primitives:

1. **Ed25519 signatures** via PyNaCl. Fast, deterministic, 32-byte keys, 64-byte
   signatures. Used by the issuer to sign credential roots.

2. **Salted Merkle trees** with SHA-256. Each claim becomes a leaf; the issuer
   signs the root. To disclose a subset of claims, the holder reveals the claim
   values, their salts, and inclusion proofs. The verifier reconstructs the
   root from disclosed leaves + proofs and checks the issuer's signature.

Design notes:

- Leaves are computed as ``SHA256(canonical_json({"name": name, "value": value,
  "salt": salt_hex}))``. The salt is 32 bytes of OS randomness per claim. This
  prevents rainbow-table attacks against low-entropy claims (e.g. ``gender``).

- Internal nodes are computed as ``SHA256(left || right)`` where ``left`` and
  ``right`` are the raw 32-byte digests of the children.

- The tree is balanced by duplicating the last leaf when a level has an odd
  count. This matches the construction used by Bitcoin and most CT logs and
  makes proof verification trivially linear in tree depth.

- All sibling digests in a proof are emitted with a positional flag
  (``"L"``/``"R"``) so the verifier knows which side to concatenate.

The module is intentionally dependency-light: only PyNaCl + stdlib. It must be
deterministic across processes, so we never use Python's ``hash()`` or
nondeterministic JSON dumps.
"""
from __future__ import annotations

import hashlib
import json
import secrets
from dataclasses import dataclass
from typing import Any

from nacl.exceptions import BadSignatureError
from nacl.signing import SigningKey, VerifyKey


# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

SALT_BYTES = 32
"""Per-claim salt size. 256 bits of entropy is overkill for our threat model
but cheap to carry around in a presentation."""

DIGEST_BYTES = 32
"""SHA-256 output size."""


# ---------------------------------------------------------------------------
# Ed25519 helpers
# ---------------------------------------------------------------------------


def generate_signing_keypair() -> tuple[str, str]:
    """Generate a fresh Ed25519 keypair.

    Returns:
        ``(signing_key_hex, verify_key_hex)`` — both 64-character lowercase hex.
    """
    sk = SigningKey.generate()
    return sk.encode().hex(), sk.verify_key.encode().hex()


def sign_message(message: bytes, signing_key_hex: str) -> str:
    """Sign ``message`` with an Ed25519 signing key.

    Args:
        message: Raw bytes to sign. Callers should pre-canonicalize.
        signing_key_hex: 64-char hex-encoded 32-byte seed.

    Returns:
        Hex-encoded 64-byte detached signature.
    """
    if len(signing_key_hex) != 64:
        raise ValueError("signing key must be 32 bytes (64 hex chars)")
    sk = SigningKey(bytes.fromhex(signing_key_hex))
    return sk.sign(message).signature.hex()


def verify_signature(message: bytes, signature_hex: str, verify_key_hex: str) -> bool:
    """Verify an Ed25519 signature.

    Returns ``True`` on valid signature, ``False`` on any failure (bad sig,
    malformed key, malformed signature). Never raises.
    """
    try:
        if len(verify_key_hex) != 64 or len(signature_hex) != 128:
            return False
        vk = VerifyKey(bytes.fromhex(verify_key_hex))
        vk.verify(message, bytes.fromhex(signature_hex))
        return True
    except (BadSignatureError, ValueError):
        return False


# ---------------------------------------------------------------------------
# Canonical serialization
# ---------------------------------------------------------------------------


def canonical_json(value: Any) -> bytes:
    """Deterministic JSON encoding suitable for hashing.

    - Keys sorted lexicographically.
    - No whitespace.
    - Unicode preserved (no ASCII escape).
    - Floats are not used in claim values; if they appear, ``json`` uses its
      default repr which is platform-deterministic for our purposes.
    """
    return json.dumps(
        value,
        sort_keys=True,
        separators=(",", ":"),
        ensure_ascii=False,
    ).encode("utf-8")


def generate_salt() -> str:
    """Return a fresh 32-byte hex-encoded salt."""
    return secrets.token_hex(SALT_BYTES)


def hash_claim(name: str, value: Any, salt_hex: str) -> bytes:
    """Hash a single (name, value, salt) tuple into a Merkle leaf.

    The claim name is included in the hash so a holder cannot swap claim values
    between fields (e.g. present the ``cgpa`` value as the ``year`` value).
    """
    if not name:
        raise ValueError("claim name must be non-empty")
    if len(salt_hex) != SALT_BYTES * 2:
        raise ValueError("salt must be 64 hex chars")
    payload = canonical_json({"name": name, "value": value, "salt": salt_hex})
    return hashlib.sha256(payload).digest()


# ---------------------------------------------------------------------------
# Merkle tree
# ---------------------------------------------------------------------------


@dataclass(frozen=True)
class ProofStep:
    """A single step in a Merkle inclusion proof.

    ``position`` indicates which side the sibling is on relative to the running
    hash: ``"L"`` means concatenate as ``sibling || running``, ``"R"`` means
    ``running || sibling``.
    """

    sibling_hex: str
    position: str  # "L" or "R"

    def to_dict(self) -> dict[str, str]:
        return {"sibling": self.sibling_hex, "position": self.position}

    @classmethod
    def from_dict(cls, d: dict[str, str]) -> ProofStep:
        if d.get("position") not in ("L", "R"):
            raise ValueError("proof step position must be 'L' or 'R'")
        return cls(sibling_hex=d["sibling"], position=d["position"])


class MerkleTree:
    """Balanced binary Merkle tree over SHA-256.

    The tree is built bottom-up. Odd levels are padded by duplicating the last
    node, which yields proofs of length ``ceil(log2(n))``.

    The tree is immutable once constructed.
    """

    __slots__ = ("_leaves", "_levels")

    def __init__(self, leaves: list[bytes]) -> None:
        if not leaves:
            raise ValueError("Merkle tree requires at least one leaf")
        for leaf in leaves:
            if len(leaf) != DIGEST_BYTES:
                raise ValueError("leaves must be 32-byte SHA-256 digests")
        self._leaves: list[bytes] = list(leaves)
        self._levels: list[list[bytes]] = self._build_levels(self._leaves)

    # ----- public API -----

    @property
    def root(self) -> bytes:
        """The Merkle root digest (32 bytes)."""
        return self._levels[-1][0]

    @property
    def root_hex(self) -> str:
        return self.root.hex()

    @property
    def leaf_count(self) -> int:
        return len(self._leaves)

    def proof(self, index: int) -> list[ProofStep]:
        """Return the inclusion proof for the leaf at ``index``.

        The proof is a list of sibling digests from leaf level upward.
        """
        if not 0 <= index < len(self._leaves):
            raise IndexError("leaf index out of range")
        steps: list[ProofStep] = []
        idx = index
        for level in self._levels[:-1]:
            # If odd index, sibling is on the left; else on the right.
            if idx % 2 == 0:
                sibling_idx = idx + 1
                # Padded level may have duplicated last node — handle gracefully.
                if sibling_idx >= len(level):
                    sibling_idx = idx
                steps.append(ProofStep(level[sibling_idx].hex(), "R"))
            else:
                steps.append(ProofStep(level[idx - 1].hex(), "L"))
            idx //= 2
        return steps

    # ----- construction -----

    @staticmethod
    def _build_levels(leaves: list[bytes]) -> list[list[bytes]]:
        levels: list[list[bytes]] = [leaves]
        current = leaves
        while len(current) > 1:
            if len(current) % 2 == 1:
                current = current + [current[-1]]  # duplicate last for padding
            nxt: list[bytes] = []
            for i in range(0, len(current), 2):
                nxt.append(hashlib.sha256(current[i] + current[i + 1]).digest())
            levels.append(nxt)
            current = nxt
        return levels


# ---------------------------------------------------------------------------
# Proof verification (stateless — runs in the verifier without the tree)
# ---------------------------------------------------------------------------


def verify_merkle_proof(
    leaf: bytes,
    proof: list[ProofStep] | list[dict[str, str]],
    root_hex: str,
) -> bool:
    """Verify a Merkle inclusion proof.

    Args:
        leaf: 32-byte leaf digest.
        proof: List of ``ProofStep`` (or their dict form).
        root_hex: Expected root, 64-char hex.

    Returns:
        ``True`` iff the proof reconstructs the given root.
    """
    if len(leaf) != DIGEST_BYTES or len(root_hex) != DIGEST_BYTES * 2:
        return False
    running = leaf
    for step in proof:
        if isinstance(step, dict):
            step = ProofStep.from_dict(step)
        try:
            sibling = bytes.fromhex(step.sibling_hex)
        except ValueError:
            return False
        if len(sibling) != DIGEST_BYTES:
            return False
        if step.position == "L":
            running = hashlib.sha256(sibling + running).digest()
        elif step.position == "R":
            running = hashlib.sha256(running + sibling).digest()
        else:
            return False
    return running.hex() == root_hex


# ---------------------------------------------------------------------------
# High-level helpers: build a credential, build a presentation
# ---------------------------------------------------------------------------


@dataclass(frozen=True)
class IssuedCredential:
    """Server-side representation of an issued credential.

    Contains everything needed to later produce selective-disclosure
    presentations. Only the salts are sensitive (they bind a leaf to a claim
    value); the leaves themselves are safe to expose to the holder.
    """

    claims: dict[str, Any]
    salts: dict[str, str]
    leaf_order: list[str]  # canonical ordering used to build the tree
    leaves_hex: list[str]
    merkle_root_hex: str
    signature_hex: str
    issuer_public_key_hex: str


def issue_credential(
    claims: dict[str, Any],
    issuer_signing_key_hex: str,
    issuer_public_key_hex: str,
) -> IssuedCredential:
    """Build a Merkle tree over the claims and sign the root.

    The leaf order is the lexicographic ordering of claim names. This makes the
    construction deterministic across servers and easy to audit. The signed
    payload binds the root to the issuer public key so a verifier cannot be
    tricked into validating against a different key.
    """
    if not claims:
        raise ValueError("at least one claim is required")

    leaf_order = sorted(claims.keys())
    salts = {name: generate_salt() for name in leaf_order}
    leaves = [hash_claim(name, claims[name], salts[name]) for name in leaf_order]
    tree = MerkleTree(leaves)

    signed_payload = canonical_json(
        {
            "root": tree.root_hex,
            "issuer_public_key": issuer_public_key_hex,
            "leaf_order": leaf_order,
        }
    )
    signature_hex = sign_message(signed_payload, issuer_signing_key_hex)

    return IssuedCredential(
        claims=claims,
        salts=salts,
        leaf_order=leaf_order,
        leaves_hex=[leaf.hex() for leaf in leaves],
        merkle_root_hex=tree.root_hex,
        signature_hex=signature_hex,
        issuer_public_key_hex=issuer_public_key_hex,
    )


def build_presentation(
    credential: IssuedCredential,
    disclose: list[str],
) -> dict[str, Any]:
    """Construct a selective-disclosure presentation.

    Args:
        credential: Previously issued credential (server-side).
        disclose: Subset of claim names to reveal. Must be non-empty.

    Returns:
        A dict containing only the revealed claims, their salts, their Merkle
        proofs, the signed root, and the issuer's public key. This is the only
        artifact the verifier needs.
    """
    if not disclose:
        raise ValueError("must disclose at least one claim")
    unknown = set(disclose) - set(credential.leaf_order)
    if unknown:
        raise ValueError(f"unknown claims: {sorted(unknown)}")

    # Rebuild the tree to derive proofs. Cheap: SHA-256 over a handful of leaves.
    leaves = [bytes.fromhex(h) for h in credential.leaves_hex]
    tree = MerkleTree(leaves)

    revealed_claims = {name: credential.claims[name] for name in disclose}
    revealed_salts = {name: credential.salts[name] for name in disclose}
    proofs: dict[str, list[dict[str, str]]] = {}
    for name in disclose:
        idx = credential.leaf_order.index(name)
        proofs[name] = [step.to_dict() for step in tree.proof(idx)]

    return {
        "revealed_claims": revealed_claims,
        "salts": revealed_salts,
        "merkle_proofs": proofs,
        "merkle_root": credential.merkle_root_hex,
        "leaf_order": credential.leaf_order,
        "signature": credential.signature_hex,
        "issuer_public_key": credential.issuer_public_key_hex,
    }


# ---------------------------------------------------------------------------
# Presentation verification
# ---------------------------------------------------------------------------


@dataclass(frozen=True)
class VerificationResult:
    """Outcome of verifying a presentation.

    ``verified`` is the single boolean a UI should branch on. The other fields
    are diagnostic and safe to surface to the verifier.
    """

    verified: bool
    fields_verified: list[str]
    failure_reason: str | None = None

    def to_dict(self) -> dict[str, Any]:
        return {
            "verified": self.verified,
            "fields_verified": self.fields_verified,
            "failure_reason": self.failure_reason,
        }


def verify_presentation(presentation: dict[str, Any]) -> VerificationResult:
    """Verify a presentation end-to-end.

    Steps:

    1. Verify the issuer's signature over ``{root, issuer_public_key, leaf_order}``.
    2. For each revealed claim, recompute its leaf hash and walk its proof to
       the root.
    3. Return success only if every step passes.

    The function never raises on malformed input; it returns a
    ``VerificationResult`` with ``failure_reason`` set.
    """
    required = {
        "revealed_claims",
        "salts",
        "merkle_proofs",
        "merkle_root",
        "leaf_order",
        "signature",
        "issuer_public_key",
    }
    missing = required - presentation.keys()
    if missing:
        return VerificationResult(False, [], f"missing fields: {sorted(missing)}")

    revealed = presentation["revealed_claims"]
    salts = presentation["salts"]
    proofs = presentation["merkle_proofs"]
    root_hex = presentation["merkle_root"]
    leaf_order = presentation["leaf_order"]
    signature_hex = presentation["signature"]
    issuer_pk_hex = presentation["issuer_public_key"]

    if not isinstance(revealed, dict) or not revealed:
        return VerificationResult(False, [], "revealed_claims must be a non-empty object")

    # Step 1: issuer signature over the root binds it to a specific issuer key.
    signed_payload = canonical_json(
        {
            "root": root_hex,
            "issuer_public_key": issuer_pk_hex,
            "leaf_order": leaf_order,
        }
    )
    if not verify_signature(signed_payload, signature_hex, issuer_pk_hex):
        return VerificationResult(False, [], "issuer signature invalid")

    # Step 2: walk each disclosed leaf to the root.
    verified_fields: list[str] = []
    for name, value in revealed.items():
        if name not in leaf_order:
            return VerificationResult(False, verified_fields, f"claim '{name}' not in leaf order")
        if name not in salts or name not in proofs:
            return VerificationResult(False, verified_fields, f"missing salt or proof for '{name}'")
        try:
            leaf = hash_claim(name, value, salts[name])
        except ValueError as exc:
            return VerificationResult(False, verified_fields, f"bad salt for '{name}': {exc}")
        if not verify_merkle_proof(leaf, proofs[name], root_hex):
            return VerificationResult(
                False, verified_fields, f"merkle proof failed for '{name}'"
            )
        verified_fields.append(name)

    return VerificationResult(True, verified_fields, None)
