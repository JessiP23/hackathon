# InfraStreet

AI-native street vendor marketplace. Vendors onboard and manage flash deals over Twilio SMS/MMS/WhatsApp; customers discover and reserve nearby deals in the mobile web app.

## What Is Wired
- FastAPI backend with Postgres/PostGIS, Redis state, Twilio webhooks, Groq deal parsing/OCR hooks, Stripe Checkout, and APScheduler jobs.
- LeanMCP server exposing vendor search, nearby deals, onboarding, and order tools.
- Next.js frontend for customer deal discovery, voice search, vendor onboarding, orders, and vendor dashboard.

## Environment Setup
Create local env files:

```bash
cp backend/.env.example backend/.env
cp frontend/.env.local.example frontend/.env.local
cp mcp-server/.env.example mcp-server/.env
```

For a local smoke test, the defaults are enough except live Twilio/Groq/Stripe/B2 calls will be skipped or unavailable until you add real credentials.

## Run Everything Locally
Start Postgres/PostGIS, Redis, MCP, and backend from the repo root:

```bash
docker compose up --build
```

Run the frontend in a second terminal:

```bash
cd frontend
npm install
npm run dev
```

Open `http://localhost:3000`. Backend health is `http://localhost:8000/health`; MCP runs at `http://localhost:3001/mcp`.

## Twilio (easiest path — one Messaging Service)

**Env:** Set `TWILIO_MESSAGING_SERVICE_SID=MG...` (one service). Optionally set `TWILIO_MESSAGING_SERVICE_SID_VENDOR` / `_CUSTOMER` later for two pools; if unset, both use the single SID.

**Twilio Console:** Messaging → Services → create service → add **one** SMS-capable phone number → Integration → “When a message comes in” → `POST` → `https://<your-api-host>/sms/vendor`

**Fly:** `PUBLIC_BASE_URL=https://infrastreet-api.fly.dev` (must match the URL Twilio calls; no trailing slash).

## Twilio Local Test
1. Run `ngrok http 8000`.
2. Set `PUBLIC_BASE_URL` in `backend/.env` to the ngrok HTTPS URL.
3. In Twilio Messaging Services, set vendor inbound webhook to `https://<ngrok-id>.ngrok-free.app/sms/vendor`.
4. Text your Twilio number to start vendor onboarding.

## Useful Checks
```bash
cd backend && python -m compileall main.py app
cd mcp-server && npm run build
cd frontend && npm run lint && npm run build
```

## Core Endpoints
- `POST /sms/vendor` and `POST /sms/customer` - Twilio inbound webhooks.
- `POST /vendors`, `GET /vendors/{vendorId}`, `POST /vendors/{vendorId}/menu`.
- `GET /deals`, `POST /deals/{dealId}/order`.
- `POST /orders`, `GET /orders/{orderId}`, `PATCH /orders/{orderId}/status`.
- `POST /voice` - voice transcript routed through MCP tools with backend fallback.