"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getCustomerOrders, getRecommendations } from "@/app/services/api";
import { Order, Vendor } from "@/app/shared/types";
import { MobileAppFrame, MobileNav } from "@/app/components/MobileLayout";

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [recommendations, setRecommendations] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    async function loadOrders() {
      const phone = localStorage.getItem("infrastreet_phone");
      if (!phone) return;
      setLoading(true);
      try {
        const [o, r] = await Promise.all([getCustomerOrders(phone), getRecommendations(phone)]);
        setOrders(o);
        setRecommendations(r);
      } finally {
        setLoading(false);
      }
    }
    void loadOrders();
  }, []);

  function formatDate(d: string) {
    return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
  }

  function statusStyle(s: string) {
    if (s === "ready") return "border-[var(--infra-green)]/40 bg-[var(--infra-green)]/15 text-[var(--infra-green)]";
    if (s === "preparing") return "border-[var(--infra-blue)]/40 bg-[var(--infra-blue)]/15 text-[var(--infra-blue)]";
    return "border-[var(--infra-amber)]/45 bg-[var(--infra-amber)]/12 text-[var(--infra-amber)]";
  }

  return (
    <MobileAppFrame>
      <MobileNav
        title="Orders"
        backHref="/search"
        right={
          <Link href="/deals" className="text-[14px] font-medium text-[var(--infra-accent)]">
            Deals
          </Link>
        }
      />

      <div className="space-y-8 px-5 py-6">
        {loading && (
          <div className="flex justify-center py-24">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--infra-ink-4)] border-t-[var(--infra-accent)]" />
          </div>
        )}

        {!loading && orders.length === 0 && (
          <div className="py-16 text-center">
            <div className="mb-6 text-5xl" aria-hidden>
              🥡
            </div>
            <h2 className="text-[22px] font-semibold tracking-tight text-[var(--infra-ink)]">No orders yet</h2>
            <p className="mx-auto mt-2 max-w-xs text-[17px] leading-snug text-[var(--infra-ink-2)]">
              Reserve a flash deal or browse vendors near you.
            </p>
            <div className="mx-auto mt-10 flex max-w-xs flex-col gap-3">
              <Link
                href="/deals"
                className="flex h-14 items-center justify-center rounded-[var(--r-pill)] text-[17px] font-semibold text-white active:scale-[0.98]"
                style={{ backgroundColor: "var(--infra-accent)" }}
              >
                Flash deals
              </Link>
              <Link
                href="/search"
                className="flex h-14 items-center justify-center rounded-[var(--r-pill)] border border-[var(--infra-ink-4)] bg-[var(--infra-tile-2)] text-[17px] font-semibold text-[var(--infra-ink)] active:scale-[0.98]"
              >
                Find vendors
              </Link>
            </div>
          </div>
        )}

        {!loading && orders.length > 0 && (
          <>
            <div className="space-y-3">
              {orders.map((order, index) => (
                <div
                  key={order.orderId}
                  className="animate-in fade-in slide-in-from-bottom-2 duration-300 rounded-[var(--r-xl)] border border-[var(--infra-ink-4)] bg-[var(--infra-tile-1)] p-5"
                  style={{ animationDelay: `${index * 40}ms` }}
                >
                  <div className="mb-4 flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-[17px] font-semibold text-[var(--infra-ink)]">{order.vendorName || "Vendor"}</p>
                      {order.createdAt && (
                        <p className="mt-1 text-[12px] text-[var(--infra-ink-3)]">{formatDate(order.createdAt)}</p>
                      )}
                    </div>
                    <span className={`shrink-0 rounded-[var(--r-pill)] border px-3 py-1 text-[11px] font-semibold capitalize ${statusStyle(order.status)}`}>
                      {order.status}
                    </span>
                  </div>

                  <div className="mb-4 space-y-1">
                    {order.items.map((item, i) => (
                      <p key={i} className="text-[14px] text-[var(--infra-ink-2)]">
                        {item.quantity}× {item.name}
                      </p>
                    ))}
                  </div>

                  <div className="flex items-center justify-between border-t border-[var(--infra-ink-4)] pt-4">
                    <span className="text-[17px] font-bold text-[var(--infra-ink)]">${order.total?.toFixed(2)}</span>
                    {order.pickupCode && order.status !== "completed" && (
                      <span className="rounded-[var(--r-lg)] bg-[var(--infra-ink)] px-4 py-2 font-mono text-[18px] font-black text-[var(--infra-black)]">
                        #{order.pickupCode}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {recommendations.length > 0 && (
              <div className="pt-4">
                <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--infra-ink-3)]">
                  Recommended
                </h2>
                <div className="space-y-2">
                  {recommendations.slice(0, 5).map((v) => (
                    <Link
                      key={v.vendorId}
                      href={`/vendor/${v.vendorId}`}
                      className="block rounded-[var(--r-lg)] border border-[var(--infra-ink-4)] bg-[var(--infra-tile-1)] p-4 active:bg-[var(--infra-tile-2)]"
                    >
                      <div className="flex items-center justify-between">
                        <p className="font-semibold text-[var(--infra-ink)]">{v.name}</p>
                        <span className="text-[var(--infra-ink-3)]">→</span>
                      </div>
                      {v.matchingItems && v.matchingItems.length > 0 && (
                        <div className="mt-3 flex flex-wrap gap-2">
                          {v.matchingItems.slice(0, 2).map((item, i) => (
                            <span
                              key={i}
                              className="rounded-[var(--r-pill)] border border-[var(--infra-green)]/25 bg-[var(--infra-green)]/10 px-2 py-1 text-[11px] text-[var(--infra-green)]"
                            >
                              {item.name}
                            </span>
                          ))}
                        </div>
                      )}
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </MobileAppFrame>
  );
}
