"use client";

import { useEffect, useState } from "react";
import { getCurrentLocation } from "@/app/services/location";
import { getDeals } from "@/app/services/api";
import DealCard from "@/app/components/DealCard";
import MapView from "@/app/components/MapView";
import { Deal, Location } from "@/app/shared/types";

export default function DealsPage() {
  const [location, setLocation] = useState<Location | null>(null);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getCurrentLocation()
      .then(async (loc) => {
        setLocation(loc);
        const res = await getDeals(loc.lat, loc.lng);
        setDeals(res.deals || []);
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <main className="min-h-screen">
      <MapView deals={deals} userLocation={location} />

      <div className="p-4 space-y-4">
        <h2 className="text-xl font-bold">🔥 Flash Deals Nearby</h2>

        {loading && (
          <div className="text-sm text-gray-500 animate-pulse">
            Finding deals...
          </div>
        )}

        {!loading && deals.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            No active deals nearby right now
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {deals.map((d) => (
            <DealCard key={d.dealId} deal={d} />
          ))}
        </div>
      </div>
    </main>
  );
}