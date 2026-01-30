export interface Location {
  lat: number;
  lng: number;
}

export interface Vendor {
  vendorId: string;
  name: string;
  distance_m: number;
  menu?: MenuItem[];
}

export interface MenuItem {
  itemId: string;
  name: string;
  price: number;
  description?: string;
  flashDeal?: boolean;
}

export interface Deal {
  item: string;
  price: number;
  vendorId: string;
  vendorName: string;
  distance_m: number;
}
