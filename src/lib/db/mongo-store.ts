/**
 * MongoDB store (Mongoose).
 *
 * Used whenever MONGODB_URI is configured and reachable. Documents are mapped
 * to the plain records in `lib/types.ts` so callers never touch Mongoose types.
 */

import { Types } from "mongoose";
import { levelFor } from "@/lib/points";
import type {
  CompletedMissionRecord,
  DiscoveryRecord,
  MissionRecord,
  UserPreferences,
  UserRecord,
  UserStatsRecord,
} from "@/lib/types";
import {
  CompletedMissionModel,
  DiscoveryModel,
  MissionModel,
  UserModel,
  UserStatsModel,
} from "./models";
import type {
  CreateCompletionInput,
  CreateDiscoveryInput,
  CreateMissionInput,
  CreateUserInput,
  StatsPatch,
  TouchGrassStore,
} from "./store-types";

function toObjectId(id: string): Types.ObjectId | null {
  return Types.ObjectId.isValid(id) ? new Types.ObjectId(id) : null;
}

function iso(value: unknown): string {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "string") return new Date(value).toISOString();
  return new Date().toISOString();
}

export class MongoStore implements TouchGrassStore {
  readonly kind = "mongodb" as const;
  readonly description = "MongoDB (Mongoose)";

  async createUser(input: CreateUserInput): Promise<UserRecord> {
    const doc = await UserModel.create({
      name: input.name,
      preferences: input.preferences,
      locationPermission: input.locationPermission,
      approximateLocation: input.approximateLocation,
      isDemo: input.isDemo ?? false,
    });
    return this.mapUser(doc);
  }

  private mapUser(doc: {
    _id: Types.ObjectId;
    name: string;
    preferences: UserPreferences;
    locationPermission?: boolean;
    approximateLocation?: { lat: number; lng: number; label?: string | null } | null;
    isDemo?: boolean;
    createdAt: Date;
  }): UserRecord {
    return {
      id: doc._id.toString(),
      name: doc.name,
      preferences: {
        experience: doc.preferences.experience,
        availableTime: doc.preferences.availableTime,
        activities: doc.preferences.activities ?? [],
        difficulty: doc.preferences.difficulty,
        surpriseMe: Boolean(doc.preferences.surpriseMe),
      },
      locationPermission: Boolean(doc.locationPermission),
      approximateLocation: doc.approximateLocation
        ? {
            lat: doc.approximateLocation.lat,
            lng: doc.approximateLocation.lng,
            label: doc.approximateLocation.label ?? undefined,
          }
        : undefined,
      isDemo: Boolean(doc.isDemo),
      createdAt: iso(doc.createdAt),
    };
  }

  async getUser(id: string): Promise<UserRecord | null> {
    const objectId = toObjectId(id);
    if (!objectId) return null;
    const doc = await UserModel.findById(objectId).lean();
    return doc ? this.mapUser(doc as never) : null;
  }

  async updateUserPreferences(id: string, preferences: UserPreferences) {
    const objectId = toObjectId(id);
    if (!objectId) return null;
    const doc = await UserModel.findByIdAndUpdate(
      objectId,
      { $set: { preferences } },
      { new: true },
    ).lean();
    return doc ? this.mapUser(doc as never) : null;
  }

  async updateUserLocation(
    id: string,
    locationPermission: boolean,
    approximateLocation?: UserRecord["approximateLocation"],
  ) {
    const objectId = toObjectId(id);
    if (!objectId) return null;
    const update: Record<string, unknown> = { $set: { locationPermission } };
    if (approximateLocation) update.$set = { ...(update.$set as object), approximateLocation };
    else update.$unset = { approximateLocation: "" };
    const doc = await UserModel.findByIdAndUpdate(objectId, update, {
      new: true,
    }).lean();
    return doc ? this.mapUser(doc as never) : null;
  }

  async deleteUserData(id: string): Promise<void> {
    const objectId = toObjectId(id);
    if (!objectId) return;
    await Promise.all([
      UserModel.deleteOne({ _id: objectId }),
      MissionModel.deleteMany({ userId: objectId }),
      CompletedMissionModel.deleteMany({ userId: objectId }),
      DiscoveryModel.deleteMany({ userId: objectId }),
      UserStatsModel.deleteOne({ userId: objectId }),
    ]);
  }

  async createMission(input: CreateMissionInput): Promise<MissionRecord> {
    const userId = toObjectId(input.userId);
    if (!userId) throw new Error("Invalid user id");
    const doc = await MissionModel.create({
      userId,
      title: input.title,
      description: input.description,
      duration: input.duration,
      difficulty: input.difficulty,
      category: input.category,
      steps: input.steps,
      thingsToLookFor: input.thingsToLookFor,
      safetyTips: input.safetyTips,
      rewardPoints: input.rewardPoints,
      generatedBy: input.generatedBy,
      model: input.model,
      offlineGenerated: input.offlineGenerated,
      placeName: input.placeName,
      placeDistanceMeters: input.placeDistanceMeters,
      ...(input.createdAt ? { createdAt: new Date(input.createdAt) } : {}),
    });
    return this.mapMission(doc.toObject() as never);
  }

  private mapMission(doc: Record<string, unknown>): MissionRecord {
    const record = doc as unknown as {
      _id: Types.ObjectId;
      userId: Types.ObjectId;
      title: string;
      description: string;
      duration: number;
      difficulty: MissionRecord["difficulty"];
      category: MissionRecord["category"];
      steps: string[];
      thingsToLookFor?: string[];
      safetyTips: string[];
      rewardPoints: number;
      generatedBy: MissionRecord["generatedBy"];
      model: string;
      offlineGenerated?: boolean;
      placeName?: string;
      placeDistanceMeters?: number;
      createdAt: Date;
    };
    return {
      id: record._id.toString(),
      userId: String(record.userId),
      title: record.title,
      description: record.description,
      duration: record.duration,
      difficulty: record.difficulty,
      category: record.category,
      steps: record.steps ?? [],
      thingsToLookFor: record.thingsToLookFor ?? [],
      safetyTips: record.safetyTips ?? [],
      rewardPoints: record.rewardPoints,
      generatedBy: record.generatedBy,
      model: record.model,
      offlineGenerated: Boolean(record.offlineGenerated),
      placeName: record.placeName,
      placeDistanceMeters: record.placeDistanceMeters,
      createdAt: iso(record.createdAt),
    };
  }

  async getMission(id: string): Promise<MissionRecord | null> {
    const objectId = toObjectId(id);
    if (!objectId) return null;
    const doc = await MissionModel.findById(objectId).lean();
    return doc ? this.mapMission(doc as never) : null;
  }

  async listMissions(userId: string, limit = 25): Promise<MissionRecord[]> {
    const objectId = toObjectId(userId);
    if (!objectId) return [];
    const docs = await MissionModel.find({ userId: objectId })
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();
    return docs.map((doc) => this.mapMission(doc as never));
  }

  private mapCompletion(doc: Record<string, unknown>): CompletedMissionRecord {
    const record = doc as unknown as {
      _id: Types.ObjectId;
      userId: Types.ObjectId;
      missionId: Types.ObjectId;
      missionTitle: string;
      category: CompletedMissionRecord["category"];
      completedAt: Date;
      duration: number;
      points: number;
      syncedFromOffline?: boolean;
      note?: string;
      clientId?: string;
    };
    return {
      id: record._id.toString(),
      userId: String(record.userId),
      missionId: String(record.missionId),
      missionTitle: record.missionTitle,
      category: record.category,
      completedAt: iso(record.completedAt),
      duration: record.duration,
      points: record.points,
      syncedFromOffline: Boolean(record.syncedFromOffline),
      note: record.note,
    };
  }

  async createCompletion(input: CreateCompletionInput) {
    const userId = toObjectId(input.userId);
    const missionId = toObjectId(input.missionId);
    if (!userId || !missionId) throw new Error("Invalid id in completion");

    if (input.clientId) {
      const existing = await CompletedMissionModel.findOne({
        userId,
        clientId: input.clientId,
      }).lean();
      if (existing) {
        return { record: this.mapCompletion(existing as never), created: false as const };
      }
    }

    try {
      const doc = await CompletedMissionModel.create({
        userId,
        missionId,
        missionTitle: input.missionTitle,
        category: input.category,
        completedAt: new Date(input.completedAt),
        duration: input.duration,
        points: input.points,
        syncedFromOffline: input.syncedFromOffline,
        note: input.note,
        clientId: input.clientId,
      });
      return { record: this.mapCompletion(doc.toObject() as never), created: true as const };
    } catch (error) {
      // Duplicate key from a concurrent offline sync: return the winner.
      if (input.clientId) {
        const existing = await CompletedMissionModel.findOne({
          userId,
          clientId: input.clientId,
        }).lean();
        if (existing) {
          return {
            record: this.mapCompletion(existing as never),
            created: false as const,
          };
        }
      }
      throw error;
    }
  }

  async listCompletions(userId: string, limit = 200): Promise<CompletedMissionRecord[]> {
    const objectId = toObjectId(userId);
    if (!objectId) return [];
    const docs = await CompletedMissionModel.find({ userId: objectId })
      .sort({ completedAt: -1 })
      .limit(limit)
      .lean();
    return docs.map((doc) => this.mapCompletion(doc as never));
  }

  async countCompletions(userId: string): Promise<number> {
    const objectId = toObjectId(userId);
    if (!objectId) return 0;
    return CompletedMissionModel.countDocuments({ userId: objectId });
  }

  private mapDiscovery(doc: Record<string, unknown>): DiscoveryRecord {
    const record = doc as unknown as {
      _id: Types.ObjectId;
      userId: Types.ObjectId;
      missionId?: Types.ObjectId;
      imageUrl: string;
      identification: string;
      confidence: number;
      description: string;
      funFact?: string;
      category: DiscoveryRecord["category"];
      provider: DiscoveryRecord["provider"];
      model: string;
      analysisUnavailable?: boolean;
      simulated?: boolean;
      createdAt: Date;
    };
    return {
      id: record._id.toString(),
      userId: String(record.userId),
      missionId: record.missionId ? String(record.missionId) : undefined,
      imageUrl: record.imageUrl,
      identification: record.identification,
      confidence: record.confidence,
      description: record.description,
      funFact: record.funFact ?? "",
      category: record.category,
      provider: record.provider,
      model: record.model,
      analysisUnavailable: Boolean(record.analysisUnavailable),
      simulated: Boolean(record.simulated),
      createdAt: iso(record.createdAt),
    };
  }

  async createDiscovery(input: CreateDiscoveryInput): Promise<DiscoveryRecord> {
    const userId = toObjectId(input.userId);
    if (!userId) throw new Error("Invalid user id");
    const doc = await DiscoveryModel.create({
      userId,
      missionId: input.missionId ? toObjectId(input.missionId) : undefined,
      imageUrl: input.imageUrl,
      identification: input.identification,
      confidence: input.confidence,
      description: input.description,
      funFact: input.funFact,
      category: input.category,
      provider: input.provider,
      model: input.model,
      analysisUnavailable: input.analysisUnavailable,
      simulated: input.simulated,
      ...(input.createdAt ? { createdAt: new Date(input.createdAt) } : {}),
    });
    return this.mapDiscovery(doc.toObject() as never);
  }

  async getDiscovery(id: string): Promise<DiscoveryRecord | null> {
    const objectId = toObjectId(id);
    if (!objectId) return null;
    const doc = await DiscoveryModel.findById(objectId).lean();
    return doc ? this.mapDiscovery(doc as never) : null;
  }

  async listDiscoveries(userId: string, limit = 60): Promise<DiscoveryRecord[]> {
    const objectId = toObjectId(userId);
    if (!objectId) return [];
    const docs = await DiscoveryModel.find({ userId: objectId })
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();
    return docs.map((doc) => this.mapDiscovery(doc as never));
  }

  async deleteDiscovery(id: string, userId: string): Promise<boolean> {
    const objectId = toObjectId(id);
    const userObjectId = toObjectId(userId);
    if (!objectId || !userObjectId) return false;
    const result = await DiscoveryModel.deleteOne({ _id: objectId, userId: userObjectId });
    return result.deletedCount === 1;
  }

  private mapStats(doc: Record<string, unknown>): UserStatsRecord {
    const record = doc as unknown as {
      userId: Types.ObjectId;
      points?: number;
      streakDays?: number;
      longestStreak?: number;
      missionsCompleted?: number;
      discoveries?: number;
      totalMinutesOutside?: number;
      rewardedStreakMilestones?: number[];
      firstMissionBonusAwarded?: boolean;
      lastMissionDate?: Date;
      updatedAt?: Date;
    };
    return {
      userId: String(record.userId),
      points: record.points ?? 0,
      streakDays: record.streakDays ?? 0,
      longestStreak: record.longestStreak ?? 0,
      missionsCompleted: record.missionsCompleted ?? 0,
      discoveries: record.discoveries ?? 0,
      totalMinutesOutside: record.totalMinutesOutside ?? 0,
      rewardedStreakMilestones: record.rewardedStreakMilestones ?? [],
      firstMissionBonusAwarded: Boolean(record.firstMissionBonusAwarded),
      lastMissionDate: record.lastMissionDate ? iso(record.lastMissionDate) : undefined,
      level: levelFor(record.points ?? 0).name,
      updatedAt: iso(record.updatedAt ?? new Date()),
    };
  }

  async getStats(userId: string): Promise<UserStatsRecord | null> {
    const objectId = toObjectId(userId);
    if (!objectId) return null;
    const doc = await UserStatsModel.findOne({ userId: objectId }).lean();
    return doc ? this.mapStats(doc as never) : null;
  }

  async upsertStats(userId: string, patch: StatsPatch): Promise<UserStatsRecord> {
    const objectId = toObjectId(userId);
    if (!objectId) throw new Error("Invalid user id");

    const existing = await UserStatsModel.findOne({ userId: objectId }).lean();
    const points = patch.points ?? (existing?.points ?? 0);
    const update: Record<string, unknown> = {
      ...patch,
      level: levelFor(points).name,
    };
    if (patch.lastMissionDate) update.lastMissionDate = new Date(patch.lastMissionDate);

    const doc = await UserStatsModel.findOneAndUpdate(
      { userId: objectId },
      { $set: update, $setOnInsert: { userId: objectId } },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    ).lean();
    return this.mapStats(doc as never);
  }

  async resetDemoData(): Promise<number> {
    const demoUsers = await UserModel.find({ isDemo: true }).select("_id").lean();
    const ids = demoUsers.map((user) => user._id);
    if (ids.length === 0) return 0;
    await Promise.all([
      UserModel.deleteMany({ _id: { $in: ids } }),
      MissionModel.deleteMany({ userId: { $in: ids } }),
      CompletedMissionModel.deleteMany({ userId: { $in: ids } }),
      DiscoveryModel.deleteMany({ userId: { $in: ids } }),
      UserStatsModel.deleteMany({ userId: { $in: ids } }),
    ]);
    return ids.length;
  }
}
