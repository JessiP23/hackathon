# InfraStreet MCP Server

LeanMCP HTTP server exposing backend tools for InfraStreet voice search and agent workflows.

## Quick Start

```bash
npm install

npm run dev

npm run build

npm start
```

## Project Structure

```
mcp-server/
├── main.ts
├── mcp/
│   ├── deals/
│   ├── onboarding/
│   ├── order/
│   └── search/
├── .env
└── package.json
```

## Tools
- `searchVendors` calls `GET /vendors/nearby`.
- `findNearbyDeals` calls `GET /deals/nearby`.
- `createDeal` calls `POST /deals`.
- `createVendor`, `processMenuImage`, and `addMenuItem` support vendor onboarding.
- `placeOrder` and `getOrderStatus` support ordering flows.

## Test With MCP Inspector

```bash
npx @modelcontextprotocol/inspector http://localhost:3001/mcp
```
