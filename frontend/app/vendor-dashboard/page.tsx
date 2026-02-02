"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  getVendor,
  addMenuItem,
  uploadMenu,
  getVendorOrders,
  updateOrderStatus,
} from "@/app/services/api";
import { Vendor, MenuItem, Order } from "@/app/shared/types";

export default function VendorDashboardPage() {
  const router = useRouter();
  const [vendor, setVendor] = useState<Vendor | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"orders" | "menu">("orders");
  const [showAddItem, setShowAddItem] = useState(false);
  const [itemName, setItemName] = useState("");
  const [itemPrice, setItemPrice] = useState("");
  const [addingItem, setAddingItem] = useState(false);
  const [uploadMsg, setUploadMsg] = useState("");

  useEffect(() => {
    const id = localStorage.getItem("infrastreet_vendor_id");
    if (!id) {
      router.push("/vendor-onboarding");
      return;
    }
    loadData(id);
    const interval = setInterval(() => loadOrders(id), 5000);
    return () => clearInterval(interval);
  }, [router]);

  async function loadData(id: string) {
    try {
      const [v, o] = await Promise.all([getVendor(id), getVendorOrders(id)]);
      setVendor(v);
      setOrders(o);
    } catch {
      router.push("/vendor-onboarding");
    } finally {
      setLoading(false);
    }
  }

  async function loadOrders(id: string) {
    try {
      setOrders(await getVendorOrders(id));
    } catch {}
  }

  async function handleStatus(orderId: string, status: string) {
    await updateOrderStatus(orderId, status);
    if (vendor) loadOrders(vendor.vendorId);
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !vendor) return;
    setUploadMsg("Processing...");
    try {
      const res = await uploadMenu(vendor.vendorId, file);
      setUploadMsg(res.itemsExtracted > 0 ? `Added ${res.itemsExtracted} items` : "No items found");
      setVendor(await getVendor(vendor.vendorId));
    } catch {
      setUploadMsg("Upload failed");
    }
    e.target.value = "";
    setTimeout(() => setUploadMsg(""), 3000);
  }

  async function handleAddItem() {
    if (!vendor || !itemName || !itemPrice) return;
    setAddingItem(true);
    try {
      await addMenuItem(vendor.vendorId, itemName, parseFloat(itemPrice));
      setVendor(await getVendor(vendor.vendorId));
      setShowAddItem(false);
      setItemName("");
      setItemPrice("");
    } catch {}
    setAddingItem(false);
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-neutral-950 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-white border-t-transparent rounded-full animate-spin" />
      </main>
    );
  }

  if (!vendor) return null;

  const pending = orders.filter((o) => o.status === "pending");
  const preparing = orders.filter((o) => o.status === "preparing");

  return (
    <main className="min-h-screen bg-neutral-950 text-white">
      {/* Header */}
      <header className="bg-neutral-900 border-b border-white/10 p-6">
        <div className="max-w-lg mx-auto flex justify-between items-start">
          <div>
            <h1 className="text-xl font-bold">{vendor.name}</h1>
            <p className="text-neutral-500 text-sm">{vendor.phone}</p>
          </div>
          <Link href="/" className="text-neutral-500 hover:text-white text-sm transition-colors">
            Home
          </Link>
        </div>
      </header>

      {/* Tabs */}
      <div className="flex bg-neutral-900 border-b border-white/10 max-w-lg mx-auto">
        <button
          onClick={() => setTab("orders")}
          className={`flex-1 py-4 text-sm font-medium transition-colors ${
            tab === "orders" ? "text-white border-b-2 border-white" : "text-neutral-500"
          }`}
        >
          Orders {pending.length > 0 && (
            <span className="ml-2 bg-red-500 text-white text-xs px-2 py-0.5 rounded-full">{pending.length}</span>
          )}
        </button>
        <button
          onClick={() => setTab("menu")}
          className={`flex-1 py-4 text-sm font-medium transition-colors ${
            tab === "menu" ? "text-white border-b-2 border-white" : "text-neutral-500"
          }`}
        >
          Menu ({vendor.menu?.length || 0})
        </button>
      </div>

      <div className="max-w-lg mx-auto p-4">
        {tab === "orders" && (
          <div className="space-y-4">
            {pending.length === 0 && preparing.length === 0 && (
              <div className="text-center py-16 text-neutral-500">
                <p className="text-lg">No orders yet</p>
                <p className="text-sm mt-1">Orders will appear here</p>
              </div>
            )}

            {pending.map((o) => (
              <div key={o.orderId} className="bg-neutral-900 rounded-2xl p-5 border-l-4 border-yellow-500">
                <div className="flex justify-between mb-3">
                  <span className="text-3xl font-mono font-bold">#{o.pickupCode}</span>
                  <span className="text-xs text-neutral-500">
                    {o.createdAt && new Date(o.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </span>
                </div>
                <div className="space-y-1 mb-4">
                  {o.items?.map((item, i) => (
                    <p key={i} className="text-sm text-neutral-300">{item.quantity}x {item.name}</p>
                  ))}
                </div>
                <div className="flex justify-between items-center">
                  <span className="font-bold text-lg">${o.total?.toFixed(2)}</span>
                  <button
                    onClick={() => handleStatus(o.orderId, "preparing")}
                    className="bg-white text-black px-6 py-2 rounded-full text-sm font-bold"
                  >
                    Accept
                  </button>
                </div>
              </div>
            ))}

            {preparing.map((o) => (
              <div key={o.orderId} className="bg-neutral-900 rounded-2xl p-5 border-l-4 border-blue-500">
                <div className="flex justify-between mb-3">
                  <span className="text-3xl font-mono font-bold">#{o.pickupCode}</span>
                  <span className="text-xs bg-blue-500/20 text-blue-400 px-2 py-1 rounded-full">Preparing</span>
                </div>
                <div className="space-y-1 mb-4">
                  {o.items?.map((item, i) => (
                    <p key={i} className="text-sm text-neutral-300">{item.quantity}x {item.name}</p>
                  ))}
                </div>
                <button
                  onClick={() => handleStatus(o.orderId, "ready")}
                  className="w-full bg-green-600 text-white py-3 rounded-full text-sm font-bold"
                >
                  Mark Ready for Pickup
                </button>
              </div>
            ))}
          </div>
        )}

        {tab === "menu" && (
          <div className="space-y-4">
            {uploadMsg && (
              <div className="bg-blue-500/20 text-blue-400 p-3 rounded-xl text-sm text-center border border-blue-500/30">
                {uploadMsg}
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setShowAddItem(true)}
                className="bg-neutral-900 border border-white/10 border-dashed rounded-2xl p-6 text-center font-medium hover:bg-neutral-800 transition-colors"
              >
                + Add Item
              </button>
              <label className="bg-neutral-900 border border-white/10 border-dashed rounded-2xl p-6 text-center font-medium cursor-pointer hover:bg-neutral-800 transition-colors">
                Upload Menu
                <input type="file" accept="image/*" onChange={handleUpload} className="hidden" />
              </label>
            </div>

            {vendor.menu && vendor.menu.length > 0 ? (
              <div className="bg-neutral-900 rounded-2xl overflow-hidden border border-white/10">
                {vendor.menu.map((item: MenuItem, i) => (
                  <div key={item.itemId} className={`p-4 flex justify-between ${i > 0 ? "border-t border-white/10" : ""}`}>
                    <span className="font-medium">{item.name}</span>
                    <span className="text-green-400 font-bold">${item.price.toFixed(2)}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12 text-neutral-500">
                <p>No menu items yet</p>
                <p className="text-sm mt-1">Add items or upload a menu image</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Add Item Modal */}
      {showAddItem && (
        <div className="fixed inset-0 bg-black/80 flex items-end justify-center z-50">
          <div className="bg-neutral-900 rounded-t-3xl p-6 w-full max-w-md space-y-4 border-t border-white/10">
            <div className="flex justify-between items-center">
              <h3 className="text-xl font-bold">Add Item</h3>
              <button onClick={() => setShowAddItem(false)} className="text-neutral-500 text-2xl hover:text-white">×</button>
            </div>
            <input
              type="text"
              placeholder="Item name"
              value={itemName}
              onChange={(e) => setItemName(e.target.value)}
              className="w-full bg-neutral-800 border border-white/10 rounded-xl p-4 text-lg text-white placeholder-neutral-500 focus:outline-none focus:border-white/30"
              autoFocus
            />
            <input
              type="number"
              step="0.01"
              placeholder="Price"
              value={itemPrice}
              onChange={(e) => setItemPrice(e.target.value)}
              className="w-full bg-neutral-800 border border-white/10 rounded-xl p-4 text-lg text-white placeholder-neutral-500 focus:outline-none focus:border-white/30"
            />
            <button
              onClick={handleAddItem}
              disabled={addingItem || !itemName || !itemPrice}
              className="w-full bg-white text-black py-4 rounded-xl font-bold disabled:opacity-50"
            >
              {addingItem ? "Adding..." : "Add Item"}
            </button>
          </div>
        </div>
      )}
    </main>
  );
}