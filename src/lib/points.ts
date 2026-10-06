/**
 * Reward system.
 *
 * Deliberately conservative: points reward *time spent outside*, and there is
 * no mechanic that rewards opening the app more often. Level names are the
 * ones described in the product spec.
 */

import type { UserStatsRecord } from "./types";

export const POINTS = {
  missionCompleted: 100,
  discovery: 50,
  firstOutdoorMission: 100,
  streakMilestone: 500,
} as const;

/** Streaks that pay out, and only once each. */
export const REWARDED_STREAK_DAYS = [7, 30] as const;

export interface LevelDefinition {
  name: string;
  minPoints: number;
  emoji: string;
  blurb: string;
}

export const LEVELS: LevelDefinition[] = [
  {
    name: "Grass Starter",
    minPoints: 0,
    emoji: "🌱",
    blurb: "You stepped outside. That is the hard part.",
  },
  {
    name: "Nature Walker",
    minPoints: 300,
    emoji: "🥾",
    blurb: "Regular short walks are becoming a habit.",
  },
  {
    name: "Trail Explorer",
    minPoints: 800,
    emoji: "🧭",
    blurb: "You go looking for things instead of waiting for them.",
  },
  {
    name: "Outdoor Regular",
    minPoints: 2000,
    emoji: "🌳",
    blurb: "Outside is part of your routine, not an event.",
  },
  {
    name: "TouchGrass Legend",
    minPoints: 5000,
    emoji: "🏔️",
    blurb: "Screen time is down. Grass time is up.",
  },
];

export function levelFor(points: number): LevelDefinition {
  let current = LEVELS[0];
  for (const level of LEVELS) {
    if (points >= level.minPoints) current = level;
  }
  return current;
}

export function nextLevel(points: number): LevelDefinition | null {
  return LEVELS.find((level) => level.minPoints > points) ?? null;
}

/** 0–1 progress through the current level (1 when at the top level). */
export function levelProgress(points: number): number {
  const current = levelFor(points);
  const next = nextLevel(points);
  if (!next) return 1;
  const span = next.minPoints - current.minPoints;
  if (span <= 0) return 1;
  return Math.min(1, Math.max(0, (points - current.minPoints) / span));
}

export function daysUntil(targetIso: string, from: Date = new Date()): number {
  const target = new Date(targetIso);
  const ms = target.getTime() - from.getTime();
  return Math.max(0, Math.ceil(ms / 86_400_000));
}

/** Points awarded beyond the base mission reward, with a human explanation. */
export function bonusFor(
  stats: Pick<
    UserStatsRecord,
    "firstMissionBonusAwarded" | "rewardedStreakMilestones"
  >,
  streakDays: number,
): { points: number; reasons: string[] } {
  const reasons: string[] = [];
  let points = 0;

  if (!stats.firstMissionBonusAwarded) {
    points += POINTS.firstOutdoorMission;
    reasons.push(`First outdoor mission +${POINTS.firstOutdoorMission}`);
  }

  const milestone = REWARDED_STREAK_DAYS.find(
    (day) =>
      streakDays >= day &&
      !stats.rewardedStreakMilestones.includes(day) &&
      day === [...REWARDED_STREAK_DAYS].filter((d) => streakDays >= d).pop(),
  );
  if (milestone) {
    points += POINTS.streakMilestone;
    reasons.push(`${milestone}-day outdoor streak +${POINTS.streakMilestone}`);
  }

  return { points, reasons };
}

/** Days between two ISO dates, ignoring time of day. */
export function dayDiff(aIso: string, bIso: string): number {
  const a = new Date(aIso);
  const b = new Date(bIso);
  const aDay = Date.UTC(a.getUTCFullYear(), a.getUTCMonth(), a.getUTCDate());
  const bDay = Date.UTC(b.getUTCFullYear(), b.getUTCMonth(), b.getUTCDate());
  return Math.round((aDay - bDay) / 86_400_000);
}

/**
 * Recomputes the streak from completion history rather than trusting a stored
 * counter, so a missed day correctly resets it.
 */
export function computeStreak(
  completedDates: string[],
  now: Date = new Date(),
): number {
  if (completedDates.length === 0) return 0;
  const uniqueDays = Array.from(
    new Set(
      completedDates.map((iso) => {
        const d = new Date(iso);
        return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
      }),
    ),
  ).sort((a, b) => b - a);

  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const first = uniqueDays[0];
  const gapFromToday = Math.round((today - first) / 86_400_000);
  // A streak stays alive if you went outside today or yesterday.
  if (gapFromToday > 1) return 0;

  let streak = 1;
  for (let i = 1; i < uniqueDays.length; i += 1) {
    const diff = Math.round((uniqueDays[i - 1] - uniqueDays[i]) / 86_400_000);
    if (diff === 1) streak += 1;
    else break;
  }
  return streak;
}
