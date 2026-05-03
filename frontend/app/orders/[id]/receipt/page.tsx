"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { getOrder } from "@/app/services/api";
import type { Order } from "@/app/shared/types";
import { MobileAppFrame, MobileNav } from "@/app/components/MobileLayout";
import { PillButton, DataCard, SectionLabel, DividerLine } from "@/app/components/Precision";

export default function OrderReceiptPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const [order, setOrder] = useState<Order | null>(null);
  const [status, setStatus] = useState<"loading" | "ok" | "err">("loading");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const o = await getOrder(id);
        if (!cancelled) {
          setOrder(o);
          setStatus("ok");
        }
      } catch {
        if (!cancelled) setStatus("err");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (status === "loading") {
    return (
      <MobileAppFrame>
        <MobileNav title="Receipt" backHref={`/orders/${id}`} />
        <main className="page-enter px-5 py-8">
          <div className="skeleton mb-4 h-40 w-full rounded-[16px]" />
        </main>
      </MobileAppFrame>
    );
  }

  if (status === "err" || !order) {
    return (
      <MobileAppFrame>
        <MobileNav title="Receipt" backHref="/orders" />
        <main className="page-enter px-5 py-10 text-center">
          <p className="text-[15px] text-[var(--is-text-2)]">Receipt unavailable.</p>
          <Link href="/orders" className="mt-4 inline-block text-[15px] text-[var(--is-purple)]">
            Back to orders
          </Link>
        </main>
      </MobileAppFrame>
    );
  }

  const subtotal =
    order.items.reduce((s, i) => s + (i.price ?? 0) * i.quantity, 0) ||
    Math.max(0, (order.total ?? 0) - (order.serviceFee ?? 0));
  const fee = order.serviceFee ?? Math.max(0, (order.total ?? 0) - subtotal);
  const total = order.total ?? subtotal + fee;

  return (
    <MobileAppFrame>
      <MobileNav title="Receipt" backHref={`/orders/${id}`} />

      <main className="page-enter px-5 py-6 print:max-w-none print:px-8 print:py-10">
        <div className="print-hero mb-6 text-center">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--is-text-3)]">InfraStreet</p>
          <h1 className="mt-1 text-[20px] font-bold tracking-[-0.03em] text-[var(--is-text-1)]">Order receipt</h1>
          <p className="mt-2 font-[family-name:var(--is-mono)] text-[12px] text-[var(--is-text-3)]">
            {order.createdAt ? new Date(order.createdAt).toLocaleString() : ""} · #{order.pickupCode ?? order.orderId.slice(0, 8)}
          </p>
          {order.vendorName ? (
            <p className="mt-1 text-[14px] text-[var(--is-text-2)]">{order.vendorName}</p>
          ) : null}
        </div>

        <DataCard className="mb-6 print:border-[var(--is-border-1)] print:shadow-none">
          <SectionLabel>Items</SectionLabel>
          <ul className="mt-3 space-y-2">
            {order.items.map((item, i) => (
              <li key={i} className="flex justify-between gap-3 text-[13px] text-[var(--is-text-2)]">
                <span>
                  {item.quantity}× {item.name}
                </span>
                <span className="[font-variant-numeric:tabular-nums]">
                  ${((item.price ?? 0) * item.quantity).toFixed(2)}
                </span>
              </li>
            ))}
          </ul>
          <div className="my-4">
            <DividerLine />
          </div>
          <div className="space-y-2 text-[13px] text-[var(--is-text-2)]">
            <div className="flex justify-between">
              <span>Subtotal</span>
              <span className="[font-variant-numeric:tabular-nums]">${subtotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span>Platform fee</span>
              <span className="[font-variant-numeric:tabular-nums]">${fee.toFixed(2)}</span>
            </div>
          </div>
          <div className="mt-3 flex justify-between border-t border-[var(--is-border-1)] pt-3 text-[15px] font-semibold text-[var(--is-text-1)]">
            <span>Total</span>
            <span className="[font-variant-numeric:tabular-nums]">${total.toFixed(2)}</span>
          </div>
        </DataCard>

        <div className="no-print mt-8 space-y-3 print:hidden">
          <PillButton type="button" onClick={() => window.print()}>
            Print / Save PDF
          </PillButton>
          <PillButton variant="ghost" type="button" onClick={() => router.push(`/orders/${id}`)}>
            Order details
          </PillButton>
        </div>
      </main>
    </MobileAppFrame>
  );
}
