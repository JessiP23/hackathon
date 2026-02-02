import { SchemaConstraint, Tool } from "@leanmcp/core";
import axios from "axios";

const BACKEND_URL = process.env.BACKEND_URL || "http://backend:8000";

class NearbyDealsInput {
  @SchemaConstraint({ description: "User latitude" })
  lat: number = 0;

  @SchemaConstraint({ description: "User longitude" })
  lng: number = 0;
}

class CreateDealInput {
  @SchemaConstraint({ description: "Vendor ID" })
  vendorId: string = "";

  @SchemaConstraint({ description: "Item name for the deal" })
  itemName: string = "";

  @SchemaConstraint({ description: "Discounted price" })
  dealPrice: number = 0;

  @SchemaConstraint({ description: "Original price" })
  originalPrice: number = 0;

  @SchemaConstraint({ description: "Deal expiration ISO timestamp" })
  expiresAt: string = "";
}

export class DealsService {
  @Tool({
    description: "Find nearby flash deals",
    inputClass: NearbyDealsInput,
  })
  async findNearbyDeals(input: NearbyDealsInput) {
    try {
      const response = await axios.get(`${BACKEND_URL}/deals/nearby`, {
        params: { lat: input.lat, lng: input.lng, limit: 10 },
      });
      return response.data;
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : "Unknown error";
      console.error("Deals error:", msg);
      return { deals: [], error: msg };
    }
  }

  @Tool({
    description: "Create a flash deal for a vendor",
    inputClass: CreateDealInput,
  })
  async createDeal(input: CreateDealInput) {
    try {
      const response = await axios.post(`${BACKEND_URL}/deals`, {
        vendorId: input.vendorId,
        itemName: input.itemName,
        dealPrice: input.dealPrice,
        originalPrice: input.originalPrice || undefined,
        expiresAt: input.expiresAt,
      });
      return response.data;
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : "Unknown error";
      console.error("Create deal error:", msg);
      return { error: msg };
    }
  }
}