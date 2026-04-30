import os
from urllib.parse import quote_plus, urlparse
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

def get_database_url() -> str:
    raw = os.getenv("DATABASE_URL", "").strip().strip('"').strip("'")
    if not raw:
        raise RuntimeError("DATABASE_URL not set")

    if raw.startswith("postgres://"):
        raw = raw.replace("postgres://", "postgresql://", 1)

    if not raw.startswith("postgresql://"):
        raise RuntimeError(f"DATABASE_URL must start with postgresql://, got: {raw[:20]}...")

    # Force psycopg3 driver
    if "+" not in raw.split("://", 1)[0]:
        raw = raw.replace("postgresql://", "postgresql+psycopg://", 1)

    return raw

DATABASE_URL = get_database_url()

# For Supabase transaction pooler, disable prepared statements
connect_args = {}
if "pooler.supabase.com" in DATABASE_URL:
    connect_args["options"] = "-c search_path=public"
    connect_args["prepare_threshold"] = 0 # This fixes pgbouncer transaction mode

engine = create_engine(
    DATABASE_URL,
    pool_pre_ping=True,
    pool_size=5,
    max_overflow=10,
    connect_args=connect_args,
)

SessionLocal = sessionmaker(bind=engine, autocommit=False, autoflush=False)