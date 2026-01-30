"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { getCurrentLocation } from "@/app/services/location";
import { Vendor, MenuItem, Location } from "@/app/shared/types";
import axios from "axios";

interface Props {}

export default function VendorMenuPage({}: Props) {
  const params = useParams();
  const vendorId = params.vendorId;

  const [vendor, setVendor] = useState<Vendor | null>(null);
  const [location, setLocation] = useState<Location | null>(null);
  const [loading, setLoading] = useState(false);
  const [order, setOrder] = useState<{ item: MenuItem; quantity: number }[]>([]);

  useEffect(() => {
    async function fetchVendor() {
      setLoading(true);
      const res = await axios.get(`${process.env.NEXT_PUBLIC_BACKEND_URL}/vendors/${vendorId}`);
      setVendor(res.data);
      setLoading(false);
    }
    fetchVendor();
    getCurrentLocation().then(setLocation);
  }, [vendorId]);

  function addToOrder(item: MenuItem) {
    setOrder((prev) => {
      const existing = prev.find((o) => o.item.itemId === item.itemId);
      if (existing) {
        return prev.map((o) =>
          o.item.itemId === item.itemId ? { ...o, quantity: o.quantity + 1 } : o
        );
      }
      return [...prev, { item, quantity: 1 }];
    });
  }

  async function placeOrder() {
    if (!vendor) return;
    setLoading(true);
    await axios.post(`${process.env.NEXT_PUBLIC_BACKEND_URL}/orders`, {
      vendorId: vendor.vendorId,
      items: order.map((o) => ({ itemId: o.item.itemId, quantity: o.quantity })),
      location,
    });
    setLoading(false);
    alert("Order placed successfully!");
    setOrder([]);
  }

  if (loading || !vendor) return <div className="p-6">Loading...</div>;

  return (
    <main className="p-6 space-y-6">
      <h1 className="text-2xl font-bold">{vendor.name}</h1>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {vendor.menu?.map((item) => (
          <div key={item.itemId} className="border rounded p-4 shadow-sm bg-white">
            <div className="font-medium">{item.name}</div>
            <div className="text-sm text-gray-500">{item.description}</div>
            <div className="font-semibold text-green-600">${item.price}</div>
            {item.flashDeal && <div className="text-red-500 text-sm font-bold">Flash Deal!</div>}
            <button
              onClick={() => addToOrder(item)}
              className="mt-2 w-full bg-black text-white py-1 rounded"
            >
              Add to Order
            </button>
          </div>
        ))}
      </div>

      {order.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t shadow-lg space-y-2">
          <h2 className="font-bold">Your Order</h2>
          {order.map((o) => (
            <div key={o.item.itemId} className="flex justify-between">
              <span>
                {o.item.name} x{o.quantity}
              </span>
              <span>${(o.item.price * o.quantity).toFixed(2)}</span>
            </div>
          ))}
          <button
            onClick={placeOrder}
            className="w-full bg-black text-white py-2 rounded"
          >
            {loading ? "Placing..." : "Place Order"}
          </button>
        </div>
      )}
    </main>
  );
}
