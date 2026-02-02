"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { registerUser } from "@/app/services/api";

export default function CustomerOnboardingPage() {
  const router = useRouter();
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    // Basic validation
    const cleanPhone = phone.replace(/\D/g, "");
    if (cleanPhone.length < 10) {
      setError("Please enter a valid phone number");
      return;
    }

    setLoading(true);
    try {
      const user = await registerUser(phone, "customer");
      localStorage.setItem("infrastreet_phone", phone);
      localStorage.setItem("infrastreet_user", JSON.stringify(user));
      router.push("/search");
    } catch (err) {
      console.error(err);
      setError("Failed to register. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-orange-50 to-white flex flex-col">
      {/* Back button */}
      <div className="p-4">
        <Link href="/" className="text-gray-500 hover:text-black">
          ← Back
        </Link>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center p-6">
        <div className="max-w-md w-full space-y-8">
          <div className="text-center">
            <div className="text-5xl mb-4">📱</div>
            <h1 className="text-2xl font-bold mb-2">Get Started</h1>
            <p className="text-gray-600">
              Enter your phone number to find street food nearby
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">
                Phone Number
              </label>
              <input
                type="tel"
                placeholder="+1 (555) 123-4567"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full border-2 border-gray-200 rounded-xl p-4 text-lg focus:border-black focus:outline-none transition"
                autoFocus
              />
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-600 p-3 rounded-lg text-sm">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-black text-white py-4 rounded-xl font-medium text-lg disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="animate-spin">⏳</span> Setting up...
                </span>
              ) : (
                "Continue"
              )}
            </button>
          </form>

          <p className="text-center text-xs text-gray-500">
            We'll use this to notify you about your orders.
            <br />
            No spam, ever.
          </p>
        </div>
      </div>
    </main>
  );
}