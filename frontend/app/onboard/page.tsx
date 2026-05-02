"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { registerUser, notifyOptIn } from "@/app/services/api";
import { getCurrentLocation } from "@/app/services/location";
import { MobileAppFrame, MobileNav } from "@/app/components/MobileLayout";
import { PillButton, DataCard, StatusPill } from "@/app/components/Precision";

type PlaceRow = { label: string; lat: number; lng: number };

export default function OnboardPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [phone, setPhone] = useState("");
  const [smsConsent, setSmsConsent] = useState(false);
  const [neighborhoodQuery, setNeighborhoodQuery] = useState("");
  const [placeSuggestions, setPlaceSuggestions] = useState<PlaceRow[]>([]);
  const [selectedPlace, setSelectedPlace] = useState<PlaceRow | null>(null);
  const [locLoading, setLocLoading] = useState(false);
  const [alertsOptIn, setAlertsOptIn] = useState<boolean | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const phoneDigits = phone.replace(/\D/g, "");
  const progressPct = (step / 3) * 100;

  const searchPlaces = useCallback(async (q: string) => {
    if (!q.trim()) {
      setPlaceSuggestions([]);
      return;
    }
    try {
      const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=5`;
      const res = await fetch(url, { headers: { Accept: "application/json" } });
      if (!res.ok) return;
      const data = (await res.json()) as { display_name?: string; lat?: string; lon?: string }[];
      setPlaceSuggestions(
        data
          .filter((r) => r.display_name && r.lat && r.lon)
          .map((r) => ({
            label: r.display_name!.split(",").slice(0, 3).join(", "),
            lat: parseFloat(r.lat!),
            lng: parseFloat(r.lon!),
          })),
      );
    } catch {
      setPlaceSuggestions([]);
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => {
      void searchPlaces(neighborhoodQuery);
    }, 400);
    return () => clearTimeout(t);
  }, [neighborhoodQuery, searchPlaces]);

  async function useMyLocation() {
    setLocLoading(true);
    setError("");
    try {
      const loc = await getCurrentLocation();
      let label = `${loc.lat.toFixed(3)}, ${loc.lng.toFixed(3)}`;
      try {
        const rev = `https://nominatim.openstreetmap.org/reverse?lat=${loc.lat}&lon=${loc.lng}&format=json`;
        const r = await fetch(rev, { headers: { Accept: "application/json" } });
        if (r.ok) {
          const j = (await r.json()) as { display_name?: string };
          if (j.display_name) label = j.display_name.split(",").slice(0, 3).join(", ");
        }
      } catch {
        /* keep coords */
      }
      setSelectedPlace({ label, lat: loc.lat, lng: loc.lng });
      setNeighborhoodQuery(label);
    } catch {
      setError("Location permission is needed to pin your neighborhood.");
    } finally {
      setLocLoading(false);
    }
  }

  async function finish() {
    setError("");
    if (phoneDigits.length < 10) {
      setError("Enter a valid phone number.");
      return;
    }
    if (!smsConsent) {
      setError("Confirm SMS consent to continue.");
      return;
    }
    if (!selectedPlace) {
      setError("Choose or search a neighborhood.");
      return;
    }
    if (alertsOptIn === null) {
      setError("Pick flash deal alerts or not.");
      return;
    }
    setSubmitting(true);
    try {
      await registerUser(phoneDigits, "customer");
      localStorage.setItem("infrastreet_phone", phoneDigits);
      if (alertsOptIn) {
        try {
          await notifyOptIn({
            lat: selectedPlace.lat,
            lng: selectedPlace.lng,
            radius: 10,
            phone: phoneDigits,
          });
        } catch {
          /* non-fatal */
        }
      }
      router.push("/deals");
    } catch {
      setError("Failed to register. Try again.");
    } finally {
      setSubmitting(false);
    }
  }

  function next() {
    setError("");
    if (step === 1) {
      if (phoneDigits.length < 10) {
        setError("Enter a valid phone number.");
        return;
      }
      if (!smsConsent) {
        setError("Confirm SMS consent.");
        return;
      }
      setStep(2);
      return;
    }
    if (step === 2) {
      if (!selectedPlace) {
        setError("Select a neighborhood.");
        return;
      }
      setStep(3);
    }
  }

  return (
    <MobileAppFrame>
      <div
        className="fixed top-0 right-0 left-0 z-[110] mx-auto h-0.5 max-w-[430px] bg-[var(--is-border-1)]"
        style={{ marginTop: "env(safe-area-inset-top)" }}
      >
        <div
          className="h-full rounded-[1px] bg-[var(--is-purple)] transition-[width] duration-300"
          style={{ width: `${progressPct}%` }}
        />
      </div>
      <MobileNav title="Get started" backHref="/" />

      <main className="page-enter px-5 pt-6 pb-28">
        {step === 1 && (
          <div className="space-y-6">
            <p className="text-[11px] font-semibold tracking-[0.08em] text-[var(--is-text-4)] uppercase">Your number</p>
            <h1 className="text-[17px] font-semibold tracking-[-0.02em] text-[var(--is-text-1)]">
              Where should we send deal alerts?
            </h1>
            <input
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              placeholder="+1 (555) 000-0000"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full rounded-[12px] border-[0.5px] border-[var(--is-border-1)] bg-[var(--is-surface)] px-4 py-[18px] text-[24px] font-semibold tracking-[0.02em] text-[var(--is-text-1)] [font-variant-numeric:tabular-nums] placeholder:text-[var(--is-text-4)] outline-none focus:border-[var(--is-purple)]"
            />
            <label className="flex cursor-pointer items-start gap-3 text-[15px] leading-snug tracking-[-0.01em] text-[var(--is-text-2)]">
              <input
                type="checkbox"
                checked={smsConsent}
                onChange={(e) => setSmsConsent(e.target.checked)}
                className="mt-1 size-4 shrink-0 rounded border-[var(--is-border-1)] bg-[var(--is-surface)]"
              />
              <span>
                I agree to receive SMS about orders and nearby flash deals.{" "}
                <Link href="/sms-consent" className="font-medium text-[var(--is-blue)] underline underline-offset-2">
                  SMS terms
                </Link>
                .
              </span>
            </label>
            {error && <AccentErr>{error}</AccentErr>}
            <PillButton type="button" onClick={next}>
              Continue
            </PillButton>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-6">
            <p className="text-[11px] font-semibold tracking-[0.08em] text-[var(--is-text-4)] uppercase">Your location</p>
            <h1 className="text-[17px] font-semibold tracking-[-0.02em] text-[var(--is-text-1)]">Which neighborhood?</h1>
            <PillButton type="button" variant="ghost" disabled={locLoading} onClick={() => void useMyLocation()}>
              {locLoading ? "Locating…" : "Use my current location"}
            </PillButton>
            <input
              type="search"
              placeholder="Search area…"
              value={neighborhoodQuery}
              onChange={(e) => {
                setNeighborhoodQuery(e.target.value);
                if (!e.target.value) setSelectedPlace(null);
              }}
              className="w-full rounded-[12px] border-[0.5px] border-[var(--is-border-1)] bg-[var(--is-surface)] px-4 py-[18px] text-[17px] font-semibold tracking-[-0.02em] text-[var(--is-text-1)] outline-none focus:border-[var(--is-purple)]"
            />
            {placeSuggestions.length > 0 && (
              <DataCard className="max-h-[220px] overflow-y-auto p-0">
                {placeSuggestions.map((p) => (
                  <button
                    key={p.label + p.lat}
                    type="button"
                    onClick={() => {
                      setSelectedPlace(p);
                      setNeighborhoodQuery(p.label);
                      setPlaceSuggestions([]);
                    }}
                    className="flex min-h-[44px] w-full flex-col items-start border-b-[0.5px] border-[var(--is-border-2)] px-4 py-3 text-left last:border-b-0"
                  >
                    <span className="text-[15px] font-medium text-[var(--is-text-1)]">{p.label}</span>
                  </button>
                ))}
              </DataCard>
            )}
            {selectedPlace && (
              <DataCard>
                <p className="text-[13px] font-medium text-[var(--is-text-2)]">Selected</p>
                <p className="mt-1 text-[15px] text-[var(--is-text-1)]">{selectedPlace.label}</p>
              </DataCard>
            )}
            {error && <AccentErr>{error}</AccentErr>}
            <div className="flex flex-col gap-3">
              <PillButton type="button" onClick={next}>
                Continue
              </PillButton>
              <PillButton type="button" variant="ghost" onClick={() => setStep(1)}>
                Back
              </PillButton>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-6">
            <p className="text-[11px] font-semibold tracking-[0.08em] text-[var(--is-text-4)] uppercase">Stay in the loop</p>
            <h1 className="text-[17px] font-semibold tracking-[-0.02em] text-[var(--is-text-1)]">Flash deal alerts?</h1>
            <button
              type="button"
              onClick={() => setAlertsOptIn(true)}
              className={`w-full rounded-[16px] border-[0.5px] p-4 text-left transition-colors ${
                alertsOptIn === true ? "border-[var(--is-purple)] bg-[var(--is-purple-tint)]" : "border-[var(--is-border-1)] bg-[var(--is-surface)]"
              }`}
            >
              <div className="flex items-center justify-between gap-3">
                <span className="text-[15px] font-medium text-[var(--is-text-1)]">Yes, text me</span>
                {alertsOptIn === true && <StatusPill kind="confirmed">On</StatusPill>}
              </div>
            </button>
            <button
              type="button"
              onClick={() => setAlertsOptIn(false)}
              className={`w-full rounded-[16px] border-[0.5px] p-4 text-left transition-colors ${
                alertsOptIn === false ? "border-[var(--is-purple)] bg-[var(--is-purple-tint)]" : "border-[var(--is-border-1)] bg-[var(--is-surface)]"
              }`}
            >
              <div className="flex items-center justify-between gap-3">
                <span className="text-[15px] font-medium text-[var(--is-text-1)]">No thanks</span>
                {alertsOptIn === false && <StatusPill kind="picked_up">Off</StatusPill>}
              </div>
            </button>
            {error && <AccentErr>{error}</AccentErr>}
            <div className="flex flex-col gap-3">
              <PillButton type="button" disabled={submitting} onClick={() => void finish()}>
                {submitting ? "Saving…" : "Finish"}
              </PillButton>
              <PillButton type="button" variant="ghost" onClick={() => setStep(2)}>
                Back
              </PillButton>
            </div>
          </div>
        )}

        <p className="mt-10 text-center text-[11px] text-[var(--is-text-4)]">Vendors onboard via Telegram — not in this app.</p>
      </main>
    </MobileAppFrame>
  );
}

function AccentErr({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="rounded-r-[12px] border-y border-r border-[0.5px] border-[var(--is-border-1)] bg-[var(--is-card-raised)] py-3 pr-4 pl-4 text-[13px] text-[var(--is-text-2)]"
      style={{ borderLeft: "2px solid var(--is-red)" }}
    >
      {children}
    </div>
  );
}
