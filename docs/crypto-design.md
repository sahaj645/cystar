# Cryptographic design

This document explains the cryptographic primitives behind CyStar's selective
disclosure module and the threat model they defend against.

## Goals

A verifiable credential should let a holder reveal **any subset** of its claims
without giving the verifier the rest, while still letting the verifier confirm:

1. **Authenticity** — the disclosed claims really came from the named issuer.
2. **Integrity** — none of the disclosed claims have been altered.
3. **Completeness** — the disclosed claims belong to the same credential
   (a holder cannot mix a `name` claim from one credential with a `cgpa` claim
   from another).

The naive approach — let the holder pick which JSON fields to send — provides
**none** of these guarantees. CyStar uses signed Merkle trees instead.

## Primitives

### Ed25519 (PyNaCl)

- 32-byte private key (seed), 32-byte public key, 64-byte signature.
- Deterministic (no nonce reuse risk), fast (>20k sig/s on commodity CPU),
  well-audited.
- One issuer keypair is loaded at boot. In dev it's persisted to
  `data/issuer_keys.json`; in production it must be injected via
  `ISSUER_SIGNING_KEY` / `ISSUER_PUBLIC_KEY`.

### Salted SHA-256 Merkle tree

- Each claim becomes a leaf: `SHA256(canonical_json({"name": n, "value": v, "salt": s}))`.
- `salt` is 32 bytes of OS randomness, freshly generated per claim per
  credential. This prevents rainbow-table attacks against low-entropy claims
  like `gender`, `country`, or `graduationYear`.
- Including `name` in the hash binds the value to its field, so a holder
  cannot present a `cgpa` value under the `marks` field.
- Internal nodes: `SHA256(left || right)`. Levels with an odd number of
  nodes are padded by duplicating the last node (Bitcoin / CT-log convention).
- Proofs are positional: each step records the sibling digest and whether it
  sits on the left or right (`"L"` / `"R"`). This makes the verifier's
  reconstruction loop branch-free and trivially auditable.

### The signed envelope

The issuer signs the canonical JSON of:

```json
{
  "root": "<merkle_root_hex>",
  "issuer_public_key": "<pk_hex>",
  "leaf_order": ["claim1", "claim2", ...]
}
```

`leaf_order` is the lexicographic ordering of claim names. Two reasons:

- **Deterministic tree shape.** A verifier that recomputes leaf positions
  from `leaf_order` always lands on the same indices the issuer used.
- **Counts as a public commitment.** A holder cannot hide the existence of
  fields, only their values. A verifier can see which fields exist (by name)
  even if their values weren't disclosed.

## Issuance flow

```
claims  = { name, degree, year, cgpa, ... }
leaf_order = sorted(claims.keys())
salts[i] = random_32_bytes()
leaves[i] = SHA256(canonical_json({name, value, salt}))
tree   = MerkleTree(leaves)
sig    = Ed25519_sign(SK, canonical_json({root, issuer_pk, leaf_order}))
```

The server stores all of: claims, salts, leaves, leaf_order, root, signature,
and issuer public key. Only the holder may issue presentations against their
own credentials.

## Disclosure flow

The holder picks fields F ⊆ leaf_order. The backend builds:

```
presentation = {
  revealed_claims:  { f: claims[f] for f in F },
  salts:            { f: salts[f]  for f in F },
  merkle_proofs:    { f: tree.proof(index_of(f)) for f in F },
  merkle_root, leaf_order, signature, issuer_public_key,
  issued_at, expires_at
}
```

The presentation is bound to a short-lived `share_token`. Public verifiers
fetch it by token (rate-limited) and run verification.

## Verification flow

```
1. Recompute signed_payload = canonical_json({root, issuer_pk, leaf_order})
   and check Ed25519_verify(PK, signed_payload, sig).

2. For each disclosed claim (name, value):
   a. leaf = SHA256(canonical_json({name, value, salts[name]}))
   b. Walk merkle_proofs[name] up to the root.
   c. If the reconstructed root != merkle_root, reject.

3. If every step passes, the presentation is verified.
```

A single bit flipped in any of: claim value, salt, sibling digest, root,
issuer key, or signature will fail step 1 or 2.

## Threat model and defenses

| Attack | Defense |
| --- | --- |
| Holder forges a new claim value | Recomputed leaf hash differs → proof fails. |
| Holder forges a salt to match a desired value | Salt is hashed into the leaf — changing it changes the leaf. |
| Holder swaps two disclosed claims (e.g. shows `marks` as `cgpa`) | Claim name is bound into the leaf hash. |
| Holder reuses a leaf from a different credential | Different `merkle_root` → signature fails. |
| Verifier is tricked into using a malicious issuer key | The issuer key is bound into the signed payload. A verifier must independently trust the key (out-of-band or via DID resolution). |
| Verifier is hammered with verification requests | `/api/credentials/verify` is rate-limited per IP (30/min). |
| Share link is leaked | Tokens are 128-bit random and expire (default 15 min). Holder can shorten further. |

## Limitations and future work

- **Linkability.** Two presentations of the same credential share the same
  Merkle root, so a verifier can correlate them. Production systems should
  move to **BBS+** or **CL signatures** for unlinkable disclosure.
- **Issuer key trust.** This implementation surfaces the raw issuer public
  key. A real deployment should integrate **DID resolution** (`did:key`,
  `did:web`) so verifiers can establish trust independently.
- **Revocation.** There is no revocation registry. A `revoked` flag on the
  disclosure row covers shares but not the underlying credential. Production
  systems should publish a revocation list (e.g. a Merkle accumulator).
- **Key custody.** Issuer keys live on the application server. Production
  systems should move signing to a KMS/HSM and rotate keys via a JWKS endpoint.
