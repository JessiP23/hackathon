"use client";

import { useEffect, useRef } from "react";
import type { Location, Vendor } from "@/app/shared/types";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

function initialCenter(userLocation: Location | null, vendors: Vendor[]): [number, number] | null {
  if (userLocation) return [userLocation.lat, userLocation.lng];
  const v = vendors.find((x) => x.location);
  if (v?.location) return [v.location.lat, v.location.lng];
  return null;
}

type Props = {
  userLocation: Location | null;
  vendors: Vendor[];
  highlightedVendorId: string | null;
  className?: string;
};

export default function OsmMapInner({
  userLocation,
  vendors,
  highlightedVendorId,
  className,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layerRef = useRef<L.LayerGroup | null>(null);

  useEffect(() => {
    return () => {
      mapRef.current?.remove();
      mapRef.current = null;
      layerRef.current = null;
    };
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const center = initialCenter(userLocation, vendors);
    if (!center) return;

    if (!mapRef.current) {
      const map = L.map(el, {
        zoomControl: true,
        attributionControl: true,
        scrollWheelZoom: true,
      }).setView(center, 14);

      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 19,
      }).addTo(map);

      layerRef.current = L.layerGroup().addTo(map);
      mapRef.current = map;
      requestAnimationFrame(() => {
        map.invalidateSize();
      });
    }

    const map = mapRef.current!;
    const lg = layerRef.current!;
    lg.clearLayers();

    const latlngs: L.LatLngExpression[] = [];

    if (userLocation) {
      latlngs.push([userLocation.lat, userLocation.lng]);
      L.circleMarker([userLocation.lat, userLocation.lng], {
        radius: 8,
        fillColor: "#0a84ff",
        color: "#ffffff",
        weight: 2,
        opacity: 1,
        fillOpacity: 0.95,
      })
        .bindTooltip("You", { permanent: false })
        .addTo(lg);
    }

    vendors.forEach((v) => {
      if (!v.location) return;
      const { lat, lng } = v.location;
      latlngs.push([lat, lng]);
      const hl = highlightedVendorId === v.vendorId;
      L.circleMarker([lat, lng], {
        radius: hl ? 11 : 7,
        fillColor: "#ff3b30",
        color: "#ffffff",
        weight: hl ? 3 : 2,
        opacity: 1,
        fillOpacity: 1,
      })
        .bindPopup(`<strong>${escapeHtml(v.name)}</strong>`)
        .addTo(lg);
    });

    if (latlngs.length === 0) return;

    if (latlngs.length === 1) {
      map.setView(latlngs[0] as L.LatLngTuple, 15);
    } else {
      map.fitBounds(L.latLngBounds(latlngs as L.LatLngTuple[]), {
        padding: [28, 28],
        maxZoom: 16,
      });
    }

    requestAnimationFrame(() => map.invalidateSize());
  }, [userLocation, vendors, highlightedVendorId]);

  return (
    <div
      ref={containerRef}
      className={`z-0 min-h-[12rem] w-full overflow-hidden rounded-[var(--r-lg,22px)] border border-white/[0.08] ${className ?? ""}`}
    />
  );
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
