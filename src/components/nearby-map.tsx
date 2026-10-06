"use client";

/**
 * Nearby outdoor spaces on OpenStreetMap.
 *
 * Leaflet is imported inside an effect rather than as a module-level import so
 * it never runs during server rendering, and the map stays a progressive
 * enhancement: if the tiles fail, the list of places is still readable.
 */

import * as React from "react";
import { ExternalLink, MapPin } from "lucide-react";
import type { Map as LeafletMap } from "leaflet";
import "leaflet/dist/leaflet.css";
import { formatDistance } from "@/lib/utils";

export interface PlaceMarker {
  name: string;
  kind: string;
  lat: number;
  lng: number;
  distanceMeters: number;
}

export function NearbyMap({
  center,
  places,
  className,
}: {
  center: { lat: number; lng: number };
  places: PlaceMarker[];
  className?: string;
}) {
  const containerRef = React.useRef<HTMLDivElement | null>(null);
  const [failed, setFailed] = React.useState(false);

  React.useEffect(() => {
    let map: LeafletMap | null = null;
    let cancelled = false;

    (async () => {
      try {
        // Leaflet touches `window` at import time, so it is loaded lazily here
        // rather than at module scope — the map stays a progressive enhancement.
        const L = await import("leaflet");
        if (cancelled || !containerRef.current) return;

        map = L.map(containerRef.current, {
          center: [center.lat, center.lng],
          zoom: 13,
          scrollWheelZoom: false,
          attributionControl: true,
        });

        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          maxZoom: 19,
          attribution: '&copy; OpenStreetMap contributors',
        }).addTo(map);

        // Search area: communicated honestly as an approximation.
        L.circle([center.lat, center.lng], {
          radius: 1000,
          color: "#6ba03c",
          weight: 1,
          fillColor: "#6ba03c",
          fillOpacity: 0.12,
        }).addTo(map);

        L.circleMarker([center.lat, center.lng], {
          radius: 6,
          color: "#2c5a34",
          fillColor: "#2c5a34",
          fillOpacity: 1,
        })
          .addTo(map)
          .bindPopup("Approximate area (rounded to about 1 km)");

        for (const place of places) {
          L.marker([place.lat, place.lng])
            .addTo(map)
            .bindPopup(
              `<strong>${place.name}</strong><br/>${place.kind} · ${formatDistance(
                place.distanceMeters,
              )} away`,
            );
        }

        if (places.length > 0) {
          const bounds = L.latLngBounds([
            [center.lat, center.lng],
            ...places.map((place) => [place.lat, place.lng] as [number, number]),
          ]);
          map.fitBounds(bounds.pad(0.25));
        }
      } catch {
        setFailed(true);
      }
    })();

    return () => {
      cancelled = true;
      map?.remove();
    };
  }, [center.lat, center.lng, places]);

  if (failed) {
    return (
      <p className="rounded-xl bg-surface p-4 text-sm text-muted-foreground">
        The map could not be loaded (map tiles may be blocked on this network). The place list
        below is still accurate.
      </p>
    );
  }

  return (
    <div className={className}>
      <div
        ref={containerRef}
        className="h-64 w-full overflow-hidden rounded-xl border border-border sm:h-72"
        role="img"
        aria-label="Map of nearby outdoor spaces"
      />
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <MapPin className="size-3.5" /> Data © OpenStreetMap contributors
        </span>
        <span className="inline-flex items-center gap-1.5">
          <ExternalLink className="size-3.5" /> Tiles served by the OpenStreetMap Foundation
        </span>
      </div>
    </div>
  );
}
