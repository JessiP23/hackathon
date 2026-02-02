"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { getVendor, createDeal } from "@/app/services/api";
import { Vendor, MenuItem } from "@/app/shared/types";

export default function VendorDashboardPage() {
  const router = useRouter();
  const [vendor, setVendor] = useState<Vendor | null>(null);
  const [loading, setLoading] = useState(true);
  const [showDealForm, setShowDealForm] = useState(false);

  // Deal form
  const [dealItem, setDealItem] = useState("");
  const [dealPrice, setDealPrice] = useState("");
  const [dealOriginalPrice, setDealOriginalPrice] = useState("");
  const [dealHours, setDealHours] = useState("2");
  const [dealLoading, setDealLoading] = useState(false);

  useEffect(() => {
    const vendorId = localStorage.getItem("infrastreet_vendor_id");
    if (!vendorId) {
      router.push("/vendor-onboarding");
      return;
    }

    getVendor(vendorId)
      .then(setVendor)
      .catch(() => {
        localStorage.removeItem("infrastreet_vendor_id");
        router.push("/vendor-onboarding");
      })
      .finally(() => setLoading(false));
  }, [router]);

  async function handleCreateDeal() {
    if (!vendor || !dealItem || !dealPrice) return;

    setDealLoading(true);
    try {
      const expiresAt = new Date(
        Date.now() + parseInt(dealHours) * 60 * 60 * 1000
      ).toISOString();

      await createDeal({
        vendorId: vendor.vendorId,
        itemName: dealItem,
        dealPrice: parseFloat(dealPrice),
        originalPrice: dealOriginalPrice ? parseFloat(dealOriginalPrice) : undefined,
        expiresAt,
      });

      setShowDealForm(false);
      setDealItem("");
      setDealPrice("");
      setDealOriginalPrice("");
      alert("🔥 Flash deal created! Nearby customers can now see it.");
    } catch (err) {
      alert("Failed to create deal. Please try again.");
    } finally {
      setDealLoading(false);
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-gray-500">Loading dashboard...</div>
      </main>
    );
  }

  if (!vendor) {
    return null;
  }

  return (
    <main className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-black text-white p-6">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-2xl font-bold">{vendor.name}</h1>
            <p className="text-gray-300 text-sm">{vendor.phone}</p>
          </div>
          <Link href="/" className="text-sm text-gray-300">
            Home
          </Link>
        </div>
      </div>

      <div className="p-4 space-y-6">
        {/* Quick Actions */}
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => setShowDealForm(true)}
            className="bg-red-500 text-white p-4 rounded-xl font-medium flex flex-col items-center gap-2"
          >
            <span className="text-2xl">🔥</span>
            <span>Create Flash Deal</span>
          </button>
          <button className="bg-white border p-4 rounded-xl font-medium flex flex-col items-center gap-2">
            <span className="text-2xl">📋</span>
            <span>Edit Menu</span>
          </button>
        </div>

        {/* Stats */}
        <div className="bg-white rounded-xl p-4">
          <h2 className="font-semibold mb-3">Today's Stats</h2>
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <div className="text-2xl font-bold">0</div>
              <div className="text-xs text-gray-500">Orders</div>
            </div>
            <div>
              <div className="text-2xl font-bold">$0</div>
              <div className="text-xs text-gray-500">Revenue</div>
            </div>
            <div>
              <div className="text-2xl font-bold">0</div>
              <div className="text-xs text-gray-500">Views</div>
            </div>
          </div>
        </div>

        {/* Menu Section */}
        <div className="bg-white rounded-xl p-4">
          <div className="flex justify-between items-center mb-3">
            <h2 className="font-semibold">Your Menu</h2>
            <button className="text-sm text-blue-600">+ Add Item</button>
          </div>

          {vendor.menu && vendor.menu.length > 0 ? (
            <div className="space-y-2">
              {vendor.menu.map((item: MenuItem) => (
                <div
                  key={item.itemId}
                  className="flex justify-between items-center py-2 border-b last:border-0"
                >
                  <div>
                    <div className="font-medium">{item.name}</div>
                    {item.description && (
                      <div className="text-sm text-gray-500">{item.description}</div>
                    )}
                  </div>
                  <div className="font-semibold">${item.price.toFixed(2)}</div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <div className="text-3xl mb-2">📋</div>
              <div className="text-sm">No menu items yet</div>
              <button className="mt-2 text-blue-600 text-sm underline">
                Add your first item
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Flash Deal Modal */}
      {showDealForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-xl font-bold">🔥 Create Flash Deal</h3>
              <button
                onClick={() => setShowDealForm(false)}
                className="text-gray-400 text-xl"
              >
                ✕
              </button>
            </div>

            <p className="text-sm text-gray-600">
              Flash deals are shown to nearby customers immediately
            </p>

            <div>
              <label className="block text-sm font-medium mb-1">Item Name *</label>
              <input
                type="text"
                placeholder="e.g., Taco Combo"
                value={dealItem}
                onChange={(e) => setDealItem(e.target.value)}
                className="w-full border rounded-lg p-3"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium mb-1">
                  Original Price
                </label>
                <input
                  type="number"
                  placeholder="$12.00"
                  value={dealOriginalPrice}
                  onChange={(e) => setDealOriginalPrice(e.target.value)}
                  className="w-full border rounded-lg p-3"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">
                  Deal Price *
                </label>
                <input
                  type="number"
                  placeholder="$8.00"
                  value={dealPrice}
                  onChange={(e) => setDealPrice(e.target.value)}
                  className="w-full border rounded-lg p-3"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Expires in</label>
              <select
                value={dealHours}
                onChange={(e) => setDealHours(e.target.value)}
                className="w-full border rounded-lg p-3"
              >
                <option value="1">1 hour</option>
                <option value="2">2 hours</option>
                <option value="4">4 hours</option>
                <option value="8">8 hours</option>
              </select>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setShowDealForm(false)}
                className="flex-1 border border-gray-300 py-3 rounded-lg font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateDeal}
                disabled={dealLoading || !dealItem || !dealPrice}
                className="flex-1 bg-red-500 text-white py-3 rounded-lg font-medium disabled:opacity-50"
              >
                {dealLoading ? "Creating..." : "Create Deal"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}