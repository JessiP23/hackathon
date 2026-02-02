# InfraStreet

Voice-first, agentic marketplace for street vendors.

## What’s wired
- FastAPI backend with Postgres/PostGIS geo queries
- LeanMCP tools for voice search and deals
- Next.js frontend (map + voice stub)
- Vendor onboarding + menu upload stub
- Order notifications via iMessage stub logger

## Environment setup
Create env files from the examples:
- `backend/.env.example` → `backend/.env`
- `frontend/.env.local.example` → `frontend/.env.local`

## Run locally
1) Start infra services + MCP + backend using Docker Compose.
2) Run the Next.js frontend locally.

### Backend + infra (Docker)
From the repo root:
```bash
docker compose up --build
```

### Frontend
From `frontend/`:
```bash
npm install
npm run dev
```

## End-to-end flow (happy path)
1) Open the app at `http://localhost:3000`.
2) Click the mic button and say “tacos” (stub prompt).
3) Vendors show up on the map list.
4) Onboard a vendor at `/vendor-onboarding` and upload a menu image.
5) Open `/vendor/{id}` to place an order.

## API endpoints
- `POST /vendors` — create vendor
- `GET /vendors/{vendorId}` — vendor + menu
- `POST /vendors/{vendorId}/menu` — upload menu image
- `GET /vendors/nearby` — search nearby vendors
- `GET /deals` — nearby flash deals
- `POST /orders` — place order
- `POST /voice` — voice transcript to MCP tools

## Notes
- Menu OCR is stubbed; menu upload inserts a placeholder item.
- Vendor notifications use an iMessage stub logger (no Twilio).
