import dotenv from "dotenv";
import { createHTTPServer } from "@leanmcp/core";

// Load environment variables
dotenv.config();

// Services are automatically discovered from ./mcp directory
await createHTTPServer({
  name: "mcp-server",
  version: "1.0.0",
  port: 3001,
  cors: true,
  logging: true
  // stateless: false,  // Enable stateful mode (uses DynamoDB on Lambda for session persistence)
});

console.log("\nmcp-server MCP Server");
