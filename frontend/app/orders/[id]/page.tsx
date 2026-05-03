"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import QRCode from "qrcode";
import { getOrder, getOrderReceipt, ackDealPaymentAuthorized } from "@/app/services/api";
import { Order } from "@/app/shared/types";
import { MobileAppFrame, MobileNav } from "@/app/components/MobileLayout";
import {
  StatusPill,
  AccentCard,
  DataCard,
  SectionLabel,
  DividerLine,
  PillButton,
  type StatusKind,
} from "@/app/components/Precision";

function orderStatusKind(status: string): StatusKind {
  const s = status.toLowerCase();
  if (s === "ready") return "ready";
  if (s === "fulfilled" || s === "no_show") return "picked_up";
  if (s === "preparing" || s === "pending" || s === "paid" || s === "confirmed") return "pending";
  if (s === "completed") return "picked_up";
  return "confirmed";
}

function canShowReceipt(status: string | undefined): boolean {
  const s = (status ?? "").toLowerCase();
  return !["pending_payment", "payment_failed", "expired", "reserved_unpaid"].includes(s);
}

export default function OrderDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const [order, setOrder] = useState<Order | null>(null);
  const [status, setStatus] = useState<"loading" | "ok" | "err">("loading");
  const [qrUrl, setQrUrl] = useState<string | null>(null);
  const [receiptBusy, setReceiptBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setStatus("loading");
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

  useEffect(() => {
    if (!order || order.status !== "pending_payment" || !order.stripePaymentIntent || !order.dealId) {
      return;
    }
    let cancelled = false;
    void ackDealPaymentAuthorized(order.orderId).then((r) => {
      if (cancelled || !r.updated) return;
      void getOrder(id).then((o) => {
        if (!cancelled) setOrder(o);
      });
    });
    return () => {
      cancelled = true;
    };
  }, [id, order?.orderId, order?.status, order?.stripePaymentIntent, order?.dealId]);

  useEffect(() => {
    if (!order) return;
    const text = `${order.pickupQrCode ?? order.pickupCode ?? `#${order.orderId.slice(0, 8)}`} · ${order.items.map((i) => i.name).join(", ")}`;
    let cancelled = false;
    QRCode.toDataURL(text.slice(0, 200), {
      width: 80,
      margin: 1,
      color: { dark: "#000000", light: "#ffffff" },
    })
      .then((u) => {
        if (!cancelled) setQrUrl(u);
      })
      .catch(() => {
        /* ignore */
      });
    return () => {
      cancelled = true;
    };
  }, [order]);

  async function viewReceipt() {
    if (!order) return;
    if (!canShowReceipt(order.status)) {
      alert("Receipt is available after payment completes.");
      return;
    }
    setReceiptBusy(true);
    try {
      const { receiptUrl } = await getOrderReceipt(order.orderId);
      if (receiptUrl) {
        window.open(receiptUrl, "_blank", "noopener,noreferrer");
      } else {
        router.push(`/orders/${order.orderId}/receipt`);
      }
    } catch {
      router.push(`/orders/${order.orderId}/receipt`);
    } finally {
      setReceiptBusy(false);
    }
  }

  if (status === "loading") {
    return (
      <MobileAppFrame>
        <MobileNav title="Order" backHref="/orders" />
        <main className="page-enter px-5 py-8">
          <div className="skeleton mb-4 h-8 w-full rounded-[12px]" />
          <div className="skeleton mb-4 h-40 w-full rounded-[16px]" />
          <div className="skeleton h-24 w-full rounded-[16px]" />
        </main>
      </MobileAppFrame>
    );
  }

  if (status === "err" || !order) {
    return (
      <MobileAppFrame>
        <MobileNav title="Order" backHref="/orders" />
        <main className="page-enter px-5 py-10">
          <AccentCard urgency>
            <p className="text-[11px] font-semibold tracking-[0.08em] text-[var(--is-text-4)] uppercase">
              Something went wrong
            </p>
            <p className="mt-2 text-[15px] text-[var(--is-text-2)]">We couldn&apos;t load this order.</p>
            <Link
              href="/orders"
              className="mt-4 inline-flex min-h-[48px] items-center justify-center rounded-[12px] border-[0.5px] border-[var(--is-border-1)] bg-[var(--is-card)] px-4 text-[15px] text-[var(--is-text-2)]"
            >
              Back to orders
            </Link>
          </AccentCard>
        </main>
      </MobileAppFrame>
    );
  }

  const kind = orderStatusKind(order.status);
  const rawItemSum = order.items.reduce((s, i) => s + (i.price ?? 0) * i.quantity, 0);
  const subtotal =
    rawItemSum > 0
      ? Math.round(rawItemSum * 100) / 100
      : Math.round((order.total ?? 0) * 100) / 100;
  const platformFee =
    order.serviceFee != null && order.serviceFee !== undefined
      ? order.serviceFee
      : rawItemSum > 0
        ? Math.round(Math.max(0, (order.total ?? 0) - subtotal) * 100) / 100
        : 0;
  const rewardsOff =
    Math.round(Math.max(0, subtotal + platformFee - (order.total ?? 0)) * 100) / 100;
  const total = order.total ?? Math.max(0, subtotal + platformFee - rewardsOff);

  return (
    <MobileAppFrame>
      <MobileNav title="Order detail" backHref="/orders" />

      <main className="page-enter px-5 py-6">
        <div className="mb-4 flex justify-center">
          <StatusPill kind={kind}>{order.status}</StatusPill>
        </div>

        {(order.status?.toLowerCase() === "pending" ||
          order.status?.toLowerCase() === "confirmed" ||
          order.status?.toLowerCase() === "paid") && (
          <div
            style={{
              background: "var(--is-card-raised)",
              border: "0.5px solid var(--is-border-1)",
              borderLeft: "2px solid var(--is-amber)",
              borderRadius: "0 10px 10px 0",
              padding: "10px 14px",
              marginBottom: "14px",
              fontSize: "12px",
              color: "var(--is-text-3)",
            }}
          >
            <span style={{ color: "var(--is-amber)", fontWeight: 600 }}>Awaiting vendor · </span>
            Card on hold. You&apos;ll be charged when the vendor confirms your order is ready.
          </div>
        )}

        {order.status?.toLowerCase() === "ready" && (
          <div
            style={{
              background: "var(--is-card-raised)",
              border: "0.5px solid var(--is-green-border)",
              borderLeft: "2px solid var(--is-green)",
              borderRadius: "0 10px 10px 0",
              padding: "10px 14px",
              marginBottom: "14px",
              fontSize: "12px",
              color: "var(--is-text-3)",
            }}
          >
            <span style={{ color: "var(--is-green)", fontWeight: 600 }}>Ready · </span>
            Card charged. Show QR code to vendor to collect your order.
          </div>
        )}

        <DataCard className="mb-8">
          <SectionLabel>Show to vendor</SectionLabel>
          <div className="flex justify-center py-3">
            {qrUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={qrUrl} alt="Order QR code" className="rounded-[8px] bg-white p-[10px]" width={100} height={100} />
            ) : (
              <div className="skeleton size-[100px] rounded-[8px]" />
            )}
          </div>
          <p className="text-center font-[family-name:var(--is-mono)] text-[12px] text-[var(--is-text-4)]">
            {order.pickupQrCode ?? order.pickupCode ?? order.orderId.slice(0, 8)} ·{" "}
            {order.items.map((i) => `${i.name} ×${i.quantity}`).join(" · ")}
          </p>
        </DataCard>

        <SectionLabel>Items</SectionLabel>
        <ul className="mb-6 space-y-2">
          {order.items.map((item, i) => (
            <li key={i} className="flex items-baseline justify-between gap-3 text-[13px]">
              <span className="text-[var(--is-text-3)] [font-variant-numeric:tabular-nums]">{item.quantity}×</span>
              <span className="min-w-0 flex-1 text-[var(--is-text-2)]">{item.name}</span>
              <span className="shrink-0 font-medium text-[var(--is-text-1)] [font-variant-numeric:tabular-nums]">
                ${((item.price ?? 0) * item.quantity).toFixed(2)}
              </span>
            </li>
          ))}
        </ul>

        <div className="mb-2 space-y-2 text-[13px]">
          <div className="flex justify-between text-[var(--is-text-2)]">
            <span>Subtotal</span>
            <span className="[font-variant-numeric:tabular-nums]">${subtotal.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-[var(--is-text-2)]">
            <span>Platform fee (15%)</span>
            <span className="[font-variant-numeric:tabular-nums]">${platformFee.toFixed(2)}</span>
          </div>
          {rewardsOff > 0 ? (
            <div className="flex justify-between text-[var(--is-green)]">
              <span>Rewards</span>
              <span className="[font-variant-numeric:tabular-nums]">−${rewardsOff.toFixed(2)}</span>
            </div>
          ) : null}
          <div className="flex justify-between py-[5px]">
            <span className="text-[12px] text-[var(--is-text-3)]">Payment</span>
            <span
              className="text-[12px] font-semibold [font-variant-numeric:tabular-nums]"
              style={{ color: order.stripeCapturedAt ? "var(--is-green)" : "var(--is-amber)" }}
            >
              {order.stripeCapturedAt ? "Charged" : "On hold"}
            </span>
          </div>
        </div>
        <DividerLine />
        <div className="flex items-baseline justify-between pt-1">
          <span className="text-[13px] font-medium text-[var(--is-text-2)]">Total charged</span>
          <span className="text-[20px] font-bold tracking-[-0.03em] text-[var(--is-text-1)] [font-variant-numeric:tabular-nums]">
            ${total.toFixed(2)}
          </span>
        </div>

        <div className="mt-8 space-y-3">
          {["pending", "confirmed", "paid", "ready"].includes(order.status?.toLowerCase() ?? "") ? (
            <PillButton type="button" variant="success" onClick={() => router.push(`/orders/${order.orderId}/qr`)}>
              Show pickup code
            </PillButton>
          ) : null}
          {canShowReceipt(order.status) ? (
            <PillButton
              variant="ghost"
              type="button"
              disabled={receiptBusy}
              onClick={() => void viewReceipt()}
            >
              {receiptBusy ? "Opening…" : "View receipt"}
            </PillButton>
          ) : null}
        </div>
      </main>
    </MobileAppFrame>
  );
}
