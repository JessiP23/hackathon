"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getCurrentLocation } from "@/app/services/location";
import { sendVoiceTranscript } from "@/app/services/voice";
import VoiceDial from "@/app/components/VoiceDial";
import MapView from "@/app/components/MapView";
import { Vendor, Location, VoiceResponse } from "@/app/shared/types";

export default function SearchPage() {
  const [location, setLocation] = useState<Location | null>(null);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [transcript, setTranscript] = useState("");
  const [hoveredVendor, setHoveredVendor] = useState<string | null>(null);
  const [showMap, setShowMap] = useState(false);

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
      if (res.results && res.results.length > 0) setShowMap(true);
    } catch {
      setMessage("Search failed. Try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-neutral-950 text-white">
      {/* Header */}
      <header className="sticky top-0 z-20 backdrop-blur-xl bg-neutral-950/80 border-b border-white/5">
        <div className="max-w-lg mx-auto px-5 py-4 flex items-center justify-between">
          <Link href="/" className="text-neutral-500 hover:text-white transition-colors text-sm font-medium">
            Back
          </Link>
          <span className="text-lg font-black tracking-tight">InfraStreet</span>
          <Link href="/deals" className="text-red-500 text-sm font-semibold">
            Deals
          </Link>
        </div>
      </header>

      {/* Content */}
      <div className="max-w-lg mx-auto px-5 pt-6 pb-40">
        {/* Transcript */}
        {transcript && (
          <div className="mb-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
            <div className="inline-block bg-white/10 rounded-2xl px-5 py-3 border border-white/10">
              <p className="text-sm text-neutral-300">
                <span className="text-neutral-500 mr-2">You said:</span>"{transcript}"
              </p>
            </div>
          </div>
        )}

        {/* Map Toggle */}
        {vendors.length > 0 && (
          <div className="mb-4">
            <button
              onClick={() => setShowMap(!showMap)}
              className="text-sm text-neutral-400 hover:text-white transition-colors"
            >
              {showMap ? "Hide Map" : "Show Map"}
            </button>
          </div>
        )}

        {/* Map */}
        {showMap && vendors.length > 0 && (
          <div className="mb-6 rounded-2xl overflow-hidden border border-white/10 animate-in fade-in duration-300">
            <MapView
              vendors={vendors}
              userLocation={location}
              highlightedVendor={hoveredVendor}
            />
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="flex flex-col items-center justify-center py-24">
            <div className="relative">
              <div className="w-16 h-16 rounded-full border-2 border-white/10" />
              <div className="absolute inset-0 w-16 h-16 rounded-full border-2 border-transparent border-t-white animate-spin" />
            </div>
            <p className="text-neutral-500 text-sm mt-6 animate-pulse">Finding the best spots...</p>
          </div>
        )}

        {/* Message */}
        {message && !loading && vendors.length === 0 && (
          <div className="text-center py-8">
            <p className="text-neutral-400">{message}</p>
          </div>
        )}

        {/* Empty */}
        {vendors.length === 0 && !loading && !message && (
          <div className="text-center py-20">
            <div className="mb-8">
              <div className="w-24 h-24 mx-auto rounded-full bg-gradient-to-br from-red-500/20 to-orange-500/20 flex items-center justify-center border border-white/5">
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-red-500 to-orange-500 animate-pulse" />
              </div>
            </div>
            <h2 className="text-3xl font-black mb-3">What are you craving?</h2>
            <p className="text-neutral-500 text-lg">Hold the button and speak</p>
            <div className="mt-8 flex flex-wrap justify-center gap-2">
              {["tacos", "ramen", "pizza", "empanadas", "falafel"].map((food) => (
                <span key={food} className="px-4 py-2 rounded-full bg-white/5 text-neutral-400 text-sm border border-white/5">
                  {food}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Results */}
        {vendors.length > 0 && !loading && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-neutral-500 text-sm font-medium uppercase tracking-wider">
                {vendors.length} {vendors.length === 1 ? "result" : "results"}
              </h3>
              <button
                onClick={() => { setVendors([]); setTranscript(""); setMessage(""); setShowMap(false); }}
                className="text-neutral-500 text-sm hover:text-white transition-colors"
              >
                Clear
              </button>
            </div>
            
            <div className="space-y-3">
              {vendors.map((v, index) => (
                <Link
                  key={v.vendorId}
                  href={`/vendor/${v.vendorId}`}
                  className="block group animate-in fade-in slide-in-from-bottom-2 duration-300"
                  style={{ animationDelay: `${index * 50}ms` }}
                  onMouseEnter={() => setHoveredVendor(v.vendorId)}
                  onMouseLeave={() => setHoveredVendor(null)}
                >
                  <div className={`relative bg-white/5 rounded-2xl p-5 border transition-all duration-300 hover:scale-[1.02] ${
                    hoveredVendor === v.vendorId ? "border-white/30 bg-white/10" : "border-white/10"
                  }`}>
                    {v.distance_m && (
                      <div className="absolute top-4 right-4 bg-white/10 px-3 py-1 rounded-full">
                        <span className="text-xs font-medium text-neutral-300">
                          {v.distance_m < 1000 ? `${v.distance_m}m` : `${(v.distance_m / 1000).toFixed(1)}km`}
                        </span>
                      </div>
                    )}

                    <div className="pr-16">
                      <h3 className="text-xl font-bold">{v.name}</h3>
                      {v.businessHours && (
                        <p className="text-neutral-500 text-sm mt-1">{v.businessHours}</p>
                      )}
                    </div>

                    {v.matchingItems && v.matchingItems.length > 0 && (
                      <div className="mt-4 flex flex-wrap gap-2">
                        {v.matchingItems.slice(0, 3).map((item, i) => (
                          <div key={i} className="flex items-center gap-2 bg-green-500/10 border border-green-500/20 rounded-xl px-3 py-1.5">
                            <span className="text-sm text-green-400">{item.name}</span>
                            <span className="text-xs text-green-500/70">${item.price.toFixed(2)}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    <div className="absolute bottom-5 right-5 w-8 h-8 rounded-full bg-white/5 flex items-center justify-center group-hover:bg-white/10 transition-colors">
                      <span className="text-neutral-400 group-hover:text-white transition-colors">→</span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Voice Button */}
      <div className="fixed bottom-0 left-0 right-0 pb-8 pt-20 bg-gradient-to-t from-neutral-950 via-neutral-950/95 to-transparent pointer-events-none">
        <div className="max-w-lg mx-auto px-5 pointer-events-auto">
          <VoiceDial onTranscript={handleVoice} />
        </div>
      </div>
    </main>
  );
}