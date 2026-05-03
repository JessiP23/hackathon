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

function pinIcon(highlighted: boolean): L.DivIcon {
  return L.divIcon({
    className: `is-map-pin${highlighted ? " is-map-pin--hl" : ""}`,
    html: '<div class="is-map-pin-inner"></div>',
    iconSize: [32, 32],
    iconAnchor: [16, 32],
    popupAnchor: [0, -28],
  });
}

type Props = {
  userLocation: Location | null;
  vendors: Vendor[];
  highlightedVendorId: string | null;
  onVendorSelect?: (v: Vendor) => void;
  className?: string;
};

export default function OsmMapInner({
  userLocation,
  vendors,
  highlightedVendorId,
  onVendorSelect,
  className,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layerRef = useRef<L.LayerGroup | null>(null);
  const onVendorSelectRef = useRef(onVendorSelect);
  onVendorSelectRef.current = onVendorSelect;

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

      L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
        attribution: "© OpenStreetMap © CARTO",
        subdomains: "abcd",
        maxZoom: 20,
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
      const mk = L.marker([lat, lng], {
        icon: pinIcon(hl),
        riseOnHover: true,
      });
      mk.bindPopup(`<strong>${escapeHtml(v.name)}</strong>`);
      mk.on("click", () => {
        onVendorSelectRef.current?.(v);
      });
      mk.addTo(lg);
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
      className={`z-0 min-h-[12rem] w-full overflow-hidden rounded-[16px] border-[0.5px] border-[var(--is-border-1)] ${className ?? ""}`}
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
