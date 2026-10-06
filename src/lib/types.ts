/**
 * Shared domain types for TouchGrass AI.
 *
 * Deliberately framework-free so the same shapes are used by the database
 * layer, the AI provider layer, and the React components.
 */

export const EXPERIENCE_LEVELS = [
  "beginner",
  "casual",
  "active",
  "adventurous",
] as const;
export type ExperienceLevel = (typeof EXPERIENCE_LEVELS)[number];

export const EXPERIENCE_LABELS: Record<ExperienceLevel, string> = {
  beginner: "Beginner",
  casual: "Casual",
  active: "Active",
  adventurous: "Adventurous",
};

/** Minutes. `120` is rendered as "2+ hours". */
export const TIME_OPTIONS = [10, 20, 30, 60, 120] as const;
export type TimeOption = (typeof TIME_OPTIONS)[number];

export const TIME_LABELS: Record<number, string> = {
  10: "10 minutes",
  20: "20 minutes",
  30: "30 minutes",
  60: "1 hour",
  120: "2+ hours",
};

export const ACTIVITIES = [
  "walking",
  "running",
  "nature",
  "photography",
  "birds",
  "plants",
  "exploration",
  "mindfulness",
] as const;
export type Activity = (typeof ACTIVITIES)[number];

export const ACTIVITY_LABELS: Record<Activity, string> = {
  walking: "Walking",
  running: "Running",
  nature: "Nature",
  photography: "Photography",
  birds: "Birds",
  plants: "Plants",
  exploration: "Exploration",
  mindfulness: "Mindfulness",
};

export const DIFFICULTIES = ["easy", "medium", "challenging"] as const;
export type Difficulty = (typeof DIFFICULTIES)[number];

export const DIFFICULTY_LABELS: Record<Difficulty, string> = {
  easy: "Easy",
  medium: "Medium",
  challenging: "Challenging",
};

export const MISSION_CATEGORIES = [
  "nature-detective",
  "walking-challenge",
  "mindful-moment",
  "photography-hunt",
  "birdwatching",
  "plant-hunt",
  "exploration",
  "movement",
] as const;
export type MissionCategory = (typeof MISSION_CATEGORIES)[number];

export const CATEGORY_LABELS: Record<MissionCategory, string> = {
  "nature-detective": "Nature Detective",
  "walking-challenge": "Walking Challenge",
  "mindful-moment": "Mindful Moment",
  "photography-hunt": "Photography Hunt",
  birdwatching: "Birdwatching",
  "plant-hunt": "Plant Hunt",
  exploration: "Exploration",
  movement: "Movement",
};

export const CATEGORY_ICONS: Record<MissionCategory, string> = {
  "nature-detective": "🔎",
  "walking-challenge": "🚶",
  "mindful-moment": "🍃",
  "photography-hunt": "📷",
  birdwatching: "🐦",
  "plant-hunt": "🌿",
  exploration: "🧭",
  movement: "🏃",
};

/**
 * The structured mission contract. The AI layer is required to return exactly
 * this shape (validated with Zod in `schemas.ts`), and the database stores it
 * verbatim, so swapping models cannot change the rest of the application.
 */
export interface MissionDraft {
  title: string;
  description: string;
  /** Minutes. */
  duration: number;
  difficulty: Difficulty;
  category: MissionCategory;
  steps: string[];
  thingsToLookFor: string[];
  safetyTips: string[];
  rewardPoints: number;
}

export interface MissionRecord extends MissionDraft {
  id: string;
  userId: string;
  /** Which AI provider produced it, and with which model. */
  generatedBy: AIProviderId;
  model: string;
  /** True when the mission was produced without contacting any model. */
  offlineGenerated: boolean;
  /** Optional nearby place suggested by OpenStreetMap, when location was shared. */
  placeName?: string;
  placeDistanceMeters?: number;
  createdAt: string;
}

export interface UserPreferences {
  experience: ExperienceLevel;
  availableTime: number;
  activities: Activity[];
  difficulty: Difficulty;
  surpriseMe: boolean;
}

export interface ApproximateLocation {
  /** Rounded to ~1km so we never store a precise position. */
  lat: number;
  lng: number;
  label?: string;
}

export interface UserRecord {
  id: string;
  name: string;
  preferences: UserPreferences;
  locationPermission: boolean;
  approximateLocation?: ApproximateLocation;
  isDemo: boolean;
  createdAt: string;
}

export interface CompletedMissionRecord {
  id: string;
  userId: string;
  missionId: string;
  missionTitle: string;
  category: MissionCategory;
  completedAt: string;
  /** Actual minutes spent outside. */
  duration: number;
  points: number;
  /** True when the user was offline and the record was synced afterwards. */
  syncedFromOffline: boolean;
  note?: string;
  /** Device-generated id, used to make offline sync idempotent. */
  clientId?: string;
}

export interface DiscoveryRecord {
  id: string;
  userId: string;
  missionId?: string;
  /** Data URL for the (client-downscaled) photo. Never a public URL. */
  imageUrl: string;
  /** Hedged identification: "Possible Neem Leaf", never a certainty. */
  identification: string;
  /** 0–100. The UI always presents this as an estimate. */
  confidence: number;
  description: string;
  funFact: string;
  category: DiscoveryCategory;
  provider: AIProviderId;
  model: string;
  /** True when no vision model was reachable and we said so instead of guessing. */
  analysisUnavailable: boolean;
  /** True only for clearly-labelled demo samples. */
  simulated: boolean;
  createdAt: string;
}

export const DISCOVERY_CATEGORIES = [
  "plant",
  "leaf",
  "flower",
  "bird",
  "insect",
  "tree",
  "fungus",
  "outdoor-object",
  "unknown",
] as const;
export type DiscoveryCategory = (typeof DISCOVERY_CATEGORIES)[number];

export const DISCOVERY_CATEGORY_LABELS: Record<DiscoveryCategory, string> = {
  plant: "Plant",
  leaf: "Leaf",
  flower: "Flower",
  bird: "Bird",
  insect: "Insect",
  tree: "Tree",
  fungus: "Fungus",
  "outdoor-object": "Outdoor object",
  unknown: "Not sure",
};

export type AIProviderId = "local" | "huggingface" | "heuristic";

export interface UserStatsRecord {
  userId: string;
  points: number;
  streakDays: number;
  longestStreak: number;
  missionsCompleted: number;
  discoveries: number;
  totalMinutesOutside: number;
  /** Streak milestones already rewarded (e.g. [3, 7]) so points are not farmed. */
  rewardedStreakMilestones: number[];
  firstMissionBonusAwarded: boolean;
  lastMissionDate?: string;
  level: string;
  updatedAt: string;
}

export interface ModelLicense {
  name: string;
  license: string;
  commerciallyUsable: boolean;
  url: string;
  notes?: string;
}

export interface ProviderStatus {
  id: AIProviderId;
  label: string;
  /** Reachable right now. */
  available: boolean;
  model: string;
  /** "local" runs on the user's machine, "remote" sends data to a server. */
  execution: "local" | "remote";
  visionModel?: string;
  visionAvailable: boolean;
  detail?: string;
  /** Exact model and licence, resolved from the registry in `lib/ai/models.ts`. */
  license?: ModelLicense;
  visionLicense?: ModelLicense;
}

/** Aggregated payload served to the dashboard in a single round trip. */
export interface DashboardPayload {
  user: UserRecord;
  stats: UserStatsRecord;
  todayMission: MissionRecord | null;
  recentMissions: CompletedMissionRecord[];
  recentDiscoveries: DiscoveryRecord[];
  provider: ProviderStatus;
}
