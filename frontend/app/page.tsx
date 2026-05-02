"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getUserByPhone } from "./services/api";
import { User } from "./shared/types";
import { MobileAppFrame } from "./components/MobileLayout";
import { setDemoBrowse } from "./lib/demo";

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
      <MobileAppFrame>
        <div className="flex min-h-[70vh] items-center justify-center">
          <div
            className="aspect-[4/5] w-[min(92vw,380px)] max-h-[70vh] animate-pulse rounded-3xl bg-[var(--infra-tile-1)]"
            aria-hidden
          />
        </div>
      </MobileAppFrame>
    );
  }

  const pillPrimary =
    "flex h-14 w-full items-center justify-center rounded-[var(--r-pill)] bg-[var(--infra-accent)] text-[17px] font-semibold text-white shadow-lg transition-transform active:scale-[0.98]";
  const pillSecondary =
    "flex h-14 w-full items-center justify-center rounded-[var(--r-pill)] border border-[var(--infra-ink-4)] bg-[var(--infra-tile-2)] text-[17px] font-semibold text-[var(--infra-ink)] transition-transform active:scale-[0.98]";

  if (user) {
    return (
      <MobileAppFrame>
        <header className="flex h-11 items-center justify-center border-b border-[var(--infra-ink-4)] px-5">
          <span className="text-[17px] font-semibold tracking-[-0.5px]">
            InfraStreet<sup className="ml-0.5 align-super text-[9px] font-semibold text-[var(--infra-accent)]">BETA</sup>
          </span>
        </header>
        <div className="space-y-10 px-6 pb-16 pt-12">
          <div>
            <p className="text-[15px] text-[var(--infra-ink-2)]">Welcome back</p>
            <h1
              className="mt-2 font-semibold tracking-tight text-[var(--infra-ink)]"
              style={{ fontSize: "clamp(32px, 8vw, 40px)", letterSpacing: "-0.45px", lineHeight: 1.08 }}
            >
              {user.name || user.phone}
            </h1>
          </div>

          <div className="space-y-3">
            <Link href="/deals" className={pillPrimary}>
              Flash deals
            </Link>
            <Link href="/search" className={pillSecondary}>
              Find food
            </Link>
            <Link href="/orders" className={`${pillSecondary} border-transparent bg-transparent text-[var(--infra-ink-3)]`}>
              My orders
            </Link>
          </div>

          <button
            type="button"
            onClick={() => {
              localStorage.clear();
              setUser(null);
            }}
            className="w-full py-4 text-[15px] text-[var(--infra-ink-3)] active:text-[var(--infra-ink-2)]"
          >
            Sign out
          </button>
        </div>
      </MobileAppFrame>
    );
  }

  return (
    <MobileAppFrame>
      <div className="flex min-h-[100dvh] flex-col px-6 pb-12 pt-12">
        <div className="flex flex-1 flex-col space-y-12">
          <div className="text-center pt-4">
            <h1
              className="font-semibold leading-none tracking-tight text-[var(--infra-ink)]"
              style={{ fontSize: "clamp(40px, 11vw, 52px)", letterSpacing: "-0.55px" }}
            >
              Infra<span className="text-[var(--infra-accent)]">Street</span>
            </h1>
            <p className="mx-auto mt-5 max-w-[300px] text-[17px] leading-snug text-[var(--infra-ink-2)]">
              Flash deals & stalls near you. Customer PWA — vendors run on Telegram.
            </p>
          </div>

          <div className="space-y-6 rounded-[var(--r-xl)] border border-[var(--infra-ink-4)] bg-[var(--infra-tile-1)] p-6">
            {[
              ["Browse deals", "Swipe nearby flash deals; checkout after you save your number."],
              ["Find stalls", "OpenStreetMap + search — real pins from active vendors."],
              ["Get started", "Optional phone + SMS consent when you want orders & alerts."],
            ].map(([title, sub]) => (
              <div key={title as string}>
                <p className="text-[17px] font-semibold tracking-tight text-[var(--infra-ink)]">{title}</p>
                <p className="mt-1 text-[15px] leading-snug text-[var(--infra-ink-2)]">{sub}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-3 pt-6">
          <Link href="/customer-onboarding" className={pillPrimary}>
            Get started (phone + SMS)
          </Link>
          <Link
            href="/deals"
            className={pillSecondary}
            onClick={() => setDemoBrowse()}
          >
            Browse deals without signing in
          </Link>
          <p className="pt-2 text-center text-[13px] text-[var(--infra-ink-3)]">
            <Link href="/sms-consent" className="text-[var(--infra-blue)] underline underline-offset-2">
              SMS terms & consent
            </Link>
          </p>
        </div>
      </div>
    </MobileAppFrame>
  );
}
