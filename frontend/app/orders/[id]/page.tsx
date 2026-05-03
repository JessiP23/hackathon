"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import QRCode from "qrcode";
import { getOrder, getOrderReceipt, updateOrderStatus } from "@/app/services/api";
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
  if (s === "preparing" || s === "pending") return "pending";
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
  const [busy, setBusy] = useState(false);
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
    if (!order) return;
    const text = `#IS-${order.pickupCode ?? order.orderId.slice(0, 6)} · ${order.items.map((i) => i.name).join(", ")}`;
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

  async function confirmPickup() {
    if (!order) return;
    setBusy(true);
    try {
      await updateOrderStatus(order.orderId, "completed");
      setOrder({ ...order, status: "completed" });
    } catch {
      alert("Could not update order.");
    } finally {
      setBusy(false);
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
  const subtotal =
    order.items.reduce((s, i) => s + (i.price ?? 0) * i.quantity, 0) ||
    Math.round(((order.total ?? 0) / 1.13) * 100) / 100;
  const platformFee =
    order.serviceFee ?? Math.round(Math.max(0, (order.total ?? 0) - subtotal) * 100) / 100;
  const tax = Math.max(0, (order.total ?? subtotal + platformFee) - subtotal - platformFee);
  const total = order.total ?? subtotal + platformFee + tax;

  return (
    <MobileAppFrame>
      <MobileNav title="Order detail" backHref="/orders" />

      <main className="page-enter px-5 py-6">
        <div className="mb-4 flex justify-center">
          <StatusPill kind={kind}>{order.status}</StatusPill>
        </div>

        {order.status?.toLowerCase() === "ready" && (
          <AccentCard className="mb-6 flex gap-3">
            <div
              className="flex size-8 shrink-0 items-center justify-center rounded-full"
              style={{ background: "var(--is-green-tint)" }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
                <path
                  d="M12 21s7-4.5 7-10a7 7 0 10-14 0c0 5.5 7 10 7 10z"
                  stroke="var(--is-green)"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <circle cx="12" cy="11" r="2" fill="var(--is-green)" />
              </svg>
            </div>
            <div>
              <p className="text-[13px] font-medium text-[var(--is-green)]">Ready now</p>
              <p className="text-[15px] text-[var(--is-text-1)]">{order.vendorName ?? "Vendor"}</p>
            </div>
          </AccentCard>
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
            #IS-{order.pickupCode ?? order.orderId.slice(0, 6)} ·{" "}
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
            <span>Platform fee</span>
            <span className="[font-variant-numeric:tabular-nums]">${platformFee.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-[var(--is-text-2)]">
            <span>Tax</span>
            <span className="[font-variant-numeric:tabular-nums]">${tax.toFixed(2)}</span>
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
          {order.status?.toLowerCase() === "ready" ? (
            <PillButton variant="success" disabled={busy} onClick={() => void confirmPickup()}>
              {busy ? "Confirming…" : "Confirm pickup"}
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
