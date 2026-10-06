/**
 * Nearby outdoor spaces via OpenStreetMap (Overpass API).
 *
 * No paid map API, no API key. Only when the user has explicitly enabled
 * location, and coordinates are rounded to ~1 km before they leave the server.
 * If Overpass is slow or unreachable we return an empty list — the UI then says
 * place suggestions are unavailable instead of faking them.
 */

export interface NearbyPlace {
  name: string;
  kind: string;
  lat: number;
  lng: number;
  distanceMeters: number;
}

interface OverpassElement {
  type: string;
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
}

interface CacheEntry {
  places: NearbyPlace[];
  fetchedAt: number;
}

declare global {
  var __touchgrassPlaceCache: Map<string, CacheEntry> | undefined;
}

const cache: Map<string, CacheEntry> =
  globalThis.__touchgrassPlaceCache ?? (globalThis.__touchgrassPlaceCache = new Map());
const CACHE_TTL_MS = 10 * 60 * 1000;

const OVERPASS_ENDPOINT = "https://overpass-api.de/api/interpreter";

function distanceMeters(
  aLat: number,
  aLng: number,
  bLat: number,
  bLng: number,
): number {
  const R = 6_371_000;
  const toRad = (value: number) => (value * Math.PI) / 180;
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLng / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.min(1, Math.sqrt(h))));
}

function kindOf(tags: Record<string, string>): string {
  if (tags.leisure) return tags.leisure.replace(/_/g, " ");
  if (tags.landuse) return tags.landuse.replace(/_/g, " ");
  if (tags.tourism) return tags.tourism.replace(/_/g, " ");
  if (tags.natural) return tags.natural.replace(/_/g, " ");
  return "outdoor space";
}

export async function findNearbyOutdoorPlaces(
  lat: number,
  lng: number,
  options: { radiusMeters?: number; limit?: number; timeoutMs?: number } = {},
): Promise<NearbyPlace[]> {
  const radius = options.radiusMeters ?? 2_500;
  const limit = options.limit ?? 5;
  const timeoutMs = options.timeoutMs ?? 8_000;

  const key = `${lat.toFixed(2)}:${lng.toFixed(2)}:${radius}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.fetchedAt < CACHE_TTL_MS) return hit.places.slice(0, limit);

  const query = `[out:json][timeout:8];
(
  nwr["leisure"~"^(park|garden|nature_reserve|common|recreation_ground|pitch)$"](around:${radius},${lat},${lng});
  nwr["landuse"~"^(forest|meadow|grass|village_green)$"](around:${radius},${lat},${lng});
  nwr["tourism"="viewpoint"](around:${radius},${lat},${lng});
);
out center ${limit * 4};`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(OVERPASS_ENDPOINT, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: `data=${encodeURIComponent(query)}`,
      signal: controller.signal,
      cache: "no-store",
    });
    if (!response.ok) return [];
    const data = (await response.json()) as { elements?: OverpassElement[] };

    const places = (data.elements ?? [])
      .map((element) => {
        const point = element.center ?? { lat: element.lat, lon: element.lon };
        if (typeof point.lat !== "number" || typeof point.lon !== "number") return null;
        const tags = element.tags ?? {};
        const name = tags.name ?? tags["name:en"] ?? undefined;
        return {
          name: name ?? "Unnamed public green space",
          kind: kindOf(tags),
          lat: point.lat,
          lng: point.lon,
          distanceMeters: distanceMeters(lat, lng, point.lat, point.lon),
        } satisfies NearbyPlace;
      })
      .filter((place): place is NearbyPlace => place !== null)
      .sort((a, b) => a.distanceMeters - b.distanceMeters);

    cache.set(key, { places, fetchedAt: Date.now() });
    return places.slice(0, limit);
  } catch {
    return [];
  } finally {
    clearTimeout(timer);
  }
}

export function mapTileConfig() {
  return {
    url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  };
}
