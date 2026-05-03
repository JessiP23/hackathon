# InfraStreet

AI-native street vendor marketplace. **Vendors** use **Telegram**; **customers** use **infrastreet.app**. Agent **v3.3 FINAL**: PaddleOCR-first menu OCR (Groq vision fallback), `notifications` table, hourly vendor-local weekly stats, `POST /customers/notify_opt_in`, DealTile swipe UI + empty-state notify flow.

## Stack
- **LLM:** Groq `llama-3.3-70b-versatile` (deal parsing).
- **OCR:** PaddleOCR (`USE_PADDLE_OCR=1`, default) → Groq llama-4-scout if Paddle missing or low yield.
- **Backend:** FastAPI, Postgres/PostGIS, Redis (short links + OTP + scheduler dedupe).
- **Scheduler:** Auto-deal every **30m** (Cancel → `cancel_{dealId}`); weekly stats **hourly UTC** tick, sends once per vendor per ISO week when local Mon **09:00** (`vendors.timezone`).
- **Short links:** `GET /d/{code}` on API; set **`SHORT_LINK_BASE`** to public API URL.

## DB migration (v3.3)
Run `backend/migrate.sql` in **your** Postgres (e.g. Supabase → SQL Editor), including:
- `notifications` table (rename from `notification_logs` when upgrading).
- Customer `telegram_id` + `notification_channel` CHECK.
- `ALTER TABLE users ADD COLUMN IF NOT EXISTS name TEXT` (fixes `/users` 500s).

### Supabase vs Docker Postgres
`docker-compose.yml` **does not override `DATABASE_URL`**. Put your **Supabase** connection string in **`backend/.env`** (`DATABASE_URL=postgresql://...@...pooler.supabase.com:6543/postgres?sslmode=require`). Default Compose brings up **Redis + backend + MCP**, not local Postgres:

```bash
docker compose up --build
```

For an optional **local** PostGIS container + migrate bootstrap:

```bash
docker compose --profile local-db up --build
# backend/.env inside Docker must use host postgres:
# DATABASE_URL=postgresql://infrastreet:infrastreet@postgres:5432/infrastreet
```

## Env (copy from `.env.example`)
`TELEGRAM_BOT_TOKEN`, `TELEGRAM_WEBHOOK_SECRET`, `GROQ_API_KEY`, Twilio (SMS + OTP), `REDIS_URL`, B2, `SHORT_LINK_BASE`, `FRONTEND_URL`, `CORS_ORIGINS`.

### PaddleOCR (recommended)
```bash
pip install paddlepaddle paddleocr   # platform-specific wheel from Paddle docs
export USE_PADDLE_OCR=1
export PADDLE_OCR_LANG=es
```

## Run locally
```bash
# Ensure backend/.env has DATABASE_URL (Supabase or local Postgres).
docker compose up --build
cd frontend && npm install && npm run dev
```

## API highlights
| Method | Path | Notes |
|--------|------|--------|
| POST | `/customers/notify_opt_in` | `{ lat, lng, radius, phone }` — upsert customer, enable alerts, SMS OTP when Twilio set |
| POST | `/telegram/webhook` | Vendors |
| GET | `/d/{code}` | Short deal link |

## Frontend §5
`/deals` uses **DealTile** (full viewport, vertical swipe, spring exit, accent `#E63946`, frosted sheet). Empty state: animated gradient placeholder; add `public/steam_rising.mp4` optional. **Notify me** calls `notify_opt_in`.

Full interaction tokens / haptics spec lives in the Agent v3.3 prompt for designers.
