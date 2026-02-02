from app.mcp_client import call_mcp_tool


class VoiceService:
    def process_voice_query(self, transcript: str, lat: float, lng: float):
        if "deal" in transcript.lower():
            return call_mcp_tool(
                tool="findNearbyDeals",
                payload={"lat": lat, "lng": lng},
            )

        return call_mcp_tool(
            tool="searchVendors",
            payload={"query": transcript, "lat": lat, "lng": lng},
        )