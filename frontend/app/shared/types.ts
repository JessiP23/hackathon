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
  flashDeal?: boolean;
}

export interface MatchingItem {
  name: string;
  price: number;
}

export interface Vendor {
  vendorId: string;
  name: string;
  phone?: string;
  distance_m?: number;
  businessHours?: string;
  location?: Location;
  menu?: MenuItem[];
}

export interface Deal {
  dealId: string;
  item: string;
  price: number;
  originalPrice?: number;
  vendorId: string;
  vendorName: string;
  distance_m: number;
}

export interface Order {
  orderId: string;
  vendorId: string;
  vendorName?: string;
  customerPhone?: string;
  status: string;
  items: OrderItem[];
  total?: number;
  pickupCode?: string;
  createdAt?: string;
}

export interface OrderItem {
  itemId: string;
  name?: string;
  quantity: number;
  price?: number;
}

export interface VoiceResponse {
  intent: string;
  message: string;
  results?: Vendor[];
  deals?: Deal[];
}