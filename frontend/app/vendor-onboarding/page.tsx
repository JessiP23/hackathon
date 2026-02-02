"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { registerUser, createVendor, uploadMenu } from "@/app/services/api";
import { getCurrentLocation } from "@/app/services/location";

export default function VendorOnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Form data
  const [phone, setPhone] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [businessHours, setBusinessHours] = useState("");
  const [menuFile, setMenuFile] = useState<File | null>(null);
  const [locationStatus, setLocationStatus] = useState<"idle" | "getting" | "done" | "error">("idle");
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);

  async function handleGetLocation() {
    setLocationStatus("getting");
    try {
      const loc = await getCurrentLocation();
      setLocation(loc);
      setLocationStatus("done");
    } catch {
      setLocationStatus("error");
    }
  }

  async function handleSubmit() {
    setError("");

    if (!phone || !businessName || !location) {
      setError("Please complete all required fields");
      return;
    }

    setLoading(true);
    try {
      // 1. Register user
      const user = await registerUser(phone, "vendor", businessName);
      localStorage.setItem("infrastreet_phone", phone);
      localStorage.setItem("infrastreet_user", JSON.stringify(user));

      // 2. Create vendor
      const vendor = await createVendor({
        name: businessName,
        phone,
        lat: location.lat,
        lng: location.lng,
        businessHours,
      });
      localStorage.setItem("infrastreet_vendor_id", vendor.vendorId);

      // 3. Upload menu if provided
      if (menuFile) {
        await uploadMenu(vendor.vendorId, menuFile);
      }

      router.push("/vendor-dashboard");
    } catch (err) {
      setError("Failed to complete registration. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen p-6">
      <div className="max-w-md mx-auto space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-2">Vendor Registration</h1>
          <p className="text-gray-600">Step {step} of 3</p>
        </div>

        {/* Progress bar */}
        <div className="flex gap-2">
          {[1, 2, 3].map((s) => (
            <div
              key={s}
              className={`flex-1 h-2 rounded-full ${s <= step ? "bg-black" : "bg-gray-200"}`}
            />
          ))}
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-600 p-3 rounded-lg text-sm">
            {error}
          </div>
        )}

        {/* Step 1: Phone */}
        {step === 1 && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Phone Number *</label>
              <input
                type="tel"
                placeholder="+1 (555) 123-4567"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full border rounded-lg p-3"
              />
              <p className="text-xs text-gray-500 mt-1">
                Customers will reach you here for orders
              </p>
            </div>

            <button
              onClick={() => phone.length >= 10 && setStep(2)}
              disabled={phone.length < 10}
              className="w-full bg-black text-white py-3 rounded-lg font-medium disabled:opacity-50"
            >
              Next
            </button>
          </div>
        )}

        {/* Step 2: Business Info */}
        {step === 2 && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Business Name *</label>
              <input
                type="text"
                placeholder="Maria's Tacos"
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                className="w-full border rounded-lg p-3"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Business Hours</label>
              <input
                type="text"
                placeholder="Mon-Fri 9am-6pm"
                value={businessHours}
                onChange={(e) => setBusinessHours(e.target.value)}
                className="w-full border rounded-lg p-3"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Location *</label>
              {locationStatus === "idle" && (
                <button
                  onClick={handleGetLocation}
                  className="w-full border-2 border-dashed border-gray-300 rounded-lg p-4 text-gray-600 hover:border-black"
                >
                  📍 Use My Current Location
                </button>
              )}
              {locationStatus === "getting" && (
                <div className="w-full border rounded-lg p-4 text-center text-gray-500">
                  Getting location...
                </div>
              )}
              {locationStatus === "done" && location && (
                <div className="w-full border border-green-500 bg-green-50 rounded-lg p-4 text-green-700">
                  ✓ Location set ({location.lat.toFixed(4)}, {location.lng.toFixed(4)})
                </div>
              )}
              {locationStatus === "error" && (
                <button
                  onClick={handleGetLocation}
                  className="w-full border border-red-300 bg-red-50 rounded-lg p-4 text-red-600"
                >
                  Failed to get location. Tap to retry.
                </button>
              )}
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setStep(1)}
                className="flex-1 border border-gray-300 py-3 rounded-lg"
              >
                Back
              </button>
              <button
                onClick={() => businessName && location && setStep(3)}
                disabled={!businessName || !location}
                className="flex-1 bg-black text-white py-3 rounded-lg disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Menu Upload */}
        {step === 3 && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Menu Photo</label>
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                {menuFile ? (
                  <div className="space-y-2">
                    <div className="text-green-600">✓ {menuFile.name}</div>
                    <button
                      onClick={() => setMenuFile(null)}
                      className="text-sm text-gray-500 underline"
                    >
                      Remove
                    </button>
                  </div>
                ) : (
                  <label className="cursor-pointer">
                    <div className="text-4xl mb-2">📸</div>
                    <div className="text-gray-600">Upload menu photo</div>
                    <div className="text-xs text-gray-400 mt-1">
                      We'll extract items automatically
                    </div>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => setMenuFile(e.target.files?.[0] || null)}
                      className="hidden"
                    />
                  </label>
                )}
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Optional - you can add items manually later
              </p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setStep(2)}
                className="flex-1 border border-gray-300 py-3 rounded-lg"
              >
                Back
              </button>
              <button
                onClick={handleSubmit}
                disabled={loading}
                className="flex-1 bg-black text-white py-3 rounded-lg disabled:opacity-50"
              >
                {loading ? "Creating..." : "Complete Setup"}
              </button>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}