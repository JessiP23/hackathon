"use client";

import { useEffect, useState } from "react";
import { getCurrentLocation } from '@/app/services/location'
import { sendVoiceTranscript } from "./services/voice";
import VoiceDial from "./components/VoiceDial";
import MapView from "./components/MapView";
import VendorCard from "./components/VendorCard";
import { Vendor, Location } from "./shared/types";

export default function HomePage() {
  const [location, setLocation] = useState<Location | null>(null);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    getCurrentLocation().then(setLocation);
  }, []);

  async function handleVoice(transcript: string) {
    if (!location) return;
    setLoading(true);

    const res = await sendVoiceTranscript(transcript, location.lat, location.lng);
    setVendors(res.results || []);
    setLoading(false);
  }

  return (
    <main className="relative min-h-screen">
      <MapView vendors={vendors} userLocation={location} />

      <div className="p-4 space-y-3">
        {loading && <div className="text-sm text-gray-500">Searching nearby vendors...</div>}

        {vendors.map((v) => (
          <VendorCard key={v.vendorId} vendor={v} />
        ))}
      </div>

      <VoiceDial onTranscript={handleVoice} />
    </main>
  );
}
