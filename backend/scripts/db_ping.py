#!/usr/bin/env python3
"""Load backend/.env and run SELECT 1 — same DB URL logic as the API."""
from __future__ import annotations

import sys
from pathlib import Path

_root = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(_root))

from dotenv import load_dotenv

load_dotenv(_root / ".env")

from sqlalchemy import text

from app.db import get_engine


def main() -> None:
    with get_engine().connect() as conn:
        n = conn.execute(text("SELECT 1")).scalar_one()
    if n != 1:
        raise SystemExit(f"unexpected: {n!r}")
    print("db ok")


if __name__ == "__main__":
    main()
