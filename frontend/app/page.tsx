"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getUserByPhone } from "./services/api";
import { User } from "./shared/types";

const accent = "#E63946";

export default function LandingPage() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    async function loadUser() {
      const phone = localStorage.getItem("infrastreet_phone");
      if (!phone) return;
      setLoading(true);
      try {
        setUser(await getUserByPhone(phone));
      } finally {
        setLoading(false);
      }
    }
    void loadUser();
  }, []);

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-[var(--color-parchment)]">
        <div
          className="w-[min(92vw,380px)] aspect-[4/5] max-h-[70vh] rounded-3xl animate-pulse bg-gradient-to-br from-neutral-200 via-neutral-100 to-neutral-200"
          aria-hidden
        />
      </main>
    );
  }

  const pillBtn =
    "flex h-14 w-full items-center justify-center rounded-full font-semibold text-[17px] tracking-tight transition-transform active:scale-[0.98]";

  if (user) {
    return (
      <main className="min-h-screen bg-[var(--color-parchment)] text-[var(--color-ink)] px-6 pb-12">
        <div className="max-w-md mx-auto pt-16 space-y-10">
          <div>
            <p className="text-[15px] font-normal text-[var(--color-muted)]">Welcome back</p>
            <h1
              className="mt-1 font-semibold tracking-tight text-[var(--color-ink)]"
              style={{ fontSize: "clamp(32px, 8vw, 40px)", letterSpacing: "-0.4px" }}
            >
              {user.name || user.phone}
            </h1>
          </div>

          <div className="space-y-3">
            {user.role === "vendor" ? (
              <>
                <Link
                  href="/vendor-dashboard"
                  className={`${pillBtn} text-white shadow-lg`}
                  style={{ backgroundColor: accent }}
                >
                  Dashboard
                </Link>
                <Link
                  href="/search"
                  className={`${pillBtn} border border-black/[0.08] bg-white text-[var(--color-ink)]`}
                >
                  Browse food
                </Link>
              </>
            ) : (
              <>
                <Link href="/deals" className={`${pillBtn} text-white shadow-lg`} style={{ backgroundColor: accent }}>
                  Hot deals
                </Link>
                <Link
                  href="/search"
                  className={`${pillBtn} border border-black/[0.08] bg-white text-[var(--color-ink)]`}
                >
                  Find food
                </Link>
                <Link
                  href="/orders"
                  className={`${pillBtn} bg-transparent text-[var(--color-muted)] underline-offset-4 hover:underline`}
                >
                  My orders
                </Link>
              </>
            )}
          </div>

          <button
            type="button"
            onClick={() => {
              localStorage.clear();
              setUser(null);
            }}
            className="w-full text-[15px] text-[var(--color-muted)] py-4"
          >
            Sign out
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[var(--color-canvas)] text-[var(--color-ink)]">
      <div className="max-w-md mx-auto px-6 pt-14 pb-12 min-h-screen flex flex-col">
        <div className="flex-1 space-y-12">
          <div className="text-center pt-6">
            <h1
              className="font-semibold tracking-tight leading-none"
              style={{ fontSize: "clamp(40px, 11vw, 52px)", letterSpacing: "-0.5px" }}
            >
              Infra
              <span style={{ color: accent }}>Street</span>
            </h1>
            <p className="text-[17px] text-[var(--color-muted)] mt-4 leading-snug max-w-[280px] mx-auto">
              Find food on your block. Reverent food, zero chrome.
            </p>
          </div>

          <div className="rounded-[28px] border border-black/[0.06] bg-[var(--color-parchment)] p-6 space-y-6 shadow-sm">
            {[
              ["Speak to search", "Say what you want — we match vendors nearby."],
              ["Reserve in one tap", "Pickup code and Stripe checkout — fast."],
              ["Support the street", "Real carts, real menus from Telegram."],
            ].map(([title, sub]) => (
              <div key={title as string}>
                <p className="text-[17px] font-semibold tracking-tight text-[var(--color-ink)]">{title}</p>
                <p className="text-[15px] text-[var(--color-muted)] mt-1 leading-snug">{sub}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-3 pt-4">
          <Link
            href="/customer-onboarding"
            className={`${pillBtn} text-white shadow-md`}
            style={{ backgroundColor: accent }}
          >
            Find food
          </Link>
          <Link
            href="/vendor-onboarding"
            className={`${pillBtn} border-2 border-[var(--color-ink)]/15 bg-transparent text-[var(--color-ink)]`}
          >
            I&apos;m a vendor
          </Link>
          <p className="text-center text-[13px] text-[var(--color-muted)] pt-2">
            <Link href="/sms-consent" className="underline underline-offset-2 hover:text-[var(--color-ink)]">
              SMS terms & consent
            </Link>
          </p>
        </div>
      </div>
    </main>
  );
}
