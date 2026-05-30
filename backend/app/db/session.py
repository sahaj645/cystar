"""Database session factory.

SQLite for the demo deployment (single file, zero ops, plenty fast for the
expected load). Switching to Postgres is a one-line change to ``DATABASE_URL``.
"""
from __future__ import annotations

from collections.abc import Generator

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from app.core.config import get_settings

_settings = get_settings()

# SQLite needs ``check_same_thread=False`` when used with FastAPI's thread pool.
_connect_args: dict = {"check_same_thread": False} if _settings.database_url.startswith("sqlite") else {}

engine = create_engine(
    _settings.database_url,
    connect_args=_connect_args,
    pool_pre_ping=True,
    future=True,
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine, future=True)


class Base(DeclarativeBase):
    """Shared SQLAlchemy declarative base."""


def get_db() -> Generator[Session, None, None]:
    """FastAPI dependency that yields a scoped database session."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db() -> None:
    """Create all tables. Idempotent. Called on application startup."""
    # Import models so they register with the metadata.
    from app.db import models  # noqa: F401

    Base.metadata.create_all(bind=engine)
