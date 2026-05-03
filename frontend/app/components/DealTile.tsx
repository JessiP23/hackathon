"use client";

import { useEffect, useState, useCallback, useRef, useMemo, memo, type PointerEvent } from "react";
import { motion, useMotionValue, animate, useTransform, useDragControls } from "framer-motion";
import dynamic from "next/dynamic";
import { Deal, Location, Vendor } from "../shared/types";
import { StatusPill, PillButton } from "./Precision";

const OsmMapView = dynamic(() => import("./OsmMapView"), {
  ssr: false,
  loading: () => <div className="size-full bg-[var(--is-card)] animate-pulse" />,
});

interface Props {
  deal: Deal;
  stackIndex: number;
  onReserve: (deal: Deal) => void;
  onSwipeNext: () => void;
  isTop: boolean;
  /** When true, deals page renders one shared map behind the stack; top map-card hero is transparent. */
  sharedMapLayerActive?: boolean;
  /** Shown on map with pickup pin; optional when geolocation denied. */
  userLocation: Location | null;
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

const DETAILS_DRAG_ARM_PX = 12;

function DealTileInner({
  deal,
  stackIndex,
  onReserve,
  onSwipeNext,
  isTop,
  sharedMapLayerActive = false,
  userLocation,
}: Props) {
  const x = useMotionValue(0);
  const lastTap = useRef<number>(0);
  const dragControls = useDragControls();
  const detailsPtrRef = useRef<{ ev: globalThis.PointerEvent; x: number; y: number } | null>(null);
  const detailsGestureDecidedRef = useRef(false);
  const detailsDragCtxRef = useRef({
    isTop: false,
    releaseStartDetailDrag: (_nativeDown: globalThis.PointerEvent) => {},
  });

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
    const vx = info.velocity.x;

    if (ox > 80 || vx > 550) {
      vibrate(12);
      try {
        localStorage.setItem(`saved_deal_${deal.dealId}`, "1");
      } catch {
        /* ignore */
      }
      animate(x, 0, { type: "tween", duration: 0.28, ease: [0.4, 0, 0.2, 1] });
      return;
    }

    if (ox < -80 || vx < -550) {
      animate(x, -900, { type: "tween", duration: 0.28, ease: [0.4, 0, 0.2, 1] }).then(() => {
        x.set(0);
        onSwipeNext();
      });
      return;
    }

    animate(x, 0, { type: "tween", duration: 0.28, ease: [0.4, 0, 0.2, 1] });
  };

  const z = 30 - stackIndex;
  const scale = 1 - stackIndex * 0.03;
  const rot = useTransform(x, [-200, 200], [-6, 6]);

  const price = deal.dealPrice?.toFixed(0) ?? "—";

  const mapsUrl =
    deal.lat != null && deal.lng != null
      ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${deal.lat},${deal.lng}`)}`
      : null;

  const mapVendors: Vendor[] = useMemo(() => {
    if (deal.lat == null || deal.lng == null) return [];
    return [
      {
        vendorId: deal.dealId,
        name: deal.vendorName ?? "Pickup",
        location: { lat: deal.lat, lng: deal.lng },
      },
    ];
  }, [deal.dealId, deal.lat, deal.lng, deal.vendorName]);

  const showLiveMap = Boolean(!deal.mediaUrl && mapVendors.length > 0 && isTop);
  const passthroughSharedMap = Boolean(
    sharedMapLayerActive && showLiveMap,
  );

  const releaseStartDetailDrag = useCallback(
    (nativeDown: globalThis.PointerEvent) => {
      detailsPtrRef.current = null;
      detailsGestureDecidedRef.current = true;
      dragControls.start(nativeDown);
    },
    [dragControls],
  );

  detailsDragCtxRef.current = { isTop, releaseStartDetailDrag };

  const teardownDetailsWindowListeners = useCallback((onMove: (ev: globalThis.PointerEvent) => void, onEnd: (ev: globalThis.PointerEvent) => void) => {
    window.removeEventListener("pointermove", onMove);
    window.removeEventListener("pointerup", onEnd);
    window.removeEventListener("pointercancel", onEnd);
  }, []);

  const onDetailsPointerDown = useCallback(
    (e: PointerEvent<HTMLDivElement>) => {
      if (!isTop || e.button > 0) return;
      const pointerId = e.pointerId;

      detailsGestureDecidedRef.current = false;
      detailsPtrRef.current = { ev: e.nativeEvent, x: e.clientX, y: e.clientY };

      const onMove = (ev: globalThis.PointerEvent) => {
        if (ev.pointerId !== pointerId) return;
        const start = detailsPtrRef.current;
        const { isTop: top, releaseStartDetailDrag: startDrag } = detailsDragCtxRef.current;
        if (!start || detailsGestureDecidedRef.current || !top) return;

        const dx = ev.clientX - start.x;
        const dy = ev.clientY - start.y;
        if (Math.hypot(dx, dy) < DETAILS_DRAG_ARM_PX) return;

        const absX = Math.abs(dx);
        const absY = Math.abs(dy);

        if (absX >= absY) {
          teardownDetailsWindowListeners(onMove, onEnd);
          startDrag(start.ev);
          return;
        }

        detailsGestureDecidedRef.current = true;
        detailsPtrRef.current = null;
        teardownDetailsWindowListeners(onMove, onEnd);
      };

      const onEnd = (ev: globalThis.PointerEvent) => {
        if (ev.pointerId !== pointerId) return;
        detailsPtrRef.current = null;
        detailsGestureDecidedRef.current = false;
        teardownDetailsWindowListeners(onMove, onEnd);
      };

      window.addEventListener("pointermove", onMove, { passive: true });
      window.addEventListener("pointerup", onEnd);
      window.addEventListener("pointercancel", onEnd);
    },
    [isTop, teardownDetailsWindowListeners],
  );

  return (
    <div
      className="absolute inset-0 flex min-h-0 flex-col overflow-hidden"
      style={{
        zIndex: z,
        scale,
        opacity: stackIndex > 2 ? 0 : 1,
      }}
    >
      <div
        className={`relative h-[min(48vh,420px)] shrink-0 overflow-hidden rounded-b-[24px] ${
          passthroughSharedMap ? "pointer-events-none bg-transparent" : "bg-[var(--is-surface)]"
        }`}
        onClick={passthroughSharedMap ? undefined : handleTapMedia}
      >
        {deal.mediaUrl ? (
          deal.mediaUrl.match(/\.(mp4|webm|mov)$/i) ? (
            <video
              src={deal.mediaUrl}
              autoPlay
              muted
              loop
              playsInline
              className="pointer-events-none size-full object-cover"
              aria-hidden
            />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={deal.mediaUrl}
              alt={deal.itemName || "Deal"}
              className="pointer-events-none size-full object-cover"
            />
          )
        ) : showLiveMap ? (
          passthroughSharedMap ? (
            <div
              className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-[var(--is-surface)]/90 to-transparent"
              aria-hidden
            />
          ) : (
            <div
              className="relative size-full [&_.leaflet-container]:!bg-[var(--is-card)]"
              style={{ pointerEvents: isTop ? "auto" : "none" }}
            >
              <OsmMapView
                userLocation={userLocation}
                vendors={mapVendors}
                highlightedVendorId={deal.dealId}
                className="size-full !min-h-0 rounded-none border-0"
              />
              <div
                className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-[var(--is-surface)]/90 to-transparent"
                aria-hidden
              />
            </div>
          )
        ) : mapVendors.length > 0 && !isTop ? (
          <div
            className="flex size-full flex-col items-center justify-center gap-1 bg-[var(--is-card)] text-[var(--is-text-3)]"
            aria-hidden
          >
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" className="text-[var(--is-purple)]" aria-hidden>
              <path
                d="M12 21s7-4.5 7-10a7 7 0 10-14 0c0 5.5 7 10 7 10z"
                stroke="currentColor"
                strokeWidth="1.5"
              />
              <circle cx="12" cy="11" r="2.5" fill="currentColor" />
            </svg>
            <span className="max-w-[85%] truncate px-3 text-center text-[11px] font-medium">
              {deal.pickupArea ?? deal.vendorName ?? "Pickup"}
            </span>
          </div>
        ) : (
          <div
            className="flex size-full items-center justify-center bg-[var(--is-card)] text-[48px] font-semibold text-[var(--is-text-4)]"
            role="presentation"
          >
            {vendorInitials(deal.vendorName)}
          </div>
        )}
      </div>

      <motion.div
        className="relative flex min-h-0 flex-1 touch-pan-y flex-col overflow-hidden bg-[var(--is-bg)]"
        style={{
          x: isTop ? x : 0,
          rotate: isTop ? rot : 0,
        }}
        drag={isTop ? "x" : false}
        dragControls={dragControls}
        dragListener={false}
        dragConstraints={{ left: -220, right: 220 }}
        dragElastic={0.12}
        onDragEnd={onDragEnd}
        transition={{ type: "tween", duration: 0.28, ease: [0.4, 0, 0.2, 1] }}
      >
        <div
          className="relative min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-y-contain px-5 pt-5"
          style={{
            paddingBottom: "calc(80px + env(safe-area-inset-bottom))",
            WebkitOverflowScrolling: "touch",
          }}
          onPointerDown={onDetailsPointerDown}
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
            {deal.vendorName ?? "Vendor"}
            {deal.pickupArea ? (
              <>
                {" · "}
                <span className="font-medium text-[var(--is-text-1)]">{deal.pickupArea}</span>
              </>
            ) : null}
          </p>
          <p className="mt-1 text-[13px] text-[var(--is-text-3)]">
            <span className="[font-variant-numeric:tabular-nums]">{walkM < 1000 ? `${walkM}m` : `${(walkM / 1000).toFixed(1)}km`}</span>{" "}
            away
            {mapsUrl ? (
              <>
                {" · "}
                <a
                  href={mapsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium text-[var(--is-blue)] underline decoration-[var(--is-blue)] underline-offset-2"
                  onClick={(e) => e.stopPropagation()}
                >
                  Directions
                </a>
              </>
            ) : null}
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
    </div>
  );
}

function dealTilePropsEqual(prev: Props, next: Props) {
  return (
    prev.deal.dealId === next.deal.dealId &&
    prev.deal.mediaUrl === next.deal.mediaUrl &&
    prev.deal.itemName === next.deal.itemName &&
    prev.deal.vendorName === next.deal.vendorName &&
    prev.deal.dealPrice === next.deal.dealPrice &&
    prev.deal.expiresAt === next.deal.expiresAt &&
    prev.deal.lat === next.deal.lat &&
    prev.deal.lng === next.deal.lng &&
    prev.deal.pickupArea === next.deal.pickupArea &&
    prev.deal.distance_m === next.deal.distance_m &&
    prev.deal.distanceMiles === next.deal.distanceMiles &&
    prev.stackIndex === next.stackIndex &&
    prev.isTop === next.isTop &&
    prev.sharedMapLayerActive === next.sharedMapLayerActive &&
    prev.userLocation?.lat === next.userLocation?.lat &&
    prev.userLocation?.lng === next.userLocation?.lng &&
    prev.onReserve === next.onReserve &&
    prev.onSwipeNext === next.onSwipeNext
  );
}

export default memo(DealTileInner, dealTilePropsEqual);
