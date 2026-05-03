"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { motion, useMotionValue, animate, useTransform } from "framer-motion";
import { Deal } from "../shared/types";
import { StatusPill, PillButton } from "./Precision";

interface Props {
  deal: Deal;
  stackIndex: number;
  onReserve: (deal: Deal) => void;
  onSwipeNext: () => void;
  isTop: boolean;
}

function formatRemaining(expiresAt: string) {
  const diff = new Date(expiresAt).getTime() - Date.now();
  if (diff <= 0) return "0:00";
  const m = Math.floor(diff / 60000);
  const s = Math.floor((diff % 60000) / 1000);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function vendorInitials(name: string | undefined) {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0]![0]! + parts[1]![0]!).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

export default function DealTile({ deal, stackIndex, onReserve, onSwipeNext, isTop }: Props) {
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const lastTap = useRef<number>(0);

  const walkM =
    deal.distance_m != null
      ? deal.distance_m
      : Math.round(((deal.distanceMiles ?? 0.5) as number) * 1609.34);

  const expiresAt = deal.expiresAt;
  const [rem, setRem] = useState(() => (expiresAt ? formatRemaining(expiresAt) : ""));

  useEffect(() => {
    if (!expiresAt) return;
    const tick = () => setRem(formatRemaining(expiresAt));
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

  const onDragEnd = (_unknown: unknown, info: { offset: { x: number; y: number }; velocity: { x: number; y: number } }) => {
    if (!isTop) return;
    const ox = info.offset.x;
    const oy = info.offset.y;
    const vx = info.velocity.x;
    const vy = info.velocity.y;

    if (ox > 80 && Math.abs(ox) >= Math.abs(oy)) {
      vibrate(12);
      try {
        localStorage.setItem(`saved_deal_${deal.dealId}`, "1");
      } catch {
        /* ignore */
      }
      animate(x, 0, { type: "tween", duration: 0.28, ease: [0.4, 0, 0.2, 1] });
      animate(y, 0, { type: "tween", duration: 0.28, ease: [0.4, 0, 0.2, 1] });
      return;
    }

    if (oy < -80 || vy < -400) {
      animate(y, -900, { type: "tween", duration: 0.28, ease: [0.4, 0, 0.2, 1] }).then(() => {
        y.set(0);
        x.set(0);
        onSwipeNext();
      });
      return;
    }

    animate(x, 0, { type: "tween", duration: 0.28, ease: [0.4, 0, 0.2, 1] });
    animate(y, 0, { type: "tween", duration: 0.28, ease: [0.4, 0, 0.2, 1] });
  };

  const z = 30 - stackIndex;
  const scale = 1 - stackIndex * 0.03;
  const rot = useTransform(x, [-200, 200], [-6, 6]);

  const price = deal.dealPrice?.toFixed(0) ?? "—";

  return (
    <motion.div
      className="absolute inset-0 flex flex-col justify-end overflow-hidden bg-[var(--is-bg)]"
      style={{
        zIndex: z,
        x: isTop ? x : 0,
        y: isTop ? y : 0,
        scale,
        rotate: isTop ? rot : 0,
        opacity: stackIndex > 2 ? 0 : 1,
      }}
      drag={isTop}
      dragConstraints={{ top: 0, right: 200, bottom: 40, left: -200 }}
      dragElastic={0.12}
      onDragEnd={onDragEnd}
      transition={{ type: "tween", duration: 0.28, ease: [0.4, 0, 0.2, 1] }}
    >
      <div
        className="relative shrink-0 overflow-hidden rounded-b-[24px] bg-[var(--is-surface)]"
        style={{ height: "55vh" }}
      >
        {deal.mediaUrl ? (
          deal.mediaUrl.match(/\.(mp4|webm|mov)$/i) ? (
            <video
              src={deal.mediaUrl}
              autoPlay
              muted
              loop
              playsInline
              className="size-full object-cover"
              onClick={handleTapMedia}
            />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={deal.mediaUrl}
              alt={deal.itemName || "Deal"}
              className="size-full object-cover"
              onClick={handleTapMedia}
            />
          )
        ) : (
          <div
            className="flex size-full items-center justify-center bg-[var(--is-card)] text-[48px] font-semibold text-[var(--is-text-4)]"
            onClick={handleTapMedia}
            role="presentation"
          >
            {vendorInitials(deal.vendorName)}
          </div>
        )}
      </div>

      <div
        className="relative px-5 pt-5"
        style={{ paddingBottom: "calc(80px + env(safe-area-inset-bottom))" }}
      >
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <StatusPill kind="flash">Flash</StatusPill>
          <span className="text-[13px] font-[family-name:var(--is-mono)] text-[var(--is-red)] [font-variant-numeric:tabular-nums]">
            {rem} left
          </span>
        </div>

        <div className="mb-3 flex items-start justify-between gap-3">
          <h2 className="max-w-[70%] text-[24px] font-bold leading-[1.15] tracking-[-0.03em] text-[var(--is-text-1)]">
            {deal.itemName}
          </h2>
          <span className="text-[28px] font-bold tracking-[-0.03em] text-[var(--is-text-1)] [font-variant-numeric:tabular-nums]">
            ${price}
          </span>
        </div>

        <p className="text-[15px] tracking-[-0.01em] text-[var(--is-text-2)]">
          {deal.vendorName ?? "Vendor"} ·{" "}
          <span className="[font-variant-numeric:tabular-nums]">{walkM < 1000 ? `${walkM}m` : `${(walkM / 1000).toFixed(1)}km`}</span>{" "}
          away
        </p>

        <div className="mt-3">
          <PillButton
            variant="danger"
            className="mt-3"
            type="button"
            onClick={() => {
              vibrate(20);
              onReserve(deal);
            }}
          >
            Reserve now — ${price}
          </PillButton>
        </div>
      </div>
    </motion.div>
  );
}
