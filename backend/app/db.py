import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker


def _sqlalchemy_database_url(raw: str) -> str:
    """Plain postgresql:// selects psycopg2 (not installed). We use psycopg v3 only."""
    if not raw:
        return raw
    url = raw.strip().strip('"').strip("'")
    if not url:
        return url
    proto = url.split("://", 1)[0].lower()
    if proto in ("http", "https"):
        raise RuntimeError(
            "DATABASE_URL must be a Postgres URI (postgresql:// or postgres://), not an https:// URL. "
            "Use the connection string from Fly Postgres (`fly postgres connect` / dashboard), Neon, "
            "Supabase (Database settings → URI), or Docker Compose — not a REST or dashboard link."
        )
    scheme = url.split("://", 1)[0]
    if "+" in scheme:
        return url
    if url.startswith("postgresql://"):
        return "postgresql+psycopg://" + url[len("postgresql://") :]
    if url.startswith("postgres://"):
        return "postgresql+psycopg://" + url[len("postgres://") :]
    raise RuntimeError(
        f"DATABASE_URL must start with postgresql:// or postgres:// (got scheme {proto!r})."
    )


DATABASE_URL = _sqlalchemy_database_url(
    os.getenv(
        "DATABASE_URL",
        "postgresql://infrastreet:infrastreet@localhost:5432/infrastreet",
    )
)

# Handle Supabase connection pooling (use transaction mode)
if "supabase.co" in DATABASE_URL:
    # Supabase uses port 6543 for transaction pooling
    # But direct connection on 5432 works fine for our use case
    engine = create_engine(
        DATABASE_URL,
        pool_pre_ping=True,
        pool_size=5,
        max_overflow=10,
        connect_args={
            "options": "-c search_path=public"
        }
    )
else:
    engine = create_engine(DATABASE_URL, pool_pre_ping=True)

SessionLocal = sessionmaker(bind=engine)