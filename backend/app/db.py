import os
from functools import lru_cache
from urllib.parse import unquote, urlparse

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker


def _log_pooler_user_once(url: str) -> None:
    if "pooler.supabase.com" not in url:
        return
    normalized = url.replace("postgresql+psycopg://", "postgresql://", 1)
    try:
        parsed = urlparse(normalized)
        user = unquote(parsed.username or "")
    except Exception:
        return
    print(f"[db] DATABASE_URL username (for pooler): {user!r}", flush=True)
    if user == "postgres":
        print(
            "[db] FATAL auth with user 'postgres' is common: use the pooler URI from Supabase "
            "— username is usually postgres.<project_ref>, and password must match Database password.",
            flush=True,
        )


def get_database_url() -> str:
    raw = os.getenv("DATABASE_URL", "").strip().strip('"').strip("'")
    if not raw:
        raise RuntimeError("DATABASE_URL not set")

    if raw.startswith("postgres://"):
        raw = raw.replace("postgres://", "postgresql://", 1)

    if not raw.startswith("postgresql://"):
        raise RuntimeError(f"DATABASE_URL must start with postgresql://, got: {raw[:20]}...")

    if "pooler.supabase.com" in raw and "sslmode=" not in raw.lower():
        raw += "&sslmode=require" if "?" in raw else "?sslmode=require"

    if "+" not in raw.split("://", 1)[0]:
        raw = raw.replace("postgresql://", "postgresql+psycopg://", 1)

    return raw


@lru_cache(maxsize=1)
def get_engine():
    """Engine is created on first use — importing this module does not connect to Postgres."""
    url = get_database_url()
    _log_pooler_user_once(url)
    # psycopg3: prepare_threshold=None disables server-side prepare (required for
    # PgBouncer / Supabase transaction pooler). Do NOT use 0 — that means "prepare
    # immediately on first exec" and triggers DuplicatePreparedStatement on the pooler.
    connect_args: dict = {"prepare_threshold": None}
    if "pooler.supabase.com" in url:
        connect_args["options"] = "-c search_path=public"
        connect_args["sslmode"] = "require"
    return create_engine(
        url,
        pool_pre_ping=True,
        pool_size=5,
        max_overflow=10,
        connect_args=connect_args,
    )


_session_maker = None


def _get_session_maker():
    global _session_maker
    if _session_maker is None:
        _session_maker = sessionmaker(
            bind=get_engine(), autocommit=False, autoflush=False
        )
    return _session_maker


class _SessionLocal:
    __slots__ = ()

    def __call__(self):
        return _get_session_maker()()


SessionLocal = _SessionLocal()


def reset_db_engine():
    global _session_maker
    get_engine.cache_clear()
    _session_maker = None
