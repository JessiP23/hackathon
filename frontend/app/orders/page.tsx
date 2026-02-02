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

  function statusStyle(s: string) {
    if (s === "ready") return "bg-green-500/20 text-green-400 border-green-500/30";
    if (s === "preparing") return "bg-blue-500/20 text-blue-400 border-blue-500/30";
    return "bg-yellow-500/20 text-yellow-400 border-yellow-500/30";
  }

  return (
    <main className="min-h-screen bg-neutral-950 text-white">
      <header className="sticky top-0 z-20 backdrop-blur-xl bg-neutral-950/80 border-b border-white/5">
        <div className="max-w-lg mx-auto px-5 py-4 flex items-center justify-between">
          <Link href="/search" className="text-neutral-500 hover:text-white transition-colors text-sm font-medium">
            Back
          </Link>
          <span className="font-bold">My Orders</span>
          <div className="w-10" />
        </div>
      </header>

      <div className="max-w-lg mx-auto px-5 py-6 space-y-8">
        {loading && (
          <div className="flex justify-center py-20">
            <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {!loading && orders.length === 0 && (
          <div className="text-center py-20">
            <h2 className="text-2xl font-bold mb-2">No orders yet</h2>
            <p className="text-neutral-500 mb-8">Find something delicious</p>
            <Link href="/search" className="inline-block bg-white text-black px-8 py-3 rounded-xl font-bold">
              Start Searching
            </Link>
          </div>
        )}

        {!loading && orders.length > 0 && (
          <>
            <div className="space-y-3">
              {orders.map((order, index) => (
                <div
                  key={order.orderId}
                  className="bg-white/5 border border-white/10 rounded-2xl p-5 animate-in fade-in slide-in-from-bottom-2 duration-300"
                  style={{ animationDelay: `${index * 50}ms` }}
                >
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <p className="font-bold text-lg">{order.vendorName || "Vendor"}</p>
                      {order.createdAt && (
                        <p className="text-xs text-neutral-500 mt-1">{formatDate(order.createdAt)}</p>
                      )}
                    </div>
                    <span className={`text-xs px-3 py-1 rounded-full font-medium capitalize border ${statusStyle(order.status)}`}>
                      {order.status}
                    </span>
                  </div>

                  <div className="space-y-1 mb-4">
                    {order.items.map((item, i) => (
                      <p key={i} className="text-sm text-neutral-400">
                        {item.quantity}x {item.name}
                      </p>
                    ))}
                  </div>

                  <div className="flex justify-between items-center pt-4 border-t border-white/10">
                    <span className="font-bold text-lg">${order.total?.toFixed(2)}</span>
                    {order.pickupCode && order.status !== "completed" && (
                      <span className="font-mono text-xl font-black bg-white text-black px-4 py-2 rounded-xl">
                        #{order.pickupCode}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {recommendations.length > 0 && (
              <div className="pt-6">
                <h2 className="text-xs text-neutral-500 font-medium uppercase tracking-wider mb-4">
                  Recommended For You
                </h2>
                <div className="space-y-2">
                  {recommendations.slice(0, 5).map((v) => (
                    <Link
                      key={v.vendorId}
                      href={`/vendor/${v.vendorId}`}
                      className="block bg-white/5 border border-white/10 rounded-xl p-4 hover:bg-white/10 transition-colors"
                    >
                      <div className="flex justify-between items-center">
                        <p className="font-semibold">{v.name}</p>
                        <span className="text-neutral-500">→</span>
                      </div>
                      {v.matchingItems && v.matchingItems.length > 0 && (
                        <div className="flex gap-2 mt-3 flex-wrap">
                          {v.matchingItems.slice(0, 2).map((item, i) => (
                            <span key={i} className="text-xs bg-green-500/10 text-green-400 border border-green-500/20 px-2 py-1 rounded-full">
                              {item.name}
                            </span>
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