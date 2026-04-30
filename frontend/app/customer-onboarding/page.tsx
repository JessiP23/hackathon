"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { registerUser } from "@/app/services/api";

const accent = "#E63946";

export default function CustomerOnboardingPage() {
  const router = useRouter();
  const [phone, setPhone] = useState("");
  const [smsConsent, setSmsConsent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    const cleanPhone = phone.replace(/\D/g, "");
    if (cleanPhone.length < 10) {
      setError("Enter a valid phone number");
      return;
    }
    if (!smsConsent) {
      setError("Confirm SMS consent to continue.");
      return;
    }

    setLoading(true);
    try {
      const user = await registerUser(phone, "customer");
      localStorage.setItem("infrastreet_phone", phone);
      localStorage.setItem("infrastreet_user", JSON.stringify(user));
      router.push("/deals");
    } catch {
      setError("Failed to register. Try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-[var(--color-parchment)] text-[var(--color-ink)] flex flex-col">
      <header className="p-5">
        <Link
          href="/"
          className="text-[15px] font-medium text-[var(--color-muted)] hover:text-[var(--color-ink)] transition-colors"
        >
          ← Back
        </Link>
      </header>

      <div className="flex-1 flex flex-col justify-center px-6 pb-24">
        <div className="max-w-md mx-auto w-full space-y-10">
          <div className="text-center">
            <h1
              className="font-semibold tracking-tight text-[var(--color-ink)]"
              style={{ fontSize: "clamp(32px, 8vw, 40px)", letterSpacing: "-0.4px" }}
            >
              Get started
            </h1>
            <p className="text-[17px] text-[var(--color-muted)] mt-3 leading-snug">
              Phone number · SMS for orders & optional deal alerts
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-[15px] font-medium text-[var(--color-ink)] mb-2 tracking-tight">
                Phone
              </label>
              <input
                type="tel"
                placeholder="+1 (555) 123-4567"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full rounded-2xl border border-black/[0.08] bg-white px-5 py-4 text-[17px] text-[var(--color-ink)] placeholder:text-neutral-400 shadow-sm focus:border-[var(--color-accent)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/20 transition-shadow"
                autoFocus
              />
            </div>

            <label className="flex items-start gap-3 cursor-pointer text-[15px] text-[var(--color-muted)] leading-snug">
              <input
                type="checkbox"
                checked={smsConsent}
                onChange={(e) => setSmsConsent(e.target.checked)}
                className="mt-1 h-4 w-4 rounded border-neutral-300 text-[var(--color-accent)] focus:ring-[var(--color-accent)]"
              />
              <span>
                I agree to receive SMS from InfraStreet about my orders and,
                if I enable deal alerts, occasional texts about nearby flash deals.
                Reply STOP to opt out of deal alerts.{" "}
                <Link
                  href="/sms-consent"
                  className="font-medium text-[var(--color-ink)] underline underline-offset-2"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  SMS terms & consent
                </Link>
                .
              </span>
            </label>

            {error && (
              <div
                className="rounded-2xl border px-4 py-3 text-[15px]"
                style={{
                  borderColor: `${accent}40`,
                  backgroundColor: `${accent}12`,
                  color: accent,
                }}
              >
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="flex h-14 w-full items-center justify-center rounded-full text-[17px] font-semibold text-white shadow-md transition-opacity disabled:opacity-50 active:scale-[0.98]"
              style={{ backgroundColor: accent }}
            >
              {loading ? "Setting up…" : "Continue"}
            </button>
          </form>

          <p className="text-center text-[13px] text-[var(--color-muted)]">
            After this you&apos;ll jump straight into deals near you.
          </p>
        </div>
      </div>
    </main>
  );
}
