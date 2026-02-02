"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getUserByPhone } from "./services/api";
import { User } from "./shared/types";

export default function LandingPage() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const phone = localStorage.getItem("infrastreet_phone");
    if (phone) {
      getUserByPhone(phone)
        .then(setUser)
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-black border-t-transparent rounded-full animate-spin" />
      </main>
    );
  }

  if (user) {
    return (
      <main className="min-h-screen bg-white p-6">
        <div className="max-w-md mx-auto pt-12 space-y-8">
          <div>
            <p className="text-gray-400 text-sm">Welcome back</p>
            <h1 className="text-3xl font-black">{user.name || user.phone}</h1>
          </div>

          <div className="space-y-3">
            {user.role === "vendor" ? (
              <>
                <Link href="/vendor-dashboard" className="block w-full bg-black text-white py-4 rounded-2xl text-center font-semibold text-lg">
                  Dashboard
                </Link>
                <Link href="/search" className="block w-full bg-gray-100 py-4 rounded-2xl text-center font-semibold">
                  Browse Food
                </Link>
              </>
            ) : (
              <>
                <Link href="/search" className="block w-full bg-black text-white py-4 rounded-2xl text-center font-semibold text-lg">
                  Find Food
                </Link>
                <Link href="/deals" className="block w-full bg-red-500 text-white py-4 rounded-2xl text-center font-semibold">
                  Hot Deals
                </Link>
                <Link href="/orders" className="block w-full bg-gray-100 py-4 rounded-2xl text-center font-semibold">
                  My Orders
                </Link>
              </>
            )}
          </div>

          <button
            onClick={() => {
              localStorage.clear();
              setUser(null);
            }}
            className="w-full text-gray-400 text-sm py-4"
          >
            Sign out
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-white text-black">
      <div className="max-w-md mx-auto px-6 pt-20 pb-12 space-y-16">
        <div className="text-center">
          <h1 className="text-5xl font-black tracking-tight">InfraStreet</h1>
          <p className="text-xl text-gray-400 mt-3">Street food, one tap away</p>
        </div>

        <div className="space-y-6 text-center">
          <div>
            <p className="text-2xl font-semibold">Speak to search</p>
            <p className="text-gray-400">Just say what you want</p>
          </div>
          <div>
            <p className="text-2xl font-semibold">Order instantly</p>
            <p className="text-gray-400">Get a pickup code in seconds</p>
          </div>
          <div>
            <p className="text-2xl font-semibold">Support local</p>
            <p className="text-gray-400">Discover hidden gems nearby</p>
          </div>
        </div>

        <div className="space-y-3">
          <Link href="/customer-onboarding" className="block w-full bg-black text-white py-4 rounded-2xl text-center font-semibold text-lg">
            Find Food
          </Link>
          <Link href="/vendor-onboarding" className="block w-full border-2 border-black py-4 rounded-2xl text-center font-semibold">
            I'm a Vendor
          </Link>
        </div>
      </div>
    </main>
  );
}