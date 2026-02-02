"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getCurrentLocation } from "@/app/services/location";
import { getDealsNearby } from "@/app/services/api";
import { Deal, Location } from "@/app/shared/types";

export default function DealsPage() {
  const [location, setLocation] = useState<Location | null>(null);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(true);

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
          <Link href="/" className="text-white/70 text-sm font-medium">Back</Link>
          <h1 className="text-2xl font-black mt-2">Hot Deals</h1>
          <p className="text-white/70 text-sm mt-1">Limited time only</p>
        </div>
      </header>

      <div className="max-w-lg mx-auto px-5 py-6">
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

        <div className="space-y-3">
          {activeDeals.map((deal, index) => {
            const timeLeft = getTimeLeft(deal.expiresAt);
            const savings = deal.originalPrice
              ? Math.round(((deal.originalPrice - deal.dealPrice) / deal.originalPrice) * 100)
              : 0;

            return (
              <Link
                key={deal.dealId}
                href={`/vendor/${deal.vendorId}`}
                className="block bg-gradient-to-br from-red-500/10 to-orange-500/10 border border-red-500/20 rounded-2xl p-5 relative animate-in fade-in slide-in-from-bottom-2 duration-300"
                style={{ animationDelay: `${index * 50}ms` }}
              >
                {savings >= 20 && (
                  <span className="absolute top-0 right-0 bg-gradient-to-r from-red-500 to-orange-500 text-white text-xs font-bold px-3 py-1.5 rounded-bl-xl rounded-tr-2xl">
                    {savings}% OFF
                  </span>
                )}

                <p className="font-black text-xl pr-16">{deal.itemName}</p>
                <p className="text-neutral-400 text-sm mt-1">{deal.vendorName}</p>

                <div className="flex items-end justify-between mt-4">
                  <div className="flex items-baseline gap-3">
                    <span className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-red-400 to-orange-400">
                      ${deal.dealPrice.toFixed(2)}
                    </span>
                    {deal.originalPrice && (
                      <span className="text-sm text-neutral-500 line-through">
                        ${deal.originalPrice.toFixed(2)}
                      </span>
                    )}
                  </div>
                  <span className="text-xs font-bold text-red-400 bg-red-500/20 px-3 py-1.5 rounded-full border border-red-500/30">
                    {timeLeft}
                  </span>
                </div>

                {deal.distance_m && (
                  <p className="text-xs text-neutral-500 mt-3">
                    {deal.distance_m < 1000 ? `${deal.distance_m}m` : `${(deal.distance_m / 1000).toFixed(1)}km`} away
                  </p>
                )}
              </Link>
            );
          })}
        </div>
      </div>
    </main>
  );
}