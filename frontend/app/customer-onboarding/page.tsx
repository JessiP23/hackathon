"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { registerUser } from "@/app/services/api";
import { MobileAppFrame, MobileNav } from "@/app/components/MobileLayout";

export default function CustomerOnboardingPage() {
  const router = useRouter();
  const [phone, setPhone] = useState("");
  const [smsConsent, setSmsConsent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const phoneDigits = phone.replace(/\D/g, "");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (phoneDigits.length < 10) {
      setError("Enter a valid phone number.");
      return;
    }
    if (!smsConsent) {
      setError("Confirm SMS consent to continue.");
      return;
    }
    setLoading(true);
    try {
      const user = await registerUser(phoneDigits, "customer");
      localStorage.setItem("infrastreet_phone", phoneDigits);
      localStorage.setItem("infrastreet_user", JSON.stringify(user));
      router.push("/deals");
    } catch {
      setError("Failed to register. Try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <MobileAppFrame>
      <MobileNav title="Get started" backHref="/" />

      <div className="flex flex-col px-5 pb-24 pt-4">
        <div className="mx-auto w-full max-w-md space-y-8">
          <div>
            <p className="text-[13px] font-semibold uppercase tracking-[0.06em] text-[var(--infra-accent)]">Customers</p>
            <h1
              className="mt-2 font-semibold tracking-tight text-[var(--infra-ink)]"
              style={{ fontSize: "clamp(30px, 8vw, 36px)", letterSpacing: "-0.45px", lineHeight: 1.1 }}
            >
              Phone & SMS only
            </h1>
            <p className="mt-3 text-[17px] leading-snug text-[var(--infra-ink-2)]">
              Orders & pickup codes via text. Optional flash-deal alerts if you opt in later on Deals.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="mb-2 block text-[15px] font-medium text-[var(--infra-ink)]">Mobile number</label>
              <input
                type="tel"
                placeholder="+1 (555) 123-4567"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full rounded-[var(--r-lg)] border border-[var(--infra-ink-4)] bg-[var(--infra-tile-2)] px-4 py-4 text-[17px] text-[var(--infra-ink)] placeholder:text-[var(--infra-ink-3)] outline-none focus:border-[var(--infra-accent)] focus:ring-2 focus:ring-[var(--infra-accent)]/20"
                autoFocus
              />
            </div>

            <label className="flex cursor-pointer items-start gap-3 text-[15px] leading-snug text-[var(--infra-ink-2)]">
              <input
                type="checkbox"
                checked={smsConsent}
                onChange={(e) => setSmsConsent(e.target.checked)}
                className="mt-1 h-4 w-4 shrink-0 rounded border-[var(--infra-ink-4)] bg-[var(--infra-tile-2)] text-[var(--infra-accent)] focus:ring-[var(--infra-accent)]"
              />
              <span>
                I agree to receive SMS about my orders and, if I opt into alerts, nearby flash deals. Reply STOP to
                opt out of promo alerts.{" "}
                <Link href="/sms-consent" className="font-medium text-[var(--infra-blue)] underline underline-offset-2">
                  SMS terms
                </Link>
                .
              </span>
            </label>

            {error && (
              <div className="rounded-[var(--r-lg)] border border-[var(--infra-accent)]/40 bg-[var(--infra-accent)]/10 px-4 py-3 text-[15px] text-[var(--infra-accent)]">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="flex h-14 w-full items-center justify-center rounded-[var(--r-pill)] text-[17px] font-semibold text-white transition-transform disabled:opacity-50 active:scale-[0.98]"
              style={{ backgroundColor: "var(--infra-accent)" }}
            >
              {loading ? "Setting up…" : "Continue to deals"}
            </button>
          </form>

          <p className="text-center text-[13px] text-[var(--infra-ink-3)]">
            Vendors?{" "}
            <Link href="/vendor-onboarding" className="font-medium text-[var(--infra-blue)] underline underline-offset-2">
              Set up your stall
            </Link>
          </p>
        </div>
      </div>
    </MobileAppFrame>
  );
}
