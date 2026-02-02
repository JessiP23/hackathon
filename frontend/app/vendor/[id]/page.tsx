"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { getVendor, placeOrder } from "@/app/services/api";
import { Vendor, MenuItem, OrderItem } from "@/app/shared/types";

export default function VendorMenuPage() {
  const params = useParams();
  const router = useRouter();
  const vendorId = params.id as string;

  const [vendor, setVendor] = useState<Vendor | null>(null);
  const [loading, setLoading] = useState(true);
  const [cart, setCart] = useState<Map<string, OrderItem>>(new Map());
  const [ordering, setOrdering] = useState(false);
  const [showOrderModal, setShowOrderModal] = useState(false);

  useEffect(() => {
    if (vendorId) {
      getVendor(vendorId)
        .then(setVendor)
        .catch(() => router.push("/search"))
        .finally(() => setLoading(false));
    }
  }, [vendorId, router]);

  function addToCart(item: MenuItem) {
    const newCart = new Map(cart);
    const existing = newCart.get(item.itemId);
    if (existing) {
      existing.quantity += 1;
    } else {
      newCart.set(item.itemId, {
        itemId: item.itemId,
        name: item.name,
        quantity: 1,
        price: item.price,
      });
    }
    setCart(newCart);
  }

  function removeFromCart(itemId: string) {
    const newCart = new Map(cart);
    const existing = newCart.get(itemId);
    if (existing && existing.quantity > 1) {
      existing.quantity -= 1;
    } else {
      newCart.delete(itemId);
    }
    setCart(newCart);
  }

  function getCartTotal() {
    let total = 0;
    cart.forEach((item) => {
      total += (item.price || 0) * item.quantity;
    });
    return total;
  }

  async function handlePlaceOrder() {
    if (cart.size === 0 || !vendor) return;

    setOrdering(true);
    try {
      const customerPhone = localStorage.getItem("infrastreet_phone") || "";
      const items = Array.from(cart.values()).map((item) => ({
        itemId: item.itemId,
        quantity: item.quantity,
      }));

      const order = await placeOrder({
        vendorId: vendor.vendorId,
        items,
        customerPhone,
      });

      setShowOrderModal(false);
      setCart(new Map());
      alert(`Order placed! Order ID: ${order.orderId}`);
    } catch (err) {
      alert("Failed to place order. Please try again.");
    } finally {
      setOrdering(false);
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-gray-500">Loading menu...</div>
      </main>
    );
  }

  if (!vendor) {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center p-6">
        <div className="text-4xl mb-4">😕</div>
        <div className="text-gray-600 mb-4">Vendor not found</div>
        <Link href="/search" className="text-blue-600 underline">
          Back to search
        </Link>
      </main>
    );
  }

  const cartItems = Array.from(cart.values());
  const cartTotal = getCartTotal();

  return (
    <main className="min-h-screen pb-24">
      {/* Header */}
      <div className="bg-black text-white p-6">
        <Link href="/search" className="text-sm text-gray-300 mb-2 block">
          ← Back to search
        </Link>
        <h1 className="text-2xl font-bold">{vendor.name}</h1>
        {vendor.businessHours && (
          <p className="text-gray-300 text-sm mt-1">{vendor.businessHours}</p>
        )}
        {vendor.distance_m && (
          <p className="text-gray-400 text-sm">{vendor.distance_m}m away</p>
        )}
      </div>

      {/* Menu */}
      <div className="p-4">
        <h2 className="text-lg font-semibold mb-4">Menu</h2>

        {vendor.menu && vendor.menu.length > 0 ? (
          <div className="space-y-3">
            {vendor.menu.map((item) => {
              const inCart = cart.get(item.itemId);
              return (
                <div
                  key={item.itemId}
                  className="flex justify-between items-center border rounded-lg p-4 bg-white"
                >
                  <div className="flex-1">
                    <div className="font-medium">{item.name}</div>
                    {item.description && (
                      <div className="text-sm text-gray-500">
                        {item.description}
                      </div>
                    )}
                    <div className="text-green-600 font-semibold mt-1">
                      ${item.price.toFixed(2)}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {inCart ? (
                      <>
                        <button
                          onClick={() => removeFromCart(item.itemId)}
                          className="w-8 h-8 rounded-full border border-gray-300 flex items-center justify-center"
                        >
                          -
                        </button>
                        <span className="w-6 text-center font-medium">
                          {inCart.quantity}
                        </span>
                        <button
                          onClick={() => addToCart(item)}
                          className="w-8 h-8 rounded-full bg-black text-white flex items-center justify-center"
                        >
                          +
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={() => addToCart(item)}
                        className="px-4 py-2 bg-black text-white rounded-lg text-sm font-medium"
                      >
                        Add
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-12 text-gray-500">
            <div className="text-4xl mb-2">📋</div>
            <div>Menu coming soon</div>
          </div>
        )}
      </div>

      {/* Cart Footer */}
      {cartItems.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t shadow-lg p-4">
          <button
            onClick={() => setShowOrderModal(true)}
            className="w-full bg-black text-white py-4 rounded-xl font-medium flex items-center justify-between px-6"
          >
            <span>
              View Order ({cartItems.reduce((sum, i) => sum + i.quantity, 0)}{" "}
              items)
            </span>
            <span>${cartTotal.toFixed(2)}</span>
          </button>
        </div>
      )}

      {/* Order Modal */}
      {showOrderModal && (
        <div className="fixed inset-0 bg-black/50 flex items-end justify-center z-50">
          <div className="bg-white rounded-t-2xl w-full max-w-md p-6 space-y-4 animate-slide-up">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-bold">Your Order</h3>
              <button
                onClick={() => setShowOrderModal(false)}
                className="text-gray-500"
              >
                ✕
              </button>
            </div>

            <div className="space-y-2 max-h-60 overflow-y-auto">
              {cartItems.map((item) => (
                <div
                  key={item.itemId}
                  className="flex justify-between items-center py-2 border-b"
                >
                  <div>
                    <span className="font-medium">{item.name}</span>
                    <span className="text-gray-500 ml-2">x{item.quantity}</span>
                  </div>
                  <span>${((item.price || 0) * item.quantity).toFixed(2)}</span>
                </div>
              ))}
            </div>

            <div className="flex justify-between items-center text-lg font-bold pt-2">
              <span>Total</span>
              <span>${cartTotal.toFixed(2)}</span>
            </div>

            <button
              onClick={handlePlaceOrder}
              disabled={ordering}
              className="w-full bg-green-600 text-white py-4 rounded-xl font-medium disabled:opacity-50"
            >
              {ordering ? "Placing order..." : "Place Order"}
            </button>
          </div>
        </div>
      )}
    </main>
  );
}