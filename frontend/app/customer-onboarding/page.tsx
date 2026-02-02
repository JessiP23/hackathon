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

    const cleanPhone = phone.replace(/\D/g, "");
    if (cleanPhone.length < 10) {
      setError("Enter a valid phone number");
      return;
    }

    setLoading(true);
    try {
      const user = await registerUser(phone, "customer");
      localStorage.setItem("infrastreet_phone", phone);
      localStorage.setItem("infrastreet_user", JSON.stringify(user));
      router.push("/search");
    } catch {
      setError("Failed to register. Try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-neutral-950 text-white flex flex-col">
      <header className="p-4">
        <Link href="/" className="text-neutral-500 hover:text-white transition-colors text-sm font-medium">
          Back
        </Link>
      </header>

      <div className="flex-1 flex flex-col justify-center px-6 pb-20">
        <div className="max-w-md mx-auto w-full space-y-10">
          <div className="text-center">
            <h1 className="text-3xl font-black">Get Started</h1>
            <p className="text-neutral-400 mt-2">Enter your phone to find food nearby</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-neutral-400 mb-2">
                Phone Number
              </label>
              <input
                type="tel"
                placeholder="+1 (555) 123-4567"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 text-lg text-white placeholder-neutral-600 focus:border-white/30 focus:outline-none transition-colors"
                autoFocus
              />
            </div>

            {error && (
              <div className="bg-red-500/10 border border-red-500/20 text-red-400 px-4 py-3 rounded-xl text-sm">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-white text-black py-4 rounded-2xl font-bold text-lg disabled:opacity-50 transition-opacity"
            >
              {loading ? "Setting up..." : "Continue"}
            </button>
          </form>

          <p className="text-center text-xs text-neutral-600">
            We'll notify you about your orders. No spam.
          </p>
        </div>
      </div>
    </main>
  );
}