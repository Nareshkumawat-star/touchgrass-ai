/**
 * User service — onboarding, preferences and privacy-preserving location.
 */

import { getStore } from "@/lib/db";
import type { OnboardingInput, PreferencesInput } from "@/lib/schemas";
import { getSessionUserId, setSession } from "@/lib/session";
import type { ApproximateLocation, UserRecord } from "@/lib/types";

/**
 * Rounds a position to ~1 km before it is stored or sent anywhere.
 * Precise coordinates are never persisted.
 */
export function toApproximateLocation(input: {
  lat: number;
  lng: number;
  label?: string;
}): ApproximateLocation {
  const round = (value: number) => Math.round(value * 100) / 100;
  return {
    lat: round(input.lat),
    lng: round(input.lng),
    label: input.label?.slice(0, 120),
  };
}

export async function createUserFromOnboarding(
  input: OnboardingInput,
  options: { isDemo?: boolean } = {},
): Promise<UserRecord> {
  const store = await getStore();

  const preferences = {
    experience: input.experience,
    availableTime: input.availableTime,
    activities: input.activities,
    difficulty: input.difficulty,
    surpriseMe: input.surpriseMe,
  };

  // Sharing is opt-in: a position that arrives alongside
  // `locationPermission: false` is dropped, never persisted.
  const approximateLocation = input.locationPermission
    ? input.approximateLocation
      ? toApproximateLocation(input.approximateLocation)
      : undefined
    : undefined;

  // Re-submitting onboarding must not orphan the account that already holds the
  // visitor's missions — it happens whenever the back button restores the wizard
  // (bfcache) after onboarding finished. Update that account in place instead of
  // minting a second one and silently re-pointing the session at it.
  const existingId = await getSessionUserId();
  const existing = existingId ? await store.getUser(existingId) : null;
  if (existing && !existing.isDemo && !options.isDemo) {
    const withPreferences = await store.updateUserPreferences(existing.id, preferences);
    const updated = await store.updateUserLocation(
      existing.id,
      input.locationPermission,
      approximateLocation,
    );
    await setSession(existing.id, false);
    return updated ?? withPreferences ?? existing;
  }

  const user = await store.createUser({
    name: input.name.trim().slice(0, 60),
    preferences,
    locationPermission: input.locationPermission,
    approximateLocation,
    isDemo: options.isDemo ?? false,
  });

  await setSession(user.id, user.isDemo);
  return user;
}

export async function updatePreferences(
  user: UserRecord,
  preferences: PreferencesInput,
): Promise<UserRecord> {
  const store = await getStore();
  const updated = await store.updateUserPreferences(user.id, {
    experience: preferences.experience,
    availableTime: preferences.availableTime,
    activities: preferences.activities,
    difficulty: preferences.difficulty,
    surpriseMe: preferences.surpriseMe,
  });
  return updated ?? user;
}

export async function updateLocation(
  user: UserRecord,
  locationPermission: boolean,
  location?: { lat: number; lng: number; label?: string },
): Promise<UserRecord> {
  const store = await getStore();
  const updated = await store.updateUserLocation(
    user.id,
    locationPermission,
    location ? toApproximateLocation(location) : undefined,
  );
  return updated ?? user;
}
