import requests 
import os

MCP_URL = os.getenv("MCP_SERVER_URL")

def call_mcp_tool(tool: str, payload: dict):
    res = requests.post(
        f"{MCP_URL}/invoke",
        json={"tool": tool, "input": payload},
        timeout=10
    )
    res.raise_for_status()
    res.json()