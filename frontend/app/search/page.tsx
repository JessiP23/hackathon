"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import Link from "next/link";
import { getCurrentLocation } from "@/app/services/location";
import { sendVoiceTranscript } from "@/app/services/voice";
import VoiceDial from "@/app/components/VoiceDial";
import MapView from "@/app/components/MapView";
import { Vendor, Location, VoiceResponse } from "@/app/shared/types";

const QUICK_FOOD_PICKS = ["tacos", "ramen", "pizza", "empanadas", "falafel"];

function uniqueMatchingLabels(vendors: Vendor[], limit = 10): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const v of vendors) {
    for (const item of v.matchingItems ?? []) {
      const raw = item.name.trim();
      if (!raw) continue;
      const key = raw.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(raw);
      if (out.length >= limit) return out;
    }
  }
  return out;
}

export default function SearchPage() {
  const [location, setLocation] = useState<Location | null>(null);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [transcript, setTranscript] = useState("");
  const [queryInput, setQueryInput] = useState("");
  const [hoveredVendor, setHoveredVendor] = useState<string | null>(null);

  const refineChips = useMemo(() => {
    const labels = uniqueMatchingLabels(vendors);
    const q = transcript.trim().toLowerCase();
    if (!q) return labels;
    return labels.filter((label) => label.trim().toLowerCase() !== q);
  }, [vendors, transcript]);

  useEffect(() => {
    getCurrentLocation()
      .then(setLocation)
      .catch(() => setMessage("Enable location to find vendors"));
  }, []);

  async function handleVoice(text: string) {
    if (!location) return;
    const q = text.trim();
    if (!q) return;
    setQueryInput(q);
    setTranscript(q);
    setLoading(true);
    setMessage("");

    try {
      const res: VoiceResponse = await sendVoiceTranscript(q, location.lat, location.lng);
      setVendors(res.results || []);
      setMessage(res.message);
    } catch {
      setMessage("Search failed. Try again.");
    } finally {
      setLoading(false);
    }
  }

  function onSearchSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    handleVoice(queryInput);
  }

  return (
    <main className="min-h-screen bg-neutral-950 text-white flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-30 backdrop-blur-xl bg-neutral-950/80 border-b border-white/5">
        <div className="max-w-lg mx-auto px-5 py-4 flex items-center justify-between">
          <Link href="/" className="text-neutral-500 hover:text-white transition-colors text-sm font-medium">
            Back
          </Link>
          <span className="text-lg font-black tracking-tight">InfraStreet</span>
          <div className="flex gap-3">
            <Link href="/orders" className="text-neutral-400 text-sm font-medium hover:text-white transition-colors">
              Orders
            </Link>
            <Link href="/deals" className="text-red-500 text-sm font-semibold">
              Deals
            </Link>
          </div>
        </div>
      </header>

      {/* Sticky Map */}
      {vendors.length > 0 && (
        <div className="sticky top-[57px] z-20 border-b border-white/10">
          <MapView
            vendors={vendors}
            userLocation={location}
            highlightedVendor={hoveredVendor}
          />
        </div>
      )}

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-lg mx-auto px-5 pt-6 pb-44">
          {/* Transcript */}
          {transcript && (
            <div className="mb-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
              <div className="inline-block bg-white/10 rounded-2xl px-5 py-3 border border-white/10">
                <p className="text-sm text-neutral-300">
                  <span className="text-neutral-500 mr-2">Searching:</span>&quot;{transcript}&quot;
                </p>
              </div>
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
              <p className="text-neutral-500 text-lg max-w-xs mx-auto">
                Type below, tap a suggestion, or use the mic
              </p>
              <div className="mt-8 flex flex-wrap justify-center gap-2">
                {QUICK_FOOD_PICKS.map((food) => (
                  <button
                    key={food}
                    type="button"
                    disabled={!location || loading}
                    onClick={() => handleVoice(food)}
                    className="px-4 py-2 rounded-full bg-white/5 text-neutral-300 text-sm border border-white/10 hover:bg-white/10 hover:border-white/20 transition-colors disabled:opacity-40"
                  >
                    {food}
                  </button>
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
                  type="button"
                  onClick={() => {
                    setVendors([]);
                    setTranscript("");
                    setMessage("");
                    setQueryInput("");
                  }}
                  className="text-neutral-500 text-sm hover:text-white transition-colors"
                >
                  Clear
                </button>
              </div>

              {refineChips.length > 0 && (
                <div className="mb-5">
                  <p className="text-neutral-500 text-xs font-medium uppercase tracking-wider mb-2">
                    Also try
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {refineChips.map((label) => (
                      <button
                        key={label}
                        type="button"
                        disabled={loading}
                        onClick={() => handleVoice(label)}
                        className="px-3 py-1.5 rounded-full text-sm bg-green-500/10 text-green-300 border border-green-500/25 hover:bg-green-500/20 transition-colors disabled:opacity-40"
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

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
      </div>

      {/* Search bar + voice */}
      <div className="fixed bottom-0 left-0 right-0 z-10 pt-16 pb-6 bg-gradient-to-t from-neutral-950 via-neutral-950/98 to-transparent pointer-events-none">
        <div className="max-w-lg mx-auto px-5 pointer-events-auto">
          <form
            onSubmit={onSearchSubmit}
            className="flex items-center gap-2 rounded-2xl bg-white/10 border border-white/10 p-2 pl-4 shadow-xl shadow-black/40"
          >
            <input
              type="search"
              enterKeyHint="search"
              autoComplete="off"
              placeholder={location ? "Tacos, coffee, bakery…" : "Enable location to search"}
              disabled={!location || loading}
              value={queryInput}
              onChange={(e) => setQueryInput(e.target.value)}
              className="flex-1 min-w-0 bg-transparent text-white placeholder:text-neutral-500 text-sm outline-none py-2"
            />
            <button
              type="submit"
              disabled={!location || loading || !queryInput.trim()}
              className="shrink-0 rounded-xl bg-white text-neutral-950 text-sm font-semibold px-4 py-2.5 disabled:opacity-40 hover:bg-neutral-200 transition-colors"
            >
              Search
            </button>
            <VoiceDial onTranscript={handleVoice} disabled={!location || loading} />
          </form>
        </div>
      </div>
    </main>
  );
}