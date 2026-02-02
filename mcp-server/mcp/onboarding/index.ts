import { SchemaConstraint, Tool } from "@leanmcp/core";
import axios from "axios";

const BACKEND_URL = process.env.BACKEND_URL || "http://backend:8000";

class CreateVendorInput {
  @SchemaConstraint({ description: "Vendor/business name" })
  name: string = "";

  @SchemaConstraint({ description: "Phone number" })
  phone: string = "";

  @SchemaConstraint({ description: "Latitude" })
  lat: number = 0;

  @SchemaConstraint({ description: "Longitude" })
  lng: number = 0;

  @SchemaConstraint({ description: "Business hours" })
  businessHours: string = "";
}

class UploadMenuInput {
  @SchemaConstraint({ description: "Vendor ID" })
  vendorId: string = "";

  @SchemaConstraint({ description: "Base64 encoded menu image" })
  imageBase64: string = "";

  @SchemaConstraint({ description: "Image filename" })
  filename: string = "";
}

export class OnboardingService {
  @Tool({
    description: "Register a new street vendor",
    inputClass: CreateVendorInput,
  })
  async createVendor(input: CreateVendorInput) {
    try {
      const response = await axios.post(`${BACKEND_URL}/vendors`, {
        name: input.name,
        phone: input.phone,
        lat: input.lat,
        lng: input.lng,
        businessHours: input.businessHours || undefined,
      });
      return response.data;
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : "Unknown error";
      console.error("Create vendor error:", msg);
      return { error: msg };
    }
  }

  @Tool({
    description: "Upload and process a menu image",
    inputClass: UploadMenuInput,
  })
  async uploadMenu(input: UploadMenuInput) {
    return {
      status: "processing",
      vendorId: input.vendorId,
      message: "Menu image received. OCR processing not yet implemented.",
    };
  }
}