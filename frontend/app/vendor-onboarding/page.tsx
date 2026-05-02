"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { registerUser, createVendor, uploadMenu } from "@/app/services/api";
import { getCurrentLocation } from "@/app/services/location";
import { MobileAppFrame, MobileNav } from "@/app/components/MobileLayout";

export default function VendorOnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [phone, setPhone] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [businessHours, setBusinessHours] = useState("");
  const [menuFile, setMenuFile] = useState<File | null>(null);
  const [locationStatus, setLocationStatus] = useState<"idle" | "getting" | "done" | "error">("idle");
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);

  const phoneDigits = phone.replace(/\D/g, "");

  async function handleGetLocation() {
    setLocationStatus("getting");
    try {
      const loc = await getCurrentLocation();
      setLocation(loc);
      setLocationStatus("done");
    } catch {
      setLocationStatus("error");
    }
  }

  async function handleSubmit() {
    setError("");
    if (!phoneDigits || phoneDigits.length < 10 || !businessName || !location) {
      setError("Complete phone, business name, and location.");
      return;
    }

    setLoading(true);
    try {
      const user = await registerUser(phoneDigits, "vendor", businessName);
      localStorage.setItem("infrastreet_phone", phoneDigits);
      localStorage.setItem("infrastreet_user", JSON.stringify(user));

      const vendor = await createVendor({
        name: businessName,
        phone: phoneDigits,
        lat: location.lat,
        lng: location.lng,
        businessHours,
      });
      localStorage.setItem("infrastreet_vendor_id", vendor.vendorId);

      if (menuFile) {
        await uploadMenu(vendor.vendorId, menuFile);
      }

      router.push("/vendor-dashboard");
    } catch {
      setError("Something failed — check network and try again.");
    } finally {
      setLoading(false);
    }
  }

  const inputClass =
    "w-full rounded-[var(--r-lg)] border border-[var(--infra-ink-4)] bg-[var(--infra-tile-2)] px-4 py-3.5 text-[17px] text-[var(--infra-ink)] placeholder:text-[var(--infra-ink-3)] outline-none focus:border-[var(--infra-accent)] focus:ring-2 focus:ring-[var(--infra-accent)]/20";

  const btnGhost =
    "flex-1 rounded-[var(--r-lg)] border border-[var(--infra-ink-4)] bg-transparent py-3.5 text-[15px] font-semibold text-[var(--infra-ink)] active:scale-[0.98]";

  const btnPrimary =
    "flex-1 rounded-[var(--r-pill)] bg-[var(--infra-accent)] py-3.5 text-[15px] font-semibold text-white disabled:opacity-40 active:scale-[0.98]";

  return (
    <MobileAppFrame>
      <MobileNav title="Vendor setup" backHref="/" />

      <div className="px-5 pb-28 pt-6">
        <p className="mb-1 text-[13px] font-semibold uppercase tracking-[0.06em] text-[var(--infra-accent)]">
          Demo-ready · ~90s
        </p>
        <p className="mb-6 text-[15px] leading-snug text-[var(--infra-ink-2)]">
          Phone → stall details → optional menu photo. You&apos;ll land on your dashboard.
        </p>

        <div className="mb-8 flex gap-2">
          {[1, 2, 3].map((s) => (
            <div
              key={s}
              className={`h-1 flex-1 rounded-full transition-colors ${s <= step ? "bg-[var(--infra-accent)]" : "bg-[var(--infra-tile-3)]"}`}
            />
          ))}
        </div>

        {error && (
          <div className="mb-5 rounded-[var(--r-lg)] border border-[var(--infra-accent)]/40 bg-[var(--infra-accent)]/10 px-4 py-3 text-[14px] text-[var(--infra-accent)]">
            {error}
          </div>
        )}

        {step === 1 && (
          <div className="space-y-5">
            <div>
              <label className="mb-2 block text-[15px] font-medium text-[var(--infra-ink)]">Mobile number</label>
              <input
                type="tel"
                placeholder="+1 (555) 123-4567"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className={inputClass}
                autoFocus
              />
              <p className="mt-2 text-[13px] text-[var(--infra-ink-3)]">SMS for orders & alerts — same flow as customers.</p>
            </div>
            <button
              type="button"
              disabled={phoneDigits.length < 10}
              className={`${btnPrimary} w-full flex-none`}
              onClick={() => phoneDigits.length >= 10 && setStep(2)}
            >
              Continue
            </button>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-5">
            <div>
              <label className="mb-2 block text-[15px] font-medium text-[var(--infra-ink)]">Business name</label>
              <input
                type="text"
                placeholder="Maria's Tacos"
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                className={inputClass}
              />
            </div>
            <div>
              <label className="mb-2 block text-[15px] font-medium text-[var(--infra-ink)]">Hours (optional)</label>
              <input
                type="text"
                placeholder="Mon–Sat 11am–8pm"
                value={businessHours}
                onChange={(e) => setBusinessHours(e.target.value)}
                className={inputClass}
              />
            </div>
            <div>
              <label className="mb-2 block text-[15px] font-medium text-[var(--infra-ink)]">Stall location</label>
              {locationStatus === "idle" && (
                <button
                  type="button"
                  onClick={handleGetLocation}
                  className="w-full rounded-[var(--r-lg)] border border-dashed border-[var(--infra-ink-4)] bg-[var(--infra-tile-1)] py-5 text-[15px] font-medium text-[var(--infra-ink-2)] active:bg-[var(--infra-tile-2)]"
                >
                  Tap to share current location
                </button>
              )}
              {locationStatus === "getting" && (
                <div className="rounded-[var(--r-lg)] border border-[var(--infra-ink-4)] bg-[var(--infra-tile-1)] py-5 text-center text-[15px] text-[var(--infra-ink-3)]">
                  Getting location…
                </div>
              )}
              {locationStatus === "done" && location && (
                <div className="rounded-[var(--r-lg)] border border-[var(--infra-green)]/35 bg-[var(--infra-green)]/10 px-4 py-4 text-[14px] text-[var(--infra-green)]">
                  Saved · {location.lat.toFixed(4)}, {location.lng.toFixed(4)}
                </div>
              )}
              {locationStatus === "error" && (
                <button
                  type="button"
                  onClick={handleGetLocation}
                  className="w-full rounded-[var(--r-lg)] border border-[var(--infra-accent)]/40 bg-[var(--infra-accent)]/10 py-4 text-[15px] text-[var(--infra-accent)]"
                >
                  Location blocked — tap to retry
                </button>
              )}
            </div>
            <div className="flex gap-3 pt-2">
              <button type="button" className={btnGhost} onClick={() => setStep(1)}>
                Back
              </button>
              <button
                type="button"
                className={btnPrimary}
                disabled={!businessName.trim() || !location}
                onClick={() => businessName.trim() && location && setStep(3)}
              >
                Next
              </button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-5">
            <div className="rounded-[var(--r-xl)] border border-[var(--infra-ink-4)] bg-[var(--infra-tile-1)] p-6 text-center">
              {menuFile ? (
                <div className="space-y-3">
                  <p className="text-[15px] font-medium text-[var(--infra-green)]">✓ {menuFile.name}</p>
                  <button type="button" className="text-[14px] text-[var(--infra-blue)] underline" onClick={() => setMenuFile(null)}>
                    Remove
                  </button>
                </div>
              ) : (
                <label className="cursor-pointer">
                  <div className="text-4xl" aria-hidden>
                    📸
                  </div>
                  <p className="mt-3 text-[16px] font-semibold text-[var(--infra-ink)]">Menu photo</p>
                  <p className="mt-1 text-[13px] text-[var(--infra-ink-3)]">We OCR items — optional now</p>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => setMenuFile(e.target.files?.[0] || null)}
                  />
                </label>
              )}
            </div>
            <div className="flex gap-3">
              <button type="button" className={btnGhost} onClick={() => setStep(2)}>
                Back
              </button>
              <button type="button" className={btnPrimary} disabled={loading} onClick={handleSubmit}>
                {loading ? "Creating…" : "Finish"}
              </button>
            </div>
            <p className="text-center text-[13px] text-[var(--infra-ink-3)]">
              Already registered?{" "}
              <Link href="/vendor-dashboard" className="text-[var(--infra-blue)] underline underline-offset-2">
                Open dashboard
              </Link>
            </p>
          </div>
        )}
      </div>
    </MobileAppFrame>
  );
}
