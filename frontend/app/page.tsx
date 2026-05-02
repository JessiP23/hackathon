"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getUserByPhone } from "./services/api";
import { User } from "./shared/types";
import { MobileAppFrame } from "./components/MobileLayout";
import { setDemoBrowse } from "./lib/demo";
import { PillLink, MetricCard } from "./components/Precision";

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
        <main className="page-enter flex min-h-[100dvh] flex-col px-6 pb-12 pt-16">
          <div className="skeleton mb-3 ml-0 h-4 w-48" />
          <div className="skeleton mb-8 h-10 w-full max-w-[320px]" />
          <div className="skeleton h-14 w-full rounded-[12px]" />
        </main>
      </MobileAppFrame>
    );
  }

  if (user) {
    return (
      <MobileAppFrame>
        <header className="flex min-h-[48px] items-center justify-center border-b-[0.5px] border-[var(--is-border-1)] px-5 py-3">
          <span className="text-[15px] font-semibold tracking-[-0.02em] text-[var(--is-text-1)]">
            InfraStreet
            <sup className="ml-0.5 align-super text-[9px] font-semibold text-[var(--is-purple)]">BETA</sup>
          </span>
        </header>
        <main className="page-enter space-y-10 px-6 pb-16 pt-12">
          <div>
            <p className="text-[15px] font-normal tracking-[-0.01em] text-[var(--is-text-2)]">Welcome back</p>
            <h1 className="mt-2 text-[28px] font-bold leading-[1.15] tracking-[-0.04em] text-[var(--is-text-1)]">
              {user.name || user.phone}
            </h1>
          </div>

          <div className="flex flex-col gap-3">
            <PillLink href="/deals">Flash deals</PillLink>
            <PillLink href="/search" variant="ghost">
              Find food
            </PillLink>
            <Link
              href="/orders"
              className="flex min-h-[48px] w-full items-center justify-center rounded-[12px] py-3 text-[15px] font-semibold text-[var(--is-text-3)]"
            >
              My orders
            </Link>
          </div>

          <button
            type="button"
            onClick={() => {
              localStorage.clear();
              setUser(null);
            }}
            className="w-full py-4 text-[15px] text-[var(--is-text-3)]"
          >
            Sign out
          </button>
        </main>
      </MobileAppFrame>
    );
  }

  return (
    <MobileAppFrame>
      <main className="page-enter flex min-h-[100dvh] flex-col px-6 pb-12 pt-16">
        <div className="flex flex-1 flex-col">
          <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--is-text-4)]">
            Street food, one tap away
          </p>
          <h1 className="max-w-[340px] text-[32px] font-bold leading-[1.15] tracking-[-0.04em] text-[var(--is-text-1)]">
            Your neighborhood&apos;s best stalls. Right now.
          </h1>
          <p className="mt-4 max-w-[320px] text-[15px] font-normal leading-snug tracking-[-0.01em] text-[var(--is-text-2)]">
            Flash deals expire. Real vendors. Real food.
          </p>

          <div className="mt-8 flex flex-col gap-3">
            <PillLink href="/onboard">Get started</PillLink>
            <Link
              href="/deals"
              onClick={() => setDemoBrowse()}
              className="flex min-h-[48px] w-full items-center justify-center rounded-[12px] border-[0.5px] border-[var(--is-border-1)] bg-[var(--is-card)] py-[15px] text-[15px] font-semibold tracking-[-0.01em] text-[var(--is-text-2)] active:scale-[0.98] active:opacity-[0.82]"
            >
              See deals near me
            </Link>
          </div>

          <p className="mt-6 text-center text-[11px] text-[var(--is-text-4)]">
            <Link href="/sms-consent" className="text-[var(--is-blue)] underline underline-offset-2">
              SMS terms
            </Link>
          </p>
        </div>

        <div className="mt-8 grid grid-cols-3 gap-3">
          <MetricCard label="Vendors active" value="847" />
          <MetricCard label="Deals today" value="2.4k" valueClassName="text-[var(--is-green)]" />
          <MetricCard label="Avg price" value="$6–18" valueClassName="text-[var(--is-purple)]" />
        </div>
      </main>
    </MobileAppFrame>
  );
}
