import { SchemaConstraint, Tool } from "@leanmcp/core";
import axios from "axios";

const BACKEND_URL = process.env.BACKEND_URL || "http://backend:8000";

class OrderItemInput {
  @SchemaConstraint({ description: "Menu item ID" })
  itemId: string = "";

  @SchemaConstraint({ description: "Quantity" })
  quantity: number = 1;
}

class PlaceOrderInput {
  @SchemaConstraint({ description: "Vendor ID" })
  vendorId: string = "";

  @SchemaConstraint({ description: "Customer phone number" })
  customerPhone: string = "";

  @SchemaConstraint({ description: "Order items as JSON string" })
  items: string = "[]";
}

class OrderStatusInput {
  @SchemaConstraint({ description: "Order ID" })
  orderId: string = "";
}

export class OrderService {
  @Tool({
    description: "Place an order with a street vendor",
    inputClass: PlaceOrderInput,
  })
  async placeOrder(input: PlaceOrderInput) {
    try {
      const items = JSON.parse(input.items);
      const response = await axios.post(`${BACKEND_URL}/orders`, {
        vendorId: input.vendorId,
        customerPhone: input.customerPhone,
        items: items,
      });
      return response.data;
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : "Unknown error";
      console.error("Order error:", msg);
      return { error: msg };
    }
  }

  @Tool({
    description: "Get order status",
    inputClass: OrderStatusInput,
  })
  async getOrderStatus(input: OrderStatusInput) {
    try {
      const response = await axios.get(`${BACKEND_URL}/orders/${input.orderId}`);
      return response.data;
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : "Unknown error";
      console.error("Order status error:", msg);
      return { error: msg };
    }
  }
}