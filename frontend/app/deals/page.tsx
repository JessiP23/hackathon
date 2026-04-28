"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { getCurrentLocation } from "@/app/services/location";
import { getDealsNearby, placeDealOrder } from "@/app/services/api";
import { Deal, Location } from "@/app/shared/types";
import DealCard from "@/app/components/DealCard";

export default function DealsPage() {
  const router = useRouter();
  const [location, setLocation] = useState<Location | null>(null);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(true);
  const [ordering, setOrdering] = useState<string | null>(null);

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

  const handleReserve = useCallback(async (deal: Deal) => {
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
  }, [router]);

  function getTimeLeft(expiresAt: string) {
    const diff = new Date(expiresAt).getTime() - Date.now();
    if (diff <= 0) return null;
    const hours = Math.floor(diff / 3600000);
    const mins = Math.floor((diff % 3600000) / 60000);
    if (hours > 0) return `${hours}h ${mins}m`;
    return `${mins}m`;
  }

  const activeDeals = deals.filter((d) => d.expiresAt && getTimeLeft(d.expiresAt));

  return (
    <main className="min-h-screen bg-neutral-950 text-white">
      <header className="sticky top-0 z-20 bg-gradient-to-r from-red-600 to-orange-500">
        <div className="max-w-lg mx-auto px-5 py-6">
          <Link href="/search" className="text-white/70 text-sm font-medium">← Back</Link>
          <h1 className="text-2xl font-black mt-2">🔥 Hot Deals</h1>
          <p className="text-white/70 text-sm mt-1">
            {location ? `Near you · ${activeDeals.length} active` : "Limited time only"}
          </p>
        </div>
      </header>

      <div className="max-w-lg mx-auto px-4 py-6">
        {loading && (
          <div className="flex justify-center py-20">
            <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {!loading && activeDeals.length === 0 && (
          <div className="text-center py-20">
            <h2 className="text-2xl font-bold mb-2">No deals right now</h2>
            <p className="text-neutral-500 mb-8">Check back soon</p>
            <Link href="/search" className="inline-block bg-white text-black px-8 py-3 rounded-xl font-bold">
              Browse Vendors
            </Link>
          </div>
        )}

        <div className="space-y-4">
          {activeDeals.map((deal) => (
            <div key={deal.dealId} className={ordering === deal.dealId ? "opacity-60 pointer-events-none" : ""}>
              <DealCard deal={deal} onReserve={handleReserve} />
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}


