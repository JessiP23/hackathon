"use client";

import { useEffect, useMemo, useState, useCallback, type FormEvent } from "react";
import Link from "next/link";
import { getCurrentLocation } from "@/app/services/location";
import { sendVoiceTranscript } from "@/app/services/voice";
import { getVendorsNearby } from "@/app/services/api";
import VoiceDial from "@/app/components/VoiceDial";
import OsmMapView from "@/app/components/OsmMapView";
import { MobileAppFrame } from "@/app/components/MobileLayout";
import { PillButton, StatusPill, DataCard, PillLink } from "@/app/components/Precision";
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
  const [nearbyVendors, setNearbyVendors] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [transcript, setTranscript] = useState("");
  const [queryInput, setQueryInput] = useState("");
  const [hoveredVendor, setHoveredVendor] = useState<string | null>(null);
  const [selectedVendor, setSelectedVendor] = useState<Vendor | null>(null);
  const [activeFilter, setActiveFilter] = useState<string | null>(null);

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

  const onVendorSelect = useCallback((v: Vendor) => {
    setSelectedVendor(v);
    setHoveredVendor(v.vendorId);
  }, []);

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

  /** Full viewport below header; overlays use flex column so search never stacks on chips. */
  const mapHeightStyle = { height: "calc(100dvh - 48px - env(safe-area-inset-top, 0px) - env(safe-area-inset-bottom, 0px))" };

  return (
    <MobileAppFrame>
      <div className="page-enter relative min-h-[100dvh] bg-[var(--is-bg)]">
        <header
          className="z-[1000] flex h-12 shrink-0 items-center justify-between border-b-[0.5px] border-[var(--is-border-1)] bg-[var(--is-bg)] px-4"
          style={{ paddingTop: "max(0px, env(safe-area-inset-top))" }}
        >
          <Link
            href="/"
            className="flex min-h-[44px] min-w-[44px] items-center text-[13px] font-medium text-[var(--is-blue)]"
          >
            ‹ Back
          </Link>
          <span className="text-[15px] font-semibold tracking-[-0.01em] text-[var(--is-text-1)]">Map</span>
          <div className="flex items-center gap-2">
            <Link
              href="/deals"
              className="flex min-h-[40px] items-center rounded-[12px] border-[0.5px] border-[var(--is-border-1)] bg-[var(--is-surface)] px-3 text-[12px] font-medium text-[var(--is-text-2)]"
            >
              Deals
            </Link>
            <Link
              href="/orders"
              className="flex min-h-[40px] items-center rounded-[12px] border-[0.5px] border-[var(--is-border-1)] bg-[var(--is-surface)] px-3 text-[12px] font-medium text-[var(--is-text-2)]"
            >
              Orders
            </Link>
          </div>
        </header>

        <div className="relative w-full overflow-hidden" style={mapHeightStyle}>
          {location && (
            <OsmMapView
              userLocation={location}
              vendors={mapPins}
              highlightedVendorId={hoveredVendor ?? selectedVendor?.vendorId ?? null}
              onVendorSelect={onVendorSelect}
              className="absolute inset-0 z-0 !min-h-0 rounded-none border-0"
            />
          )}

          <div className="pointer-events-none absolute top-0 right-0 left-0 z-[1000] flex flex-col gap-3 px-4 pt-3">
            <form
              onSubmit={onSearchSubmit}
              className="pointer-events-auto flex items-center gap-2 rounded-[12px] border-[0.5px] border-[var(--is-border-1)] bg-[var(--is-surface)] px-4 py-3 shadow-[0_8px_24px_rgba(0,0,0,0.35)]"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="shrink-0 text-[var(--is-text-4)]" aria-hidden>
                <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="1.5" />
                <path d="M20 20l-4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
              <input
                type="search"
                enterKeyHint="search"
                autoComplete="off"
                placeholder="Search stalls…"
                disabled={!location || loading}
                value={queryInput}
                onChange={(e) => setQueryInput(e.target.value)}
                className="min-h-[44px] min-w-0 flex-1 bg-transparent text-[15px] text-[var(--is-text-1)] placeholder:text-[var(--is-text-4)] outline-none"
              />
              <VoiceDial onTranscript={handleVoice} disabled={!location || loading} variant="dark" />
            </form>

            <div className="pointer-events-auto flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [mask-image:linear-gradient(to_right,black_92%,transparent)]">
              {QUICK_FOOD_PICKS.map((food) => (
                <button
                  key={food}
                  type="button"
                  disabled={!location || loading}
                  onClick={() => {
                    setActiveFilter(food);
                    handleVoice(food);
                  }}
                  className={`shrink-0 rounded-[20px] border-[0.5px] px-[14px] py-1.5 text-[13px] font-medium whitespace-nowrap ${
                    activeFilter === food
                      ? "border-[var(--is-purple)] bg-[var(--is-purple-tint)] text-[var(--is-purple)]"
                      : "border-[var(--is-border-1)] bg-[var(--is-surface)] text-[var(--is-text-3)]"
                  }`}
                >
                  {food}
                </button>
              ))}
            </div>
          </div>

          {loading && (
            <div className="absolute right-4 bottom-24 left-4 z-[998] rounded-[16px] border-[0.5px] border-[var(--is-border-1)] bg-[var(--is-surface)] p-4">
              <div className="skeleton mb-3 h-4 w-3/4" />
              <div className="skeleton h-4 w-1/2" />
            </div>
          )}

          {message && !loading && vendors.length === 0 && (
            <div className="absolute bottom-24 left-4 z-[998] max-w-[calc(100%-32px)]">
              <DataCard>
                <p className="text-[13px] text-[var(--is-text-2)]">{message}</p>
                <PillButton type="button" variant="ghost" className="mt-3" onClick={() => setMessage("")}>
                  Dismiss
                </PillButton>
              </DataCard>
            </div>
          )}
        </div>

        {selectedVendor && (
          <div
            className="fixed right-0 bottom-0 left-0 z-[1001] mx-auto max-w-[430px] rounded-t-[24px] border-t-[0.5px] border-[var(--is-border-1)] bg-[var(--is-surface)] px-5 pt-3"
            style={{ paddingBottom: "calc(20px + env(safe-area-inset-bottom))", height: "45vh" }}
          >
            <div className="skeleton mx-auto mb-4 h-1 w-9 rounded-full bg-[var(--is-border-1)]" />
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-[17px] font-semibold tracking-[-0.02em] text-[var(--is-text-1)]">
                  {selectedVendor.name}
                </h2>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <StatusPill kind="ready">Open</StatusPill>
                  {selectedVendor.distance_m != null && (
                    <span className="text-[13px] text-[var(--is-text-3)] [font-variant-numeric:tabular-nums]">
                      {selectedVendor.distance_m < 1000
                        ? `${selectedVendor.distance_m}m`
                        : `${(selectedVendor.distance_m / 1000).toFixed(1)}km`}{" "}
                      away
                    </span>
                  )}
                </div>
                {selectedVendor.businessHours && (
                  <p className="mt-2 text-[12px] text-[var(--is-text-3)]">{selectedVendor.businessHours}</p>
                )}
              </div>
              <button
                type="button"
                aria-label="Close sheet"
                className="flex size-11 items-center justify-center text-[var(--is-text-4)]"
                onClick={() => setSelectedVendor(null)}
              >
                ×
              </button>
            </div>
            <div className="mt-4 max-h-[30%] overflow-y-auto">
              {selectedVendor.matchingItems?.slice(0, 4).map((item, i) => (
                <div key={i} className="flex justify-between border-b-[0.5px] border-[var(--is-border-2)] py-2 text-[13px]">
                  <span className="text-[var(--is-text-2)]">{item.name}</span>
                  <span className="[font-variant-numeric:tabular-nums] text-[var(--is-text-1)]">${item.price.toFixed(2)}</span>
                </div>
              ))}
            </div>
            <div className="mt-4">
              <PillLink href={`/vendor/${selectedVendor.vendorId}`}>See menu</PillLink>
            </div>
          </div>
        )}

        {!selectedVendor && vendors.length > 0 && !loading && (
          <div
            className="fixed right-0 bottom-0 left-0 z-[1000] mx-auto max-h-[40vh] max-w-[430px] overflow-y-auto border-t-[0.5px] border-[var(--is-border-1)] bg-[var(--is-bg)] px-4 py-4"
            style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
          >
            <div className="item-stagger mb-3 flex items-center justify-between">
              <span className="text-[11px] font-semibold tracking-[0.08em] text-[var(--is-text-4)] uppercase">
                {vendors.length} results
              </span>
              <button
                type="button"
                className="text-[13px] font-medium text-[var(--is-blue)]"
                onClick={() => {
                  setVendors([]);
                  setTranscript("");
                  setMessage("");
                  setQueryInput("");
                }}
              >
                Clear
              </button>
            </div>
            {refineChips.length > 0 && (
              <div className="mb-3 flex gap-2 overflow-x-auto pb-1">
                {refineChips.map((label) => (
                  <button
                    key={label}
                    type="button"
                    disabled={loading}
                    onClick={() => handleVoice(label)}
                    className="shrink-0 rounded-[20px] border-[0.5px] border-[var(--is-border-1)] bg-[var(--is-card)] px-3 py-1.5 text-[12px] text-[var(--is-text-2)]"
                  >
                    {label}
                  </button>
                ))}
              </div>
            )}
            <div className="item-stagger space-y-2">
              {vendors.map((v) => (
                <button
                  key={v.vendorId}
                  type="button"
                  onClick={() => onVendorSelect(v)}
                  className="flex w-full min-h-[44px] items-center justify-between rounded-[12px] border-[0.5px] border-[var(--is-border-1)] bg-[var(--is-surface)] px-4 py-3 text-left"
                >
                  <span className="text-[15px] font-medium text-[var(--is-text-1)]">{v.name}</span>
                  <span className="text-[12px] text-[var(--is-text-4)]">→</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {transcript && vendors.length === 0 && !loading && (
          <p className="px-4 py-2 text-center text-[12px] text-[var(--is-text-3)]">Searching: &quot;{transcript}&quot;</p>
        )}
      </div>
    </MobileAppFrame>
  );
}
