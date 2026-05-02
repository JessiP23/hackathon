"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { motion, useMotionValue, animate } from "framer-motion";
import { Deal } from "../shared/types";

const ACCENT = "#ff3b30";
const INK = "#1D1D1F";
const CANVAS = "#FFFFFF";
const PARCHMENT = "#F5F5F7";

interface Props {
  deal: Deal;
  stackIndex: number;
  onReserve: (deal: Deal) => void;
  onSwipeNext: () => void;
  isTop: boolean;
}

function formatEndTime(iso: string) {
  try {
    return new Date(iso).toLocaleTimeString(undefined, {
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

export default function DealTile({ deal, stackIndex, onReserve, onSwipeNext, isTop }: Props) {
  const y = useMotionValue(0);
  const lastTap = useRef<number>(0);

  const walkMins = Math.max(
    1,
    Math.round(
      ((deal.distanceMiles ?? (deal.distance_m ? deal.distance_m / 1609.34 : 0.5)) as number) * 18,
    ),
  );

  const expiresAt = deal.expiresAt;
  const [ringProgress, setRingProgress] = useState(1);

  useEffect(() => {
    if (!expiresAt) return;
    const end = new Date(expiresAt).getTime();
    const start = end - 45 * 60 * 1000;
    const total = Math.max(60000, end - start);
    const tick = () => {
      const now = Date.now();
      setRingProgress(Math.max(0, Math.min(1, (end - now) / total)));
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [expiresAt]);

  const vibrate = useCallback((pattern: number | number[]) => {
    try {
      if (typeof navigator !== "undefined" && navigator.vibrate) navigator.vibrate(pattern);
    } catch {
      /* ignore */
    }
  }, []);

  const handleTapMedia = () => {
    const now = Date.now();
    if (now - lastTap.current < 280) {
      vibrate(10);
      try {
        localStorage.setItem(`saved_deal_${deal.dealId}`, "1");
      } catch {
        /* ignore */
      }
      lastTap.current = 0;
    } else {
      lastTap.current = now;
      setTimeout(() => {
        if (lastTap.current === now) vibrate(10);
      }, 300);
    }
  };

  const onDragEnd = (_: unknown, info: { offset: { y: number }; velocity: { y: number } }) => {
    if (!isTop) return;
    const oy = info.offset.y;
    if (oy < -80 || info.velocity.y < -400) {
      animate(y, -900, { type: "spring", stiffness: 300, damping: 30 }).then(() => {
        y.set(0);
        onSwipeNext();
      });
    } else {
      animate(y, 0, { type: "spring", stiffness: 300, damping: 30 });
    }
  };

  const z = 30 - stackIndex;
  const scale = 1 - stackIndex * 0.03;

  return (
    <motion.div
      className="absolute inset-0 overflow-hidden"
      style={{
        zIndex: z,
        color: INK,
        background: CANVAS,
        y: isTop ? y : 0,
        scale,
        opacity: stackIndex > 2 ? 0 : 1,
      }}
      drag={isTop ? "y" : false}
      dragElastic={0.15}
      dragConstraints={{ top: 0, bottom: 0 }}
      onDragEnd={onDragEnd}
    >
      <div className="relative h-full w-full bg-black">
        {deal.mediaUrl ? (
          deal.mediaUrl.match(/\.(mp4|webm|mov)$/i) ? (
            <video
              src={deal.mediaUrl}
              autoPlay
              muted
              loop
              playsInline
              className="h-full w-full object-cover"
              onClick={handleTapMedia}
            />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={deal.mediaUrl}
              alt={deal.itemName}
              className="h-full w-full object-cover"
              onClick={handleTapMedia}
            />
          )
        ) : (
          <div className="h-full w-full animate-pulse bg-gradient-to-br from-neutral-800 via-neutral-700 to-neutral-900" />
        )}

        <div
          className="absolute bottom-0 left-0 right-0 flex flex-col border-t border-black/[0.04] px-6 pb-10 pt-5"
          style={{
            height: "28vh",
            minHeight: 200,
            background: "rgba(245,245,247,0.82)",
            backdropFilter: "blur(20px)",
            WebkitBackdropFilter: "blur(20px)",
          }}
        >
          <div className="flex items-center gap-2 mb-1 min-h-0">
            <div
              className="h-8 w-8 shrink-0 rounded-full bg-neutral-300 bg-cover bg-center border border-black/5"
              style={{
                backgroundImage:
                  deal.mediaUrl && !deal.mediaUrl.match(/\.(mp4|webm)$/i)
                    ? `url(${deal.mediaUrl})`
                    : undefined,
              }}
            />
            <span className="text-[17px] font-semibold tracking-tight text-[#1D1D1F] truncate">
              {deal.vendorName}
            </span>
            <span className="text-[15px] text-neutral-500 font-normal whitespace-nowrap">
              · {walkMins}min walk
            </span>
          </div>

          <h2
            className="font-bold tracking-tight text-[#1D1D1F] mt-1 line-clamp-2"
            style={{ fontSize: "clamp(28px, 8vw, 56px)", letterSpacing: "-0.6px", lineHeight: 1.05 }}
          >
            {deal.itemName}
          </h2>

          <div className="flex items-center gap-3 mt-2 flex-wrap">
            <span className="text-[28px] font-semibold tracking-tight">
              ${deal.dealPrice?.toFixed(2) ?? "—"}
            </span>
            <span className="text-[15px] text-neutral-500">
              {deal.remainingQuantity ?? "—"} left
            </span>
            <div className="ml-auto relative h-11 w-11 shrink-0">
              <svg viewBox="0 0 36 36" className="h-full w-full -rotate-90">
                <circle cx="18" cy="18" r="15" fill="none" stroke={PARCHMENT} strokeWidth="3" />
                <circle
                  cx="18"
                  cy="18"
                  r="15"
                  fill="none"
                  stroke={ACCENT}
                  strokeWidth="2"
                  strokeDasharray={`${ringProgress * 94.2} 94.2`}
                  strokeLinecap="round"
                />
              </svg>
              <span className="absolute inset-0 flex items-center justify-center text-[11px] font-semibold text-neutral-700">
                {expiresAt ? formatEndTime(expiresAt) : ""}
              </span>
            </div>
          </div>

          <button
            type="button"
            className="mt-3 h-14 w-full rounded-full font-semibold text-[17px] text-white shadow-lg active:scale-[0.98] transition-transform"
            style={{ backgroundColor: ACCENT }}
            onClick={() => {
              vibrate(20);
              onReserve(deal);
            }}
          >
            Reserve for ${deal.dealPrice?.toFixed(2) ?? "—"}
          </button>
        </div>
      </div>
    </motion.div>
  );
}
