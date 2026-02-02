import dotenv from "dotenv";
import { createHTTPServer } from "@leanmcp/core";

dotenv.config();

const PORT = parseInt(process.env.PORT || "3001");

const server = await createHTTPServer({
  name: "infrastreet-mcp",
  version: "1.0.0",
  port: PORT,
  cors: true,
  logging: true,
});

console.log(`🚀 InfraStreet MCP Server running on port ${PORT}`);