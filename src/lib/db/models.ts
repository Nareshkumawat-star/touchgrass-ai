/**
 * Mongoose models — User, Mission, CompletedMission, Discovery, UserStats.
 *
 * Schemas mirror the shapes in `lib/types.ts` exactly. The local JSON store
 * uses the same documents so switching storage never changes application code.
 */

import { Schema, model, models, type Model, type InferSchemaType } from "mongoose";
import {
  ACTIVITIES,
  DIFFICULTIES,
  DISCOVERY_CATEGORIES,
  EXPERIENCE_LEVELS,
  MISSION_CATEGORIES,
} from "@/lib/types";
import { LEVELS } from "@/lib/points";

const preferencesSchema = new Schema(
  {
    experience: { type: String, enum: EXPERIENCE_LEVELS, required: true },
    // Kept as a plain number so the schema type matches `UserPreferences`;
    // the allowed values are enforced by Zod at the API boundary.
    availableTime: { type: Number, required: true, min: 5, max: 180 },
    activities: {
      type: [String],
      enum: [...ACTIVITIES],
      default: [],
      validate: {
        validator: (value: string[]) => value.length <= ACTIVITIES.length,
        message: "Too many preferred activities",
      },
    },
    difficulty: { type: String, enum: DIFFICULTIES, required: true },
    surpriseMe: { type: Boolean, default: false },
  },
  { _id: false },
);

const userSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 60 },
    preferences: { type: preferencesSchema, required: true },
    locationPermission: { type: Boolean, default: false },
    approximateLocation: {
      type: new Schema(
        {
          lat: { type: Number, required: true, min: -90, max: 90 },
          lng: { type: Number, required: true, min: -180, max: 180 },
          label: { type: String, maxlength: 120 },
        },
        { _id: false },
      ),
      required: false,
    },
  },
  { timestamps: true, versionKey: false },
);
userSchema.index({ createdAt: -1 });

const missionSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    title: { type: String, required: true, trim: true, maxlength: 90 },
    description: { type: String, required: true, trim: true, maxlength: 400 },
    duration: { type: Number, required: true, min: 5, max: 180 },
    difficulty: { type: String, enum: DIFFICULTIES, required: true },
    category: { type: String, enum: MISSION_CATEGORIES, required: true },
    steps: { type: [String], required: true },
    thingsToLookFor: { type: [String], default: [] },
    safetyTips: { type: [String], required: true },
    rewardPoints: { type: Number, required: true, min: 20, max: 400 },
    generatedBy: { type: String, enum: ["local", "huggingface", "heuristic"], required: true },
    model: { type: String, required: true, maxlength: 80 },
    offlineGenerated: { type: Boolean, default: false },
    placeName: { type: String, maxlength: 120 },
    placeDistanceMeters: { type: Number, min: 0 },
  },
  { timestamps: { createdAt: true, updatedAt: false }, versionKey: false },
);
missionSchema.index({ userId: 1, createdAt: -1 });

const completedMissionSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    missionId: { type: Schema.Types.ObjectId, ref: "Mission", required: true },
    missionTitle: { type: String, required: true, maxlength: 90 },
    category: { type: String, enum: MISSION_CATEGORIES, required: true },
    completedAt: { type: Date, required: true },
    duration: { type: Number, required: true, min: 1, max: 600 },
    points: { type: Number, required: true, min: 0 },
    syncedFromOffline: { type: Boolean, default: false },
    note: { type: String, maxlength: 500 },
    clientId: { type: String, maxlength: 64 },
  },
  { timestamps: { createdAt: true, updatedAt: false }, versionKey: false },
);
completedMissionSchema.index({ userId: 1, completedAt: -1 });
// Idempotency for offline syncs: the same device event can never pay out twice.
completedMissionSchema.index(
  { userId: 1, clientId: 1 },
  { unique: true, partialFilterExpression: { clientId: { $type: "string" } } },
);

const discoverySchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    missionId: { type: Schema.Types.ObjectId, ref: "Mission" },
    imageUrl: { type: String, required: true },
    identification: { type: String, required: true, maxlength: 120 },
    confidence: { type: Number, required: true, min: 0, max: 100 },
    description: { type: String, required: true, maxlength: 600 },
    funFact: { type: String, default: "", maxlength: 400 },
    category: { type: String, enum: DISCOVERY_CATEGORIES, required: true },
    provider: { type: String, enum: ["local", "huggingface", "heuristic"], required: true },
    model: { type: String, required: true, maxlength: 80 },
    analysisUnavailable: { type: Boolean, default: false },
  },
  { timestamps: { createdAt: true, updatedAt: false }, versionKey: false },
);
discoverySchema.index({ userId: 1, createdAt: -1 });

const userStatsSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
      index: true,
    },
    points: { type: Number, default: 0, min: 0 },
    streakDays: { type: Number, default: 0, min: 0 },
    longestStreak: { type: Number, default: 0, min: 0 },
    missionsCompleted: { type: Number, default: 0, min: 0 },
    discoveries: { type: Number, default: 0, min: 0 },
    totalMinutesOutside: { type: Number, default: 0, min: 0 },
    rewardedStreakMilestones: { type: [Number], default: [] },
    firstMissionBonusAwarded: { type: Boolean, default: false },
    lastMissionDate: { type: Date },
    level: {
      type: String,
      enum: LEVELS.map((level) => level.name),
      default: LEVELS[0].name,
    },
  },
  { timestamps: true, versionKey: false },
);

export type UserDoc = InferSchemaType<typeof userSchema>;
export type MissionDoc = InferSchemaType<typeof missionSchema>;
export type CompletedMissionDoc = InferSchemaType<typeof completedMissionSchema>;
export type DiscoveryDoc = InferSchemaType<typeof discoverySchema>;
export type UserStatsDoc = InferSchemaType<typeof userStatsSchema>;

export const UserModel: Model<UserDoc> =
  (models.User as Model<UserDoc>) ?? model<UserDoc>("User", userSchema);

export const MissionModel: Model<MissionDoc> =
  (models.Mission as Model<MissionDoc>) ?? model<MissionDoc>("Mission", missionSchema);

export const CompletedMissionModel: Model<CompletedMissionDoc> =
  (models.CompletedMission as Model<CompletedMissionDoc>) ??
  model<CompletedMissionDoc>("CompletedMission", completedMissionSchema);

export const DiscoveryModel: Model<DiscoveryDoc> =
  (models.Discovery as Model<DiscoveryDoc>) ??
  model<DiscoveryDoc>("Discovery", discoverySchema);

export const UserStatsModel: Model<UserStatsDoc> =
  (models.UserStats as Model<UserStatsDoc>) ??
  model<UserStatsDoc>("UserStats", userStatsSchema);

/** Indexes are created on first use; failures are non-fatal (e.g. restricted DB). */
export async function ensureIndexes(): Promise<void> {
  try {
    await Promise.all([
      UserModel.init(),
      MissionModel.init(),
      CompletedMissionModel.init(),
      DiscoveryModel.init(),
      UserStatsModel.init(),
    ]);
  } catch (error) {
    console.warn("[touchgrass] index creation skipped:", error);
  }
}
