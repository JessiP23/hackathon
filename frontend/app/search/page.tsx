"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getCurrentLocation } from "@/app/services/location";
import { sendVoiceTranscript } from "@/app/services/voice";
import VoiceDial from "@/app/components/VoiceDial";
import { Vendor, Location, VoiceResponse } from "@/app/shared/types";

export default function SearchPage() {
  const [location, setLocation] = useState<Location | null>(null);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [transcript, setTranscript] = useState("");

  useEffect(() => {
    getCurrentLocation()
      .then(setLocation)
      .catch(() => setMessage("Enable location to find vendors"));
  }, []);

  async function handleVoice(text: string) {
    if (!location) return;
    setTranscript(text);
    setLoading(true);
    setMessage("");

    try {
      const res: VoiceResponse = await sendVoiceTranscript(text, location.lat, location.lng);
      setVendors(res.results || []);
      setMessage(res.message);
    } catch {
      setMessage("Search failed. Try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-white pb-24 text-black">
      {/* Header */}
      <div className="sticky top-0 bg-white border-b px-4 py-4 z-10">
        <div className="flex items-center justify-between">
          <Link href="/" className="text-gray-400">Back</Link>
          <h1 className="font-bold">Search</h1>
          <Link href="/deals" className="text-gray-400">Deals</Link>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {transcript && (
          <div className="text-center text-sm text-gray-500">
            Searching for "{transcript}"
          </div>
        )}

        {loading && (
          <div className="flex justify-center py-12">
            <div className="w-8 h-8 border-2 border-black border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {message && !loading && (
          <div className="text-center text-sm font-medium py-2">{message}</div>
        )}

        {vendors.length === 0 && !loading && !message && (
          <div className="text-center py-20">
            <div className="text-6xl mb-4">🎤</div>
            <p className="text-xl font-medium mb-2">What are you craving?</p>
            <p className="text-gray-500">Tap the mic and speak</p>
          </div>
        )}

        {/* Results */}
        <div className="space-y-3">
          {vendors.map((v) => (
            <Link
              key={v.vendorId}
              href={`/vendor/${v.vendorId}`}
              className="block bg-gray-50 rounded-2xl p-4"
            >
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="font-semibold text-lg">{v.name}</h3>
                  <p className="text-sm text-gray-500">{v.distance_m}m away</p>
                  {v.businessHours && (
                    <p className="text-xs text-gray-400 mt-1">{v.businessHours}</p>
                  )}
                </div>
                <span className="text-gray-400">→</span>
              </div>

              {v.matchingItems && v.matchingItems.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {v.matchingItems.slice(0, 3).map((item, i) => (
                    <span
                      key={i}
                      className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded-full"
                    >
                      {item.name} ${item.price}
                    </span>
                  ))}
                </div>
              )}
            </Link>
          ))}
        </div>
      </div>

      <VoiceDial onTranscript={handleVoice} />
    </main>
  );
}