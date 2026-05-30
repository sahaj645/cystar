"""FastAPI application entry point.

Run with: ``uvicorn app.main:app --reload``
"""
from __future__ import annotations

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi.errors import RateLimitExceeded

from app.api import auth as auth_router
from app.api import credentials as credentials_router
from app.api import verify as verify_router
from app.core.config import get_settings
from app.core.issuer import load_or_create_issuer_keys
from app.db.session import init_db
from app.middleware.rate_limit import limiter

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s :: %(message)s",
)
_log = logging.getLogger("cystar")
_settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Initialize DB and issuer keys on startup."""
    _log.info("Starting %s (env=%s)", _settings.app_name, _settings.app_env)
    init_db()
    signing_key, public_key = load_or_create_issuer_keys()
    app.state.issuer_keys = {"signing": signing_key, "public": public_key}
    _log.info("Issuer public key: %s", public_key)
    yield
    _log.info("Shutting down")


app = FastAPI(
    title=_settings.app_name,
    description=(
        "Production-grade Verifiable Credentials API with cryptographic "
        "selective disclosure built on Ed25519 + Merkle trees."
    ),
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json",
    lifespan=lifespan,
)

# Rate limiter
app.state.limiter = limiter


@app.exception_handler(RateLimitExceeded)
async def _rate_limit_handler(request: Request, exc: RateLimitExceeded) -> JSONResponse:
    return JSONResponse(
        status_code=429,
        content={"detail": f"rate limit exceeded: {exc.detail}"},
    )


# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=_settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)


# Routes
app.include_router(auth_router.router)
app.include_router(credentials_router.router)
app.include_router(verify_router.router)


@app.get("/", tags=["meta"])
def root() -> dict:
    return {
        "name": _settings.app_name,
        "version": "1.0.0",
        "docs": "/docs",
        "status": "ok",
    }


@app.get("/health", tags=["meta"])
def health() -> dict:
    return {"status": "ok"}
