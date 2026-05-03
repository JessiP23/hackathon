"use client";

import { Suspense, useEffect, useMemo, useState, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { loadStripe } from "@stripe/stripe-js";
import type { StripeElementsOptions } from "@stripe/stripe-js";
import { Elements, PaymentElement, useStripe, useElements } from "@stripe/react-stripe-js";
import { getOrder } from "@/app/services/api";
import type { Order } from "@/app/shared/types";
import { MobileAppFrame, MobileNav } from "@/app/components/MobileLayout";
import { DataCard, PillButton, DividerLine, stripeElementsAppearance } from "@/app/components/Precision";

type PaySession = {
  orderId: string;
  clientSecret: string;
  publishableKey: string;
  trustLevel?: number;
};

function readPaySession(orderId: string | null): PaySession | null {
  if (!orderId || typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem("infrastreet_pay");
    const p = raw ? (JSON.parse(raw) as PaySession) : null;
    if (p?.orderId === orderId && p.clientSecret && p.publishableKey) return p;
  } catch {
    /* ignore */
  }
  return null;
}

function PayForm({
  orderId,
  trustLevel,
  onDone,
}: {
  orderId: string;
  trustLevel: number;
  onDone: () => void;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const onSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!stripe || !elements) return;
      setBusy(true);
      setErr(null);
      const { error } = await stripe.confirmPayment({
        elements,
        confirmParams: {
          return_url: `${window.location.origin}/orders/${encodeURIComponent(orderId)}`,
        },
        redirect: "if_required",
      });
      if (error) {
        setErr(error.message || "Payment failed");
        setBusy(false);
        return;
      }
      onDone();
    },
    [stripe, elements, orderId, onDone],
  );

  const upfront = trustLevel >= 2;

  return (
    <form onSubmit={(e) => void onSubmit(e)} className="space-y-4">
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          gap: "10px",
          background: "var(--is-card-raised)",
          border: "0.5px solid var(--is-border-1)",
          borderLeft: upfront ? "2px solid var(--is-red)" : "2px solid var(--is-purple)",
          borderRadius: "0 10px 10px 0",
          padding: "12px 14px",
          marginBottom: "14px",
        }}
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 16 16"
          fill="none"
          stroke={upfront ? "var(--is-red)" : "var(--is-purple)"}
          strokeWidth="1.5"
          strokeLinecap="round"
          style={{ flexShrink: 0, marginTop: "1px" }}
        >
          <rect x="3" y="7" width="10" height="8" rx="1.5" />
          <path d="M5 7V5a3 3 0 016 0v2" />
        </svg>
        <div>
          <div
            style={{
              fontSize: "12px",
              fontWeight: 600,
              color: "var(--is-text-2)",
              marginBottom: "3px",
            }}
          >
            {upfront ? "Charged when you reserve" : "Card held, not charged yet"}
          </div>
          <div style={{ fontSize: "12px", color: "var(--is-text-3)", lineHeight: "1.5" }}>
            {upfront
              ? "Due to previous no-shows, your card is charged immediately when you complete payment."
              : "Your card is reserved now. You're only charged when the vendor marks your order ready for pickup."}
          </div>
        </div>
      </div>
      <PaymentElement />
      {err ? <p className="text-[13px] text-[var(--is-red)]">{err}</p> : null}
      <PillButton type="submit" disabled={!stripe || busy}>
        {busy ? "Processing…" : "Pay"}
      </PillButton>
    </form>
  );
}

function CheckoutInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const orderId = searchParams.get("orderId");
  const [order, setOrder] = useState<Order | null | undefined>(undefined);
  const [pay, setPay] = useState<PaySession | null | undefined>(undefined);

  useEffect(() => {
    const p = readPaySession(orderId);
    setPay(p);
  }, [orderId]);

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

  const stripePromise = useMemo(() => {
    if (!pay?.publishableKey) return null;
    return loadStripe(pay.publishableKey);
  }, [pay?.publishableKey]);

  const elementsOptions: StripeElementsOptions | null = useMemo(() => {
    if (!pay?.clientSecret) return null;
    return {
      clientSecret: pay.clientSecret,
      appearance: stripeElementsAppearance,
    };
  }, [pay?.clientSecret]);

  const onPaid = useCallback(() => {
    router.push(`/orders/${encodeURIComponent(orderId!)}`);
  }, [router, orderId]);

  const backHref =
    order && order.vendorId != null ? `/vendor/${order.vendorId}` : "/deals";

  if (order === undefined || pay === undefined) {
    return (
      <>
        <MobileNav title="Checkout" backHref="/deals" />
        <main className="page-enter px-5 py-8">
          <div className="skeleton mb-4 h-28 w-full rounded-[16px]" />
        </main>
      </>
    );
  }

  if (!orderId || order === null) {
    return (
      <>
        <MobileNav title="Checkout" backHref="/deals" />
        <main className="page-enter px-5 py-10">
          <DataCard>
            <p className="text-[15px] text-[var(--is-text-2)]">Missing checkout session.</p>
          </DataCard>
        </main>
      </>
    );
  }

  if (!pay || !stripePromise || !elementsOptions) {
    return (
      <>
        <MobileNav title="Checkout" backHref={backHref} />
        <main className="page-enter px-5 py-10">
          <DataCard>
            <p className="text-[15px] text-[var(--is-text-2)] mb-3">
              Start checkout from a deal — payment session expired or missing.
            </p>
            <PillButton type="button" onClick={() => router.push("/deals")}>
              Browse deals
            </PillButton>
          </DataCard>
        </main>
      </>
    );
  }

  const total = order.total ?? 0;
  const subtotal = order.items.reduce((s, i) => s + (i.price ?? 0) * i.quantity, 0);
  const platformFee =
    order.serviceFee != null && order.serviceFee !== undefined
      ? order.serviceFee
      : Math.round(Math.max(0, total - subtotal) * 100) / 100;

  return (
    <>
      <MobileNav title="Checkout" backHref={backHref} />
      <main
        className="page-enter px-5 py-6"
        data-stripe-primary={stripeElementsAppearance.variables.colorPrimary}
      >
        <DataCard className="mb-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[17px] font-bold tracking-[-0.02em] text-[var(--is-text-1)]">
                {order.vendorName ?? "Vendor"}
              </p>
              <p className="mt-1 text-[12px] text-[var(--is-text-3)]">Flash deal · Stripe</p>
            </div>
            <p className="text-[22px] font-bold tracking-[-0.03em] text-[var(--is-text-1)] [font-variant-numeric:tabular-nums]">
              ${total.toFixed(2)}
            </p>
          </div>
        </DataCard>

        <DataCard className="mb-6">
          <Elements stripe={stripePromise} options={elementsOptions}>
            <PayForm
              orderId={orderId}
              trustLevel={pay.trustLevel ?? 0}
              onDone={onPaid}
            />
          </Elements>
        </DataCard>

        <div className="mb-4 space-y-2 text-[13px] text-[var(--is-text-2)]">
          <div className="flex justify-between">
            <span>Food subtotal</span>
            <span className="[font-variant-numeric:tabular-nums]">${subtotal.toFixed(2)}</span>
          </div>
          <div className="flex justify-between">
            <span>Platform fee (15%)</span>
            <span className="[font-variant-numeric:tabular-nums]">${platformFee.toFixed(2)}</span>
          </div>
        </div>
        <DividerLine />
        <div className="mb-8 flex justify-between pt-2">
          <span className="text-[15px] font-semibold text-[var(--is-text-1)]">Total</span>
          <span className="text-[22px] font-bold tracking-[-0.03em] text-[var(--is-text-1)] [font-variant-numeric:tabular-nums]">
            ${total.toFixed(2)}
          </span>
        </div>
      </main>
    </>
  );
}

export default function CheckoutPage() {
  return (
    <MobileAppFrame>
      <Suspense
        fallback={
          <>
            <MobileNav title="Checkout" backHref="/deals" />
            <div className="px-5 py-8">
              <div className="skeleton h-28 w-full rounded-[16px]" />
            </div>
          </>
        }
      >
        <CheckoutInner />
      </Suspense>
    </MobileAppFrame>
  );
}
