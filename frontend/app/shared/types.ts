export interface Location {
  lat: number;
  lng: number;
}

export interface User {
  userId: string;
  phone: string;
  role: "customer" | "vendor";
  name?: string;
}

export interface MenuItem {
  itemId: string;
  name: string;
  price: number;
  description?: string;
  isAvailable?: boolean;
}

export interface Vendor {
  vendorId: string;
  name: string;
  phone?: string;
  distance_m?: number;
  businessHours?: string;
  location?: Location;
  menu?: MenuItem[];
  matchingItems?: { name: string; price: number }[];
  reliabilityScore?: number;
}

export interface Deal {
  dealId: string;
  vendorId: string;
  vendorName?: string;
  itemName: string;
  dealPrice: number;
  originalPrice?: number;
  discountPct?: number;
  remainingQuantity?: number;
  expiresAt: string;
  distance_m?: number;
  distanceMiles?: number;
  mediaUrl?: string;
  reliabilityScore?: number;
  rankScore?: number;
}

export interface Order {
  orderId: string;
  vendorId: string;
  vendorName?: string;
  customerPhone?: string;
  dealId?: string;
  status: string;
  items: { name: string; quantity: number; price?: number }[];
  total?: number;
  serviceFee?: number;
  pickupCode?: string;
  checkoutUrl?: string;
  stripePaymentIntent?: string | null;
  createdAt?: string;
}

export interface VoiceResponse {
  intent: string;
  message: string;
  results?: Vendor[];
  deals?: Deal[];
}
