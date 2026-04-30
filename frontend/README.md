# InfraStreet Frontend

Mobile web app for customers to discover nearby flash deals, reserve orders, and search by voice. It also includes lightweight vendor onboarding and dashboard screens for local testing.

## Run

```bash
cp .env.local.example .env.local
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Environment

`NEXT_PUBLIC_BACKEND_URL` should point at the FastAPI backend. Local default:

```bash
NEXT_PUBLIC_BACKEND_URL=http://localhost:8000
```

## Checks

```bash
npm run lint
npm run build
```
