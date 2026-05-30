# CyStar — Selective Disclosure & Verification Module

> Production-grade Verifiable Credentials platform with cryptographic selective disclosure built on **Ed25519 signatures** and **salted Merkle trees**.

Submission for the **CyStar (IIT Madras) Summer Internship — Final Round**, Problem 1.

[![CI](https://github.com/sahaj645/cystar/actions/workflows/ci.yml/badge.svg)](https://github.com/sahaj645/cystar/actions/workflows/ci.yml)
![License](https://img.shields.io/badge/license-MIT-blue)
![Python](https://img.shields.io/badge/python-3.11-blue)
![Next.js](https://img.shields.io/badge/Next.js-14-black)

---

## Live demo

| Service | URL |
| --- | --- |
| Frontend (holder + verifier UI) | _will be added after deploy_ |
| Backend API (Swagger docs)       | _will be added after deploy_ |
| Demo video (5 min)               | _will be added after recording_ |

---

## Why this design wins

Most "selective disclosure" implementations are JSON filtering — the holder picks fields, the backend strips the rest, and ships. That isn't selective disclosure, it's selective transmission. A verifier has no cryptographic guarantee that the disclosed claims weren't fabricated.

This module does it properly:

1. On **issuance**, every claim is salted and hashed into a leaf of a Merkle tree. The Merkle root is signed with the issuer's **Ed25519** private key.
2. On **sharing**, the holder reveals only the selected claims, their salts, and their Merkle inclusion proofs.
3. On **verification**, the verifier recomputes the leaf hashes, walks the proofs to reconstruct the Merkle root, and checks the issuer's signature against that root.

Any tampering — flipping a single bit in a disclosed claim, swapping a claim from a different credential, or removing/adding a claim — breaks the root and the signature check fails.

See [`docs/crypto-design.md`](./docs/crypto-design.md) for the full design.

---

## Tech stack

**Backend:** FastAPI, SQLAlchemy, PyNaCl (Ed25519), python-jose, passlib/bcrypt, slowapi, pytest

**Frontend:** Next.js 14 (App Router), TypeScript, Tailwind CSS, shadcn/ui, react-hook-form, zod, qrcode.react

**Infra:** Docker, Docker Compose, GitHub Actions CI, Render (backend), Vercel (frontend)

---

## Repo layout

```
cystar/
├── backend/                  FastAPI service
│   ├── app/
│   │   ├── api/              HTTP routers (auth, credentials, verify)
│   │   ├── core/             config, security, crypto primitives
│   │   ├── db/               SQLAlchemy models + session
│   │   ├── schemas/          Pydantic v2 schemas
│   │   └── services/         business logic
│   ├── tests/                pytest suite
│   └── Dockerfile
├── frontend/                 Next.js 14 app
│   ├── src/
│   │   ├── app/              App Router routes
│   │   ├── components/       UI components (shadcn + feature)
│   │   └── lib/              api client, auth, utils
│   └── Dockerfile
├── docs/                     architecture, crypto design, API reference
├── docker-compose.yml
└── .github/workflows/ci.yml
```

---

## Quickstart

```bash
git clone https://github.com/sahaj645/cystar.git
cd cystar
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env.local
docker compose up --build
```

Frontend → http://localhost:3000
Backend  → http://localhost:8000
Swagger  → http://localhost:8000/docs

---

## API reference

See [`docs/api.md`](./docs/api.md) for the full reference. Quick summary:

| Method | Path                          | Auth | Purpose                                  |
| ------ | ----------------------------- | ---- | ---------------------------------------- |
| POST   | `/api/auth/register`          | —    | Create a holder account                  |
| POST   | `/api/auth/login`             | —    | Exchange credentials for a JWT           |
| POST   | `/api/credentials/issue`      | JWT  | Issue a signed verifiable credential     |
| GET    | `/api/credentials`            | JWT  | List the holder's credentials            |
| POST   | `/api/credentials/share`      | JWT  | Generate a selective-disclosure share    |
| GET    | `/api/credentials/share/{t}`  | —    | Fetch a shared presentation (public)     |
| POST   | `/api/credentials/verify`     | —    | Verify a presentation cryptographically  |

---

## Security posture

- **JWT** with short-lived access tokens, signed with HS256 and a 32-byte secret.
- **bcrypt** password hashing (12 rounds).
- **Rate limiting** on `/api/credentials/verify` and `/api/auth/*` via `slowapi`.
- **Input validation** on every endpoint via Pydantic v2 with strict mode.
- **CORS** allowlist (no wildcards in production).
- **No PII in logs.** Structured logging with field-level redaction.
- **Salted claim hashes** prevent rainbow-table attacks on low-entropy claims.
- **Issuer key never leaves the backend.** Holders receive credentials, not signing material.
- **Time-limited share tokens** (configurable, default 15 min).
- **Mock Aadhaar Face Authentication** gates the share action — captures a live
  camera frame and simulates a UIDAI biometric match before issuing the share
  link. Clearly labelled as a demo; production would POST the frame to UIDAI's
  Aadhaar Face Authentication API.

---

## What I'd improve given more time

- **BBS+ signatures** for unlinkable selective disclosure (a verifier can't correlate two presentations of the same credential).
- **DID resolution** (did:key, did:web) instead of raw issuer public keys.
- **Revocation registry** via a Merkle accumulator or status list.
- **WebAuthn / passkeys** for holder login.
- **Hardware-backed signing** via a KMS/HSM in production.
- **Audit log** for every issuance, share, and verification event.

---

## License

MIT — see [LICENSE](./LICENSE).
