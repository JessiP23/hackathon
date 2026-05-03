"use client";

import { useEffect, useState, useCallback, useMemo, startTransition } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { getCurrentLocation } from "@/app/services/location";
import { getDealsNearby, placeDealOrder, notifyOptIn, getUserByPhone } from "@/app/services/api";
import { Deal, Location, Vendor } from "@/app/shared/types";
import DealTile from "@/app/components/DealTile";
import { MobileAppFrame } from "@/app/components/MobileLayout";
import { isDemoBrowse } from "@/app/lib/demo";
import { DataCard, PillLink, PillButton } from "@/app/components/Precision";

const DealsStackMap = dynamic(() => import("@/app/components/OsmMapView"), {
  ssr: false,
  loading: () => <div className="size-full animate-pulse bg-[var(--is-card)]" />,
});

export default function DealsPage() {
  const router = useRouter();
  const [location, setLocation] = useState<Location | null>(null);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(true);
  const [ordering, setOrdering] = useState<string | null>(null);
  const [focusDealId, setFocusDealId] = useState<string | null>(null);
  const [dealLinkQty, setDealLinkQty] = useState(1);
  const [stackIndex, setStackIndex] = useState(0);
  const [notifyBusy, setNotifyBusy] = useState(false);
  const [notifyMsg, setNotifyMsg] = useState<string | null>(null);
  const [showDemoBanner, setShowDemoBanner] = useState(false);
  const [pointsBalance, setPointsBalance] = useState(0);
  const [applyFoodPoints, setApplyFoodPoints] = useState(true);

  useEffect(() => {
    setShowDemoBanner(isDemoBrowse() && !localStorage.getItem("infrastreet_phone"));
  }, []);

  useEffect(() => {
    const phone = localStorage.getItem("infrastreet_phone");
    if (!phone) return;
    void getUserByPhone(phone).then((u) => {
      if (u?.rewardPoints != null) setPointsBalance(u.rewardPoints);
    });
  }, []);

  useEffect(() => {
    const q =
      typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("deal") : null;
    const rawQty =
      typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("qty") : null;
    setFocusDealId(q);
    const n = rawQty ? parseInt(rawQty, 10) : 1;
    setDealLinkQty(Number.isFinite(n) && n > 0 ? Math.min(99, n) : 1);
  }, []);

  useEffect(() => {
    getCurrentLocation()
      .then(async (loc) => {
        setLocation(loc);
        const data = await getDealsNearby(loc.lat, loc.lng);
        startTransition(() => setDeals(data));
      })
      .catch(async () => {
        const data = await getDealsNearby(40.7128, -74.006);
        startTransition(() => setDeals(data));
      })
      .finally(() => setLoading(false));
  }, []);

  const FEE = 0.15;

  const handleReserve = useCallback(
    async (deal: Deal, quantity: number) => {
      const phone = localStorage.getItem("infrastreet_phone");
      if (!phone) {
        if (isDemoBrowse()) {
          alert("Demo: complete Get started to add your number, then you can reserve and pay.");
          return;
        }
        router.push("/onboard");
        return;
      }
      setOrdering(deal.dealId);
      try {
        const max =
          deal.remainingQuantity != null && deal.remainingQuantity > 0
            ? deal.remainingQuantity
            : 99;
        const qty = Math.max(1, Math.min(max, Math.floor(quantity) || 1));
        const vendorSubtotal = deal.dealPrice * qty;
        const preTotal = Math.round(vendorSubtotal * (1 + FEE) * 100) / 100;
        const maxCents = Math.floor(preTotal * 0.5 * 100);
        const redeemPoints =
          applyFoodPoints && pointsBalance > 0 ? Math.min(pointsBalance, maxCents) : 0;
        const order = await placeDealOrder(deal.dealId, {
          customerPhone: phone,
          quantity: qty,
          redeemPoints,
        });
        void getUserByPhone(phone).then((u) => {
          if (u?.rewardPoints != null) setPointsBalance(u.rewardPoints);
        });
        if (order.checkoutUrl) {
          try {
            sessionStorage.setItem(
              "infrastreet_checkout",
              JSON.stringify({ orderId: order.orderId, url: order.checkoutUrl }),
            );
          } catch {
            /* ignore */
          }
          router.push(`/checkout?orderId=${encodeURIComponent(order.orderId)}`);
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
    [router, applyFoodPoints, pointsBalance],
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

  const topDeal = stackSlice[0];
  const sharedMapOpen = Boolean(
    topDeal && !topDeal.mediaUrl && topDeal.lat != null && topDeal.lng != null,
  );

  const stackMapVendors: Vendor[] = useMemo(() => {
    if (!topDeal || topDeal.lat == null || topDeal.lng == null) return [];
    return [
      {
        vendorId: topDeal.dealId,
        name: topDeal.vendorName ?? topDeal.pickupArea ?? "Pickup",
        location: { lat: topDeal.lat, lng: topDeal.lng },
      },
    ];
  }, [topDeal]);

  function DealSkeleton({ i }: { i: number }) {
    return (
      <div
        className="absolute inset-0 flex flex-col justify-end bg-[var(--is-bg)]"
        style={{ zIndex: 20 - i, transform: `scale(${1 - i * 0.03})` }}
      >
        <div
          className="skeleton mb-auto h-[min(54dvh,480px)] w-full rounded-b-[24px]"
        />
        <div className="px-5 pb-20">
          <div className="skeleton mb-3 h-4 w-24" />
          <div className="skeleton mb-2 h-8 w-full" />
          <div className="skeleton h-4 w-2/3" />
        </div>
      </div>
    );
  }

  return (
    <MobileAppFrame>
      <main className="page-enter relative flex min-h-[100dvh] flex-col overflow-hidden bg-[var(--is-bg)] text-[var(--is-text-1)]">
        <header className="relative z-40 flex shrink-0 flex-col border-b-[0.5px] border-[var(--is-border-1)]/60 bg-[var(--is-bg)] [padding-top:max(12px,env(safe-area-inset-top))]">
          {showDemoBanner && (
            <div className="mb-1 w-full px-4 py-2 text-center">
              <Link
                href="/onboard"
                className="inline-block rounded-[12px] border-[0.5px] border-[var(--is-border-1)] bg-[var(--is-surface)] px-3 py-2 text-[12px] font-medium text-[var(--is-text-1)]"
              >
                Demo browse — Get started to reserve
              </Link>
            </div>
          )}
          <div className="flex w-full items-center justify-between px-5 py-2">
            <Link
              href="/search"
              className="flex min-h-[44px] items-center text-[13px] font-medium text-[var(--is-blue)]"
            >
              ‹ Search
            </Link>
            <span className="text-center text-[15px] font-semibold tracking-[-0.01em] text-[var(--is-text-1)]">
              Deals
            </span>
            <Link
              href="/orders"
              className="flex min-h-[44px] items-center text-[13px] font-medium text-[var(--is-blue)]"
            >
              Orders
            </Link>
          </div>
          {pointsBalance > 0 ? (
            <label className="mx-5 mt-1 mb-2 flex cursor-pointer items-center gap-3 rounded-[12px] border-[0.5px] border-[var(--is-border-1)] bg-[var(--is-surface)] px-3 py-2.5">
              <input
                type="checkbox"
                className="size-4 accent-[var(--is-purple)]"
                checked={applyFoodPoints}
                onChange={(e) => setApplyFoodPoints(e.target.checked)}
              />
              <span className="text-left text-[12px] leading-snug text-[var(--is-text-2)]">
                Use food points on checkout (balance{" "}
                <strong className="text-[var(--is-text-1)]">{pointsBalance}</strong> pts · up to half the order)
              </span>
            </label>
          ) : null}
        </header>

        {loading && (
          <div className="relative min-h-0 flex-1">
            <DealSkeleton i={0} />
            <DealSkeleton i={1} />
            <DealSkeleton i={2} />
          </div>
        )}

        {!loading && sortedDeals.length === 0 && (
          <div className="relative flex min-h-0 flex-1 flex-col items-center justify-center px-6 py-24 text-center">
            <DataCard className="max-w-sm">
              <p className="text-[11px] font-semibold tracking-[0.08em] text-[var(--is-text-4)] uppercase">
                All caught up
              </p>
              <h1 className="mt-2 text-[17px] font-semibold tracking-[-0.02em] text-[var(--is-text-1)]">
                No more deals right now
              </h1>
              <p className="mt-2 text-[15px] text-[var(--is-text-2)]">New flash deals drop throughout the day.</p>
              <div className="mt-6">
                <PillLink href="/search" variant="ghost">
                  Explore the map
                </PillLink>
              </div>
              <div className="mt-6">
                <PillButton type="button" variant="ghost" disabled={notifyBusy} onClick={() => void onNotifyMe()}>
                  {notifyBusy ? "Saving…" : "Notify me"}
                </PillButton>
                {notifyMsg && <p className="mt-3 text-[13px] text-[var(--is-text-2)]">{notifyMsg}</p>}
              </div>
            </DataCard>
          </div>
        )}

        {!loading && sortedDeals.length > 0 && (
          <div className="relative min-h-0 flex-1">
            {sharedMapOpen && stackMapVendors.length > 0 && topDeal ? (
              <div
                key="deals-stack-map-host"
                className="pointer-events-auto absolute top-0 right-0 left-0 z-[15] h-[min(54dvh,480px)] touch-auto overflow-hidden rounded-b-[24px] bg-[var(--is-card)] [&_.leaflet-container]:!bg-[var(--is-card)]"
              >
                <DealsStackMap
                  userLocation={location}
                  vendors={stackMapVendors}
                  highlightedVendorId={topDeal.dealId}
                  className="size-full !min-h-0 rounded-none border-0"
                />
              </div>
            ) : null}
            {ordering && (
              <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/40">
                <span className="text-[14px] font-medium text-[var(--is-text-1)]">Opening checkout…</span>
              </div>
            )}
            {stackSlice.map((deal, i) => (
              <DealTile
                key={deal.dealId}
                deal={deal}
                stackIndex={i}
                isTop={i === 0}
                userLocation={location}
                sharedMapLayerActive={sharedMapOpen}
                quantitySeed={focusDealId === deal.dealId ? dealLinkQty : 1}
                onReserve={handleReserve}
                onSwipeNext={onSwipeNext}
              />
            ))}
          </div>
        )}
      </main>
    </MobileAppFrame>
  );
}
