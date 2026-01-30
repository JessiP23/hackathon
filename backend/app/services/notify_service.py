class NotifyService:
    def notify_vendor_order(self, vendor_phone: str, message: str):
        #Replace with Twilio iMEssage MCP
        print(f"[Vendor SMS] To {vendor_phone}: {message}")