"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getCustomerOrders, getRecommendations } from "@/app/services/api";
import { Order, Vendor } from "@/app/shared/types";

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [recommendations, setRecommendations] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const phone = localStorage.getItem("infrastreet_phone");
    if (!phone) {
      setLoading(false);
      return;
    }

    Promise.all([getCustomerOrders(phone), getRecommendations(phone)])
      .then(([o, r]) => {
        setOrders(o);
        setRecommendations(r);
      })
      .finally(() => setLoading(false));
  }, []);

  function formatDate(d: string) {
    return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
  }

  function statusColor(s: string) {
    if (s === "ready") return "bg-green-100 text-green-700";
    if (s === "preparing") return "bg-blue-100 text-blue-700";
    return "bg-yellow-100 text-yellow-700";
  }

  return (
    <main className="min-h-screen bg-gray-50">
      <header className="bg-white border-b sticky top-0 z-10 px-4 py-4">
        <div className="max-w-lg mx-auto flex items-center justify-between">
          <Link href="/" className="text-gray-400">Back</Link>
          <h1 className="font-bold">My Orders</h1>
          <div className="w-10" />
        </div>
      </header>

      <div className="max-w-lg mx-auto p-4 space-y-6">
        {loading && (
          <div className="flex justify-center py-20">
            <div className="w-6 h-6 border-2 border-black border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {!loading && orders.length === 0 && (
          <div className="text-center py-16">
            <p className="text-xl font-bold mb-2">No orders yet</p>
            <p className="text-gray-400 mb-6">Find something delicious</p>
            <Link href="/search" className="bg-black text-white px-6 py-3 rounded-xl font-semibold">
              Start Searching
            </Link>
          </div>
        )}

        {!loading && orders.length > 0 && (
          <>
            <div className="space-y-3">
              {orders.map((order) => (
                <div key={order.orderId} className="bg-white rounded-2xl p-4 shadow-sm">
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <p className="font-bold text-lg">{order.vendorName || "Vendor"}</p>
                      {order.createdAt && <p className="text-xs text-gray-400">{formatDate(order.createdAt)}</p>}
                    </div>
                    <span className={`text-xs px-2.5 py-1 rounded-full font-medium capitalize ${statusColor(order.status)}`}>
                      {order.status}
                    </span>
                  </div>

                  <div className="space-y-1 mb-3">
                    {order.items.map((item, i) => (
                      <p key={i} className="text-sm text-gray-600">{item.quantity}x {item.name}</p>
                    ))}
                  </div>

                  <div className="flex justify-between items-center pt-3 border-t border-gray-100">
                    <span className="font-bold">${order.total?.toFixed(2)}</span>
                    {order.pickupCode && order.status !== "completed" && (
                      <span className="font-mono text-lg font-bold bg-black text-white px-3 py-1 rounded-lg">#{order.pickupCode}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {recommendations.length > 0 && (
              <div className="pt-4">
                <h2 className="text-xs text-gray-400 font-medium uppercase tracking-wide mb-3">Recommended For You</h2>
                <div className="space-y-2">
                  {recommendations.slice(0, 5).map((v) => (
                    <Link key={v.vendorId} href={`/vendor/${v.vendorId}`} className="block bg-white rounded-xl p-3 shadow-sm">
                      <div className="flex justify-between items-center">
                        <p className="font-semibold">{v.name}</p>
                      </div>
                      {v.matchingItems && v.matchingItems.length > 0 && (
                        <div className="flex gap-1.5 mt-2 flex-wrap">
                          {v.matchingItems.slice(0, 2).map((item, i) => (
                            <span key={i} className="text-xs bg-green-50 text-green-700 px-2 py-0.5 rounded-full">{item.name}</span>
                          ))}
                        </div>
                      )}
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </main>
  );
}