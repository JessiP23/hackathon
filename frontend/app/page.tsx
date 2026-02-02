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
      <main className="min-h-screen flex items-center justify-center bg-white">
        <div className="w-8 h-8 border-2 border-black border-t-transparent rounded-full animate-spin" />
      </main>
    );
  }

  if (user) {
    return (
      <main className="min-h-screen bg-white p-6">
        <div className="max-w-md mx-auto pt-16 space-y-8">
          <div className="text-center">
            <h1 className="text-3xl font-bold">Hey{user.name ? `, ${user.name}` : ""}!</h1>
            <p className="text-gray-500 mt-1">What are you craving?</p>
          </div>

          <div className="space-y-3">
            {user.role === "vendor" ? (
              <>
                <Link
                  href="/vendor-dashboard"
                  className="block w-full bg-black text-white py-5 rounded-2xl text-center text-lg font-semibold"
                >
                  Open Dashboard
                </Link>
                <Link
                  href="/search"
                  className="block w-full border-2 border-gray-200 py-5 rounded-2xl text-center text-lg font-medium"
                >
                  Browse Food
                </Link>
              </>
            ) : (
              <>
                <Link
                  href="/search"
                  className="block w-full bg-black text-white py-5 rounded-2xl text-center text-lg font-semibold"
                >
                  Find Food
                </Link>
                <Link
                  href="/deals"
                  className="block w-full border-2 border-gray-200 py-5 rounded-2xl text-center text-lg font-medium"
                >
                  View Deals
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
      <div className="max-w-md mx-auto px-6 pt-24 pb-12 space-y-16">
        <div className="text-center space-y-4">
          <h1 className="text-5xl font-black tracking-tight">InfraStreet</h1>
          <p className="text-xl text-gray-500">Street food, one tap away</p>
        </div>

        <div className="space-y-6 text-center">
          <div className="space-y-2">
            <p className="text-2xl font-medium">Speak to search</p>
            <p className="text-gray-500">Just say what you want</p>
          </div>
          <div className="space-y-2">
            <p className="text-2xl font-medium">Order instantly</p>
            <p className="text-gray-500">Get a pickup code in seconds</p>
          </div>
          <div className="space-y-2">
            <p className="text-2xl font-medium">Support local</p>
            <p className="text-gray-500">Discover hidden gems nearby</p>
          </div>
        </div>

        <div className="space-y-3">
          <Link
            href="/customer-onboarding"
            className="block w-full bg-black text-white py-5 rounded-2xl text-center text-lg font-semibold"
          >
            Find Food
          </Link>
          <Link
            href="/vendor-onboarding"
            className="block w-full border-2 border-black py-5 rounded-2xl text-center text-lg font-semibold"
          >
            I'm a Vendor
          </Link>
        </div>
      </div>
    </main>
  );
}