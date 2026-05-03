"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import QRCode from "qrcode";
import { getOrder } from "@/app/services/api";
import type { Order } from "@/app/shared/types";
import { MobileAppFrame, MobileNav } from "@/app/components/MobileLayout";
import { StatusPill } from "@/app/components/Precision";

export default function OrderQrPage() {
  const params = useParams();
  const id = params.id as string;
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [dataUrl, setDataUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const o = await getOrder(id);
        if (!cancelled) setOrder(o);
      } catch {
        if (!cancelled) setOrder(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  const code = order?.pickupQrCode || order?.pickupCode || "";
  const label = code || "—";

  useEffect(() => {
    if (!code) return;
    let cancelled = false;
    QRCode.toDataURL(code, { width: 200, margin: 1, color: { dark: "#000000", light: "#ffffff" } })
      .then((u) => {
        if (!cancelled) setDataUrl(u);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [code]);

  if (loading) {
    return (
      <MobileAppFrame>
        <MobileNav title="Pickup code" backHref={`/orders/${id}`} />
        <div className="px-5 py-16">
          <div className="skeleton mx-auto h-56 w-56 rounded-[16px]" />
        </div>
      </MobileAppFrame>
    );
  }

  if (!order) {
    return (
      <MobileAppFrame>
        <MobileNav title="Pickup code" backHref="/orders" />
        <div className="px-5 py-12 text-center text-[15px] text-[var(--is-text-2)]">Order not found.</div>
      </MobileAppFrame>
    );
  }

  const itemLine =
    order.items.map((i) => `${i.name} ×${i.quantity}`).join(" · ") || "Order";

  return (
    <MobileAppFrame>
      <MobileNav title="Pickup code" backHref={`/orders/${id}`} />
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          minHeight: "calc(100dvh - 48px)",
          padding: "24px",
          background: "var(--is-bg)",
        }}
      >
        <div className="mb-6">
          <StatusPill kind={order.status?.toLowerCase() === "ready" ? "ready" : "pending"}>
            {order.status?.toLowerCase() === "ready" ? "Ready for pickup" : order.status}
          </StatusPill>
        </div>

        <div
          style={{
            background: "#ffffff",
            padding: "20px",
            borderRadius: "16px",
            marginBottom: "20px",
          }}
        >
          {dataUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={dataUrl} alt="Pickup QR code" width={200} height={200} />
          ) : (
            <div className="size-[200px] animate-pulse rounded bg-neutral-200" />
          )}
        </div>

        <div
          style={{
            fontFamily: "var(--is-mono)",
            fontSize: "22px",
            fontWeight: 700,
            color: "var(--is-text-1)",
            letterSpacing: "0.08em",
            marginBottom: "8px",
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {label}
        </div>

        <div style={{ fontSize: "15px", color: "var(--is-text-2)", marginBottom: "4px" }}>
          {order.vendorName ?? "Vendor"}
        </div>
        <div style={{ fontSize: "13px", color: "var(--is-text-3)" }}>{itemLine}</div>

        <p
          style={{
            marginTop: "32px",
            fontSize: "12px",
            color: "var(--is-text-4)",
            textAlign: "center",
          }}
        >
          Turn up screen brightness for scanning
        </p>

        <Link href={`/orders/${id}`} className="mt-8 text-[13px] font-medium text-[var(--is-blue)]">
          Order details
        </Link>
      </div>
    </MobileAppFrame>
  );
}
