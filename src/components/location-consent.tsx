"use client";

/**
 * Optional location.
 *
 * Nothing is requested from the browser until the user presses the button, and
 * what gets stored is a rounded approximation. Denying permission leaves a
 * fully working app — that is a hard requirement, not a nicety.
 */

import * as React from "react";
import { CloudSun, Compass, Loader2, MapPin, TreePine } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Callout } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { NearbyMap, type PlaceMarker } from "@/components/nearby-map";
import { formatDistance } from "@/lib/utils";
import type { MissionWeatherContext } from "@/lib/ai/types";

interface PlacesResponse {
  center: { lat: number; lng: number };
  places: PlaceMarker[];
  weather: MissionWeatherContext | null;
  placesAvailable: boolean;
  weatherAvailable: boolean;
}

export function LocationConsent({
  initialPermission,
  initialCoords,
}: {
  initialPermission: boolean;
  initialCoords?: { lat: number; lng: number };
}) {
  const [permission, setPermission] = React.useState(initialPermission);
  const [coords, setCoords] = React.useState(initialCoords ?? null);
  const [data, setData] = React.useState<PlacesResponse | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [message, setMessage] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    try {
      const response = await fetch("/api/location", { cache: "no-store" });
      if (!response.ok) return;
      const payload = (await response.json()) as PlacesResponse;
      setData(payload);
      setCoords(payload.center);
    } catch {
      setMessage("Nearby places could not be loaded — OpenStreetMap may be unreachable.");
    }
  }, []);

  React.useEffect(() => {
    if (permission) void load();
  }, [permission, load]);

  async function enable() {
    if (!("geolocation" in navigator)) {
      setMessage("This browser has no location support. Missions still work normally.");
      return;
    }
    setBusy(true);
    setMessage(null);

    const position = await new Promise<GeolocationPosition | null>((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (result) => resolve(result),
        () => resolve(null),
        { enableHighAccuracy: false, timeout: 8_000, maximumAge: 600_000 },
      );
    });

    if (!position) {
      setBusy(false);
      setPermission(false);
      setMessage("Location was declined or timed out. Everything else keeps working.");
      return;
    }

    try {
      const response = await fetch("/api/location", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          locationPermission: true,
          location: {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          },
        }),
      });
      if (!response.ok) throw new Error("Could not save location preference");
      setPermission(true);
      setMessage("Location on. Only a rounded ~1 km area is stored.");
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not save location preference");
    } finally {
      setBusy(false);
    }
  }

  async function disable() {
    setBusy(true);
    try {
      await fetch("/api/location", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ locationPermission: false }),
      });
      setPermission(false);
      setCoords(null);
      setData(null);
      setMessage("Location off and the stored approximation removed.");
    } finally {
      setBusy(false);
    }
  }

  if (!permission) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Compass className="size-5 text-accent" /> Nearby nature (optional)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-muted-foreground">
          <p>
            Share an approximate location and missions can point at parks and green space near
            you, and adapt to the current weather.
          </p>
          <ul className="space-y-1.5 text-xs">
            <li>• Only a rounded area (~1 km) is stored — never your exact position.</li>
            <li>• It is never published or shared publicly.</li>
            <li>• You can switch it off at any time.</li>
          </ul>
          <div className="flex flex-wrap gap-3">
            <Button type="button" onClick={enable} disabled={busy} size="lg">
              {busy ? <Loader2 className="animate-spin" /> : <MapPin />} Use approximate location
            </Button>
          </div>
          {message && <p className="text-xs">{message}</p>}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TreePine className="size-5 text-accent" /> Nearby nature
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {data?.weather ? (
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <Badge variant="sky">
              <CloudSun className="size-3.5" /> {data.weather.summary},{" "}
              {Math.round(data.weather.temperatureC)}°C
            </Badge>
            <span className="text-xs text-muted-foreground">
              {data.weather.isDay ? "Daytime" : "After dark"} at your approximate location
            </span>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">
            Weather is unavailable right now, so missions make no assumptions about it.
          </p>
        )}

        {data?.placesAvailable && coords ? (
          <>
            <NearbyMap center={coords} places={data.places} />
            <ul className="space-y-1.5 text-sm">
              {data.places.map((place) => (
                <li key={`${place.lat}-${place.lng}`} className="flex items-center justify-between gap-3">
                  <span className="truncate">{place.name}</span>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {place.kind} · {formatDistance(place.distanceMeters)}
                  </span>
                </li>
              ))}
            </ul>
          </>
        ) : (
          <Callout variant="warning" hideIcon>
            OpenStreetMap did not return any parks or green spaces near you. Missions will still
            be generated without place suggestions.
          </Callout>
        )}

        <div className="flex flex-wrap items-center gap-3">
          <Button type="button" variant="outline" size="sm" onClick={disable} disabled={busy}>
            Turn location off
          </Button>
          {message && <p className="text-xs text-muted-foreground">{message}</p>}
        </div>
      </CardContent>
    </Card>
  );
}
