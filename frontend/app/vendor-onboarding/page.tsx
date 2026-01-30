"use client";

import { useState } from "react";
import { createVendor, uploadMenu } from "../services/api";
import { getCurrentLocation } from '@/app/services/location'
import { Vendor } from "../shared/types";

export default function VendorOnboardingPage() {
  const [name, setName] = useState<string>("");
  const [phone, setPhone] = useState<string>("");
  const [menuFile, setMenuFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit() {
    setLoading(true);
    const loc = await getCurrentLocation();

    const vendor: Vendor = await createVendor({
      name,
      phone,
      lat: loc.lat,
      lng: loc.lng,
    });

    if (menuFile) {
      await uploadMenu(vendor.vendorId, menuFile);
    }

    setLoading(false);
    alert("Vendor onboarded!");
  }

  return (
    <main className="p-6 max-w-md mx-auto space-y-4">
      <h2 className="text-xl font-semibold">Vendor Onboarding</h2>

      <input
        className="w-full border rounded p-2"
        placeholder="Business name"
        value={name}
        onChange={(e) => setName(e.target.value)}
      />

      <input
        className="w-full border rounded p-2"
        placeholder="Phone number"
        value={phone}
        onChange={(e) => setPhone(e.target.value)}
      />

      <input
        type="file"
        className="w-full"
        onChange={(e) => setMenuFile(e.target.files?.[0] || null)}
      />

      <button
        onClick={handleSubmit}
        disabled={loading}
        className="w-full bg-black text-white py-2 rounded"
      >
        {loading ? "Submitting..." : "Submit"}
      </button>
    </main>
  );
}
