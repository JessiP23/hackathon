"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { getCustomerOrders, getRecommendations } from "@/app/services/api";
import { Order, Vendor } from "@/app/shared/types";
import { MobileAppFrame, MobileNav } from "@/app/components/MobileLayout";
import { MetricCard, PillLink, type StatusKind } from "@/app/components/Precision";

function orderStatusKind(status: string): StatusKind {
  const s = status.toLowerCase();
  if (s === "ready") return "ready";
  if (s === "preparing" || s === "pending" || s === "paid") return "pending";
  if (s === "completed" || s === "picked_up") return "picked_up";
  return "confirmed";
}

function statusDotClass(kind: StatusKind): string {
  switch (kind) {
    case "ready":
      return "bg-[var(--is-green)]";
    case "pending":
      return "bg-[var(--is-amber)]";
    case "flash":
      return "bg-[var(--is-red)]";
    case "confirmed":
      return "bg-[var(--is-purple)]";
    default:
      return "bg-[var(--is-text-4)]";
  }
}

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

  const { active, past, weekSpend, readyCount } = useMemo(() => {
    const now = Date.now();
    const weekAgo = now - 7 * 24 * 3600000;
    let spend = 0;
    let ready = 0;
    const act: Order[] = [];
    const done: Order[] = [];
    for (const o of orders) {
      const created = o.createdAt ? new Date(o.createdAt).getTime() : 0;
      if (created >= weekAgo && o.total) spend += o.total;
      if (o.status?.toLowerCase() === "ready") ready += 1;
      if (["completed", "picked_up", "cancelled"].includes(o.status?.toLowerCase() ?? "")) {
        done.push(o);
      } else {
        act.push(o);
      }
    }
    return { active: act, past: done, weekSpend: spend, readyCount: ready };
  }, [orders]);

  return (
    <MobileAppFrame>
      <MobileNav
        title="Orders"
        backHref="/search"
        right={
          <Link href="/deals" className="text-[12px] font-medium text-[var(--is-purple)]">
            Deals
          </Link>
        }
      />

      <main className="page-enter px-4 py-6">
        {loading && (
          <div className="space-y-3">
            <div className="skeleton h-24 w-full rounded-[10px]" />
            <div className="skeleton h-20 w-full rounded-[12px]" />
            <div className="skeleton h-20 w-full rounded-[12px]" />
          </div>
        )}

        {!loading && orders.length === 0 && (
          <div className="py-16 text-center">
            <h2 className="text-[22px] font-bold tracking-[-0.03em] text-[var(--is-text-1)]">No orders yet</h2>
            <p className="mx-auto mt-2 max-w-xs text-[15px] text-[var(--is-text-2)]">
              Reserve a flash deal or browse stalls on the map.
            </p>
            <div className="mx-auto mt-10 flex max-w-xs flex-col gap-3">
              <PillLink href="/deals" variant="danger">
                Flash deals
              </PillLink>
              <PillLink href="/search" variant="ghost">
                Explore map
              </PillLink>
            </div>
          </div>
        )}

        {!loading && orders.length > 0 && (
          <>
            <div className="mb-8 grid grid-cols-2 gap-3">
              <MetricCard
                label="This week"
                value={`$${weekSpend.toFixed(2)}`}
                valueClassName="[font-variant-numeric:tabular-nums]"
              />
              <MetricCard
                label="Ready now"
                value={String(readyCount)}
                valueClassName="text-[var(--is-green)] [font-variant-numeric:tabular-nums]"
              />
            </div>

            {active.length > 0 && (
              <section className="mb-6">
                <p className="mb-2 text-[11px] font-semibold tracking-[0.08em] text-[var(--is-text-4)] uppercase">
                  Active orders
                </p>
                <div className="item-stagger divide-y divide-[var(--is-border-2)] border-t-[0.5px] border-[var(--is-border-2)]">
                  {active.map((order) => (
                    <OrderRow key={order.orderId} order={order} />
                  ))}
                </div>
              </section>
            )}

            {past.length > 0 && (
              <section>
                <p className="mb-2 text-[11px] font-semibold tracking-[0.08em] text-[var(--is-text-4)] uppercase">
                  Past orders
                </p>
                <div className="item-stagger divide-y divide-[var(--is-border-2)] opacity-50 border-t-[0.5px] border-[var(--is-border-2)]">
                  {past.map((order) => (
                    <OrderRow key={order.orderId} order={order} />
                  ))}
                </div>
              </section>
            )}

            {recommendations.length > 0 && (
              <div className="mt-10">
                <p className="mb-3 text-[11px] font-semibold tracking-[0.08em] text-[var(--is-text-4)] uppercase">
                  Recommended
                </p>
                <div className="space-y-2">
                  {recommendations.slice(0, 5).map((v) => (
                    <Link
                      key={v.vendorId}
                      href={`/vendor/${v.vendorId}`}
                      className="block rounded-[12px] border-[0.5px] border-[var(--is-border-1)] bg-[var(--is-surface)] p-4 active:opacity-90"
                    >
                      <div className="flex items-center justify-between">
                        <p className="font-semibold text-[var(--is-text-1)]">{v.name}</p>
                        <span className="text-[var(--is-text-4)]">→</span>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </main>
    </MobileAppFrame>
  );
}

function OrderRow({ order }: { order: Order }) {
  const kind = orderStatusKind(order.status);
  const dot = statusDotClass(kind);
  const itemCount = order.items.reduce((n, i) => n + i.quantity, 0);
  return (
    <Link
      href={`/orders/${order.orderId}`}
      className="flex items-center gap-3 py-3 pr-1 active:opacity-90"
    >
      <span className={`size-2 shrink-0 rounded-full ${dot}`} aria-hidden />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <p className="truncate text-[13px] font-medium text-[var(--is-text-1)]">{order.vendorName || "Vendor"}</p>
          <p className="shrink-0 text-[13px] font-semibold text-[var(--is-text-2)] [font-variant-numeric:tabular-nums]">
            ${order.total?.toFixed(2)}
          </p>
        </div>
        <div className="mt-1 flex items-center justify-between gap-2">
          <p className="truncate text-[11px] text-[var(--is-text-4)]">
            Items · {itemCount} ·{" "}
            <span className="font-[family-name:var(--is-mono)]">#{order.orderId.slice(0, 8)}</span>
          </p>
          <span
            className={`shrink-0 text-[10px] font-semibold uppercase tracking-wide ${
              kind === "ready"
                ? "text-[var(--is-green)]"
                : kind === "pending"
                  ? "text-[var(--is-amber)]"
                  : "text-[var(--is-text-4)]"
            }`}
          >
            {order.status}
          </span>
        </div>
      </div>
    </Link>
  );
}
