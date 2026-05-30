# CyStar Backend

FastAPI service implementing selective-disclosure verifiable credentials with
Ed25519 + salted Merkle trees.

## Run locally

```bash
python -m venv .venv && source .venv/bin/activate
pip install -r requirements-dev.txt
cp .env.example .env
# In dev, leave ISSUER_SIGNING_KEY / ISSUER_PUBLIC_KEY empty to auto-generate.
PYTHONPATH=. uvicorn app.main:app --reload
```

Swagger: http://localhost:8000/docs

## Tests

```bash
PYTHONPATH=. pytest -q          # 67 tests
PYTHONPATH=. pytest -q --cov=app
ruff check app tests
```

## Project layout

```
app/
├── api/             HTTP routers (auth, credentials, verify)
├── core/            crypto, security, config, issuer
├── db/              SQLAlchemy session + models
├── schemas/         Pydantic v2 request/response models
├── services/        business logic (Merkle, share, verify)
├── middleware/      slowapi rate limiter
└── main.py          FastAPI app + lifespan
tests/
├── test_crypto.py   49 unit tests of the cryptographic core
└── test_api.py      18 integration tests over the HTTP surface
```

## Environment variables

See `.env.example`. Required in production:

- `JWT_SECRET_KEY` — 32+ byte random string
- `ISSUER_SIGNING_KEY`, `ISSUER_PUBLIC_KEY` — Ed25519 keypair hex
- `DATABASE_URL` — e.g. `postgresql+psycopg://user:pass@host/db`
- `CORS_ORIGINS` — comma-separated allowlist
- `PUBLIC_FRONTEND_URL` — used when generating share links
