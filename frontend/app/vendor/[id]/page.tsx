"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { getVendor, placeOrder } from "@/app/services/api";
import { Vendor, MenuItem, Order } from "@/app/shared/types";
import { MobileAppFrame, MobileNav } from "@/app/components/MobileLayout";
import { isDemoBrowse } from "@/app/lib/demo";

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
    const phone = localStorage.getItem("infrastreet_phone");
    if (!phone) {
      if (isDemoBrowse()) {
        alert("Demo: add your phone on Get started to place a real order.");
        return;
      }
      router.push("/onboard");
      return;
    }
    setOrdering(true);
    try {
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
      <MobileAppFrame>
        <div className="flex min-h-[60vh] items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--infra-ink-4)] border-t-[var(--infra-accent)]" />
        </div>
      </MobileAppFrame>
    );
  }

  if (!vendor) return null;

  if (order) {
    return (
      <MobileAppFrame>
        <div className="flex min-h-[85vh] flex-col items-center justify-center px-6 pb-16 pt-10">
          <div className="mb-8 flex h-20 w-20 items-center justify-center rounded-full border border-[var(--infra-green)]/35 bg-[var(--infra-green)]/15">
            <span className="text-3xl text-[var(--infra-green)]">✓</span>
          </div>

          <h1 className="mb-2 text-[26px] font-semibold tracking-tight text-[var(--infra-ink)]">Order placed</h1>
          <p className="mb-8 text-[15px] text-[var(--infra-ink-2)]">Show this pickup code at the stall</p>

          <div className="mb-8 rounded-[var(--r-xl)] bg-[var(--infra-ink)] px-10 py-8 font-mono text-[clamp(2.5rem,12vw,3.5rem)] font-black tracking-[0.2em] text-[var(--infra-black)]">
            {order.pickupCode}
          </div>

          <div className="mb-8 w-full max-w-sm rounded-[var(--r-xl)] border border-[var(--infra-ink-4)] bg-[var(--infra-tile-1)] p-5">
            {order.items?.map((item, i) => (
              <div key={i} className="flex justify-between py-2 text-[14px]">
                <span className="text-[var(--infra-ink-2)]">
                  {item.quantity}× {item.name}
                </span>
                <span className="text-[var(--infra-ink-3)]">${((item.price || 0) * item.quantity).toFixed(2)}</span>
              </div>
            ))}
            <div className="mt-3 flex justify-between border-t border-[var(--infra-ink-4)] pt-3 font-semibold text-[var(--infra-ink)]">
              <span>Total</span>
              <span>${order.total?.toFixed(2)}</span>
            </div>
          </div>

          <p className="mb-8 text-[14px] text-[var(--infra-ink-3)]">{vendor.name}</p>

          <Link
            href="/orders"
            className="flex h-14 w-full max-w-sm items-center justify-center rounded-[var(--r-pill)] bg-[var(--infra-accent)] text-[17px] font-semibold text-white active:scale-[0.98]"
          >
            View orders
          </Link>
          <Link href="/search" className="mt-4 text-[15px] font-medium text-[var(--infra-blue)] underline-offset-2 hover:underline">
            Back to search
          </Link>
        </div>
      </MobileAppFrame>
    );
  }

  return (
    <MobileAppFrame>
      <MobileNav title={vendor.name.length > 18 ? `${vendor.name.slice(0, 17)}…` : vendor.name} backHref="/search" />

      <div className="px-5 pb-36 pt-2">
        {vendor.businessHours && (
          <p className="mb-6 text-[14px] text-[var(--infra-ink-3)]">{vendor.businessHours}</p>
        )}

        {vendor.menu && vendor.menu.length > 0 ? (
          <div className="space-y-3">
            {vendor.menu.map((item: MenuItem) => (
              <div
                key={item.itemId}
                className="flex items-center justify-between rounded-[var(--r-xl)] border border-[var(--infra-ink-4)] bg-[var(--infra-tile-1)] p-4"
              >
                <div className="min-w-0 flex-1 pr-4">
                  <p className="font-semibold text-[var(--infra-ink)]">{item.name}</p>
                  {item.description && (
                    <p className="mt-1 text-[13px] text-[var(--infra-ink-3)]">{item.description}</p>
                  )}
                  <p className="mt-2 text-[16px] font-bold text-[var(--infra-green)]">${item.price.toFixed(2)}</p>
                </div>

                {cart[item.itemId] ? (
                  <div className="flex shrink-0 items-center gap-2">
                    <button
                      type="button"
                      onClick={() => updateCart(item.itemId, -1)}
                      className="flex h-10 w-10 items-center justify-center rounded-full border border-[var(--infra-ink-4)] bg-[var(--infra-tile-2)] text-[var(--infra-ink)] font-bold active:scale-95"
                    >
                      −
                    </button>
                    <span className="w-6 text-center font-bold text-[var(--infra-ink)]">{cart[item.itemId]}</span>
                    <button
                      type="button"
                      onClick={() => updateCart(item.itemId, 1)}
                      className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--infra-ink)] text-[var(--infra-black)] font-bold active:scale-95"
                    >
                      +
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => updateCart(item.itemId, 1)}
                    className="shrink-0 rounded-[var(--r-pill)] bg-[var(--infra-tile-2)] px-5 py-2.5 text-[14px] font-semibold text-[var(--infra-ink)] ring-1 ring-[var(--infra-ink-4)] active:scale-95"
                  >
                    Add
                  </button>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="py-20 text-center text-[var(--infra-ink-3)]">
            <p className="text-[17px]">Menu coming soon</p>
          </div>
        )}
      </div>

      {getCount() > 0 && (
        <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-[var(--infra-ink-4)] bg-[rgba(0,0,0,0.92)] px-4 py-3 backdrop-blur-xl [padding-bottom:max(12px,env(safe-area-inset-bottom))]">
          <div className="mx-auto w-full max-w-[430px]">
            <button
              type="button"
              onClick={handleOrder}
              disabled={ordering}
              className="flex h-14 w-full items-center justify-center rounded-[var(--r-pill)] text-[17px] font-semibold text-white disabled:opacity-50 active:scale-[0.98]"
              style={{ backgroundColor: "var(--infra-accent)" }}
            >
              {ordering ? "Placing order…" : `Place order · $${getTotal().toFixed(2)}`}
            </button>
          </div>
        </div>
      )}
    </MobileAppFrame>
  );
}
