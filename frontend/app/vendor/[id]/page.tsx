"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { getVendor, placeOrder } from "@/app/services/api";
import { Vendor, MenuItem, Order } from "@/app/shared/types";

export default function VendorPage() {
  const params = useParams();
  const router = useRouter();
  const vendorId = params.id as string;

  const [vendor, setVendor] = useState<Vendor | null>(null);
  const [loading, setLoading] = useState(true);
  const [cart, setCart] = useState<Record<string, number>>({});
  const [ordering, setOrdering] = useState(false);
  const [order, setOrder] = useState<Order | null>(null);

  useEffect(() => {
    if (vendorId) {
      getVendor(vendorId)
        .then(setVendor)
        .catch(() => router.push("/search"))
        .finally(() => setLoading(false));
    }
  }, [vendorId, router]);

  function updateCart(itemId: string, delta: number) {
    setCart((prev) => {
      const qty = (prev[itemId] || 0) + delta;
      if (qty <= 0) {
        const { [itemId]: _, ...rest } = prev;
        return rest;
      }
      return { ...prev, [itemId]: qty };
    });
  }

  function getTotal() {
    if (!vendor?.menu) return 0;
    return Object.entries(cart).reduce((sum, [id, qty]) => {
      const item = vendor.menu?.find((m) => m.itemId === id);
      return sum + (item?.price || 0) * qty;
    }, 0);
  }

  function getCount() {
    return Object.values(cart).reduce((a, b) => a + b, 0);
  }

  async function handleOrder() {
    if (!vendor || getCount() === 0) return;
    setOrdering(true);
    try {
      const phone = localStorage.getItem("infrastreet_phone") || "guest";
      const items = Object.entries(cart).map(([itemId, quantity]) => ({ itemId, quantity }));
      const result = await placeOrder({ vendorId: vendor.vendorId, customerPhone: phone, items });
      setOrder(result);
      setCart({});
    } catch {
      alert("Order failed. Try again.");
    } finally {
      setOrdering(false);
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-black border-t-transparent rounded-full animate-spin" />
      </main>
    );
  }

  if (!vendor) return null;

  // Order Success
  if (order) {
    return (
      <main className="min-h-screen bg-white flex flex-col items-center justify-center p-6 text-center text-black">
        <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mb-6">
          <span className="text-green-600 text-3xl">✓</span>
        </div>
        
        <h1 className="text-2xl font-bold mb-2">Order Confirmed</h1>
        <p className="text-gray-500 mb-8">Show this code at pickup</p>

        <div className="bg-black text-white text-6xl font-mono py-8 px-16 rounded-3xl mb-8 tracking-[0.3em]">
          {order.pickupCode}
        </div>

        <div className="w-full max-w-sm bg-gray-50 rounded-2xl p-5 mb-6">
          {order.items?.map((item, i) => (
            <div key={i} className="flex justify-between py-2 text-sm">
              <span>{item.quantity}x {item.name}</span>
              <span>${((item.price || 0) * item.quantity).toFixed(2)}</span>
            </div>
          ))}
          <div className="border-t mt-3 pt-3 flex justify-between font-bold">
            <span>Total</span>
            <span>${order.total?.toFixed(2)}</span>
          </div>
        </div>

        <p className="text-sm text-gray-400 mb-6">{vendor.name}</p>

        <Link href="/search" className="w-full max-w-sm bg-black text-white py-4 rounded-2xl font-semibold text-center block">
          Done
        </Link>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-white pb-28 text-black">
      {/* Header */}
      <div className="bg-black text-white p-6 pb-8">
        <Link href="/search" className="text-gray-400 text-sm">← Back</Link>
        <h1 className="text-2xl font-bold mt-4">{vendor.name}</h1>
        {vendor.businessHours && <p className="text-gray-400 text-sm mt-1">{vendor.businessHours}</p>}
      </div>

      {/* Menu */}
      <div className="p-4 -mt-4">
        {vendor.menu && vendor.menu.length > 0 ? (
          <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
            {vendor.menu.map((item: MenuItem, i) => (
              <div
                key={item.itemId}
                className={`p-4 flex justify-between items-center ${i > 0 ? "border-t" : ""}`}
              >
                <div className="flex-1">
                  <p className="font-medium">{item.name}</p>
                  {item.description && <p className="text-sm text-gray-500">{item.description}</p>}
                  <p className="text-green-600 font-semibold mt-1">${item.price.toFixed(2)}</p>
                </div>

                {cart[item.itemId] ? (
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => updateCart(item.itemId, -1)}
                      className="w-8 h-8 rounded-full bg-gray-100 font-bold"
                    >
                      -
                    </button>
                    <span className="w-4 text-center font-medium">{cart[item.itemId]}</span>
                    <button
                      onClick={() => updateCart(item.itemId, 1)}
                      className="w-8 h-8 rounded-full bg-black text-white font-bold"
                    >
                      +
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => updateCart(item.itemId, 1)}
                    className="px-5 py-2 bg-black text-white rounded-full text-sm font-medium"
                  >
                    Add
                  </button>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-16 text-gray-500">
            <p className="text-lg">Menu coming soon</p>
          </div>
        )}
      </div>

      {/* Cart */}
      {getCount() > 0 && (
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t">
          <button
            onClick={handleOrder}
            disabled={ordering}
            className="w-full bg-black text-white py-4 rounded-2xl font-bold disabled:opacity-50"
          >
            {ordering ? "Placing Order..." : `Order · $${getTotal().toFixed(2)}`}
          </button>
        </div>
      )}
    </main>
  );
}