<div align="center">

# CyStar

### Selective Disclosure & Verification Module

A production-grade verifiable credentials platform with cryptographic selective disclosure.

[![CI](https://github.com/sahaj645/cystar/actions/workflows/ci.yml/badge.svg)](https://github.com/sahaj645/cystar/actions/workflows/ci.yml)
![Python](https://img.shields.io/badge/python-3.11-3776AB?logo=python&logoColor=white)
![Next.js](https://img.shields.io/badge/Next.js-14-000?logo=nextdotjs)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-17-4169E1?logo=postgresql&logoColor=white)
![License](https://img.shields.io/badge/license-MIT-blue)

[Live app](https://cystar.vercel.app) &nbsp;·&nbsp; [Backend API](https://cystar-backend.onrender.com/docs) &nbsp;·&nbsp; [Crypto design](./docs/crypto-design.md) &nbsp;·&nbsp; [API reference](./docs/api.md)

</div>

---

## Table of contents

- [Overview](#overview)
- [Live demo](#live-demo)
- [Key features](#key-features)
- [How selective disclosure works](#how-selective-disclosure-works)
- [Architecture](#architecture)
- [Tech stack](#tech-stack)
- [Local development](#local-development)
- [Environment variables](#environment-variables)
- [API reference](#api-reference)
- [Testing](#testing)
- [Security posture](#security-posture)
- [Deployment](#deployment)
- [Project structure](#project-structure)
- [Roadmap](#roadmap)
- [License](#license)

---

## Overview

CyStar is a full-stack module that lets a holder of a digital credential reveal **only the fields they choose** to a verifier while still allowing the verifier to **cryptographically prove** the disclosed data is authentic and untampered.

Most "selective disclosure" implementations are JSON filtering — the holder picks fields, the backend strips the rest, the verifier trusts the holder. That is not selective disclosure; it is selective transmission with no cryptographic guarantees.

CyStar implements the real thing:

1. On issuance, every claim is salted, hashed, and committed to a Merkle tree. The Merkle root is signed by the issuer with an **Ed25519** key.
2. On sharing, the holder reveals only the chosen claims, their salts, and the Merkle inclusion proofs.
3. On verification, the verifier recomputes the leaf hashes, walks the proofs to reconstruct the root, and checks the issuer's signature against that root.

Tampering with any disclosed claim, swapping a claim from a different credential, or forging the issuer breaks the proof and the signature check fails.

This project was built as the final-round submission for the **CyStar (IIT Madras) Summer Internship**, Problem 1: _Selective Disclosure & Verification Module_.

---

## Live demo

| Service                              | URL                                                                                       |
| ------------------------------------ | ----------------------------------------------------------------------------------------- |
| Frontend (holder + verifier)         | <https://cystar.vercel.app>                                                                |
| Backend API + Swagger                | <https://cystar-backend.onrender.com/docs>                                                 |
| Public verification endpoint sample  | <https://cystar-backend.onrender.com/api/credentials/share/{share_token}>                  |
| Demo video (5 min, unlisted)         | _added on submission_                                                                      |

**Try it in 60 seconds:**

1. Open the [live frontend](https://cystar.vercel.app) and register a new holder account.
2. Click **Issue** and create a credential with claims such as `name`, `degree`, `graduationYear`, `cgpa`, `marks`.
3. Open the credential, check only the fields you want to reveal (e.g., `name`, `degree`), pick an expiry, click **Verify & share**.
4. Complete the mock Aadhaar face check (camera optional — falls back if denied).
5. Copy the share link or scan the QR code, open in an incognito tab — the verifier page shows the disclosed claims with a green ✅ verified verdict.

---

## Key features

### Holder

- JWT-based register and login flows with bcrypt-hashed passwords.
- Dashboard listing every issued credential with issuer, type, root, and signed-on date.
- Dynamic credential issuance form that supports arbitrary claim sets and primitive value types.
- Per-claim checkbox UI for selective disclosure with a one-click reveal-all toggle.
- Configurable share-link expiry (5 minutes to 7 days).
- QR-code share modal with copy-to-clipboard and live expiry countdown.
- **Mock Aadhaar Face Authentication** gates the share action; uses the browser camera and simulates the UIDAI biometric match. Gracefully degrades when the camera is unavailable.

### Verifier

- Public verification page — no login required, works from a shared link or QR scan.
- Verdict banner with binary outcome and a confidence score derived from the number of fields proven.
- Issuer identity card showing the issuer name, public key, issuance date, and share expiry.
- Disclosed-claims table; hidden claims are not in the payload at all (not just hidden in the UI).
- Plain-English explainer of the underlying cryptography.

### Backend

- Type-safe FastAPI service with strict Pydantic v2 validation on every endpoint.
- Real cryptographic selective disclosure using PyNaCl Ed25519 and salted SHA-256 Merkle trees.
- JWT route protection via FastAPI dependencies; HS256 tokens with a configurable lifetime.
- IP-based rate limiting on authentication and verification endpoints via slowapi.
- Issuer key bootstrap — env-injected in production, persisted to disk in development.
- Auto-generated OpenAPI 3.1 documentation served at `/docs`.
- 67 tests (49 cryptographic, 18 HTTP integration) covering every documented tamper scenario.

### Infrastructure

- Multi-stage Dockerfiles for backend and frontend (non-root users, health checks).
- `docker compose up` runs the full stack with one command.
- GitHub Actions workflow runs lint, type-check, and tests on every push.
- Production deployment on Render (backend) + Vercel (frontend) + Neon Postgres.

---

## How selective disclosure works

```
┌──────────────────┐                                         ┌─────────────────┐
│      Issuer      │       1.  issue + sign Merkle root      │     Backend     │
│   (server key)   │ ──────────────────────────────────────► │   (FastAPI)     │
└──────────────────┘                                         └────────┬────────┘
                                                                      │
                                                                      │ store credential
                                                                      ▼
                                                              ┌─────────────────┐
                                                              │   PostgreSQL    │
                                                              └─────────────────┘
┌──────────────────┐    2.  pick fields, generate share      ┌─────────────────┐
│      Holder      │ ──────────────────────────────────────► │     Backend     │
│  (Next.js + JWT) │ ◄────── share token + QR + link ─────── │   (FastAPI)     │
└──────────────────┘                                         └─────────────────┘

┌──────────────────┐                                         ┌─────────────────┐
│     Verifier     │   3.  fetch presentation + verify       │     Backend     │
│ (public, no JWT) │ ──────────────────────────────────────► │   (FastAPI)     │
│                  │ ◄────── ✓ verified + claims ─────────── │                 │
└──────────────────┘                                         └─────────────────┘
```

A presentation contains only:

| Field                | Purpose                                                                                  |
| -------------------- | ---------------------------------------------------------------------------------------- |
| `revealed_claims`    | The subset of claim values the holder chose to disclose.                                 |
| `salts`              | Per-claim 32-byte salts (prevent rainbow-table attacks against low-entropy claims).      |
| `merkle_proofs`      | SHA-256 inclusion proofs, one per revealed claim.                                        |
| `merkle_root`        | The committed root of the original credential tree.                                      |
| `leaf_order`         | Canonical ordering of every claim name in the original credential.                       |
| `signature`          | Issuer's Ed25519 signature over `{root, issuer_pk, leaf_order}`.                         |
| `issuer_public_key`  | The key the verifier checks the signature against.                                       |

The verifier never sees the hidden claim values — they aren't transmitted at all. The full design, including the threat model and limitations, is in [`docs/crypto-design.md`](./docs/crypto-design.md).

---

## Architecture

```
                              ┌──────────────────────────────────┐
                              │           Vercel (CDN)           │
                              │   Next.js 14 — Holder + Verifier │
                              └─────────────────┬────────────────┘
                                                │ HTTPS
                                                ▼
                              ┌──────────────────────────────────┐
                              │           Render (Docker)        │
                              │       FastAPI + Ed25519 + Merkle │
                              └─────────────────┬────────────────┘
                                                │ TLS (sslmode=require)
                                                ▼
                              ┌──────────────────────────────────┐
                              │       Neon — Postgres 17         │
                              └──────────────────────────────────┘
```

See [`docs/architecture.md`](./docs/architecture.md) for sequence diagrams of the issue, share, and verify flows.

---

## Tech stack

| Layer        | Choices                                                                                                              |
| ------------ | -------------------------------------------------------------------------------------------------------------------- |
| Frontend     | Next.js 14 (App Router), TypeScript 5, Tailwind CSS 3, shadcn/ui, Radix UI, react-hook-form, zod, qrcode.react, sonner |
| Backend      | FastAPI, Pydantic v2, SQLAlchemy 2, python-jose, passlib, slowapi, PyNaCl                                            |
| Cryptography | Ed25519 (EdDSA) via PyNaCl, SHA-256 salted Merkle trees                                                              |
| Database     | PostgreSQL 17 (Neon in production, SQLite for local dev)                                                             |
| DevOps       | Docker, Docker Compose, GitHub Actions                                                                               |
| Hosting      | Vercel (frontend), Render (backend), Neon (Postgres)                                                                 |

---

## Local development

### Prerequisites

- Docker and Docker Compose, or
- Python 3.11+ and Node.js 20+

### Option 1: Docker Compose (recommended)

```bash
git clone https://github.com/sahaj645/cystar.git
cd cystar
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env.local
docker compose up --build
```

Open <http://localhost:3000>.

### Option 2: Run services directly

**Backend:**

```bash
cd backend
python -m venv .venv
source .venv/bin/activate            # Windows: .venv\Scripts\activate
pip install -r requirements-dev.txt
cp .env.example .env
PYTHONPATH=. uvicorn app.main:app --reload
```

Swagger UI: <http://localhost:8000/docs>.

**Frontend:**

```bash
cd frontend
npm install --legacy-peer-deps
cp .env.example .env.local
npm run dev
```

App: <http://localhost:3000>.

---

## Environment variables

### Backend (`backend/.env`)

| Variable                            | Required           | Description                                                                           |
| ----------------------------------- | ------------------ | ------------------------------------------------------------------------------------- |
| `APP_ENV`                           | yes                | `development`, `staging`, or `production`.                                            |
| `JWT_SECRET_KEY`                    | yes                | At least 32 bytes. Generate with `python -c "import secrets; print(secrets.token_urlsafe(32))"`. |
| `JWT_ACCESS_TOKEN_EXPIRE_MINUTES`   | no (default 60)    | Access token lifetime in minutes.                                                     |
| `ISSUER_NAME`                       | no                 | Human-readable issuer name shown to verifiers.                                        |
| `ISSUER_SIGNING_KEY`                | prod only          | Hex-encoded Ed25519 signing key (32 bytes). Auto-generated in dev.                    |
| `ISSUER_PUBLIC_KEY`                 | prod only          | Hex-encoded Ed25519 public key (32 bytes).                                            |
| `DATABASE_URL`                      | yes                | SQLAlchemy URL. Example: `postgresql+psycopg2://user:pass@host/db?sslmode=require`.   |
| `CORS_ORIGINS`                      | yes                | Comma-separated allow-list of frontend origins.                                       |
| `PUBLIC_FRONTEND_URL`               | yes                | Base URL used to build share links (e.g. `https://cystar.vercel.app`).                |
| `DEFAULT_SHARE_EXPIRY_MINUTES`      | no (default 15)    | Default share-link lifetime.                                                          |
| `MAX_SHARE_EXPIRY_MINUTES`          | no (default 10080) | Hard upper bound on share lifetimes.                                                  |
| `RATE_LIMIT_VERIFY`                 | no                 | slowapi format, e.g. `30/minute`.                                                     |
| `RATE_LIMIT_AUTH`                   | no                 | slowapi format, e.g. `10/minute`.                                                     |

To generate a production issuer keypair:

```bash
python -c "
from nacl.signing import SigningKey
sk = SigningKey.generate()
print('ISSUER_SIGNING_KEY=' + sk.encode().hex())
print('ISSUER_PUBLIC_KEY=' + sk.verify_key.encode().hex())
"
```

### Frontend (`frontend/.env.local`)

| Variable               | Required | Description                                                |
| ---------------------- | -------- | ---------------------------------------------------------- |
| `NEXT_PUBLIC_API_URL`  | yes      | Public URL of the backend, e.g. `http://localhost:8000`.   |

---

## API reference

Full reference: [`docs/api.md`](./docs/api.md). Interactive Swagger UI is mounted at `/docs`.

| Method | Path                              | Auth | Purpose                                            |
| ------ | --------------------------------- | ---- | -------------------------------------------------- |
| POST   | `/api/auth/register`              | —    | Create a holder account, returns JWT.              |
| POST   | `/api/auth/login`                 | —    | Exchange credentials for a JWT.                    |
| GET    | `/api/auth/me`                    | JWT  | Return the authenticated user.                     |
| POST   | `/api/credentials/issue`          | JWT  | Issue a Merkle-rooted, Ed25519-signed credential.  |
| GET    | `/api/credentials`                | JWT  | List the holder's credentials.                     |
| GET    | `/api/credentials/{id}`           | JWT  | Fetch a single credential.                         |
| POST   | `/api/credentials/share`          | JWT  | Create a time-limited selective-disclosure share. |
| GET    | `/api/credentials/share/{token}`  | —    | Fetch the public presentation for a share token.  |
| POST   | `/api/credentials/verify`         | —    | Cryptographically verify a presentation or token. |

### Example: issue → share → verify

```bash
# 1. Register and capture the JWT
TOKEN=$(curl -s -X POST https://cystar-backend.onrender.com/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"alice@example.com","password":"correct-horse","full_name":"Alice"}' \
  | python -c "import sys,json; print(json.load(sys.stdin)['access_token'])")

# 2. Issue a credential
CRED_ID=$(curl -s -X POST https://cystar-backend.onrender.com/api/credentials/issue \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "credential_type":"AcademicCredential",
    "claims":{
      "name":"Alice Doe",
      "degree":"B.Tech CSE",
      "graduationYear":2026,
      "cgpa":9.1,
      "marks":920
    }
  }' | python -c "import sys,json; print(json.load(sys.stdin)['id'])")

# 3. Create a share revealing only name and degree
TOKEN_SHARE=$(curl -s -X POST https://cystar-backend.onrender.com/api/credentials/share \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"credential_id\":\"$CRED_ID\",\"fields\":[\"name\",\"degree\"],\"expires_in_minutes\":15}" \
  | python -c "import sys,json; print(json.load(sys.stdin)['share_token'])")

# 4. Verify publicly (no JWT needed)
curl -X POST https://cystar-backend.onrender.com/api/credentials/verify \
  -H "Content-Type: application/json" \
  -d "{\"share_token\":\"$TOKEN_SHARE\"}"
```

---

## Testing

```bash
cd backend
PYTHONPATH=. pytest -q                   # 67 tests
PYTHONPATH=. pytest tests/test_crypto.py # crypto unit tests (49)
PYTHONPATH=. pytest tests/test_api.py    # HTTP integration tests (18)
ruff check app tests
```

Cryptographic tests cover every documented tamper vector: claim-value forgery, salt swap, proof bit-flip, root rewrite, wrong-issuer attack, name/value rebinding, missing fields. Tree sizes 1 through 64 are parameterised to exercise odd-level padding.

---

## Security posture

- **JWT** access tokens signed with HS256 and a ≥ 32-byte secret; 60-minute default lifetime.
- **bcrypt** password hashing at 12 rounds.
- **Per-IP rate limiting** on `/api/auth/*` (10/min) and `/api/credentials/verify` (30/min) via slowapi.
- **Strict input validation** on every endpoint via Pydantic v2 with hard limits on claim count, name length, and value length.
- **CORS allow-list** is environment-driven; production deployments must not use wildcards.
- **Security headers** on the frontend: `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy: camera=(), microphone=(), geolocation=()`.
- **Salted claim hashes** prevent rainbow-table attacks against low-entropy claims like `country` or `gender`.
- **Issuer signing key never leaves the backend.** Holders receive credentials, not signing material.
- **Time-limited share tokens** with configurable expiry (default 15 minutes, hard cap 7 days).
- **Mock Aadhaar Face Authentication** gates share-link generation. A production deployment would POST the captured frame to UIDAI's Aadhaar Face Authentication API.
- **No PII in logs.** Structured logging only emits identifiers (user id, credential id), never claim values or salts.

---

## Deployment

Full step-by-step guide: [`docs/deployment.md`](./docs/deployment.md).

### Backend → Render

1. Create a new **Web Service** from the repo, root directory `backend/`, language **Docker**.
2. Add a Postgres database (Neon recommended for the free tier) and copy the connection string.
3. Set the environment variables listed above. `DATABASE_URL` must use the `postgresql+psycopg2://...?sslmode=require` form when targeting Neon.
4. Add `/health` as the health-check path.
5. Deploy.

### Frontend → Vercel

1. Import the repo, root directory `frontend/`. Framework auto-detected as Next.js.
2. Set `NEXT_PUBLIC_API_URL` to the Render backend URL.
3. Deploy. After the first deploy, update `CORS_ORIGINS` and `PUBLIC_FRONTEND_URL` on Render with the assigned Vercel URL.

---

## Project structure

```
cystar/
├── backend/
│   ├── app/
│   │   ├── api/             # HTTP routers (auth, credentials, verify)
│   │   ├── core/            # config, security, crypto primitives, issuer keys
│   │   ├── db/              # SQLAlchemy models + session factory
│   │   ├── schemas/         # Pydantic v2 request/response schemas
│   │   ├── services/        # business logic (issuance, share, verify)
│   │   ├── middleware/      # slowapi rate limiter
│   │   └── main.py          # FastAPI app + lifespan
│   ├── tests/
│   │   ├── test_crypto.py   # 49 unit tests covering tamper rejection
│   │   └── test_api.py      # 18 integration tests over the HTTP surface
│   ├── Dockerfile
│   ├── requirements.txt
│   └── README.md
├── frontend/
│   ├── src/
│   │   ├── app/             # Next.js App Router routes
│   │   ├── components/
│   │   │   ├── ui/          # shadcn/ui-style primitives
│   │   │   └── features/    # topbar, share dialog, face auth dialog
│   │   └── lib/             # typed API client, auth hooks, utilities
│   ├── Dockerfile
│   ├── package.json
│   └── README.md
├── docs/
│   ├── crypto-design.md     # full cryptographic design + threat model
│   ├── api.md               # endpoint reference
│   ├── architecture.md      # mermaid diagrams of system + flows
│   └── deployment.md        # production deployment guide
├── docker-compose.yml
├── .github/workflows/ci.yml
└── README.md
```

---

## Roadmap

Items that would extend the module beyond the assignment scope:

- **BBS+ signatures** for unlinkable selective disclosure so a verifier cannot correlate two presentations of the same credential.
- **DID resolution** (`did:key`, `did:web`) so verifiers can establish issuer trust independently of an out-of-band public key exchange.
- **Revocation registry** backed by a Merkle accumulator or status list.
- **Hardware-backed signing** through a KMS or HSM in production.
- **WebAuthn / passkeys** for holder authentication.
- **Real UIDAI integration** replacing the mock Aadhaar face check.
- **Audit log** of every issuance, share, and verification event with structured event IDs.

---

## License

Released under the [MIT License](./LICENSE).

---

<div align="center">
Built for the <strong>CyStar (IIT Madras) Summer Internship — Final Round</strong>.
</div>
