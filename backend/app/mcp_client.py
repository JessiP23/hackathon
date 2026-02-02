import os
import requests

MCP_URL = os.getenv("MCP_SERVER_URL")


def call_mcp_tool(tool: str, payload: dict):
    if not MCP_URL:
        raise RuntimeError("MCP_SERVER_URL environment variable is not set.")
    res = requests.post(
        f"{MCP_URL}/invoke",
        json={"tool": tool, "input": payload},
        timeout=10,
    )
    res.raise_for_status()
    return res.json()