"use client";

import dynamic from "next/dynamic";
import type { Location, Vendor } from "@/app/shared/types";

const OsmMapInner = dynamic(() => import("./OsmMapInner"), {
  ssr: false,
  loading: () => (
    <div className="skeleton min-h-[12rem] w-full rounded-[16px] border-[0.5px] border-[var(--is-border-1)]" />
  ),
});

type Props = {
  userLocation: Location | null;
  vendors: Vendor[];
  highlightedVendorId: string | null;
  onVendorSelect?: (v: Vendor) => void;
  className?: string;
};

/** OpenStreetMap tiles (Leaflet) — real geo, mobile-friendly. */
export default function OsmMapView(props: Props) {
  const hasPoint =
    props.userLocation != null || props.vendors.some((v) => v.location != null);
  if (!hasPoint) return null;
  return <OsmMapInner {...props} />;
}
