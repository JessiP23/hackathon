"use client";

import { useState, useEffect } from "react";
import { Deal } from "../shared/types";

interface Props {
  deal: Deal;
  onReserve?: (deal: Deal) => void;
}

function useCountdown(expiresAt: string) {
  const [timeLeft, setTimeLeft] = useState("");

  useEffect(() => {
    function calc() {
      const diff = new Date(expiresAt).getTime() - Date.now();
      if (diff <= 0) { setTimeLeft("Expired"); return; }
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      if (h > 0) setTimeLeft(`${h}h ${m}m`);
      else if (m > 0) setTimeLeft(`${m}m ${s}s`);
      else setTimeLeft(`${s}s`);
    }
    calc();
    const id = setInterval(calc, 1000);
    return () => clearInterval(id);
  }, [expiresAt]);

  return timeLeft;
}

export default function DealCard({ deal, onReserve }: Props) {
  const timeLeft = useCountdown(deal.expiresAt);
  const isExpired = timeLeft === "Expired";
  const discountPct = deal.discountPct
    ? Math.round(deal.discountPct)
    : deal.originalPrice && deal.dealPrice
    ? Math.round(((deal.originalPrice - deal.dealPrice) / deal.originalPrice) * 100)
    : null;
  const savings = deal.originalPrice && deal.dealPrice
    ? (deal.originalPrice - deal.dealPrice).toFixed(2)
    : null;
  const dist = deal.distanceMiles ?? (deal.distance_m ? (deal.distance_m / 1609.34).toFixed(1) : null);
  const trusted = (deal.reliabilityScore ?? 0) >= 90;

  return (
    <div className={`relative rounded-2xl overflow-hidden bg-neutral-900 border border-white/10 ${isExpired ? "opacity-50" : ""}`}>
      {/* Media */}
      {deal.mediaUrl && (
        <div className="w-full h-40 overflow-hidden bg-neutral-800">
          {deal.mediaUrl.match(/\.(mp4|webm|mov)$/i) ? (
            <video src={deal.mediaUrl} autoPlay muted loop playsInline className="w-full h-full object-cover" />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={deal.mediaUrl} alt={deal.itemName} className="w-full h-full object-cover" />
          )}
        </div>
      )}

      {/* Discount badge */}
      {discountPct && (
        <div className="absolute top-3 right-3 bg-red-500 text-white text-xs font-black px-2 py-1 rounded-full">
          -{discountPct}%
        </div>
      )}

      {/* Trusted badge */}
      {trusted && (
        <div className="absolute top-3 left-3 bg-yellow-400 text-black text-xs font-bold px-2 py-1 rounded-full">
          ⭐ Trusted
        </div>
      )}

      <div className="p-4 space-y-2">
        {/* Title + vendor */}
        <div>
          <p className="font-black text-white text-lg leading-tight">{deal.itemName}</p>
          <p className="text-neutral-400 text-sm">{deal.vendorName}</p>
        </div>

        {/* Pricing */}
        <div className="flex items-baseline gap-2">
          <span className="text-green-400 font-black text-2xl">${deal.dealPrice?.toFixed(2)}</span>
          {deal.originalPrice && (
            <span className="text-neutral-500 line-through text-sm">${deal.originalPrice.toFixed(2)}</span>
          )}
          {savings && (
            <span className="text-green-500 text-xs font-semibold">You save ${savings}</span>
          )}
        </div>

        {/* Meta row */}
        <div className="flex items-center gap-3 text-xs text-neutral-400 flex-wrap">
          {dist && <span>📍 {dist} mi away</span>}
          {deal.remainingQuantity !== undefined && (
            <span className={`font-semibold ${deal.remainingQuantity <= 5 ? "text-red-400" : "text-neutral-400"}`}>
              {deal.remainingQuantity} left
            </span>
          )}
          {!isExpired && (
            <span className={`font-semibold ${timeLeft.includes("m") && !timeLeft.includes("h") ? "text-orange-400" : "text-neutral-400"}`}>
              ⏰ {timeLeft}
            </span>
          )}
        </div>

        {/* CTA */}
        {!isExpired && onReserve && (
          <button
            onClick={() => onReserve(deal)}
            className="w-full mt-2 bg-gradient-to-r from-red-500 to-orange-500 text-white py-3 rounded-xl font-bold text-sm active:scale-95 transition-transform"
          >
            Reserve &amp; Pay
          </button>
        )}
      </div>
    </div>
  );
}
