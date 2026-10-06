/**
 * Validation schemas.
 *
 * Everything that crosses a trust boundary — request bodies and AI model
 * output — is parsed here before it reaches the database.
 */

import { z } from "zod";
import {
  ACTIVITIES,
  DIFFICULTIES,
  DISCOVERY_CATEGORIES,
  EXPERIENCE_LEVELS,
  MISSION_CATEGORIES,
} from "./types";

export const preferencesSchema = z.object({
  name: z.string().trim().min(1, "Please tell us your name").max(60),
  experience: z.enum(EXPERIENCE_LEVELS),
  availableTime: z.union([
    z.literal(10),
    z.literal(20),
    z.literal(30),
    z.literal(60),
    z.literal(120),
  ]),
  activities: z.array(z.enum(ACTIVITIES)).max(ACTIVITIES.length),
  difficulty: z.enum(DIFFICULTIES),
  surpriseMe: z.boolean(),
});

export const onboardingSchema = preferencesSchema.extend({
  locationPermission: z.boolean(),
  approximateLocation: z
    .object({
      lat: z.number().min(-90).max(90),
      lng: z.number().min(-180).max(180),
      label: z.string().trim().max(120).optional(),
    })
    .optional(),
});

export const missionRequestSchema = z.object({
  /** Optional nudges from the client; the rest comes from stored preferences. */
  availableTime: z.number().int().min(5).max(180).optional(),
  difficulty: z.enum(DIFFICULTIES).optional(),
  activities: z.array(z.enum(ACTIVITIES)).max(ACTIVITIES.length).optional(),
  /** True when the user asked for something random. */
  surpriseMe: z.boolean().optional(),
  /** Weather is only sent when it was actually fetched successfully. */
  weather: z
    .object({
      summary: z.string().max(120),
      temperatureC: z.number().min(-60).max(60),
      isDay: z.boolean(),
      precipitationMm: z.number().min(0).max(500).optional(),
    })
    .optional(),
  location: z
    .object({
      label: z.string().max(120).optional(),
    })
    .optional(),
  /** Previously completed mission titles, used to avoid repeats. */
  recentMissionTitles: z.array(z.string().max(120)).max(20).optional(),
  /** Previously saved discoveries, used to build on what the user found. */
  recentDiscoveries: z.array(z.string().max(120)).max(20).optional(),
  /** Set by the offline queue so we never call the model without a network. */
  forceOffline: z.boolean().optional(),
});

/**
 * The mission contract the model must satisfy. Deliberately strict: if a model
 * returns junk, the provider falls back instead of writing junk to Mongo.
 */
export const missionDraftSchema = z.object({
  title: z.string().trim().min(3).max(90),
  description: z.string().trim().min(10).max(400),
  duration: z.number().int().min(5).max(180),
  difficulty: z.enum(DIFFICULTIES),
  category: z.enum(MISSION_CATEGORIES),
  steps: z.array(z.string().trim().min(3).max(240)).min(2).max(8),
  thingsToLookFor: z.array(z.string().trim().min(2).max(160)).max(6),
  safetyTips: z.array(z.string().trim().min(4).max(240)).min(1).max(5),
  rewardPoints: z.number().int().min(20).max(400),
});

/** Shape we ask the vision model to emit before hedging is applied. */
export const visionDraftSchema = z.object({
  identification: z.string().trim().min(1).max(120),
  confidence: z.number().min(0).max(100),
  description: z.string().trim().min(1).max(600),
  funFact: z.string().trim().max(400).default(""),
  category: z.enum(DISCOVERY_CATEGORIES).default("unknown"),
  /** True when the model says it cannot tell what this is. */
  uncertain: z.boolean().default(false),
});

export const analyzeRequestSchema = z.object({
  /** Data URL. Size is enforced before it reaches the model. */
  imageUrl: z
    .string()
    .startsWith("data:image/", "Expected an image data URL")
    .max(8 * 1024 * 1024, "Image is too large — please retake at a smaller size"),
  missionId: z.string().trim().max(64).optional(),
  /** Optional user-provided hint, e.g. "I think it's a bird". */
  hint: z.string().trim().max(160).optional(),
  /** Demo mode analyses are clearly simulabeled as a sample. */
  simulate: z.boolean().optional(),
});

export const completeMissionSchema = z.object({
  missionId: z.string().trim().min(1).max(64),
  /** Actual minutes spent outside; falls back to the mission duration. */
  duration: z.number().int().min(1).max(600).optional(),
  note: z.string().trim().max(500).optional(),
  /** Set when the completion happened offline and was queued on the device. */
  completedAt: z.string().datetime().optional(),
  clientId: z.string().trim().max(64).optional(),
  syncedFromOffline: z.boolean().optional(),
});

export const syncSchema = z.object({
  completions: z.array(completeMissionSchema).max(50),
});

export const createDiscoverySchema = z.object({
  imageUrl: z
    .string()
    .startsWith("data:image/", "Expected an image data URL")
    .max(8 * 1024 * 1024),
  identification: z.string().trim().min(1).max(120),
  confidence: z.number().min(0).max(100),
  description: z.string().trim().max(600),
  funFact: z.string().trim().max(400).default(""),
  category: z.enum(DISCOVERY_CATEGORIES).default("unknown"),
  missionId: z.string().trim().max(64).optional(),
  provider: z.enum(["local", "huggingface", "heuristic"]),
  model: z.string().trim().max(80),
  analysisUnavailable: z.boolean().default(false),
  simulated: z.boolean().default(false),
  createdAt: z.string().datetime().optional(),
});

export type PreferencesInput = z.infer<typeof preferencesSchema>;
export type OnboardingInput = z.infer<typeof onboardingSchema>;
export type MissionRequestInput = z.infer<typeof missionRequestSchema>;
export type MissionDraftInput = z.infer<typeof missionDraftSchema>;
export type VisionDraftInput = z.infer<typeof visionDraftSchema>;
export type CompleteMissionInput = z.infer<typeof completeMissionSchema>;
export type CreateDiscoveryInput = z.infer<typeof createDiscoverySchema>;
