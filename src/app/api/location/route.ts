/**
 * /api/location
 *   POST — record whether the user allows location, and an approximate position
 *   GET  — nearby public green spaces (OpenStreetMap Overpass) for that position
 *
 * Coordinates are rounded to ~1 km before storage, and the GET endpoint refuses
 * to look anything up unless the user has explicitly opted in.
 */

import { z } from "zod";
import { fail, ok, parseBody, withUser } from "@/lib/api";
import { findNearbyOutdoorPlaces } from "@/lib/places";
import { updateLocation } from "@/lib/services/user";
import { getWeather } from "@/lib/weather";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const locationSchema = z.object({
  locationPermission: z.boolean(),
  /** Optional: only sent when the browser granted permission. */
  location: z
    .object({
      lat: z.number().min(-90).max(90),
      lng: z.number().min(-180).max(180),
      label: z.string().trim().max(120).optional(),
    })
    .optional(),
});

export async function POST(request: Request) {
  return withUser(async (user) => {
    const parsed = await parseBody(request, locationSchema);
    if (parsed.response) return parsed.response;

    const updated = await updateLocation(
      user,
      parsed.data.locationPermission,
      parsed.data.location,
    );

    return ok({
      user: updated,
      // Explained to the client so the UI can be explicit about what is stored.
      stored: updated.approximateLocation
        ? "Approximate position stored (rounded to about 1 km)."
        : "No position stored.",
    });
  });
}

export async function GET() {
  return withUser(async (user) => {
    if (!user.locationPermission || !user.approximateLocation) {
      return fail(
        "Location is off — enable it to see nearby parks and trails.",
        403,
      );
    }

    const { lat, lng } = user.approximateLocation;
    const [places, weather] = await Promise.all([
      findNearbyOutdoorPlaces(lat, lng, { limit: 6 }),
      getWeather(lat, lng),
    ]);

    return ok({
      center: { lat, lng },
      places,
      weather,
      source: "OpenStreetMap Overpass API",
      // Honest reporting: an empty list means Overpass did not answer.
      placesAvailable: places.length > 0,
      weatherAvailable: Boolean(weather),
    });
  });
}
