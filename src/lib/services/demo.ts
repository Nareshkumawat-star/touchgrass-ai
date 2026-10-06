/**
 * Demo mode.
 *
 * Creates a realistic user with history so the app can be evaluated in seconds
 * instead of onboarding first. Everything it writes is flagged `isDemo` and
 * shown with a "Demo data" badge in the UI, and it can be wiped again from the
 * dashboard. Nothing here is presented as a real user's activity.
 */

import { getStore } from "@/lib/db";
import { POINTS, levelFor } from "@/lib/points";
import { MISSION_TEMPLATES } from "@/lib/ai/templates";
import { OFFLINE_MODEL_ID } from "@/lib/ai/heuristic";
import type { DiscoveryRecord, MissionRecord, UserRecord } from "@/lib/types";
import { refreshStats } from "./stats";

export const DEMO_USER_NAME = "Demo Explorer";

const DAY_MS = 86_400_000;

/** Tiny illustrative SVGs so demo cards render without shipping binary assets. */
function sampleImage(kind: "leaf" | "bird" | "flower" | "tree" | "insect" | "stone"): string {
  const palettes: Record<string, [string, string, string]> = {
    leaf: ["#2c5a34", "#6ba03c", "#e6efdd"],
    bird: ["#3b5a7a", "#78aecf", "#e8f1f7"],
    flower: ["#a9713f", "#dda93c", "#fdf3e3"],
    tree: ["#1f4026", "#3f6b33", "#dfe9d6"],
    insect: ["#7a5a2c", "#c9a24a", "#f6efdc"],
    stone: ["#4a4a45", "#8a8a80", "#ecebe6"],
  };
  const [dark, mid, light] = palettes[kind];
  const shapes: Record<string, string> = {
    leaf: '<path d="M60 150 C20 110 30 40 100 20 C160 40 160 120 120 150 Z" fill="%MID%"/><path d="M60 150 L100 20" stroke="%DARK%" stroke-width="4" fill="none"/>',
    bird: '<ellipse cx="100" cy="95" rx="46" ry="30" fill="%MID%"/><circle cx="142" cy="70" r="14" fill="%MID%"/><path d="M150 66 L170 74 L150 80 Z" fill="%DARK%"/><path d="M70 100 C90 60 130 60 150 95" stroke="%DARK%" stroke-width="3" fill="none"/>',
    flower:
      '<circle cx="100" cy="70" r="26" fill="%MID%"/><circle cx="70" cy="98" r="22" fill="%MID%"/><circle cx="130" cy="98" r="22" fill="%MID%"/><circle cx="100" cy="130" r="22" fill="%MID%"/><circle cx="100" cy="100" r="14" fill="%DARK%"/>',
    tree: '<rect x="92" y="110" width="16" height="60" fill="%DARK%"/><circle cx="100" cy="80" r="52" fill="%MID%"/><circle cx="66" cy="106" r="30" fill="%MID%"/><circle cx="136" cy="106" r="30" fill="%MID%"/>',
    insect:
      '<ellipse cx="100" cy="100" rx="14" ry="34" fill="%DARK%"/><ellipse cx="72" cy="88" rx="22" ry="12" fill="%MID%"/><ellipse cx="128" cy="88" rx="22" ry="12" fill="%MID%"/><circle cx="100" cy="60" r="12" fill="%DARK%"/>',
    stone:
      '<ellipse cx="100" cy="115" rx="66" ry="40" fill="%MID%"/><ellipse cx="86" cy="104" rx="34" ry="20" fill="%LIGHT%"/>',
  };
  const body = shapes[kind]
    .replaceAll("%MID%", encodeURIComponent(mid))
    .replaceAll("%DARK%", encodeURIComponent(dark))
    .replaceAll("%LIGHT%", encodeURIComponent(light));

  return `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200"><rect width="200" height="200" rx="24" fill="${encodeURIComponent(light)}"/>${body}</svg>`;
}

const DEMO_DISCOVERIES: {
  identification: string;
  confidence: number;
  description: string;
  funFact: string;
  category: DiscoveryRecord["category"];
  image: Parameters<typeof sampleImage>[0];
  daysAgo: number;
}[] = [
  {
    identification: "Possible neem leaf",
    confidence: 82,
    description:
      "Serrated edges and a single central vein, which is the usual shape for a neem leaf. Identification from one photo is always an estimate.",
    funFact:
      "Neem trees are widely planted across South Asia, which is why the leaves show up in ordinary street walks.",
    category: "leaf",
    image: "leaf",
    daysAgo: 0,
  },
  {
    identification: "Possible house sparrow",
    confidence: 71,
    description:
      "Small, brown-grey with a stubby beak and a hopping gait, the usual combination for a sparrow on a city pavement.",
    funFact: "House sparrows often stay within a few hundred metres of where they hatched.",
    category: "bird",
    image: "bird",
    daysAgo: 0,
  },
  {
    identification: "Possible dandelion flower",
    confidence: 64,
    description:
      "A single yellow flower head on a hollow stem with a rosette of toothed leaves at the base.",
    funFact: "Dandelion seeds travel on a tiny parachute that can carry them several kilometres.",
    category: "flower",
    image: "flower",
    daysAgo: 1,
  },
  {
    identification: "Possible oak tree",
    confidence: 58,
    description:
      "Lobed leaves and a rough, fissured trunk. Without acorns visible this stays a guess.",
    funFact: "Some oak species live for several hundred years and host hundreds of insect species.",
    category: "tree",
    image: "tree",
    daysAgo: 2,
  },
  {
    identification: "Possible bumblebee",
    confidence: 69,
    description:
      "Round, densely furry body with a black and yellow band pattern, seen working low flowers.",
    funFact: "Bumblebees can warm up their flight muscles by shivering before they take off.",
    category: "insect",
    image: "insect",
    daysAgo: 3,
  },
  {
    identification: "Possible granite kerbstone",
    confidence: 44,
    description:
      "Speckled grey crystalline surface with visible mineral grains, typical of granite paving.",
    funFact: "Paving stones often come from quarries hundreds of kilometres from where they are laid.",
    category: "outdoor-object",
    image: "stone",
    daysAgo: 4,
  },
  {
    identification: "Possible clover patch",
    confidence: 61,
    description:
      "Three-lobed leaves in a low creeping mat, common in lawns and roadside verges.",
    funFact: "Clover fixes nitrogen from the air into the soil, which is why it is planted in lawns.",
    category: "plant",
    image: "leaf",
    daysAgo: 4,
  },
];

/**
 * Creates (or re-uses) the demo account and populates it with missions,
 * completions, discoveries, a streak and points.
 */
export async function seedDemoUser(): Promise<{
  user: UserRecord;
  missions: MissionRecord[];
  discoveries: DiscoveryRecord[];
}> {
  const store = await getStore();

  const user = await store.createUser({
    name: DEMO_USER_NAME,
    preferences: {
      experience: "casual",
      availableTime: 30,
      activities: ["walking", "nature", "plants", "photography"],
      difficulty: "easy",
      surpriseMe: false,
    },
    locationPermission: false,
    isDemo: true,
  });

  const now = Date.now();

  // One mission per curated template, then complete 10 of them across five
  // consecutive days so the streak and totals look real.
  const missions: MissionRecord[] = [];
  for (const template of MISSION_TEMPLATES) {
    const mission = await store.createMission({
      userId: user.id,
      title: template.title,
      description: template.description,
      duration: Math.max(10, template.minMinutes),
      difficulty: "easy",
      category: template.category,
      steps: template.steps(Math.max(10, template.minMinutes), "easy"),
      thingsToLookFor: template.thingsToLookFor,
      safetyTips: template.safetyTips,
      rewardPoints: 80,
      generatedBy: "heuristic",
      model: OFFLINE_MODEL_ID,
      offlineGenerated: true,
    });
    missions.push(mission);
  }

  // Ten completions spread over five consecutive days gives a live 5-day streak.
  // The two missions left uncompleted are what the dashboard shows as
  // "Today's Mission", so the demo flow always has something to start.
  const schedule = [0, 0, 1, 1, 2, 2, 2, 3, 3, 4];
  for (let index = 0; index < schedule.length && index < missions.length; index += 1) {
    const daysAgo = schedule[index];
    const mission = missions[index];
    const completedAt = new Date(
      now - daysAgo * DAY_MS - (index % 3) * 3_600_000,
    ).toISOString();
    await store.createCompletion({
      userId: user.id,
      missionId: mission.id,
      missionTitle: mission.title,
      category: mission.category,
      completedAt,
      duration: mission.duration,
      points: 80 + (index === 0 ? POINTS.firstOutdoorMission : 0),
      syncedFromOffline: index % 4 === 0,
      clientId: `demo-${index}`,
    });
  }

  const discoveries: DiscoveryRecord[] = [];
  for (const [index, entry] of DEMO_DISCOVERIES.entries()) {
    const createdAt = new Date(now - entry.daysAgo * DAY_MS - index * 900_000).toISOString();
    const discovery = await store.createDiscovery({
      userId: user.id,
      missionId: missions[index]?.id,
      imageUrl: sampleImage(entry.image),
      identification: entry.identification,
      confidence: entry.confidence,
      description: entry.description,
      funFact: entry.funFact,
      category: entry.category,
      provider: "heuristic",
      model: "demo-sample",
      analysisUnavailable: false,
      simulated: true,
      createdAt,
    });
    discoveries.push(discovery);
  }

  await refreshStats(user.id, store);

  return { user, missions, discoveries };
}

export function demoLevel(points: number) {
  return levelFor(points);
}

export async function resetDemoData(): Promise<number> {
  const store = await getStore();
  return store.resetDemoData();
}
