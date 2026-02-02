import os
import httpx
from typing import Optional

MCP_SERVER_URL = os.getenv("MCP_SERVER_URL", "http://mcp-server:3001")


class VoiceService:
    """Voice service that routes to MCP agents"""

    async def process_voice_query(self, transcript: str, lat: float, lng: float):
        """Process voice transcript using MCP agents"""
        transcript_lower = transcript.lower()

        # Detect intent and route to appropriate MCP tool
        if any(word in transcript_lower for word in ["deal", "discount", "sale", "cheap", "offer"]):
            return await self._call_mcp_tool("findNearbyDeals", {"lat": lat, "lng": lng})

        # Default: search for vendors
        search_query = self._extract_search_query(transcript)
        result = await self._call_mcp_tool("searchVendors", {
            "query": search_query,
            "lat": lat,
            "lng": lng
        })
        
        results = result.get("results", [])
        return {
            "intent": "search",
            "message": f"Found {len(results)} vendors" + (f" for '{search_query}'" if search_query else " nearby"),
            "results": results,
            "deals": []
        }

    async def _call_mcp_tool(self, tool_name: str, params: dict):
        """Call MCP server tool via HTTP"""
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                # LeanMCP exposes tools at POST /mcp with JSON-RPC format
                response = await client.post(
                    f"{MCP_SERVER_URL}/mcp",
                    json={
                        "jsonrpc": "2.0",
                        "method": "tools/call",
                        "params": {
                            "name": tool_name,
                            "arguments": params
                        },
                        "id": 1
                    }
                )
                response.raise_for_status()
                data = response.json()
                
                # Extract result from JSON-RPC response
                if "result" in data:
                    content = data["result"].get("content", [])
                    if content and len(content) > 0:
                        return content[0].get("text", {})
                return data
        except Exception as e:
            print(f"MCP call error: {e}")
            # Fallback to direct service call
            return await self._fallback(tool_name, params)

    async def _fallback(self, tool_name: str, params: dict):
        """Fallback when MCP is unavailable"""
        if tool_name == "searchVendors":
            from app.services.vendor_service import VendorService
            service = VendorService()
            return service.search_nearby(params.get("query", ""), params["lat"], params["lng"])
        elif tool_name == "findNearbyDeals":
            from app.services.deal_service import DealService
            service = DealService()
            return service.find_nearby(params["lat"], params["lng"])
        return {"error": "Unknown tool"}

    def _extract_search_query(self, transcript: str) -> str:
        """Extract search term from transcript"""
        remove_phrases = [
            "i want", "i'm looking for", "looking for", "find me",
            "search for", "where can i find", "i need", "get me",
            "show me", "any", "some", "nearby", "around here",
            "find", "search"
        ]
        result = transcript.lower()
        for phrase in remove_phrases:
            result = result.replace(phrase, "")
        return result.strip()