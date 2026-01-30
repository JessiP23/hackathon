import axios from "axios";
import { Vendor, Deal } from "../shared/types";

const BASE_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";

export async function getVendorsNearby(query: string, lat: number, lng: number): Promise<{ results: Vendor[] }> {
  const res = await axios.get(`${BASE_URL}/vendors/nearby`, { params: { query, lat, lng } });
  return res.data;
}

export async function getDeals(lat: number, lng: number): Promise<{ deals: Deal[] }> {
  const res = await axios.get(`${BASE_URL}/deals`, { params: { lat, lng } });
  return res.data;
}

export async function createVendor(data: { name: string; phone: string; lat: number; lng: number; }): Promise<Vendor> {
  const res = await axios.post(`${BASE_URL}/vendors`, data);
  return res.data;
}

export async function uploadMenu(vendorId: string, file: File) {
  const formData = new FormData();
  formData.append("file", file);
  await axios.post(`${BASE_URL}/vendors/${vendorId}/menu`, formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
}
