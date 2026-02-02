import axios from "axios";
import { User, Vendor, Deal, Order, VoiceResponse } from "../shared/types";

const BASE_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";

const api = axios.create({
  baseURL: BASE_URL,
  timeout: 10000,
});

// User endpoints
export async function registerUser(phone: string, role: "customer" | "vendor", name?: string): Promise<User & { isExisting: boolean }> {
  const res = await api.post("/users", { phone, role, name });
  return res.data;
}

export async function getUserByPhone(phone: string): Promise<User | null> {
  try {
    const res = await api.get(`/users/phone/${encodeURIComponent(phone)}`);
    return res.data;
  } catch {
    return null;
  }
}

// Vendor endpoints
export async function createVendor(data: {
  name: string;
  phone: string;
  lat: number;
  lng: number;
  businessHours?: string;
}): Promise<Vendor> {
  const res = await api.post("/vendors", data);
  return res.data;
}

export async function getVendor(vendorId: string): Promise<Vendor> {
  const res = await api.get(`/vendors/${vendorId}`);
  return res.data;
}

export async function getVendorsNearby(
  query: string,
  lat: number,
  lng: number
): Promise<{ results: Vendor[] }> {
  const res = await api.get("/vendors/nearby", {
    params: { query, lat, lng },
  });
  return res.data;
}

export async function uploadMenu(vendorId: string, file: File): Promise<{ status: string; menuId: string }> {
  const formData = new FormData();
  formData.append("file", file);
  const res = await api.post(`/vendors/${vendorId}/menu`, formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return res.data;
}

// Deal endpoints
export async function getDeals(lat: number, lng: number): Promise<{ deals: Deal[] }> {
  const res = await api.get("/deals", { params: { lat, lng } });
  return res.data;
}

export async function createDeal(data: {
  vendorId: string;
  itemName: string;
  dealPrice: number;
  originalPrice?: number;
  expiresAt: string;
}): Promise<{ dealId: string }> {
  const res = await api.post("/deals", data);
  return res.data;
}

// Order endpoints
export async function placeOrder(data: {
  vendorId: string;
  items: { itemId: string; quantity: number }[];
  customerPhone?: string;
  lat?: number;
  lng?: number;
}): Promise<Order> {
  const res = await api.post("/orders", data);
  return res.data;
}

export async function getOrder(orderId: string): Promise<Order> {
  const res = await api.get(`/orders/${orderId}`);
  return res.data;
}

// Voice endpoint
export async function sendVoiceTranscript(
  transcript: string,
  lat: number,
  lng: number
): Promise<VoiceResponse> {
  const res = await api.post("/voice", { transcript, lat, lng });
  return res.data;
}