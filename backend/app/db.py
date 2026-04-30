import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql://infrastreet:infrastreet@localhost:5432/infrastreet",
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