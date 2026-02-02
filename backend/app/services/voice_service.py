from app.services.vendor_service import VendorService
from app.services.deal_service import DealService


class VoiceService:
    def __init__(self):
        self.vendor_service = VendorService()
        self.deal_service = DealService()

    def process_voice_query(self, transcript: str, lat: float, lng: float):
        """Process voice transcript and return appropriate results"""
        transcript_lower = transcript.lower()
        
        # Detect intent from transcript
        if any(word in transcript_lower for word in ["deal", "discount", "sale", "cheap", "offer"]):
            deals = self.deal_service.find_nearby(lat, lng)
            return {
                "intent": "deals",
                "message": f"Found {len(deals.get('deals', []))} deals nearby",
                "deals": deals.get("deals", []),
                "results": []
            }
        
        # Default: search vendors
        # Extract search term (simple approach - remove common words)
        search_query = self._extract_search_query(transcript)
        vendors = self.vendor_service.search_nearby(search_query, lat, lng)
        
        results = vendors.get("results", [])
        if results:
            message = f"Found {len(results)} vendors nearby"
            if search_query:
                message = f"Found {len(results)} vendors for '{search_query}'"
        else:
            message = "No vendors found nearby. Try a different search."
        
        return {
            "intent": "search",
            "message": message,
            "results": results,
            "deals": []
        }

    def _extract_search_query(self, transcript: str) -> str:
        """Extract the main search term from transcript"""
        # Remove common phrases
        remove_phrases = [
            "i want", "i'm looking for", "looking for", "find me", 
            "search for", "where can i find", "i need", "get me",
            "show me", "any", "some", "nearby", "around here"
        ]
        
        result = transcript.lower()
        for phrase in remove_phrases:
            result = result.replace(phrase, "")
        
        return result.strip()