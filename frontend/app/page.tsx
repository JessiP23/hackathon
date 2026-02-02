"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getUserByPhone } from "./services/api";
import { User } from "./shared/types";

export default function LandingPage() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check if user is already registered
    const storedPhone = localStorage.getItem("infrastreet_phone");
    if (storedPhone) {
      getUserByPhone(storedPhone)
        .then((u) => setUser(u))
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-gradient-to-b from-orange-50 to-white">
        <div className="animate-pulse text-gray-500">Loading...</div>
      </main>
    );
  }

  // Returning user - show quick actions
  if (user) {
    return (
      <main className="min-h-screen bg-gradient-to-b from-orange-50 to-white p-6">
        <div className="max-w-md mx-auto pt-12 space-y-8">
          <div className="text-center">
            <div className="text-5xl mb-4">🍜</div>
            <h1 className="text-2xl font-bold">Welcome back!</h1>
            <p className="text-gray-600">{user.name || user.phone}</p>
          </div>

          <div className="space-y-3">
            {user.role === "vendor" ? (
              <>
                <Link
                  href="/vendor-dashboard"
                  className="block w-full bg-black text-white py-4 rounded-xl text-center text-lg font-medium"
                >
                  📊 Go to Dashboard
                </Link>
                <Link
                  href="/deals"
                  className="block w-full border-2 border-black py-4 rounded-xl text-center text-lg font-medium"
                >
                  🔥 View Local Deals
                </Link>
              </>
            ) : (
              <>
                <Link
                  href="/search"
                  className="block w-full bg-black text-white py-4 rounded-xl text-center text-lg font-medium"
                >
                  🎤 Find Food Nearby
                </Link>
                <Link
                  href="/deals"
                  className="block w-full border-2 border-black py-4 rounded-xl text-center text-lg font-medium"
                >
                  🔥 Flash Deals
                </Link>
              </>
            )}

            <button
              onClick={() => {
                localStorage.removeItem("infrastreet_phone");
                localStorage.removeItem("infrastreet_user");
                localStorage.removeItem("infrastreet_vendor_id");
                setUser(null);
              }}
              className="block w-full text-gray-500 py-3 text-center text-sm"
            >
              Sign out
            </button>
          </div>
        </div>
      </main>
    );
  }

  // New user - show role selection
  return (
    <main className="min-h-screen bg-gradient-to-b from-orange-50 to-white">
      <div className="max-w-md mx-auto px-6 pt-16 pb-12 space-y-12">
        {/* Hero */}
        <div className="text-center space-y-4">
          <div className="text-6xl">🍜</div>
          <h1 className="text-4xl font-bold tracking-tight">InfraStreet</h1>
          <p className="text-lg text-gray-600">
            Voice-first marketplace for street food
          </p>
        </div>

        {/* Value props */}
        <div className="space-y-3 text-center text-sm text-gray-600">
          <div className="flex items-center justify-center gap-2">
            <span>🎤</span>
            <span>Just talk — find food instantly</span>
          </div>
          <div className="flex items-center justify-center gap-2">
            <span>📍</span>
            <span>Discover hidden gems nearby</span>
          </div>
          <div className="flex items-center justify-center gap-2">
            <span>⚡</span>
            <span>Flash deals from local vendors</span>
          </div>
        </div>

        {/* Role Selection */}
        <div className="space-y-4">
          <Link
            href="/customer-onboarding"
            className="block w-full bg-black text-white py-4 rounded-xl text-center text-lg font-medium hover:bg-gray-800 transition shadow-lg"
          >
            🛒 I'm looking for food
          </Link>

          <Link
            href="/vendor-onboarding"
            className="block w-full border-2 border-black py-4 rounded-xl text-center text-lg font-medium hover:bg-gray-50 transition"
          >
            🏪 I'm a street vendor
          </Link>
        </div>

        {/* Footer */}
        <p className="text-center text-xs text-gray-400">
          Bringing street food online — no app download needed
        </p>
      </div>
    </main>
  );
}