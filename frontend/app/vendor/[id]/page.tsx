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
      <main className="min-h-screen bg-neutral-950 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-white border-t-transparent rounded-full animate-spin" />
      </main>
    );
  }

  if (!vendor) return null;

  // Order Success
  if (order) {
    return (
      <main className="min-h-screen bg-neutral-950 text-white flex flex-col items-center justify-center p-6">
        <div className="w-20 h-20 bg-green-500/20 border border-green-500/30 rounded-full flex items-center justify-center mb-8">
          <span className="text-green-400 text-3xl">✓</span>
        </div>
        
        <h1 className="text-3xl font-black mb-2">Order Confirmed</h1>
        <p className="text-neutral-500 mb-10">Show this code at pickup</p>

        <div className="bg-white text-black text-6xl font-mono py-8 px-16 rounded-3xl mb-10 tracking-[0.3em] font-black">
          {order.pickupCode}
        </div>

        <div className="w-full max-w-sm bg-white/5 border border-white/10 rounded-2xl p-5 mb-8">
          {order.items?.map((item, i) => (
            <div key={i} className="flex justify-between py-2 text-sm">
              <span className="text-neutral-300">{item.quantity}x {item.name}</span>
              <span className="text-neutral-400">${((item.price || 0) * item.quantity).toFixed(2)}</span>
            </div>
          ))}
          <div className="border-t border-white/10 mt-3 pt-3 flex justify-between font-bold">
            <span>Total</span>
            <span>${order.total?.toFixed(2)}</span>
          </div>
        </div>

        <p className="text-sm text-neutral-600 mb-8">{vendor.name}</p>

        <Link href="/search" className="w-full max-w-sm bg-white text-black py-4 rounded-2xl font-bold text-center block">
          Done
        </Link>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-neutral-950 text-white pb-28">
      {/* Header */}
      <header className="sticky top-0 z-20 backdrop-blur-xl bg-neutral-950/80 border-b border-white/5">
        <div className="max-w-lg mx-auto px-5 py-4">
          <Link href="/search" className="text-neutral-500 hover:text-white transition-colors text-sm font-medium">
            Back
          </Link>
          <h1 className="text-2xl font-black mt-3">{vendor.name}</h1>
          {vendor.businessHours && (
            <p className="text-neutral-500 text-sm mt-1">{vendor.businessHours}</p>
          )}
        </div>
      </header>

      {/* Menu */}
      <div className="max-w-lg mx-auto px-5 py-6">
        {vendor.menu && vendor.menu.length > 0 ? (
          <div className="space-y-3">
            {vendor.menu.map((item: MenuItem) => (
              <div
                key={item.itemId}
                className="bg-white/5 border border-white/10 rounded-2xl p-4 flex justify-between items-center"
              >
                <div className="flex-1 pr-4">
                  <p className="font-semibold text-white">{item.name}</p>
                  {item.description && (
                    <p className="text-sm text-neutral-500 mt-1">{item.description}</p>
                  )}
                  <p className="text-green-400 font-bold mt-2">${item.price.toFixed(2)}</p>
                </div>

                {cart[item.itemId] ? (
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => updateCart(item.itemId, -1)}
                      className="w-10 h-10 rounded-full bg-white/10 text-white font-bold hover:bg-white/20 transition-colors"
                    >
                      -
                    </button>
                    <span className="w-6 text-center font-bold">{cart[item.itemId]}</span>
                    <button
                      onClick={() => updateCart(item.itemId, 1)}
                      className="w-10 h-10 rounded-full bg-white text-black font-bold hover:bg-neutral-200 transition-colors"
                    >
                      +
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => updateCart(item.itemId, 1)}
                    className="px-6 py-2.5 bg-white text-black rounded-full font-semibold hover:bg-neutral-200 transition-colors"
                  >
                    Add
                  </button>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-20 text-neutral-500">
            <p className="text-lg">Menu coming soon</p>
          </div>
        )}
      </div>

      {/* Cart */}
      {getCount() > 0 && (
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-neutral-950/90 backdrop-blur-xl border-t border-white/10">
          <div className="max-w-lg mx-auto">
            <button
              onClick={handleOrder}
              disabled={ordering}
              className="w-full bg-white text-black py-4 rounded-2xl font-bold text-lg disabled:opacity-50 transition-opacity"
            >
              {ordering ? "Placing Order..." : `Order · $${getTotal().toFixed(2)}`}
            </button>
          </div>
        </div>
      )}
    </main>
  );
}