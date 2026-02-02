import { SchemaConstraint, Tool } from "@leanmcp/core";
import axios from "axios";

const BACKEND_URL = process.env.BACKEND_URL || "http://backend:8000";

class SearchVendorInput {
  @SchemaConstraint({ description: "Food or product user is looking for" })
  query: string = "";

  @SchemaConstraint({ description: "User latitude" })
  lat: number = 0;

  @SchemaConstraint({ description: "User longitude" })
  lng: number = 0;
}

export class SearchService {
  @Tool({
    description: "Search nearby street vendors by food or product",
    inputClass: SearchVendorInput,
  })
  async searchVendors(input: SearchVendorInput) {
    try {
      const response = await axios.get(`${BACKEND_URL}/vendors/nearby`, {
        params: {
          q: input.query,
          lat: input.lat,
          lng: input.lng,
          limit: 10,
        },
      });
      return response.data;
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : "Unknown error";
      console.error("Search error:", msg);
      return { results: [], error: msg };
    }
  }
}