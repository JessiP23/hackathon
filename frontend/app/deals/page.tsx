"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { getCurrentLocation } from "@/app/services/location";
import { getDealsNearby, placeDealOrder, notifyOptIn } from "@/app/services/api";
import { Deal, Location } from "@/app/shared/types";
import DealTile from "@/app/components/DealTile";
import { MobileAppFrame } from "@/app/components/MobileLayout";

export default function DealsPage() {
  const router = useRouter();
  const [location, setLocation] = useState<Location | null>(null);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(true);
  const [ordering, setOrdering] = useState<string | null>(null);
  const [focusDealId, setFocusDealId] = useState<string | null>(null);
  const [stackIndex, setStackIndex] = useState(0);
  const [notifyBusy, setNotifyBusy] = useState(false);
  const [notifyMsg, setNotifyMsg] = useState<string | null>(null);

  useEffect(() => {
    const q =
      typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("deal") : null;
    setFocusDealId(q);
  }, []);

  useEffect(() => {
    getCurrentLocation()
      .then(async (loc) => {
        setLocation(loc);
        const data = await getDealsNearby(loc.lat, loc.lng);
        setDeals(data);
      })
      .catch(async () => {
        const data = await getDealsNearby(40.7128, -74.006);
        setDeals(data);
      })
      .finally(() => setLoading(false));
  }, []);

  const handleReserve = useCallback(
    async (deal: Deal) => {
      const phone = localStorage.getItem("infrastreet_phone");
      if (!phone) {
        router.push("/customer-onboarding");
        return;
      }
      setOrdering(deal.dealId);
      try {
        const order = await placeDealOrder(deal.dealId, { customerPhone: phone, quantity: 1 });
        if (order.checkoutUrl) {
          window.location.href = order.checkoutUrl;
        } else {
          router.push(`/orders/${order.orderId}/confirmed`);
        }
      } catch (e) {
        console.error(e);
        alert("Could not place order. Please try again.");
      } finally {
        setOrdering(null);
      }
    },
    [router],
  );

  function getTimeLeft(expiresAt: string) {
    const diff = new Date(expiresAt).getTime() - Date.now();
    if (diff <= 0) return null;
    const hours = Math.floor(diff / 3600000);
    const mins = Math.floor((diff % 3600000) / 60000);
    if (hours > 0) return `${hours}h ${mins}m`;
    return `${mins}m`;
  }

  const activeDeals = deals.filter((d) => d.expiresAt && getTimeLeft(d.expiresAt));

  const sortedDeals = useMemo(() => {
    if (!focusDealId) return activeDeals;
    const ix = activeDeals.findIndex((d) => d.dealId === focusDealId);
    if (ix <= 0) return activeDeals;
    const copy = [...activeDeals];
    const [h] = copy.splice(ix, 1);
    return [h, ...copy];
  }, [activeDeals, focusDealId]);

  useEffect(() => {
    setStackIndex(0);
  }, [sortedDeals.length]);

  const onSwipeNext = useCallback(() => {
    setStackIndex((i) => Math.min(i + 1, Math.max(0, sortedDeals.length - 1)));
    try {
      if (sortedDeals.length) navigator.vibrate?.([10, 30, 10]);
    } catch {
      /* ignore */
    }
  }, [sortedDeals.length]);

  const onNotifyMe = async () => {
    setNotifyMsg(null);
    let loc = location;
    try {
      if (!loc) loc = await getCurrentLocation();
    } catch {
      setNotifyMsg("Turn on location to get neighborhood alerts.");
      return;
    }
    let phone = localStorage.getItem("infrastreet_phone") || "";
    if (!phone && typeof window !== "undefined") {
      phone = window.prompt("Your mobile number (include country code, e.g. +15551234567)") || "";
    }
    if (!phone.trim()) {
      setNotifyMsg("Phone required.");
      return;
    }
    setNotifyBusy(true);
    try {
      const res = await notifyOptIn({
        lat: loc.lat,
        lng: loc.lng,
        radius: 10,
        phone: phone.trim(),
      });
      if (res.success) {
        localStorage.setItem("infrastreet_phone", phone.trim());
        setNotifyMsg(res.otpSent ? "Check your phone for a confirmation code." : "You're on the list.");
      } else {
        setNotifyMsg("Could not save. Try again.");
      }
    } catch {
      setNotifyMsg("Network error. Try again.");
    } finally {
      setNotifyBusy(false);
    }
  };

  const stackSlice = sortedDeals.slice(stackIndex, stackIndex + 3);

  return (
    <MobileAppFrame>
      <main className="relative flex min-h-[100dvh] flex-col overflow-hidden bg-[var(--infra-black)] text-[var(--infra-ink)]">
        <header className="pointer-events-none absolute left-0 right-0 top-0 z-40 flex items-center justify-between px-5 py-4 [padding-top:max(12px,env(safe-area-inset-top))]">
          <Link href="/search" className="pointer-events-auto text-[14px] font-medium text-[var(--infra-ink-2)] active:text-[var(--infra-ink)]">
            ← Search
          </Link>
          <span className="pointer-events-none text-center text-[14px] font-semibold tracking-tight text-[var(--infra-ink)]">
            Deals
          </span>
          <Link href="/orders" className="pointer-events-auto text-[14px] font-medium text-[var(--infra-blue)]">
            Orders
          </Link>
        </header>

      {loading && (
        <div className="flex flex-1 items-center justify-center">
          <div
            className="aspect-[3/4] w-[min(100vw,420px)] animate-pulse rounded-2xl bg-[var(--infra-tile-1)]"
            aria-hidden
          />
        </div>
      )}

      {!loading && sortedDeals.length === 0 && (
        <div className="relative flex flex-1 flex-col items-center justify-center overflow-hidden px-6 text-center">
          <div className="absolute inset-0 bg-[var(--infra-black)]" />
          <div className="absolute inset-0 bg-gradient-to-b from-[var(--infra-tile-1)]/80 via-transparent to-[var(--infra-black)]" />

          <div className="relative z-10 max-w-md">
            <h1
              className="mb-3 font-semibold tracking-tight text-[var(--infra-ink)]"
              style={{ fontSize: "clamp(28px, 7vw, 34px)", letterSpacing: "-0.4px" }}
            >
              The street is quiet... for now.
            </h1>
            <p className="mb-8 text-[17px] leading-snug text-[var(--infra-ink-2)]">
              We&apos;ll text you when deals heat up nearby.
            </p>
            <button
              type="button"
              disabled={notifyBusy}
              onClick={onNotifyMe}
              className="mx-auto flex h-14 w-full max-w-xs items-center justify-center rounded-[var(--r-pill)] border border-[var(--infra-ink-4)] bg-[var(--infra-tile-2)] text-[17px] font-semibold text-[var(--infra-ink)] disabled:opacity-50 active:scale-[0.98]"
            >
              {notifyBusy ? "Saving…" : "Notify me"}
            </button>
            {notifyMsg && <p className="mt-4 text-[14px] text-[var(--infra-ink-2)]">{notifyMsg}</p>}
          </div>
        </div>
      )}

      {!loading && sortedDeals.length > 0 && (
        <div className="relative h-[100dvh] flex-1">
          {ordering && (
            <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/40">
              <span className="text-[14px] font-medium text-[var(--infra-ink)]">Redirecting to checkout…</span>
            </div>
          )}
          {stackSlice.map((deal, i) => (
            <DealTile
              key={`${deal.dealId}-${stackIndex + i}`}
              deal={deal}
              stackIndex={i}
              isTop={i === 0}
              onReserve={handleReserve}
              onSwipeNext={onSwipeNext}
            />
          ))}
          <p className="pointer-events-none absolute bottom-8 left-0 right-0 z-40 text-center text-[11px] text-[var(--infra-ink-3)] [padding-bottom:env(safe-area-inset-bottom)]">
            Swipe up for next deal
          </p>
        </div>
      )}
    </main>
    </MobileAppFrame>
  );
}
