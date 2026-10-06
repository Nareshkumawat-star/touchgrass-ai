/**
 * Mission service — generation, completion and history.
 *
 * The AI provider is only consulted here; everything above this layer works
 * with plain `MissionRecord` values.
 */

import { getStore } from "@/lib/db";
import type { MissionRequestInput } from "@/lib/schemas";
import { generateMission, getActiveProviderStatus } from "@/lib/ai/provider";
import type {
  AIProviderId,
  CompletedMissionRecord,
  MissionRecord,
  ProviderStatus,
  UserRecord,
  UserStatsRecord,
} from "@/lib/types";
import { findNearbyOutdoorPlaces } from "@/lib/places";
import { bonusFor, computeStreak, levelFor } from "@/lib/points";
import { getWeather } from "@/lib/weather";
import { refreshStats } from "./stats";

export interface GenerateMissionResult {
  mission: MissionRecord;
  provider: AIProviderId;
  model: string;
  offlineGenerated: boolean;
  notes: string[];
  attempts: { provider: string; error: string }[];
  providerStatus: ProviderStatus;
  weatherUsed: boolean;
  nearbyPlace?: string;
}

/**
 * Generates and stores a mission for a user.
 *
 * Honest by construction: weather and nearby-place data are only attached when
 * they were actually retrieved, and the `notes` array always explains which
 * provider answered and whether anything was unavailable.
 */
export async function generateMissionForUser(
  user: UserRecord,
  request: MissionRequestInput = {},
): Promise<GenerateMissionResult> {
  const store = await getStore();
  const notes: string[] = [];

  const [recentMissions, recentDiscoveries] = await Promise.all([
    store.listMissions(user.id, 6),
    store.listDiscoveries(user.id, 6),
  ]);

  const location = user.locationPermission ? user.approximateLocation : undefined;
  const [weather, places] = location
    ? await Promise.all([
        getWeather(location.lat, location.lng),
        findNearbyOutdoorPlaces(location.lat, location.lng, { limit: 3 }),
      ])
    : [null, []];

  if (user.locationPermission && !location) {
    notes.push("Location sharing is on but no position has been stored yet.");
  }
  if (user.locationPermission && location && !weather) {
    notes.push("Weather could not be read, so the mission makes no weather assumptions.");
  }
  if (user.locationPermission && location && places.length === 0) {
    notes.push("Nearby place suggestions were unavailable (OpenStreetMap did not answer).");
  }
  if (!user.locationPermission) {
    notes.push("Location is off, so this mission is written to work anywhere.");
  }

  const outcome = await generateMission(
    {
      preferences: user.preferences,
      availableTime: request.availableTime ?? user.preferences.availableTime,
      difficulty: request.difficulty ?? user.preferences.difficulty,
      activities: request.activities?.length
        ? request.activities
        : user.preferences.activities,
      surpriseMe: request.surpriseMe ?? user.preferences.surpriseMe,
      weather: weather ?? undefined,
      locationLabel: location?.label,
      nearbyPlaceName: places[0]?.name,
      recentMissionTitles: [
        ...(request.recentMissionTitles ?? []),
        ...recentMissions.map((mission) => mission.title),
      ],
      recentDiscoveries: [
        ...(request.recentDiscoveries ?? []),
        ...recentDiscoveries.map((discovery) => discovery.identification),
      ],
    },
    { forceOffline: request.forceOffline },
  );

  notes.push(...outcome.result.notes);
  for (const attempt of outcome.attempts) {
    notes.push(`${attempt.provider} was unavailable: ${attempt.error}`);
  }

  const mission = await store.createMission({
    userId: user.id,
    ...outcome.result.mission,
    generatedBy: outcome.result.provider,
    model: outcome.result.model,
    offlineGenerated: outcome.result.offlineGenerated,
    placeName: places[0]?.name,
    placeDistanceMeters: places[0]?.distanceMeters,
  });

  return {
    mission,
    provider: outcome.result.provider,
    model: outcome.result.model,
    offlineGenerated: outcome.result.offlineGenerated,
    notes,
    attempts: outcome.attempts.map(({ provider, error }) => ({ provider, error })),
    providerStatus: await getActiveProviderStatus(),
    weatherUsed: Boolean(weather),
    nearbyPlace: places[0]?.name,
  };
}

export interface CompleteMissionResult {
  completion: CompletedMissionRecord;
  /** False when an identical offline sync had already been recorded. */
  created: boolean;
  pointsAwarded: number;
  bonusReasons: string[];
  totalPoints: number;
  streakDays: number;
  stats: UserStatsRecord;
}

export async function completeMission(
  user: UserRecord,
  input: {
    missionId: string;
    duration?: number;
    note?: string;
    completedAt?: string;
    clientId?: string;
    syncedFromOffline?: boolean;
  },
): Promise<CompleteMissionResult> {
  const store = await getStore();
  const mission = await store.getMission(input.missionId);
  if (!mission || mission.userId !== user.id) {
    throw new Error("Mission not found for this user");
  }

  const completedAt = input.completedAt ?? new Date().toISOString();
  const duration = Math.max(1, Math.min(600, input.duration ?? mission.duration));

  const statsBefore = await refreshStats(user.id, store);
  const priorCompletions = await store.listCompletions(user.id, 500);
  const streakAfter = computeStreak([
    ...priorCompletions.map((entry) => entry.completedAt),
    completedAt,
  ]);

  const bonus = bonusFor(statsBefore, streakAfter);
  const pointsAwarded = mission.rewardPoints + bonus.points;

  const { record, created } = await store.createCompletion({
    userId: user.id,
    missionId: mission.id,
    missionTitle: mission.title,
    category: mission.category,
    completedAt,
    duration,
    points: pointsAwarded,
    syncedFromOffline: input.syncedFromOffline ?? false,
    note: input.note,
    clientId: input.clientId,
  });

  // Refresh (rather than increment) so a duplicate sync cannot double-count.
  const stats = await refreshStats(user.id, store);

  return {
    completion: record,
    created,
    pointsAwarded: created ? pointsAwarded : 0,
    bonusReasons: created ? bonus.reasons : [],
    totalPoints: stats.points,
    streakDays: stats.streakDays,
    stats,
  };
}

export async function missionHistory(
  userId: string,
  limit = 30,
): Promise<CompletedMissionRecord[]> {
  const store = await getStore();
  return store.listCompletions(userId, limit);
}

/**
 * The mission shown on the dashboard: the most recent one that has not been
 * completed yet, otherwise null.
 */
export async function getTodaysMission(user: UserRecord): Promise<MissionRecord | null> {
  const store = await getStore();
  const [missions, completions] = await Promise.all([
    store.listMissions(user.id, 8),
    store.listCompletions(user.id, 50),
  ]);
  const completedIds = new Set(completions.map((entry) => entry.missionId));
  return missions.find((mission) => !completedIds.has(mission.id)) ?? null;
}

export function levelForPoints(points: number) {
  return levelFor(points);
}
