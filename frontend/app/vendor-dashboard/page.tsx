"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { getVendor, createDeal, addMenuItem, uploadMenu } from "@/app/services/api";
import { Vendor, MenuItem } from "@/app/shared/types";

export default function VendorDashboardPage() {
  const router = useRouter();
  const [vendor, setVendor] = useState<Vendor | null>(null);
  const [loading, setLoading] = useState(true);
  const [showDealForm, setShowDealForm] = useState(false);
  const [showAddItem, setShowAddItem] = useState(false);
  const [uploadMsg, setUploadMsg] = useState("");

  // Deal form
  const [dealItem, setDealItem] = useState("");
  const [dealPrice, setDealPrice] = useState("");
  const [dealOriginalPrice, setDealOriginalPrice] = useState("");
  const [dealHours, setDealHours] = useState("2");
  const [dealLoading, setDealLoading] = useState(false);

  // Add item form
  const [itemName, setItemName] = useState("");
  const [itemPrice, setItemPrice] = useState("");
  const [itemDesc, setItemDesc] = useState("");
  const [addingItem, setAddingItem] = useState(false);

  async function loadVendor(id: string) {
    try {
      const v = await getVendor(id);
      setVendor(v);
    } catch {
      localStorage.removeItem("infrastreet_vendor_id");
      router.push("/vendor-onboarding");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const vendorId = localStorage.getItem("infrastreet_vendor_id");
    if (!vendorId) {
      router.push("/vendor-onboarding");
      return;
    }
    loadVendor(vendorId);
  }, [router]);

  async function handleCreateDeal() {
    if (!vendor || !dealItem || !dealPrice) return;
    setDealLoading(true);
    try {
      const expiresAt = new Date(Date.now() + parseInt(dealHours) * 3600000).toISOString();
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
      alert("🔥 Flash deal created!");
    } catch {
      alert("Failed to create deal");
    } finally {
      setDealLoading(false);
    }
  }

  async function handleAddItem() {
    if (!vendor || !itemName || !itemPrice) return;
    setAddingItem(true);
    try {
      await addMenuItem(vendor.vendorId, itemName, parseFloat(itemPrice), itemDesc);
      await loadVendor(vendor.vendorId);
      setShowAddItem(false);
      setItemName("");
      setItemPrice("");
      setItemDesc("");
    } catch {
      alert("Failed to add item");
    } finally {
      setAddingItem(false);
    }
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !vendor) return;
    setUploadMsg("Processing...");
    try {
      const res = await uploadMenu(vendor.vendorId, file);
      if (res.itemsExtracted && res.itemsExtracted > 0) {
        setUploadMsg(`✓ Extracted ${res.itemsExtracted} items`);
        await loadVendor(vendor.vendorId);
      } else {
        setUploadMsg("No items found. Add manually.");
      }
    } catch {
      setUploadMsg("Upload failed");
    }
    e.target.value = "";
    setTimeout(() => setUploadMsg(""), 4000);
  }

  if (loading) {
    return <main className="min-h-screen flex items-center justify-center"><div className="animate-pulse">Loading...</div></main>;
  }

  if (!vendor) return null;

  return (
    <main className="min-h-screen bg-gray-50 text-black">
      <div className="bg-black text-white p-6">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-2xl font-bold">{vendor.name}</h1>
            <p className="text-gray-300 text-sm">{vendor.phone}</p>
          </div>
          <Link href="/" className="text-sm text-gray-300">Home</Link>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {uploadMsg && <div className="bg-blue-50 border border-blue-200 p-3 rounded-lg text-sm">{uploadMsg}</div>}

        <div className="grid grid-cols-2 gap-3">
          <button onClick={() => setShowDealForm(true)} className="bg-red-500 text-white p-4 rounded-xl font-medium">
            🔥 Flash Deal
          </button>
          <label className="bg-white border-2 border-dashed p-4 rounded-xl font-medium text-center cursor-pointer">
            📷 Upload Menu
            <input type="file" accept="image/*" onChange={handleUpload} className="hidden" />
          </label>
        </div>

        <div className="bg-white rounded-xl p-4">
          <div className="flex justify-between items-center mb-3">
            <h2 className="font-semibold">Your Menu</h2>
            <button onClick={() => setShowAddItem(true)} className="text-sm text-blue-600">+ Add Item</button>
          </div>

          {vendor.menu && vendor.menu.length > 0 ? (
            <div className="space-y-2">
              {vendor.menu.map((item: MenuItem) => (
                <div key={item.itemId} className="flex justify-between py-2 border-b last:border-0">
                  <div>
                    <div className="font-medium">{item.name}</div>
                    {item.description && <div className="text-sm text-gray-500">{item.description}</div>}
                  </div>
                  <div className="font-semibold">${item.price.toFixed(2)}</div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <div className="text-3xl mb-2">📋</div>
              <div className="text-sm">No menu items</div>
            </div>
          )}
        </div>
      </div>

      {/* Add Item Modal */}
      {showAddItem && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md space-y-4">
            <div className="flex justify-between"><h3 className="text-xl font-bold">Add Item</h3><button onClick={() => setShowAddItem(false)} className="text-gray-400 text-xl">×</button></div>
            <input type="text" placeholder="Item name" value={itemName} onChange={e => setItemName(e.target.value)} className="w-full border rounded-lg p-3" />
            <input type="number" step="0.01" placeholder="Price" value={itemPrice} onChange={e => setItemPrice(e.target.value)} className="w-full border rounded-lg p-3" />
            <input type="text" placeholder="Description (optional)" value={itemDesc} onChange={e => setItemDesc(e.target.value)} className="w-full border rounded-lg p-3" />
            <div className="flex gap-3">
              <button onClick={() => setShowAddItem(false)} className="flex-1 border py-3 rounded-lg">Cancel</button>
              <button onClick={handleAddItem} disabled={addingItem || !itemName || !itemPrice} className="flex-1 bg-black text-white py-3 rounded-lg disabled:opacity-50">{addingItem ? "Adding..." : "Add"}</button>
            </div>
          </div>
        </div>
      )}

      {/* Deal Modal */}
      {showDealForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md space-y-4">
            <div className="flex justify-between"><h3 className="text-xl font-bold">🔥 Flash Deal</h3><button onClick={() => setShowDealForm(false)} className="text-gray-400 text-xl">×</button></div>
            <input type="text" placeholder="Item name" value={dealItem} onChange={e => setDealItem(e.target.value)} className="w-full border rounded-lg p-3" />
            <div className="grid grid-cols-2 gap-3">
              <input type="number" placeholder="Original $" value={dealOriginalPrice} onChange={e => setDealOriginalPrice(e.target.value)} className="border rounded-lg p-3" />
              <input type="number" placeholder="Deal $" value={dealPrice} onChange={e => setDealPrice(e.target.value)} className="border rounded-lg p-3" />
            </div>
            <select value={dealHours} onChange={e => setDealHours(e.target.value)} className="w-full border rounded-lg p-3">
              <option value="1">1 hour</option><option value="2">2 hours</option><option value="4">4 hours</option>
            </select>
            <div className="flex gap-3">
              <button onClick={() => setShowDealForm(false)} className="flex-1 border py-3 rounded-lg">Cancel</button>
              <button onClick={handleCreateDeal} disabled={dealLoading || !dealItem || !dealPrice} className="flex-1 bg-red-500 text-white py-3 rounded-lg disabled:opacity-50">{dealLoading ? "..." : "Create"}</button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}