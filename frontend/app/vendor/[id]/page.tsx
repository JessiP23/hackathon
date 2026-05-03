"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { getVendor, placeOrder, getVendorActiveDeals, getUserByPhone } from "@/app/services/api";
import { Vendor, MenuItem, Deal } from "@/app/shared/types";
import { MobileAppFrame, MobileNav } from "@/app/components/MobileLayout";
import { isDemoBrowse } from "@/app/lib/demo";

const SERVICE_FEE_RATE = 0.15;

function timeLeftLabel(expiresAt: string) {
  const diff = new Date(expiresAt).getTime() - Date.now();
  if (diff <= 0) return null;
  const hours = Math.floor(diff / 3600000);
  const mins = Math.floor((diff % 3600000) / 60000);
  if (hours > 0) return `${hours}h ${mins}m`;
  return `${mins}m`;
}

export default function VendorPage() {
  const params = useParams();
  const router = useRouter();
  const vendorId = params.id as string;

  const [vendor, setVendor] = useState<Vendor | null>(null);
  const [loading, setLoading] = useState(true);
  const [cart, setCart] = useState<Record<string, number>>({});
  const [ordering, setOrdering] = useState(false);
  const [vendorFlashDeals, setVendorFlashDeals] = useState<Deal[]>([]);
  const [pointsBalance, setPointsBalance] = useState(0);
  const [applyFoodPoints, setApplyFoodPoints] = useState(true);
  const [specialQty, setSpecialQty] = useState<Record<string, number>>({});

  const specialMax = useCallback((d: Deal) => {
    const r = d.remainingQuantity;
    if (r != null && r > 0) return Math.min(99, r);
    return 99;
  }, []);

  const bumpSpecialQty = useCallback(
    (dealId: string, delta: number) => {
      const deal = vendorFlashDeals.find((x) => x.dealId === dealId);
      if (!deal) return;
      const max = specialMax(deal);
      setSpecialQty((prev) => {
        const cur = prev[dealId] ?? 1;
        const next = Math.max(1, Math.min(max, cur + delta));
        return { ...prev, [dealId]: next };
      });
    },
    [vendorFlashDeals, specialMax],
  );

  const clampedSpecialQty = (d: Deal) => {
    const max = specialMax(d);
    const q = specialQty[d.dealId] ?? 1;
    return Math.max(1, Math.min(max, q));
  };

  useEffect(() => {
    if (vendorId) {
      getVendor(vendorId)
        .then(setVendor)
        .catch(() => router.push("/search"))
        .finally(() => setLoading(false));
    }
  }, [vendorId, router]);

  useEffect(() => {
    const phone = localStorage.getItem("infrastreet_phone");
    if (!phone) return;
    void getUserByPhone(phone).then((u) => {
      if (u?.rewardPoints != null) setPointsBalance(u.rewardPoints);
    });
  }, []);

  useEffect(() => {
    if (!vendor) return;
    void (async () => {
      try {
        const deals = await getVendorActiveDeals(vendor.vendorId);
        const active = deals.filter((d) => d.expiresAt && timeLeftLabel(d.expiresAt));
        setVendorFlashDeals(active);
      } catch {
        setVendorFlashDeals([]);
      }
    })();
  }, [vendor]);

  const cartSubtotal = useMemo(() => {
    if (!vendor?.menu) return 0;
    return Object.entries(cart).reduce((sum, [id, qty]) => {
      const item = vendor.menu?.find((m) => m.itemId === id);
      return sum + (item?.price || 0) * qty;
    }, 0);
  }, [vendor, cart]);

  const estimatedPayTotal = useMemo(() => {
    return Math.round(cartSubtotal * (1 + SERVICE_FEE_RATE) * 100) / 100;
  }, [cartSubtotal]);

  const updateCart = useCallback((itemId: string, delta: number) => {
    setCart((prev) => {
      const qty = (prev[itemId] || 0) + delta;
      if (qty <= 0) {
        const { [itemId]: _, ...rest } = prev;
        return rest;
      }
      return { ...prev, [itemId]: qty };
    });
  }, []);

  const cartCount = useMemo(() => Object.values(cart).reduce((a, b) => a + b, 0), [cart]);

  const handleOrder = useCallback(async () => {
    if (!vendor || cartCount === 0) return;
    const phone = localStorage.getItem("infrastreet_phone");
    if (!phone) {
      if (isDemoBrowse()) {
        alert("Demo: add your phone on Get started to pay with Stripe checkout.");
        return;
      }
      router.push("/onboard");
      return;
    }
    setOrdering(true);
    try {
      const items = Object.entries(cart).map(([itemId, quantity]) => ({ itemId, quantity }));
      const preTotal = Math.round(cartSubtotal * (1 + SERVICE_FEE_RATE) * 100) / 100;
      const maxCents = Math.floor(preTotal * 0.5 * 100);
      const redeemPoints =
        applyFoodPoints && pointsBalance > 0 ? Math.min(pointsBalance, maxCents) : 0;
      const order = await placeOrder({
        vendorId: vendor.vendorId,
        customerPhone: phone,
        items,
        redeemPoints,
      });
      void getUserByPhone(phone).then((u) => {
        if (u?.rewardPoints != null) setPointsBalance(u.rewardPoints);
      });
      setCart({});
      if (order.checkoutUrl) {
        try {
          sessionStorage.setItem(
            "infrastreet_checkout",
            JSON.stringify({ orderId: order.orderId, url: order.checkoutUrl }),
          );
        } catch {
          /* ignore */
        }
        router.push(`/checkout?orderId=${encodeURIComponent(order.orderId)}`);
      } else {
        router.push(`/orders/${order.orderId}/confirmed`);
      }
    } catch (e) {
      console.error(e);
      alert("Could not start checkout. Try again.");
    } finally {
      setOrdering(false);
    }
  }, [
    vendor,
    cartCount,
    cart,
    cartSubtotal,
    router,
    applyFoodPoints,
    pointsBalance,
  ]);

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

  return (
    <MobileAppFrame>
      <MobileNav title={vendor.name.length > 18 ? `${vendor.name.slice(0, 17)}…` : vendor.name} backHref="/search" />

      <div className="px-5 pb-40 pt-2">
        <div className="mb-4 flex flex-wrap gap-2">
          <Link
            href="/deals"
            className="rounded-[var(--r-pill)] bg-[var(--infra-tile-2)] px-3 py-1.5 text-[13px] font-semibold text-[var(--infra-ink)] ring-1 ring-[var(--infra-ink-4)]"
          >
            Flash deals nearby
          </Link>
        </div>

        {vendor.businessHours && (
          <p className="mb-4 text-[14px] text-[var(--infra-ink-3)]">{vendor.businessHours}</p>
        )}

        {vendorFlashDeals.length > 0 && (
          <div className="mb-6">
            <h2 className="mb-2 text-[15px] font-semibold text-[var(--infra-ink)]">Specials</h2>
            <ul className="space-y-2">
              {vendorFlashDeals.map((d) => {
                const left = timeLeftLabel(d.expiresAt);
                const price =
                  typeof d.dealPrice === "number" && !Number.isNaN(d.dealPrice)
                    ? d.dealPrice.toFixed(2)
                    : "—";
                const sq = clampedSpecialQty(d);
                const smax = specialMax(d);
                return (
                  <li key={d.dealId}>
                    <div className="flex flex-col gap-2 rounded-[var(--r-xl)] border border-[var(--infra-green)]/40 bg-[var(--infra-green)]/10 px-4 py-3 text-[14px] text-[var(--infra-ink)]">
                      <div className="flex min-w-0 items-start justify-between gap-2">
                        <span className="min-w-0 pr-2">
                          <span className="font-semibold">{d.itemName}</span>
                          <span className="text-[var(--infra-ink-2)]"> · ${price} ea.</span>
                        </span>
                        {left ? (
                          <span className="shrink-0 text-[12px] font-medium text-[var(--infra-green)]">
                            {left} left
                          </span>
                        ) : null}
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            aria-label="Fewer"
                            disabled={sq <= 1}
                            onClick={() => bumpSpecialQty(d.dealId, -1)}
                            className="flex size-10 items-center justify-center rounded-full border border-[var(--infra-ink-4)] bg-[var(--infra-tile-2)] text-[16px] font-bold disabled:opacity-35"
                          >
                            −
                          </button>
                          <span className="w-7 text-center text-[15px] font-semibold tabular-nums">{sq}</span>
                          <button
                            type="button"
                            aria-label="More"
                            disabled={sq >= smax}
                            onClick={() => bumpSpecialQty(d.dealId, 1)}
                            className="flex size-10 items-center justify-center rounded-full border border-[var(--infra-ink-4)] bg-[var(--infra-tile-2)] text-[16px] font-bold disabled:opacity-35"
                          >
                            +
                          </button>
                        </div>
                        <button
                          type="button"
                          onClick={() =>
                            router.push(
                              `/deals?deal=${encodeURIComponent(d.dealId)}&qty=${sq}`,
                            )
                          }
                          className="rounded-[var(--r-pill)] bg-[var(--infra-ink)] px-4 py-2.5 text-[13px] font-semibold text-[var(--infra-black)] active:scale-[0.98]"
                        >
                          Reserve →
                        </button>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        <h2 className="mb-2 text-[15px] font-semibold text-[var(--infra-ink)]">Full menu</h2>
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
                      className="flex h-10 w-10 items-center justify-center rounded-full border border-[var(--infra-ink-4)] bg-[var(--infra-tile-2)] font-bold text-[var(--infra-ink)] active:scale-95"
                    >
                      −
                    </button>
                    <span className="w-6 text-center font-bold text-[var(--infra-ink)]">{cart[item.itemId]}</span>
                    <button
                      type="button"
                      onClick={() => updateCart(item.itemId, 1)}
                      className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--infra-ink)] font-bold text-[var(--infra-black)] active:scale-95"
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

      {cartCount > 0 && (
        <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-[var(--infra-ink-4)] bg-[rgba(0,0,0,0.92)] px-4 py-3 backdrop-blur-xl [padding-bottom:max(12px,env(safe-area-inset-bottom))]">
          <div className="mx-auto w-full max-w-[430px] space-y-3">
            {pointsBalance > 0 && (
              <label className="flex cursor-pointer items-center gap-2 text-[13px] text-[var(--infra-ink-2)]">
                <input
                  type="checkbox"
                  checked={applyFoodPoints}
                  onChange={(e) => setApplyFoodPoints(e.target.checked)}
                  className="rounded border-[var(--infra-ink-4)]"
                />
                Apply food points ({pointsBalance} pts · max 50% off food)
              </label>
            )}
            <p className="text-center text-[12px] text-[var(--infra-ink-3)]">
              Subtotal ${cartSubtotal.toFixed(2)} · est. with service fee ${estimatedPayTotal.toFixed(2)}
              {applyFoodPoints && pointsBalance > 0 ? " · points applied at checkout if eligible" : ""}
            </p>
            <button
              type="button"
              onClick={() => void handleOrder()}
              disabled={ordering}
              className="flex h-14 w-full items-center justify-center rounded-[var(--r-pill)] text-[17px] font-semibold text-white disabled:opacity-50 active:scale-[0.98]"
              style={{ backgroundColor: "var(--infra-accent)" }}
            >
              {ordering ? "Starting checkout…" : `Pay · ~$${estimatedPayTotal.toFixed(2)}`}
            </button>
          </div>
        </div>
      )}
    </MobileAppFrame>
  );
}
