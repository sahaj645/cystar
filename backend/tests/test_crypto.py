"""Unit tests for the cryptographic core.

These tests are the most important in the project. Selective disclosure relies
on the Merkle tree refusing to validate tampered claims. Every form of tamper
we can imagine has a test here.
"""
from __future__ import annotations

import json

import pytest

from app.core.crypto import (
    MerkleTree,
    ProofStep,
    build_presentation,
    canonical_json,
    generate_salt,
    generate_signing_keypair,
    hash_claim,
    issue_credential,
    sign_message,
    verify_merkle_proof,
    verify_presentation,
    verify_signature,
)


# ---------------------------------------------------------------------------
# Ed25519
# ---------------------------------------------------------------------------


class TestEd25519:
    def test_keypair_format(self) -> None:
        sk, pk = generate_signing_keypair()
        assert len(sk) == 64 and len(pk) == 64
        int(sk, 16)  # parses as hex
        int(pk, 16)

    def test_sign_and_verify_roundtrip(self) -> None:
        sk, pk = generate_signing_keypair()
        msg = b"hello cystar"
        sig = sign_message(msg, sk)
        assert verify_signature(msg, sig, pk) is True

    def test_verify_rejects_wrong_message(self) -> None:
        sk, pk = generate_signing_keypair()
        sig = sign_message(b"original", sk)
        assert verify_signature(b"tampered", sig, pk) is False

    def test_verify_rejects_wrong_key(self) -> None:
        sk1, _ = generate_signing_keypair()
        _, pk2 = generate_signing_keypair()
        sig = sign_message(b"msg", sk1)
        assert verify_signature(b"msg", sig, pk2) is False

    def test_verify_rejects_malformed(self) -> None:
        _, pk = generate_signing_keypair()
        assert verify_signature(b"msg", "not-hex", pk) is False
        assert verify_signature(b"msg", "ab" * 64, "not-a-key") is False

    def test_sign_rejects_bad_key_length(self) -> None:
        with pytest.raises(ValueError):
            sign_message(b"msg", "abcd")


# ---------------------------------------------------------------------------
# Canonical JSON
# ---------------------------------------------------------------------------


class TestCanonicalJson:
    def test_sorts_keys(self) -> None:
        a = canonical_json({"b": 1, "a": 2})
        b = canonical_json({"a": 2, "b": 1})
        assert a == b
        assert json.loads(a) == {"a": 2, "b": 1}

    def test_no_whitespace(self) -> None:
        assert b" " not in canonical_json({"a": 1, "b": 2})

    def test_unicode_preserved(self) -> None:
        out = canonical_json({"name": "Ådne"})
        assert "Å".encode() in out


# ---------------------------------------------------------------------------
# Claim hashing
# ---------------------------------------------------------------------------


class TestClaimHash:
    def test_deterministic(self) -> None:
        salt = generate_salt()
        assert hash_claim("name", "Sahaj", salt) == hash_claim("name", "Sahaj", salt)

    def test_different_salt_yields_different_hash(self) -> None:
        s1, s2 = generate_salt(), generate_salt()
        assert hash_claim("name", "Sahaj", s1) != hash_claim("name", "Sahaj", s2)

    def test_different_name_yields_different_hash(self) -> None:
        salt = generate_salt()
        assert hash_claim("name", "Sahaj", salt) != hash_claim("alias", "Sahaj", salt)

    def test_different_value_yields_different_hash(self) -> None:
        salt = generate_salt()
        assert hash_claim("name", "A", salt) != hash_claim("name", "B", salt)

    def test_rejects_bad_salt(self) -> None:
        with pytest.raises(ValueError):
            hash_claim("name", "X", "short")

    def test_rejects_empty_name(self) -> None:
        with pytest.raises(ValueError):
            hash_claim("", "X", generate_salt())


# ---------------------------------------------------------------------------
# Merkle tree
# ---------------------------------------------------------------------------


def _leaf(s: str) -> bytes:
    return hash_claim("k", s, generate_salt())


class TestMerkleTree:
    def test_single_leaf(self) -> None:
        leaf = _leaf("only")
        tree = MerkleTree([leaf])
        assert tree.root == leaf
        assert tree.proof(0) == []
        assert verify_merkle_proof(leaf, [], tree.root_hex)

    def test_two_leaves(self) -> None:
        leaves = [_leaf("a"), _leaf("b")]
        tree = MerkleTree(leaves)
        for i, leaf in enumerate(leaves):
            assert verify_merkle_proof(leaf, tree.proof(i), tree.root_hex)

    def test_odd_count(self) -> None:
        leaves = [_leaf(s) for s in ("a", "b", "c")]
        tree = MerkleTree(leaves)
        for i, leaf in enumerate(leaves):
            assert verify_merkle_proof(leaf, tree.proof(i), tree.root_hex)

    @pytest.mark.parametrize("n", [1, 2, 3, 4, 5, 7, 8, 13, 16, 33, 64])
    def test_many_sizes(self, n: int) -> None:
        leaves = [_leaf(f"claim-{i}") for i in range(n)]
        tree = MerkleTree(leaves)
        for i, leaf in enumerate(leaves):
            assert verify_merkle_proof(leaf, tree.proof(i), tree.root_hex)

    def test_tampered_leaf_rejected(self) -> None:
        leaves = [_leaf(s) for s in ("a", "b", "c", "d")]
        tree = MerkleTree(leaves)
        tampered = _leaf("evil")
        assert not verify_merkle_proof(tampered, tree.proof(0), tree.root_hex)

    def test_tampered_proof_rejected(self) -> None:
        leaves = [_leaf(s) for s in ("a", "b", "c", "d")]
        tree = MerkleTree(leaves)
        proof = [s.to_dict() for s in tree.proof(0)]
        # Flip one bit in the first sibling.
        sibling = bytearray(bytes.fromhex(proof[0]["sibling"]))
        sibling[0] ^= 0x01
        proof[0]["sibling"] = sibling.hex()
        assert not verify_merkle_proof(leaves[0], proof, tree.root_hex)

    def test_wrong_root_rejected(self) -> None:
        leaves = [_leaf(s) for s in ("a", "b")]
        tree = MerkleTree(leaves)
        bogus = "00" * 32
        assert not verify_merkle_proof(leaves[0], tree.proof(0), bogus)

    def test_empty_tree_rejected(self) -> None:
        with pytest.raises(ValueError):
            MerkleTree([])

    def test_bad_leaf_size_rejected(self) -> None:
        with pytest.raises(ValueError):
            MerkleTree([b"too short"])

    def test_proof_index_out_of_range(self) -> None:
        tree = MerkleTree([_leaf("a"), _leaf("b")])
        with pytest.raises(IndexError):
            tree.proof(99)

    def test_proof_step_serialization(self) -> None:
        step = ProofStep("ab" * 32, "L")
        assert ProofStep.from_dict(step.to_dict()) == step

    def test_proof_step_bad_position(self) -> None:
        with pytest.raises(ValueError):
            ProofStep.from_dict({"sibling": "ab" * 32, "position": "X"})


# ---------------------------------------------------------------------------
# Full credential + presentation flow
# ---------------------------------------------------------------------------


@pytest.fixture
def keypair() -> tuple[str, str]:
    return generate_signing_keypair()


@pytest.fixture
def credential(keypair: tuple[str, str]):
    sk, pk = keypair
    return issue_credential(
        {
            "name": "Sahaj Gaur",
            "degree": "B.Tech Computer Science",
            "graduationYear": 2026,
            "cgpa": 9.1,
            "marks": 920,
            "issuer": "IIT Madras",
        },
        sk,
        pk,
    )


class TestCredentialFlow:
    def test_issue_produces_signed_root(self, credential) -> None:
        assert credential.merkle_root_hex
        assert credential.signature_hex
        assert len(credential.leaf_order) == 6

    def test_full_disclosure_verifies(self, credential) -> None:
        presentation = build_presentation(credential, credential.leaf_order)
        result = verify_presentation(presentation)
        assert result.verified, result.failure_reason
        assert set(result.fields_verified) == set(credential.leaf_order)

    def test_partial_disclosure_verifies(self, credential) -> None:
        presentation = build_presentation(credential, ["name", "degree", "graduationYear"])
        result = verify_presentation(presentation)
        assert result.verified, result.failure_reason
        assert set(result.fields_verified) == {"name", "degree", "graduationYear"}
        assert "cgpa" not in presentation["revealed_claims"]

    def test_tampered_claim_value_fails(self, credential) -> None:
        presentation = build_presentation(credential, ["degree", "cgpa"])
        presentation["revealed_claims"]["cgpa"] = 10.0  # forge a better CGPA
        result = verify_presentation(presentation)
        assert not result.verified

    def test_tampered_salt_fails(self, credential) -> None:
        presentation = build_presentation(credential, ["degree"])
        presentation["salts"]["degree"] = generate_salt()
        result = verify_presentation(presentation)
        assert not result.verified

    def test_tampered_proof_fails(self, credential) -> None:
        presentation = build_presentation(credential, ["degree", "cgpa"])
        proof = presentation["merkle_proofs"]["cgpa"]
        sibling = bytearray(bytes.fromhex(proof[0]["sibling"]))
        sibling[0] ^= 0x01
        proof[0]["sibling"] = sibling.hex()
        assert not verify_presentation(presentation).verified

    def test_tampered_root_fails(self, credential) -> None:
        presentation = build_presentation(credential, ["degree"])
        presentation["merkle_root"] = "00" * 32
        assert not verify_presentation(presentation).verified

    def test_wrong_issuer_key_fails(self, credential) -> None:
        presentation = build_presentation(credential, ["degree"])
        _, bogus_pk = generate_signing_keypair()
        presentation["issuer_public_key"] = bogus_pk
        assert not verify_presentation(presentation).verified

    def test_unknown_claim_rejected(self, credential) -> None:
        with pytest.raises(ValueError):
            build_presentation(credential, ["does-not-exist"])

    def test_empty_disclose_rejected(self, credential) -> None:
        with pytest.raises(ValueError):
            build_presentation(credential, [])

    def test_missing_fields_in_presentation(self, credential) -> None:
        presentation = build_presentation(credential, ["degree"])
        del presentation["signature"]
        result = verify_presentation(presentation)
        assert not result.verified
        assert "missing fields" in (result.failure_reason or "")

    def test_swapped_claim_value_fails(self, credential) -> None:
        """Forging by swapping name->value bindings should fail."""
        presentation = build_presentation(credential, ["cgpa", "marks"])
        presentation["revealed_claims"]["cgpa"], presentation["revealed_claims"]["marks"] = (
            presentation["revealed_claims"]["marks"],
            presentation["revealed_claims"]["cgpa"],
        )
        assert not verify_presentation(presentation).verified
