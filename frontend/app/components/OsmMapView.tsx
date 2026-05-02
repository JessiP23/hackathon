"use client";

import dynamic from "next/dynamic";
import type { Location, Vendor } from "@/app/shared/types";

const OsmMapInner = dynamic(() => import("./OsmMapInner"), {
  ssr: false,
  loading: () => (
    <div className="min-h-[12rem] w-full animate-pulse rounded-[22px] bg-[var(--infra-tile-1,#1c1c1e)] border border-white/[0.08]" />
  ),
});

type Props = {
  userLocation: Location | null;
  vendors: Vendor[];
  highlightedVendorId: string | null;
  className?: string;
};

/** OpenStreetMap tiles (Leaflet) — real geo, mobile-friendly. */
export default function OsmMapView(props: Props) {
  const hasPoint =
    props.userLocation != null || props.vendors.some((v) => v.location != null);
  if (!hasPoint) return null;
  return <OsmMapInner {...props} />;
}
