"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { getCurrentLocation } from "@/app/services/location";
import { getDealsNearby, placeDealOrder, notifyOptIn } from "@/app/services/api";
import { Deal, Location } from "@/app/shared/types";
import DealTile from "@/app/components/DealTile";

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
    <main className="min-h-[100dvh] bg-[#1D1D1F] text-white overflow-hidden flex flex-col">
      <header className="absolute top-0 left-0 right-0 z-40 px-5 py-4 flex justify-between items-center pointer-events-none">
        <Link href="/search" className="pointer-events-auto text-white/70 text-sm font-medium">
          ← Back
        </Link>
        <span className="text-sm font-semibold tracking-tight text-white/90">InfraStreet</span>
        <Link href="/orders" className="pointer-events-auto text-white/70 text-sm font-medium">
          Orders
        </Link>
      </header>

      {loading && (
        <div className="flex-1 flex items-center justify-center">
          <div
            className="w-[min(100vw,420px)] aspect-[3/4] rounded-2xl animate-pulse bg-gradient-to-br from-neutral-800 via-neutral-700 to-neutral-900"
            aria-hidden
          />
        </div>
      )}

      {!loading && sortedDeals.length === 0 && (
        <div className="relative flex-1 flex flex-col items-center justify-center text-center px-6 overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-b from-zinc-900 via-neutral-800 to-black" />
          <div className="absolute inset-0 opacity-40 animate-pulse bg-gradient-to-t from-white/5 via-transparent to-white/10" />

          <div className="relative z-10 max-w-md">
            <h1
              className="text-white font-semibold tracking-tight mb-3"
              style={{ fontSize: "clamp(28px, 7vw, 34px)", letterSpacing: "-0.4px" }}
            >
              The street is quiet... for now.
            </h1>
            <p className="text-[17px] text-white/80 mb-8 leading-snug">
              We&apos;ll text you when deals heat up nearby.
            </p>
            <button
              type="button"
              disabled={notifyBusy}
              onClick={onNotifyMe}
              className="h-14 w-full max-w-xs mx-auto rounded-full border border-white text-white font-semibold text-[17px] bg-white/20 backdrop-blur-sm disabled:opacity-50 active:scale-[0.98] transition-transform"
            >
              {notifyBusy ? "Saving…" : "Notify me"}
            </button>
            {notifyMsg && <p className="mt-4 text-sm text-white/80">{notifyMsg}</p>}
          </div>
        </div>
      )}

      {!loading && sortedDeals.length > 0 && (
        <div className="relative flex-1 h-[100dvh]">
          {ordering && (
            <div className="absolute inset-0 z-50 bg-black/30 flex items-center justify-center">
              <span className="text-sm font-medium text-white">Redirecting to checkout…</span>
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
          <p className="absolute bottom-3 left-0 right-0 text-center text-[11px] text-white/40 z-40 pointer-events-none">
            Swipe up for next deal
          </p>
        </div>
      )}
    </main>
  );
}
