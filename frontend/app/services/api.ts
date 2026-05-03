import axios from "axios";
import { User, Vendor, Deal, Order } from "../shared/types";

const BASE_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";

const api = axios.create({
  baseURL: BASE_URL,
  headers: { "Content-Type": "application/json" },
});

// Users
export async function registerUser(
  phone: string,
  role: "customer" | "vendor",
  name?: string,
  referredBy?: string,
): Promise<User & { isExisting: boolean; referralBonusApplied?: boolean }> {
  const res = await api.post("/users", {
    phone,
    role,
    name,
    ...(referredBy ? { referredBy } : {}),
  });
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
  redeemPoints?: number;
  items: { itemId: string; quantity: number }[];
}): Promise<Order> {
  const res = await api.post("/orders", {
    vendorId: data.vendorId,
    customerPhone: data.customerPhone,
    redeemPoints: data.redeemPoints ?? 0,
    items: data.items,
  });
  return res.data;
}

export async function getOrder(orderId: string): Promise<Order> {
  const res = await api.get(`/orders/${orderId}`);
  return res.data;
}

/** Resume Stripe Elements after refresh / direct link (uses PaymentIntent on the order). */
export async function getOrderCheckoutSession(orderId: string): Promise<{
  orderId: string;
  clientSecret: string;
  publishableKey: string;
  trustLevel?: number;
}> {
  const res = await api.get(`/orders/${encodeURIComponent(orderId)}/checkout-session`);
  return res.data;
}

/** Resume or create Stripe Hosted Checkout (vendor menu cart orders). */
export async function getHostedCheckoutUrl(orderId: string): Promise<{ checkoutUrl: string; orderId?: string }> {
  const res = await api.get(`/orders/${encodeURIComponent(orderId)}/hosted-checkout`);
  return res.data;
}

/** Recover from missed Stripe webhooks after Hosted Checkout (local dev / connectivity). */
export async function syncOrderStripeCheckout(orderId: string): Promise<{
  ok?: boolean;
  synced?: boolean;
  status?: string;
  error?: string;
}> {
  try {
    const res = await api.post(`/orders/${encodeURIComponent(orderId)}/sync-stripe-checkout`);
    return res.data;
  } catch {
    return { ok: false };
  }
}

/** Flash deal / Elements: after card is on file, sync DB + vendor Telegram if webhooks missed localhost. */
export async function ackDealPaymentAuthorized(orderId: string): Promise<{
  ok?: boolean;
  updated?: boolean;
  pi_status?: string;
  error?: string;
}> {
  try {
    const res = await api.post(`/orders/${encodeURIComponent(orderId)}/ack-payment-authorized`);
    return res.data;
  } catch {
    return { ok: false };
  }
}

export async function getOrderReceipt(orderId: string): Promise<{ receiptUrl: string | null }> {
  const res = await api.get(`/orders/${encodeURIComponent(orderId)}/receipt`);
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

/** Active flash deals for one stall (vendor menu page). */
export async function getVendorActiveDeals(vendorId: string): Promise<Deal[]> {
  try {
    const res = await api.get(`/vendors/${vendorId}/deals`);
    return res.data.deals || [];
  } catch {
    return [];
  }
}

export async function placeDealOrder(
  dealId: string,
  data: { customerPhone: string; quantity: number; customerId?: string; redeemPoints?: number }
): Promise<Order> {
  try {
    const res = await api.post(`/deals/${dealId}/order`, data);
    return res.data;
  } catch (e) {
    if (axios.isAxiosError(e) && e.response?.data && typeof (e.response.data as { detail?: unknown }).detail === "string") {
      return {
        orderId: "",
        vendorId: "",
        status: "error",
        items: [],
        error: (e.response.data as { detail: string }).detail,
      };
    }
    throw e;
  }
}

export async function notifyOptIn(data: {
  lat: number;
  lng: number;
  radius?: number;
  phone: string;
}): Promise<{ success: boolean; otpSent?: boolean; error?: string }> {
  const res = await api.post("/customers/notify_opt_in", {
    lat: data.lat,
    lng: data.lng,
    radius: data.radius ?? 10,
    phone: data.phone,
  });
  return res.data;
}

export async function getVendorStats(vendorId: string, days = 7) {
  try {
    const res = await api.get(`/vendors/${vendorId}/stats`, { params: { days } });
    return res.data;
  } catch {
    return null;
  }
}
