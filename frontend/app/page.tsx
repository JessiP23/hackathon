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
      <main className="min-h-screen bg-neutral-950 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-white border-t-transparent rounded-full animate-spin" />
      </main>
    );
  }

  if (user) {
    return (
      <main className="min-h-screen bg-neutral-950 text-white p-6">
        <div className="max-w-md mx-auto pt-16 space-y-10">
          <div>
            <p className="text-neutral-500 text-sm font-medium">Welcome back</p>
            <h1 className="text-4xl font-black mt-1">{user.name || user.phone}</h1>
          </div>

          <div className="space-y-3">
            {user.role === "vendor" ? (
              <>
                <Link href="/vendor-dashboard" className="block w-full bg-white text-black py-4 rounded-2xl text-center font-bold text-lg">
                  Dashboard
                </Link>
                <Link href="/search" className="block w-full bg-white/10 border border-white/10 text-white py-4 rounded-2xl text-center font-semibold">
                  Browse Food
                </Link>
              </>
            ) : (
              <>
                <Link href="/search" className="block w-full bg-white text-black py-4 rounded-2xl text-center font-bold text-lg">
                  Find Food
                </Link>
                <Link href="/deals" className="block w-full bg-gradient-to-r from-red-500 to-orange-500 text-white py-4 rounded-2xl text-center font-bold">
                  Hot Deals
                </Link>
                <Link href="/orders" className="block w-full bg-white/10 border border-white/10 text-white py-4 rounded-2xl text-center font-semibold">
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
            className="w-full text-neutral-500 text-sm py-4 hover:text-white transition-colors"
          >
            Sign out
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-neutral-950 text-white">
      <div className="max-w-md mx-auto px-6 pt-24 pb-12 min-h-screen flex flex-col">
        <div className="flex-1 space-y-16">
          <div className="text-center">
            <h1 className="text-6xl font-black tracking-tight">
              Infra<span className="text-transparent bg-clip-text bg-gradient-to-r from-red-500 to-orange-500">Street</span>
            </h1>
            <p className="text-xl text-neutral-400 mt-4">Street food, one tap away</p>
          </div>

          <div className="space-y-8">
            <div className="text-center">
              <p className="text-2xl font-bold">Speak to search</p>
              <p className="text-neutral-500 mt-1">Just say what you want</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold">Order instantly</p>
              <p className="text-neutral-500 mt-1">Get a pickup code in seconds</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold">Support local</p>
              <p className="text-neutral-500 mt-1">Discover hidden gems nearby</p>
            </div>
          </div>
        </div>

        <div className="space-y-3 pt-8">
          <Link href="/customer-onboarding" className="block w-full bg-white text-black py-4 rounded-2xl text-center font-bold text-lg">
            Find Food
          </Link>
          <Link href="/vendor-onboarding" className="block w-full border-2 border-white/20 text-white py-4 rounded-2xl text-center font-semibold hover:bg-white/5 transition-colors">
            I'm a Vendor
          </Link>
        </div>
      </div>
    </main>
  );
}