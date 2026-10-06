/**
 * Storage contracts.
 *
 * Both implementations (`MongoStore`, `LocalJsonStore`) satisfy this interface,
 * so the rest of the application never branches on which database is in use.
 */

import type {
  AIProviderId,
  ApproximateLocation,
  CompletedMissionRecord,
  DiscoveryCategory,
  DiscoveryRecord,
  MissionCategory,
  MissionDraft,
  MissionRecord,
  UserPreferences,
  UserRecord,
  UserStatsRecord,
} from "@/lib/types";

export interface CreateUserInput {
  name: string;
  preferences: UserPreferences;
  locationPermission: boolean;
  approximateLocation?: ApproximateLocation;
  isDemo?: boolean;
}

export interface CreateMissionInput extends MissionDraft {
  userId: string;
  generatedBy: AIProviderId;
  model: string;
  offlineGenerated: boolean;
  placeName?: string;
  placeDistanceMeters?: number;
  createdAt?: string;
}

export interface CreateCompletionInput {
  userId: string;
  missionId: string;
  missionTitle: string;
  category: MissionCategory;
  completedAt: string;
  duration: number;
  points: number;
  syncedFromOffline: boolean;
  note?: string;
  /** Device-generated id: makes offline sync idempotent. */
  clientId?: string;
}

export interface CreateDiscoveryInput {
  userId: string;
  missionId?: string;
  imageUrl: string;
  identification: string;
  confidence: number;
  description: string;
  funFact: string;
  category: DiscoveryCategory;
  provider: AIProviderId;
  model: string;
  analysisUnavailable: boolean;
  simulated: boolean;
  createdAt?: string;
}

export interface StatsPatch {
  points?: number;
  streakDays?: number;
  longestStreak?: number;
  missionsCompleted?: number;
  discoveries?: number;
  totalMinutesOutside?: number;
  rewardedStreakMilestones?: number[];
  firstMissionBonusAwarded?: boolean;
  lastMissionDate?: string;
  level?: string;
}

export interface TouchGrassStore {
  readonly kind: "mongodb" | "local-file";
  /** Human-readable explanation surfaced in the UI / health endpoint. */
  readonly description: string;

  createUser(input: CreateUserInput): Promise<UserRecord>;
  getUser(id: string): Promise<UserRecord | null>;
  updateUserPreferences(
    id: string,
    preferences: UserPreferences,
  ): Promise<UserRecord | null>;
  updateUserLocation(
    id: string,
    locationPermission: boolean,
    approximateLocation?: ApproximateLocation,
  ): Promise<UserRecord | null>;
  deleteUserData(id: string): Promise<void>;

  createMission(input: CreateMissionInput): Promise<MissionRecord>;
  getMission(id: string): Promise<MissionRecord | null>;
  listMissions(userId: string, limit?: number): Promise<MissionRecord[]>;

  createCompletion(input: CreateCompletionInput): Promise<{
    record: CompletedMissionRecord;
    /** False when an identical offline sync had already been recorded. */
    created: boolean;
  }>;
  listCompletions(userId: string, limit?: number): Promise<CompletedMissionRecord[]>;
  countCompletions(userId: string): Promise<number>;

  createDiscovery(input: CreateDiscoveryInput): Promise<DiscoveryRecord>;
  getDiscovery(id: string): Promise<DiscoveryRecord | null>;
  listDiscoveries(userId: string, limit?: number): Promise<DiscoveryRecord[]>;
  deleteDiscovery(id: string, userId: string): Promise<boolean>;

  getStats(userId: string): Promise<UserStatsRecord | null>;
  upsertStats(userId: string, patch: StatsPatch): Promise<UserStatsRecord>;

  /** Removes demo users and everything they own. Real users are untouched. */
  resetDemoData(): Promise<number>;
}
