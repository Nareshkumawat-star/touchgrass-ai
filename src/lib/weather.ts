/**
 * Weather via Open-Meteo.
 *
 * Free, key-less and privacy-friendly. If it fails for any reason we return
 * `null` and the UI says weather is unavailable — the app never invents
 * conditions it did not actually read.
 */

import type { MissionWeatherContext } from "@/lib/ai/types";

const WMO_SUMMARY: Record<number, string> = {
  0: "clear sky",
  1: "mostly clear",
  2: "partly cloudy",
  3: "overcast",
  45: "foggy",
  48: "freezing fog",
  51: "light drizzle",
  53: "drizzle",
  55: "heavy drizzle",
  56: "freezing drizzle",
  57: "heavy freezing drizzle",
  61: "light rain",
  63: "rain",
  65: "heavy rain",
  66: "freezing rain",
  67: "heavy freezing rain",
  71: "light snow",
  73: "snow",
  75: "heavy snow",
  77: "snow grains",
  80: "light showers",
  81: "showers",
  82: "heavy showers",
  85: "snow showers",
  86: "heavy snow showers",
  95: "thunderstorm",
  96: "thunderstorm with hail",
  99: "severe thunderstorm with hail",
};

function summarize(code: number): string {
  return WMO_SUMMARY[code] ?? "mixed conditions";
}

export async function getWeather(
  lat: number,
  lng: number,
  timeoutMs = 4_000,
): Promise<MissionWeatherContext | null> {
  const url = new URL("https://api.open-meteo.com/v1/forecast");
  // Rounded coordinates: Open-Meteo does not need more precision, and we do not
  // want to send a precise position anywhere.
  url.searchParams.set("latitude", (Math.round(lat * 100) / 100).toString());
  url.searchParams.set("longitude", (Math.round(lng * 100) / 100).toString());
  url.searchParams.set(
    "current",
    "temperature_2m,precipitation,weather_code,is_day",
  );
  url.searchParams.set("timezone", "auto");

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      cache: "no-store",
    });
    if (!response.ok) return null;
    const data = (await response.json()) as {
      current?: {
        temperature_2m?: number;
        precipitation?: number;
        weather_code?: number;
        is_day?: number;
      };
    };
    const current = data.current;
    if (!current || typeof current.temperature_2m !== "number") return null;

    return {
      summary: summarize(current.weather_code ?? 0),
      temperatureC: current.temperature_2m,
      isDay: current.is_day === 1,
      precipitationMm: current.precipitation,
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
