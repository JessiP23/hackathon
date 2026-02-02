import { Tool, SchemaConstraint } from "@leanmcp/core";
import axios from "axios";
import FormData from "form-data";

const BACKEND = process.env.BACKEND_URL || "http://backend:8000";

class CreateVendorInput {
  @SchemaConstraint({ description: "Business name" })
  name: string = "";

  @SchemaConstraint({ description: "Phone number" })
  phone: string = "";

  @SchemaConstraint({ description: "Latitude" })
  lat: number = 0;

  @SchemaConstraint({ description: "Longitude" })
  lng: number = 0;

  @SchemaConstraint({ description: "Business hours (e.g., '9am-5pm')" })
  businessHours: string = "";
}

class ProcessMenuInput {
  @SchemaConstraint({ description: "Vendor ID" })
  vendorId: string = "";

  @SchemaConstraint({ description: "Base64 encoded menu image" })
  imageBase64: string = "";
}

class AddItemInput {
  @SchemaConstraint({ description: "Vendor ID" })
  vendorId: string = "";

  @SchemaConstraint({ description: "Item name" })
  itemName: string = "";

  @SchemaConstraint({ description: "Price" })
  price: number = 0;

  @SchemaConstraint({ description: "Description" })
  description: string = "";
}

export class OnboardingService {
  @Tool({
    description: "Register a new street vendor",
    inputClass: CreateVendorInput,
  })
  async createVendor(input: CreateVendorInput) {
    try {
      const res = await axios.post(`${BACKEND}/vendors`, {
        name: input.name,
        phone: input.phone,
        lat: input.lat,
        lng: input.lng,
        businessHours: input.businessHours || undefined,
      });

      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify({
            success: true,
            vendorId: res.data.vendorId,
            message: `Registered "${input.name}". Now upload a menu image.`
          })
        }]
      };
    } catch (e: unknown) {
      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify({ success: false, error: String(e) })
        }]
      };
    }
  }

  @Tool({
    description: "Process menu image with OCR to extract items automatically",
    inputClass: ProcessMenuInput,
  })
  async processMenuImage(input: ProcessMenuInput) {
    try {
      const buffer = Buffer.from(input.imageBase64, "base64");
      const form = new FormData();
      form.append("file", buffer, { filename: "menu.jpg", contentType: "image/jpeg" });

      const res = await axios.post(
        `${BACKEND}/vendors/${input.vendorId}/menu`,
        form,
        { headers: form.getHeaders(), timeout: 30000 }
      );

      const data = res.data;

      if (data.itemsExtracted > 0) {
        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify({
              success: true,
              message: `Extracted ${data.itemsExtracted} menu items via OCR`,
              items: data.items
            })
          }]
        };
      } else {
        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify({
              success: false,
              message: "No items found. Try clearer image or add manually."
            })
          }]
        };
      }
    } catch (e: unknown) {
      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify({ success: false, error: String(e) })
        }]
      };
    }
  }

  @Tool({
    description: "Add a single menu item manually",
    inputClass: AddItemInput,
  })
  async addMenuItem(input: AddItemInput) {
    try {
      const res = await axios.post(`${BACKEND}/vendors/${input.vendorId}/menu/item`, {
        itemName: input.itemName,
        price: input.price,
        description: input.description,
      });

      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify({
            success: true,
            message: `Added "${input.itemName}" ($${input.price})`,
            itemId: res.data.itemId
          })
        }]
      };
    } catch (e: unknown) {
      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify({ success: false, error: String(e) })
        }]
      };
    }
  }
}