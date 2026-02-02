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
    <main className="min-h-screen bg-white">
      <header className="bg-red-500 text-white px-4 py-6">
        <div className="max-w-lg mx-auto">
          <Link href="/" className="text-red-200 text-sm">Back</Link>
          <h1 className="text-2xl font-black mt-2">Hot Deals</h1>
          <p className="text-red-200 text-sm mt-1">Limited time only</p>
        </div>
      </header>

      <div className="max-w-lg mx-auto p-4">
        {loading && (
          <div className="flex justify-center py-20">
            <div className="w-6 h-6 border-2 border-red-500 border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {!loading && activeDeals.length === 0 && (
          <div className="text-center py-20">
            <p className="text-xl font-bold mb-2">No deals right now</p>
            <p className="text-gray-400 mb-6">Check back soon</p>
            <Link href="/search" className="bg-black text-white px-6 py-3 rounded-xl font-semibold">
              Browse Vendors
            </Link>
          </div>
        )}

        <div className="space-y-3">
          {activeDeals.map((deal) => {
            const timeLeft = getTimeLeft(deal.expiresAt);
            const savings = deal.originalPrice
              ? Math.round(((deal.originalPrice - deal.dealPrice) / deal.originalPrice) * 100)
              : 0;

            return (
              <Link
                key={deal.dealId}
                href={`/vendor/${deal.vendorId}`}
                className="block bg-red-50 border border-red-100 rounded-2xl p-4 relative"
              >
                {savings >= 20 && (
                  <span className="absolute top-0 right-0 bg-red-500 text-white text-xs font-bold px-3 py-1 rounded-bl-xl">
                    {savings}% OFF
                  </span>
                )}

                <p className="font-black text-lg text-black pr-16">{deal.itemName}</p>
                <p className="text-gray-500 text-sm">{deal.vendorName}</p>

                <div className="flex items-end justify-between mt-3">
                  <div className="flex items-baseline gap-2">
                    <span className="text-2xl font-black text-red-600">${deal.dealPrice.toFixed(2)}</span>
                    {deal.originalPrice && (
                      <span className="text-sm text-gray-400 line-through">${deal.originalPrice.toFixed(2)}</span>
                    )}
                  </div>
                  <span className="text-xs font-semibold text-red-600 bg-red-100 px-2 py-1 rounded-full">
                    {timeLeft}
                  </span>
                </div>

                {deal.distance_m && (
                  <p className="text-xs text-gray-400 mt-2">{deal.distance_m}m away</p>
                )}
              </Link>
            );
          })}
        </div>
      </div>
    </main>
  );
}