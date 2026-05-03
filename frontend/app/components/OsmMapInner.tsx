"use client";

import { useEffect, useMemo, useRef } from "react";
import type { Location, Vendor } from "@/app/shared/types";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

function structuralKey(userLocation: Location | null, vendors: Vendor[]): string {
  const u =
    userLocation != null ? `u:${userLocation.lat.toFixed(5)},${userLocation.lng.toFixed(5)}` : "u:none";
  const vs = [...vendors]
    .filter((v) => v.location)
    .map((v) => `${v.vendorId}:${v.location!.lat.toFixed(5)},${v.location!.lng.toFixed(5)}`)
    .sort()
    .join(";");
  return `${u}|${vs}`;
}

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

function mapAlive(m: L.Map | null): m is L.Map {
  if (!m) return false;
  try {
    const c = m.getContainer();
    return Boolean(c?.isConnected);
  } catch {
    return false;
  }
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
  const markersByVendorRef = useRef<Map<string, L.Marker>>(new Map());
  const structuralKeyRef = useRef<string>("");
  const onVendorSelectRef = useRef(onVendorSelect);
  onVendorSelectRef.current = onVendorSelect;

  const vendorsStructuralKey = useMemo(() => structuralKey(userLocation, vendors), [userLocation, vendors]);

  useEffect(() => {
    return () => {
      try {
        mapRef.current?.remove();
      } catch {
        /* map already removed */
      }
      mapRef.current = null;
      layerRef.current = null;
      markersByVendorRef.current.clear();
      structuralKeyRef.current = "";
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    let raf0 = 0;
    let raf1 = 0;

    const el = containerRef.current;
    if (!el?.isConnected) return;

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
      raf0 = requestAnimationFrame(() => {
        if (!cancelled && mapAlive(mapRef.current)) {
          try {
            mapRef.current.invalidateSize();
          } catch {
            /* ignore */
          }
        }
      });
    }

    const map = mapRef.current;
    const lg = layerRef.current;
    if (!mapAlive(map) || !lg) return;

    try {
      map.stop();
    } catch {
      /* ignore */
    }

    const structureChanged = vendorsStructuralKey !== structuralKeyRef.current;
    structuralKeyRef.current = vendorsStructuralKey;

    if (structureChanged) {
      try {
        lg.clearLayers();
      } catch {
        if (cancelled) return;
      }
      markersByVendorRef.current.clear();

      if (cancelled || !mapAlive(map)) return;

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
        markersByVendorRef.current.set(v.vendorId, mk);
      });

      if (latlngs.length > 0 && mapAlive(map) && !cancelled) {
        try {
          if (latlngs.length === 1) {
            map.setView(latlngs[0] as L.LatLngTuple, 15);
          } else {
            map.fitBounds(L.latLngBounds(latlngs as L.LatLngTuple[]), {
              padding: [28, 28],
              maxZoom: 16,
            });
          }
        } catch {
          /* Leaflet occasionally throws if the map is resizing mid-update */
        }
      }
    } else {
      markersByVendorRef.current.forEach((m, id) => {
        const hl = highlightedVendorId === id;
        try {
          m.setIcon(pinIcon(hl));
        } catch {
          /* ignore */
        }
      });

      if (highlightedVendorId && mapAlive(map) && !cancelled) {
        const v = vendors.find((x) => x.vendorId === highlightedVendorId);
        if (v?.location) {
          try {
            map.panTo([v.location.lat, v.location.lng], { animate: true, duration: 0.32 } as L.ZoomPanOptions);
          } catch {
            /* ignore */
          }
        }
      }
    }

    raf1 = requestAnimationFrame(() => {
      if (cancelled || !mapAlive(mapRef.current)) return;
      try {
        mapRef.current!.invalidateSize({ animate: false });
      } catch {
        /* ignore */
      }
    });

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf0);
      cancelAnimationFrame(raf1);
    };
  }, [userLocation, vendors, vendorsStructuralKey, highlightedVendorId]);

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
