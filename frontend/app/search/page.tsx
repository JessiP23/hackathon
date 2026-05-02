"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import Link from "next/link";
import { getCurrentLocation } from "@/app/services/location";
import { sendVoiceTranscript } from "@/app/services/voice";
import { getVendorsNearby } from "@/app/services/api";
import VoiceDial from "@/app/components/VoiceDial";
import OsmMapView from "@/app/components/OsmMapView";
import { Vendor, Location, VoiceResponse } from "@/app/shared/types";

const accent = "#ff3b30";

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
  const [nearbyVendors, setNearbyVendors] = useState<Vendor[]>([]);
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

  const mapVendors = useMemo(() => {
    if (vendors.length > 0) return vendors;
    return nearbyVendors;
  }, [vendors, nearbyVendors]);

  const mapPins = useMemo(() => mapVendors.filter((v) => v.location), [mapVendors]);

  const mapCaption =
    vendors.length > 0
      ? `${vendors.length} match${vendors.length === 1 ? "" : "es"} · OpenStreetMap`
      : nearbyVendors.length > 0
        ? `${nearbyVendors.length} nearby · search to narrow`
        : "You · enable location";

  useEffect(() => {
    getCurrentLocation()
      .then(setLocation)
      .catch(() => setMessage("Enable location to find vendors"));
  }, []);

  useEffect(() => {
    if (!location) return;
    let cancelled = false;
    (async () => {
      try {
        const { results } = await getVendorsNearby("", location.lat, location.lng);
        if (!cancelled) setNearbyVendors(results ?? []);
      } catch {
        if (!cancelled) setNearbyVendors([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [location]);

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
    <main className="mx-auto flex min-h-[100dvh] w-full max-w-[430px] flex-col bg-[var(--infra-black)] text-[var(--infra-ink)]">
      {/* Global nav — matches reference */}
      <header className="sticky top-0 z-[90] flex h-11 items-center justify-between bg-[var(--infra-black)] px-5">
        <span className="text-[17px] font-semibold tracking-[-0.5px] text-[var(--infra-ink)]">
          InfraStreet
          <sup className="ml-0.5 align-super text-[9px] font-semibold text-[var(--infra-accent)]">BETA</sup>
        </span>
        <div className="flex items-center gap-1.5">
          <Link
            href="/deals"
            className="flex h-[30px] items-center gap-1.5 rounded-[var(--r-sm)] bg-[var(--infra-tile-2)] px-3 text-[13px] text-[var(--infra-ink)] active:opacity-80"
          >
            Deals
          </Link>
          <Link
            href="/orders"
            className="flex h-[30px] items-center gap-1.5 rounded-[var(--r-sm)] bg-[var(--infra-tile-2)] px-3 text-[13px] text-[var(--infra-ink)] active:opacity-80"
          >
            Orders
          </Link>
        </div>
      </header>

      {/* Sub nav */}
      <div
        className="sticky top-11 z-[89] flex h-[52px] items-center justify-between border-b border-[var(--infra-ink-4)] bg-[rgba(0,0,0,0.88)] px-5 backdrop-blur-xl backdrop-saturate-180"
        style={{ WebkitBackdropFilter: "saturate(180%) blur(20px)" }}
      >
        <Link
          href="/"
          className="text-[15px] font-semibold tracking-[-0.3px] text-[var(--infra-ink-2)] hover:text-[var(--infra-ink)]"
        >
          ← Back
        </Link>
        <span className="text-[15px] font-semibold tracking-[-0.3px]">Find food</span>
        <span className="w-10" aria-hidden />
      </div>

      {location && (
        <div className="border-b border-[var(--infra-ink-4)] bg-[var(--infra-black)] px-4 pb-3 pt-3">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--infra-accent)]">
            Map · live pins
          </p>
          <p className="mb-2 text-[12px] leading-snug text-[var(--infra-ink-3)]">{mapCaption}</p>
          <OsmMapView
            userLocation={location}
            vendors={mapPins}
            highlightedVendorId={hoveredVendor}
            className="h-[min(240px,42vw)] min-h-[200px]"
          />
        </div>
      )}

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="px-5 pb-40 pt-5">
          {transcript && (
            <div className="mb-5 animate-in fade-in slide-in-from-bottom-2 duration-300">
              <div className="inline-block rounded-[var(--r-lg)] border border-[var(--infra-ink-4)] bg-[var(--infra-tile-1)] px-4 py-3">
                <p className="text-[14px] text-[var(--infra-ink-2)]">
                  <span className="mr-2 font-medium text-[var(--infra-ink)]">Searching:</span>&quot;{transcript}&quot;
                </p>
              </div>
            </div>
          )}

          {loading && (
            <div className="flex flex-col items-center justify-center py-20">
              <div className="relative">
                <div className="h-16 w-16 rounded-full border-2 border-[var(--infra-ink-4)]" />
                <div
                  className="absolute inset-0 h-16 w-16 animate-spin rounded-full border-2 border-transparent"
                  style={{ borderTopColor: accent }}
                />
              </div>
              <p className="mt-6 text-[15px] text-[var(--infra-ink-3)]">Finding the best spots...</p>
            </div>
          )}

          {message && !loading && vendors.length === 0 && (
            <div className="py-8 text-center">
              <p className="text-[var(--infra-ink-2)]">{message}</p>
            </div>
          )}

          {vendors.length === 0 && !loading && !message && (
            <div className="py-12 text-center">
              <div className="mb-6 text-6xl leading-none" aria-hidden>
                🌮
              </div>
              <p className="mb-2 text-[13px] font-semibold uppercase tracking-[0.06em] text-[var(--infra-accent)]">
                Nearby first
              </p>
              <h2
                className="mb-3 font-semibold text-[var(--infra-ink)]"
                style={{ fontSize: "clamp(28px, 7vw, 34px)", letterSpacing: "-0.6px", lineHeight: 1.08 }}
              >
                What are you craving?
              </h2>
              <p className="mx-auto max-w-[300px] text-[17px] leading-snug text-[var(--infra-ink-2)]">
                OpenStreetMap shows real stall locations. Type, tap below, or use the mic.
              </p>
              <div className="mt-8 flex flex-wrap justify-center gap-2">
                {QUICK_FOOD_PICKS.map((food) => (
                  <button
                    key={food}
                    type="button"
                    disabled={!location || loading}
                    onClick={() => handleVoice(food)}
                    className="rounded-[var(--r-pill)] border border-[var(--infra-ink-4)] bg-[var(--infra-tile-2)] px-4 py-2 text-[15px] font-medium text-[var(--infra-ink)] transition-colors active:scale-[0.98] disabled:opacity-40"
                  >
                    {food}
                  </button>
                ))}
              </div>
            </div>
          )}

          {vendors.length > 0 && !loading && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-[13px] font-semibold uppercase tracking-[0.06em] text-[var(--infra-ink-3)]">
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
                  className="text-[14px] text-[var(--infra-blue)] active:opacity-70"
                >
                  Clear
                </button>
              </div>

              {refineChips.length > 0 && (
                <div className="mb-4">
                  <p className="mb-2 text-[12px] font-semibold uppercase tracking-wide text-[var(--infra-ink-3)]">
                    Also try
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {refineChips.map((label) => (
                      <button
                        key={label}
                        type="button"
                        disabled={loading}
                        onClick={() => handleVoice(label)}
                        className="rounded-[var(--r-pill)] border border-[var(--infra-ink-4)] bg-[var(--infra-accent-2)] px-3 py-1.5 text-[14px] font-medium text-[var(--infra-accent)] active:scale-[0.98] disabled:opacity-40"
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
                    className="block animate-in fade-in slide-in-from-bottom-2 duration-300 active:scale-[0.98]"
                    style={{ animationDelay: `${index * 50}ms` }}
                    onPointerEnter={() => setHoveredVendor(v.vendorId)}
                    onPointerLeave={() => setHoveredVendor(null)}
                  >
                    <div
                      className={`relative overflow-hidden rounded-[var(--r-xl)] border bg-[var(--infra-tile-1)] p-5 transition-colors ${
                        hoveredVendor === v.vendorId
                          ? "border-[var(--infra-accent)] ring-2 ring-[var(--infra-accent)]/25"
                          : "border-[var(--infra-ink-4)]"
                      }`}
                    >
                      {v.distance_m != null && (
                        <div className="absolute right-4 top-4 rounded-[var(--r-pill)] bg-[rgba(0,0,0,0.72)] px-3 py-1 backdrop-blur-md">
                          <span className="text-[12px] text-[var(--infra-ink)]">
                            {v.distance_m < 1000 ? `${v.distance_m}m` : `${(v.distance_m / 1000).toFixed(1)}km`}
                          </span>
                        </div>
                      )}
                      <div className="pr-16">
                        <h3 className="text-[19px] font-semibold tracking-[-0.4px] text-[var(--infra-ink)]">{v.name}</h3>
                        {v.businessHours && (
                          <p className="mt-1 text-[14px] text-[var(--infra-ink-3)]">{v.businessHours}</p>
                        )}
                      </div>
                      {v.matchingItems && v.matchingItems.length > 0 && (
                        <div className="mt-4 flex flex-wrap gap-2">
                          {v.matchingItems.slice(0, 3).map((item, i) => (
                            <div
                              key={i}
                              className="flex items-center gap-2 rounded-[var(--r-md)] border border-[var(--infra-ink-4)] bg-[var(--infra-tile-2)] px-3 py-1.5"
                            >
                              <span className="text-[14px] text-[var(--infra-ink)]">{item.name}</span>
                              <span className="text-[12px] text-[var(--infra-green)]">${item.price.toFixed(2)}</span>
                            </div>
                          ))}
                        </div>
                      )}
                      <div className="absolute bottom-5 right-5 flex h-9 w-9 items-center justify-center rounded-full bg-[var(--infra-tile-2)] text-[var(--infra-ink-3)]">
                        →
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Sticky search bar */}
      <div
        className="pointer-events-none fixed bottom-0 left-0 right-0 z-50 border-t border-[var(--infra-ink-4)] bg-[rgba(0,0,0,0.88)] px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur-xl backdrop-saturate-180"
        style={{ WebkitBackdropFilter: "saturate(180%) blur(20px)" }}
      >
        <form
          onSubmit={onSearchSubmit}
          className="pointer-events-auto mx-auto flex max-w-[430px] items-center gap-2"
        >
          <div className="flex min-w-0 flex-1 items-center rounded-[var(--r-pill)] border border-[var(--infra-ink-4)] bg-[var(--infra-tile-2)] px-4">
            <input
              type="search"
              enterKeyHint="search"
              autoComplete="off"
              placeholder={location ? "Tacos, coffee…" : "Enable location"}
              disabled={!location || loading}
              value={queryInput}
              onChange={(e) => setQueryInput(e.target.value)}
              className="min-w-0 flex-1 bg-transparent py-3 text-[16px] text-[var(--infra-ink)] placeholder:text-[var(--infra-ink-3)] outline-none"
            />
          </div>
          <button
            type="submit"
            disabled={!location || loading || !queryInput.trim()}
            className="h-11 shrink-0 rounded-[var(--r-pill)] px-5 text-[16px] font-normal text-white disabled:opacity-40 active:scale-[0.96]"
            style={{ backgroundColor: accent }}
          >
            Go
          </button>
          <VoiceDial onTranscript={handleVoice} disabled={!location || loading} variant="dark" />
        </form>
      </div>
    </main>
  );
}
