import axios from "axios";
import { User, Vendor, Deal, Order } from "../shared/types";

const BASE_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";

const api = axios.create({
  baseURL: BASE_URL,
  headers: { "Content-Type": "application/json" },
});

// Users
export async function registerUser(phone: string, role: "customer" | "vendor", name?: string): Promise<User & { isExisting: boolean }> {
  const res = await api.post("/users", { phone, role, name });
  return res.data;
}

export async function getUserByPhone(phone: string): Promise<User | null> {
  try {
    const res = await api.get(`/users/phone/${phone}`);
    return res.data;
  } catch {
    return null;
  }
}

// Vendors
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

export async function getVendorsNearby(query: string, lat: number, lng: number): Promise<{ results: Vendor[] }> {
  const res = await api.get("/vendors/nearby", { params: { query, lat, lng } });
  return res.data;
}

export async function uploadMenu(vendorId: string, file: File) {
  const formData = new FormData();
  formData.append("file", file);
  const res = await api.post(`/vendors/${vendorId}/menu`, formData, {
    headers: { "Content-Type": "multipart/form-data" },
    timeout: 30000,
  });
  return res.data;
}

export async function addMenuItem(vendorId: string, itemName: string, price: number, description?: string) {
  const res = await api.post(`/vendors/${vendorId}/menu/item`, { itemName, price, description: description || "" });
  return res.data;
}

// Orders
export async function placeOrder(data: {
  vendorId: string;
  customerPhone?: string;
  items: { itemId: string; quantity: number }[];
}): Promise<Order> {
  const res = await api.post("/orders", data);
  return res.data;
}

export async function getOrder(orderId: string): Promise<Order> {
  const res = await api.get(`/orders/${orderId}`);
  return res.data;
}

export async function getVendorOrders(vendorId: string): Promise<Order[]> {
  const res = await api.get(`/orders/vendor/${vendorId}`);
  return res.data;
}

export async function getCustomerOrders(phone: string): Promise<Order[]> {
  try {
    const res = await api.get(`/orders/customer/${encodeURIComponent(phone)}`);
    return res.data.orders || [];
  } catch {
    return [];
  }
}

export async function getRecommendations(phone: string): Promise<Vendor[]> {
  try {
    const res = await api.get(`/orders/recommendations/${encodeURIComponent(phone)}`);
    return res.data.vendors || [];
  } catch {
    return [];
  }
}

export async function updateOrderStatus(orderId: string, status: string) {
  const res = await api.patch(`/orders/${orderId}/status`, { status });
  return res.data;
}

// Deals
export async function createDeal(data: {
  vendorId: string;
  itemName: string;
  dealPrice: number;
  originalPrice?: number;
  expiresAt: string;
}): Promise<Deal> {
  const res = await api.post("/deals", data);
  return res.data;
}

export async function getDealsNearby(lat: number, lng: number): Promise<Deal[]> {
  try {
    const res = await api.get("/deals", { params: { lat, lng } });
    return res.data.deals || res.data || [];
  } catch {
    return [];
  }
}