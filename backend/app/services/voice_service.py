import requests
from app.mcp_client import call_mcp_tool

class VoiceService:
    def process_voice_query(self, transcript: str, lat: float, lon: float):
        if "deal" in transcript.lower():
            return call_mcp_tool(
                tool="findNearbyDeals",
                payload={"lat": lat, "lon": lon}
            )
        
        return call_mcp_tool(
            tool="searchVendors",
            payload={"query": transcript, "lat": lat, "lon": lon}
        )