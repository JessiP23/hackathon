"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";

const STORE_KEY = "infrastreet_ref";

/** Persist ?ref= for signup — friends’ referral codes (must be 4–40 chars). */
export function ReferralCapture() {
  const params = useSearchParams();

  useEffect(() => {
    const ref = params.get("ref")?.trim();
    if (!ref || ref.length < 4 || ref.length > 40) return;
    try {
      sessionStorage.setItem(STORE_KEY, ref);
    } catch {
      /* ignore */
    }
  }, [params]);

  return null;
}

export function getStoredReferral(): string | undefined {
  if (typeof window === "undefined") return undefined;
  try {
    const v = sessionStorage.getItem(STORE_KEY)?.trim();
    return v && v.length >= 4 ? v : undefined;
  } catch {
    return undefined;
  }
}
