/**
 * Stats service.
 *
 * Points and streaks are *derived* from the stored activity (completed missions
 * and discoveries) rather than incremented blindly. That means an offline
 * completion synced later, a deleted discovery, or a manual data reset all
 * settle to a correct total with no drift.
 */

import { getStore } from "@/lib/db";
import type { TouchGrassStore } from "@/lib/db/store-types";
import { POINTS, REWARDED_STREAK_DAYS, computeStreak, levelFor } from "@/lib/points";
import type { UserStatsRecord } from "@/lib/types";

export async function refreshStats(
  userId: string,
  store?: TouchGrassStore,
): Promise<UserStatsRecord> {
  const db = store ?? (await getStore());

  const [completions, discoveries, existing] = await Promise.all([
    db.listCompletions(userId, 500),
    db.listDiscoveries(userId, 500),
    db.getStats(userId),
  ]);

  const missionPoints = completions.reduce((total, entry) => total + entry.points, 0);
  const discoveryPoints = discoveries.length * POINTS.discovery;
  const points = missionPoints + discoveryPoints;

  const streakDays = computeStreak(completions.map((entry) => entry.completedAt));
  const longestStreak = Math.max(existing?.longestStreak ?? 0, streakDays);

  const achievedMilestones = REWARDED_STREAK_DAYS.filter((day) => streakDays >= day);
  const rewardedStreakMilestones = Array.from(
    new Set([...(existing?.rewardedStreakMilestones ?? []), ...achievedMilestones]),
  ).sort((a, b) => a - b);

  const totalMinutesOutside = completions.reduce(
    (total, entry) => total + entry.duration,
    0,
  );

  return db.upsertStats(userId, {
    points,
    streakDays,
    longestStreak,
    missionsCompleted: completions.length,
    discoveries: discoveries.length,
    totalMinutesOutside,
    rewardedStreakMilestones,
    firstMissionBonusAwarded: (existing?.firstMissionBonusAwarded ?? false) || completions.length > 0,
    lastMissionDate: completions[0]?.completedAt,
    level: levelFor(points).name,
  });
}

/** A read-only view without touching the database (for read endpoints). */
export function levelOf(stats: UserStatsRecord) {
  return levelFor(stats.points);
}
