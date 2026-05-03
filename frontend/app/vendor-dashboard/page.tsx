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
import OsmMapView from "@/app/components/OsmMapView";
import { Vendor, MenuItem, Order } from "@/app/shared/types";

const accent = "#ff3b30";

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
    } catch {
      /* ignore */
    }
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
    } catch {
      /* ignore */
    }
    setAddingItem(false);
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[var(--infra-black)]">
        <div
          className="aspect-[4/5] max-h-[70vh] w-[min(92vw,380px)] animate-pulse rounded-3xl bg-[var(--infra-tile-1)]"
          aria-hidden
        />
      </main>
    );
  }

  if (!vendor) return null;

  const pending = orders.filter((o) => o.status === "pending");
  const preparing = orders.filter((o) => o.status === "preparing");
  const mapVendors = vendor.location ? [vendor] : [];

  return (
    <main className="mx-auto min-h-screen max-w-[430px] bg-[var(--infra-black)] pb-28 text-[var(--infra-ink)]">
      <header className="border-b border-[var(--infra-ink-4)] bg-[var(--infra-black)] px-5 py-5">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h1
              className="truncate font-semibold tracking-tight text-[var(--infra-ink)]"
              style={{ fontSize: "clamp(22px, 5vw, 26px)", letterSpacing: "-0.3px" }}
            >
              {vendor.name}
            </h1>
            <p className="mt-1 truncate text-[14px] text-[var(--infra-ink-3)]">{vendor.phone}</p>
          </div>
          <Link href="/" className="shrink-0 text-[15px] font-medium text-[var(--infra-blue)] active:opacity-70">
            Home
          </Link>
        </div>
      </header>

      <div className="space-y-4 px-5 pt-5">
        <div>
          <h2 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--infra-accent)]">
            Your stall · OpenStreetMap
          </h2>
          {vendor.location ? (
            <OsmMapView
              userLocation={null}
              vendors={mapVendors}
              highlightedVendorId={vendor.vendorId}
              className="h-52 w-full"
            />
          ) : (
            <div className="rounded-[var(--r-xl)] border border-dashed border-[var(--infra-ink-4)] bg-[var(--infra-tile-1)] px-5 py-10 text-center">
              <p className="text-[15px] leading-snug text-[var(--infra-ink-2)]">
                No coordinates on file. Complete vendor onboarding with location enabled so you appear on customer maps.
              </p>
              <Link
                href="/vendor-onboarding"
                className="mt-4 inline-block text-[15px] font-semibold underline-offset-2 hover:underline"
                style={{ color: accent }}
              >
                Fix location
              </Link>
            </div>
          )}
        </div>
      </div>

      <div className="sticky top-0 z-20 mt-6 flex max-w-[430px] border-y border-[var(--infra-ink-4)] bg-[rgba(0,0,0,0.88)] backdrop-blur-xl backdrop-saturate-180">
        <button
          type="button"
          onClick={() => setTab("orders")}
          className={`flex-1 border-b-2 py-4 text-[14px] font-semibold transition-colors ${
            tab === "orders" ? "text-[var(--infra-ink)]" : "border-transparent text-[var(--infra-ink-3)]"
          }`}
          style={tab === "orders" ? { borderBottomColor: accent } : undefined}
        >
          Orders{" "}
          {pending.length > 0 && (
            <span
              className="ml-2 inline-flex min-w-[22px] justify-center rounded-full px-2 py-0.5 text-[11px] font-bold text-white"
              style={{ backgroundColor: accent }}
            >
              {pending.length}
            </span>
          )}
        </button>
        <button
          type="button"
          onClick={() => setTab("menu")}
          className={`flex-1 border-b-2 py-4 text-[14px] font-semibold transition-colors ${
            tab === "menu" ? "text-[var(--infra-ink)]" : "border-transparent text-[var(--infra-ink-3)]"
          }`}
          style={tab === "menu" ? { borderBottomColor: accent } : undefined}
        >
          Menu ({vendor.menu?.length || 0})
        </button>
      </div>

      <div className="mx-auto max-w-[430px] px-5 py-5">
        {tab === "orders" && (
          <div className="space-y-4">
            {pending.length === 0 && preparing.length === 0 && (
              <div className="rounded-[var(--r-xl)] border border-[var(--infra-ink-4)] bg-[var(--infra-tile-1)] py-16 text-center">
                <p className="text-[17px] font-semibold text-[var(--infra-ink)]">No orders yet</p>
                <p className="mt-2 text-[15px] text-[var(--infra-ink-3)]">Orders will appear here in real time</p>
              </div>
            )}

            {pending.map((o) => (
              <div
                key={o.orderId}
                className="rounded-[var(--r-xl)] border border-[var(--infra-ink-4)] border-l-4 bg-[var(--infra-tile-1)] p-5"
                style={{ borderLeftColor: "#ffd60a" }}
              >
                <div className="mb-3 flex justify-between">
                  <span className="font-mono text-3xl font-bold tracking-tight text-[var(--infra-ink)]">
                    #{o.pickupCode}
                  </span>
                  <span className="text-[12px] text-[var(--infra-ink-3)]">
                    {o.createdAt && new Date(o.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </span>
                </div>
                <div className="mb-4 space-y-1">
                  {o.items?.map((item, i) => (
                    <p key={i} className="text-[14px] text-[var(--infra-ink-2)]">
                      {item.quantity}× {item.name}
                    </p>
                  ))}
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[18px] font-bold text-[var(--infra-ink)]">${o.total?.toFixed(2)}</span>
                  <button
                    type="button"
                    onClick={() => handleStatus(o.orderId, "preparing")}
                    className="rounded-[var(--r-pill)] px-6 py-2.5 text-[14px] font-semibold text-white transition-transform active:scale-[0.98]"
                    style={{ backgroundColor: accent }}
                  >
                    Accept
                  </button>
                </div>
              </div>
            ))}

            {preparing.map((o) => (
              <div
                key={o.orderId}
                className="rounded-[var(--r-xl)] border border-[var(--infra-ink-4)] border-l-4 border-l-[var(--infra-blue)] bg-[var(--infra-tile-1)] p-5"
              >
                <div className="mb-3 flex justify-between">
                  <span className="font-mono text-3xl font-bold tracking-tight text-[var(--infra-ink)]">
                    #{o.pickupCode}
                  </span>
                  <span className="rounded-[var(--r-pill)] bg-[var(--infra-blue)]/15 px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-[var(--infra-blue)]">
                    Preparing
                  </span>
                </div>
                <div className="mb-4 space-y-1">
                  {o.items?.map((item, i) => (
                    <p key={i} className="text-[14px] text-[var(--infra-ink-2)]">
                      {item.quantity}× {item.name}
                    </p>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => handleStatus(o.orderId, "ready")}
                  className="w-full rounded-[var(--r-pill)] bg-[var(--infra-green)] py-3 text-[14px] font-semibold text-[var(--infra-black)] transition-colors hover:opacity-95"
                >
                  Mark ready for pickup
                </button>
              </div>
            ))}
          </div>
        )}

        {tab === "menu" && (
          <div className="space-y-4">
            {uploadMsg && (
              <div className="rounded-xl border border-[var(--infra-ink-4)] bg-[var(--infra-tile-2)] p-3 text-center text-[14px] text-[var(--infra-ink-2)]">
                {uploadMsg}
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setShowAddItem(true)}
                className="rounded-[var(--r-xl)] border border-dashed border-[var(--infra-ink-4)] bg-[var(--infra-tile-1)] p-6 text-center text-[15px] font-semibold text-[var(--infra-ink)] transition-colors active:scale-[0.98]"
              >
                + Add item
              </button>
              <label className="cursor-pointer rounded-[var(--r-xl)] border border-dashed border-[var(--infra-ink-4)] bg-[var(--infra-tile-1)] p-6 text-center text-[15px] font-semibold text-[var(--infra-ink)] transition-colors active:scale-[0.98]">
                Upload menu
                <input type="file" accept="image/*" onChange={handleUpload} className="hidden" />
              </label>
            </div>

            {vendor.menu && vendor.menu.length > 0 ? (
              <div className="overflow-hidden rounded-[var(--r-xl)] border border-[var(--infra-ink-4)] bg-[var(--infra-tile-1)]">
                {vendor.menu.map((item: MenuItem, i) => (
                  <div
                    key={item.itemId}
                    className={`flex items-center justify-between p-4 ${i > 0 ? "border-t border-[var(--infra-ink-4)]" : ""}`}
                  >
                    <span className="font-medium text-[var(--infra-ink)]">{item.name}</span>
                    <span className="tabular-nums font-semibold" style={{ color: accent }}>
                      ${item.price.toFixed(2)}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-[var(--r-xl)] border border-[var(--infra-ink-4)] bg-[var(--infra-tile-1)] py-12 text-center">
                <p className="text-[var(--infra-ink-3)]">No menu items yet</p>
                <p className="mt-1 text-[14px] text-[var(--infra-ink-3)]">Add items or upload a menu photo</p>
              </div>
            )}
          </div>
        )}
      </div>

      {showAddItem && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-[2px]">
          <div className="w-full max-w-[430px] space-y-4 rounded-t-[var(--r-xl)] border border-[var(--infra-ink-4)] bg-[var(--infra-tile-1)] p-6 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="text-[20px] font-semibold tracking-tight text-[var(--infra-ink)]">Add item</h3>
              <button
                type="button"
                onClick={() => setShowAddItem(false)}
                className="text-2xl leading-none text-[var(--infra-ink-3)] hover:text-[var(--infra-ink)]"
                aria-label="Close"
              >
                ×
              </button>
            </div>
            <input
              type="text"
              placeholder="Item name"
              value={itemName}
              onChange={(e) => setItemName(e.target.value)}
              className="w-full rounded-[var(--r-lg)] border border-[var(--infra-ink-4)] bg-[var(--infra-tile-2)] px-5 py-4 text-[17px] text-[var(--infra-ink)] placeholder:text-[var(--infra-ink-3)] focus:border-[var(--infra-accent)] focus:outline-none focus:ring-2 focus:ring-[var(--infra-accent)]/25"
              autoFocus
            />
            <input
              type="number"
              step="0.01"
              placeholder="Price"
              value={itemPrice}
              onChange={(e) => setItemPrice(e.target.value)}
              className="w-full rounded-[var(--r-lg)] border border-[var(--infra-ink-4)] bg-[var(--infra-tile-2)] px-5 py-4 text-[17px] text-[var(--infra-ink)] placeholder:text-[var(--infra-ink-3)] focus:border-[var(--infra-accent)] focus:outline-none focus:ring-2 focus:ring-[var(--infra-accent)]/25"
            />
            <button
              type="button"
              onClick={handleAddItem}
              disabled={addingItem || !itemName || !itemPrice}
              className="w-full rounded-[var(--r-pill)] py-4 text-[16px] font-semibold text-white disabled:opacity-50 active:scale-[0.99]"
              style={{ backgroundColor: accent }}
            >
              {addingItem ? "Adding…" : "Add item"}
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
