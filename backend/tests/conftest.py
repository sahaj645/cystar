"""Test fixtures: per-test SQLite DB + TestClient."""
from __future__ import annotations

import os
import tempfile
from collections.abc import Iterator

import pytest

# Configure env BEFORE importing the app so Settings picks up overrides.
os.environ.setdefault("JWT_SECRET_KEY", "x" * 64)
os.environ.setdefault("APP_ENV", "development")


@pytest.fixture
def client() -> Iterator:
    """Yield a fresh TestClient backed by a temporary SQLite DB."""
    from fastapi.testclient import TestClient
    from sqlalchemy import create_engine
    from sqlalchemy.orm import sessionmaker

    from app.db import session as session_module
    from app.db.session import Base, get_db
    from app.main import app

    tmpdir = tempfile.mkdtemp(prefix="cystar-test-")
    db_path = os.path.join(tmpdir, "test.db")
    test_engine = create_engine(
        f"sqlite:///{db_path}",
        connect_args={"check_same_thread": False},
        future=True,
    )
    TestSession = sessionmaker(bind=test_engine, autocommit=False, autoflush=False, future=True)

    # Patch the global session module so lifespan's init_db hits our test engine.
    session_module.engine = test_engine
    session_module.SessionLocal = TestSession
    Base.metadata.create_all(bind=test_engine)

    def override_get_db():
        db = TestSession()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = override_get_db

    # Reset rate limiter storage between tests so per-IP quotas don't bleed.
    try:
        from app.middleware.rate_limit import limiter
        limiter.reset()
    except Exception:
        pass

    with TestClient(app) as c:
        yield c

    app.dependency_overrides.clear()


@pytest.fixture
def auth_headers(client) -> dict:
    """Register a user and return Authorization headers."""
    r = client.post(
        "/api/auth/register",
        json={"email": "test@example.com", "password": "supersecret1", "full_name": "Test User"},
    )
    assert r.status_code == 201, r.text
    token = r.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}
