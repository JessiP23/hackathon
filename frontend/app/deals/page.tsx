"use client";

import { useEffect, useState } from "react";
import { getCurrentLocation } from "../services/location";
import { getDeals } from "../services/api";
import DealCard from "../components/DealCard";
import MapView from "../components/MapView";
import VoiceDial from "../components/VoiceDial";
import { Deal, Location } from "../shared/types";

export default function DealsPage() {
  const [location, setLocation] = useState<Location | null>(null);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    getCurrentLocation().then(async (loc) => {
      setLocation(loc);
      const res = await getDeals(loc.lat, loc.lng);
      setDeals(res.deals || []);
    });
  }, []);

  async function handleVoice(transcript: string) {
    if (!location) return;
    setLoading(true);
    const res = await getDeals(location.lat, location.lng); // backend can filter by transcript
    setDeals(res.deals || []);
    setLoading(false);
  }

  return (
    <main className="min-h-screen p-4 space-y-4">
      <MapView deals={deals} userLocation={location} />

      {loading && <div className="text-sm text-gray-500">Searching deals...</div>}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {deals.map((d, i) => (
          <DealCard key={i} deal={d} />
        ))}
      </div>

      <VoiceDial onTranscript={handleVoice} />
    </main>
  );
}
