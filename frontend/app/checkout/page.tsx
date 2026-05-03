"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { getOrder } from "@/app/services/api";
import { Order } from "@/app/shared/types";
import { MobileAppFrame, MobileNav } from "@/app/components/MobileLayout";
import { DataCard, PillButton, DividerLine, stripeElementsAppearance } from "@/app/components/Precision";

function CheckoutInner() {
  const searchParams = useSearchParams();
  const orderId = searchParams.get("orderId");
  const [order, setOrder] = useState<Order | null | undefined>(undefined);
  const [payTab, setPayTab] = useState<"card" | "apple">("card");

  useEffect(() => {
    if (!orderId) {
      setOrder(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const o = await getOrder(orderId);
        if (!cancelled) setOrder(o);
      } catch {
        if (!cancelled) setOrder(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [orderId]);

  let checkoutUrl = order?.checkoutUrl ?? "";
  if (!checkoutUrl && typeof window !== "undefined" && orderId) {
    try {
      const raw = sessionStorage.getItem("infrastreet_checkout");
      const p = raw ? (JSON.parse(raw) as { orderId?: string; url?: string }) : null;
      if (p?.orderId === orderId && p?.url) checkoutUrl = p.url;
    } catch {
      /* ignore */
    }
  }

  const total = order?.total ?? 0;
  const subtotal = order ? Math.max(0, total * (17 / 18)) : 0;
  const fees = order ? Math.max(0, total - subtotal) : 0;

  if (order === undefined) {
    return (
      <main className="page-enter px-5 py-8">
        <div className="skeleton mb-4 h-28 w-full rounded-[16px]" />
        <div className="skeleton h-14 w-full rounded-[12px]" />
      </main>
    );
  }

  if (!orderId || order === null) {
    return (
      <main className="page-enter px-5 py-10">
        <DataCard>
          <p className="text-[15px] text-[var(--is-text-2)]">Missing checkout session.</p>
        </DataCard>
      </main>
    );
  }

  return (
    <main
      className="page-enter px-5 py-6"
      data-stripe-primary={stripeElementsAppearance.variables.colorPrimary}
    >
      <DataCard className="mb-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[17px] font-bold tracking-[-0.02em] text-[var(--is-text-1)]">{order.vendorName ?? "Vendor"}</p>
            {order.dealId && <p className="mt-1 text-[12px] text-[var(--is-text-3)]">Flash deal checkout</p>}
          </div>
          <p className="text-[22px] font-bold tracking-[-0.03em] text-[var(--is-text-1)] [font-variant-numeric:tabular-nums]">
            ${total.toFixed(2)}
          </p>
        </div>
      </DataCard>

      <div className="mb-6 flex gap-2">
        <button
          type="button"
          onClick={() => setPayTab("card")}
          className={`min-h-[44px] flex-1 rounded-[20px] border-[0.5px] px-4 text-[13px] font-medium ${
            payTab === "card"
              ? "border-[var(--is-purple)] bg-[var(--is-purple-tint)] text-[var(--is-purple)]"
              : "border-[var(--is-border-1)] bg-[var(--is-surface)] text-[var(--is-text-3)]"
          }`}
        >
          Card
        </button>
        <button
          type="button"
          onClick={() => setPayTab("apple")}
          className={`min-h-[44px] flex-1 rounded-[20px] border-[0.5px] px-4 text-[13px] font-medium ${
            payTab === "apple"
              ? "border-[var(--is-purple)] bg-[var(--is-purple-tint)] text-[var(--is-purple)]"
              : "border-[var(--is-border-1)] bg-[var(--is-surface)] text-[var(--is-text-3)]"
          }`}
        >
          Apple Pay
        </button>
      </div>

      <DataCard className="mb-6 space-y-2">
        <p className="text-[11px] font-semibold tracking-[0.08em] text-[var(--is-text-4)] uppercase">
          {payTab === "apple" ? "Apple Pay" : "Card"} (Stripe)
        </p>
        <p className="text-[13px] text-[var(--is-text-2)]">
          Hosted Checkout opens next — use <code className="font-[family-name:var(--is-mono)] text-[12px]">appearance</code>{" "}
          from code when you embed Elements.
        </p>
      </DataCard>

      <div className="mb-4 space-y-2 text-[13px] text-[var(--is-text-2)]">
        <div className="flex justify-between">
          <span>Subtotal</span>
          <span className="[font-variant-numeric:tabular-nums]">${subtotal.toFixed(2)}</span>
        </div>
        <div className="flex justify-between">
          <span>Fee + tax</span>
          <span className="[font-variant-numeric:tabular-nums]">${fees.toFixed(2)}</span>
        </div>
      </div>
      <DividerLine />
      <div className="mb-8 flex justify-between pt-2">
        <span className="text-[15px] font-semibold text-[var(--is-text-1)]">Total</span>
        <span className="text-[22px] font-bold tracking-[-0.03em] text-[var(--is-text-1)] [font-variant-numeric:tabular-nums]">
          ${total.toFixed(2)}
        </span>
      </div>

      <PillButton
        type="button"
        disabled={!checkoutUrl}
        onClick={() => {
          if (checkoutUrl) window.location.href = checkoutUrl;
        }}
      >
        Pay ${total.toFixed(2)}
      </PillButton>

      <div className="mt-6 flex flex-wrap items-center justify-center gap-2 text-[11px] text-[var(--is-text-4)]">
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" aria-hidden>
          <path
            d="M7 11V8a5 5 0 0110 0v3M6 20h12v-7H6v7z"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </svg>
        <span>256-bit SSL encryption</span>
        <span
          className="rounded-[20px] border-[0.5px] border-[var(--is-border-1)] px-[10px] py-1 text-[10px]"
        >
          Stripe
        </span>
      </div>
    </main>
  );
}

export default function CheckoutPage() {
  return (
    <MobileAppFrame>
      <MobileNav title="Checkout" backHref="/deals" />
      <Suspense
        fallback={
          <div className="px-5 py-8">
            <div className="skeleton h-28 w-full rounded-[16px]" />
          </div>
        }
      >
        <CheckoutInner />
      </Suspense>
    </MobileAppFrame>
  );
}
