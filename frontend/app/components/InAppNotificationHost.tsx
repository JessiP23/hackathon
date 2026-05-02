"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useInAppNotifications } from "@/app/stores/inAppNotifications";

const BASE = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";

export function InAppNotificationHost() {
  const pushFromEvent = useInAppNotifications((s) => s.pushFromEvent);
  const items = useInAppNotifications((s) => s.items);
  const dismiss = useInAppNotifications((s) => s.dismiss);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const phone = localStorage.getItem("infrastreet_phone");
    if (!phone || phone.replace(/\D/g, "").length < 10) return;

    const url = `${BASE}/customers/inapp/stream?phone=${encodeURIComponent(phone)}`;
    const es = new EventSource(url);

    es.onmessage = (ev) => {
      try {
        const data = JSON.parse(ev.data) as Record<string, unknown>;
        pushFromEvent(data);
      } catch {
        /* ignore malformed */
      }
    };

    return () => es.close();
  }, [pushFromEvent]);

  if (items.length === 0) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-[90] flex flex-col-reverse gap-2 p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
      {items.map((n) => (
        <div
          key={n.id}
          className="pointer-events-auto mx-auto w-full max-w-md rounded-[var(--r-lg)] border border-[var(--is-border-1)] bg-[var(--is-card)] p-3 shadow-lg"
        >
          <div className="flex justify-between gap-2">
            <p className="text-[13px] font-semibold text-[var(--is-text-1)]">{n.title}</p>
            <button
              type="button"
              className="text-xs text-[var(--is-text-3)]"
              onClick={() => dismiss(n.id)}
            >
              Dismiss
            </button>
          </div>
          <p className="mt-1 text-[13px] text-[var(--is-text-2)] line-clamp-4">{n.body}</p>
          {n.dealId ? (
            <Link
              href={`/deals?deal=${encodeURIComponent(n.dealId)}`}
              className="mt-2 inline-block text-[13px] font-medium text-[var(--is-purple)]"
            >
              View deal
            </Link>
          ) : null}
          {n.orderId ? (
            <Link
              href="/orders"
              className="mt-2 ml-3 inline-block text-[13px] font-medium text-[var(--is-purple)]"
            >
              Orders
            </Link>
          ) : null}
        </div>
      ))}
    </div>
  );
}
