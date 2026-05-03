export interface Location {
  lat: number;
  lng: number;
}

export interface User {
  userId: string;
  phone: string;
  role: "customer" | "vendor";
  name?: string;
  /** 1 point = 1¢ off food (capped per order). */
  rewardPoints?: number;
  referralCode?: string;
  referralBonusApplied?: boolean;
  /** 2+ = upfront capture on reserve (trust policy). */
  trustLevel?: number;
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
  /** When true, automated Brain may post timed flash deals (see /deals). Managed in Telegram /brain. */
  brainEnabled?: boolean;
  neighborhood?: string | null;
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
  /** Human place label, e.g. "Astoria, Queens" */
  pickupArea?: string;
  lat?: number;
  lng?: number;
  reliabilityScore?: number;
  rankScore?: number;
}

export interface Order {
  orderId: string;
  vendorId: string;
  vendorName?: string;
  customerPhone?: string;
  dealId?: string | null;
  status: string;
  items: { name: string; quantity: number; price?: number }[];
  total?: number;
  serviceFee?: number;
  pickupCode?: string;
  /** Pickup code shown as QR / IS-XXXXXXXX when present. */
  pickupQrCode?: string | null;
  checkoutUrl?: string;
  /** Embedded Stripe checkout (deal flow). */
  clientSecret?: string;
  publishableKey?: string;
  captureMethod?: string;
  trustLevel?: number;
  stripePaymentIntent?: string | null;
  stripeCaptureMethod?: string | null;
  stripeCapturedAt?: string | null;
  customerNoShow?: boolean;
  payoutTransferId?: string | null;
  createdAt?: string;
  pointsRedeemed?: number;
  pointsDiscount?: number;
  error?: string;
}

export interface VoiceResponse {
  intent: string;
  message: string;
  results?: Vendor[];
  deals?: Deal[];
}
