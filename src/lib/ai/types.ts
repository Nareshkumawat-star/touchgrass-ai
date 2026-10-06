/**
 * The AI abstraction.
 *
 * Everything above this layer (routes, services, UI) talks to the
 * `AIProvider` interface only. Adding a vendor means adding one file and one
 * entry in the registry — no changes anywhere else.
 */

import type {
  Activity,
  AIProviderId,
  Difficulty,
  DiscoveryCategory,
  MissionDraft,
  ProviderStatus,
  UserPreferences,
} from "@/lib/types";

export interface MissionWeatherContext {
  summary: string;
  temperatureC: number;
  isDay: boolean;
  precipitationMm?: number;
}

export interface MissionGenerationInput {
  preferences: UserPreferences;
  availableTime?: number;
  difficulty?: Difficulty;
  activities?: Activity[];
  surpriseMe?: boolean;
  weather?: MissionWeatherContext;
  /** City-level only, never a precise coordinate. */
  locationLabel?: string;
  nearbyPlaceName?: string;
  recentMissionTitles?: string[];
  recentDiscoveries?: string[];
}

export interface MissionGenerationResult {
  mission: MissionDraft;
  provider: AIProviderId;
  model: string;
  /** True when no model was contacted at all (templates / offline). */
  offlineGenerated: boolean;
  /** Anything worth telling the user, e.g. "trimmed to your time budget". */
  notes: string[];
}

export interface DiscoveryAnalysisInput {
  /** `data:image/jpeg;base64,...` */
  imageDataUrl: string;
  hint?: string;
}

export interface DiscoveryAnalysisResult {
  identification: string;
  confidence: number;
  description: string;
  funFact: string;
  category: DiscoveryCategory;
  provider: AIProviderId;
  model: string;
  /** True when no vision model was reachable — we say so instead of guessing. */
  analysisUnavailable: boolean;
  /** Set only when the provider could not run the vision model. */
  unavailableReason?: string;
}

export interface AIProvider {
  readonly id: AIProviderId;
  readonly label: string;
  /** The model that will actually be used for text generation. */
  readonly model: string;
  /** True when the provider runs on the user's own machine. */
  readonly execution: "local" | "remote";

  generateMission(input: MissionGenerationInput): Promise<MissionGenerationResult>;
  analyzeDiscovery(input: DiscoveryAnalysisInput): Promise<DiscoveryAnalysisResult>;
  status(): Promise<ProviderStatus>;
}

/** Thrown when a provider cannot serve a request; the resolver moves on. */
export class ProviderUnavailableError extends Error {
  readonly providerId: AIProviderId;
  readonly detail: string;

  constructor(providerId: AIProviderId, message: string, detail = "") {
    super(message);
    this.name = "ProviderUnavailableError";
    this.providerId = providerId;
    this.detail = detail;
  }
}

/** Thrown when a provider replied, but with output we refuse to trust. */
export class ProviderOutputError extends Error {
  readonly providerId: AIProviderId;
  readonly raw: string;

  constructor(providerId: AIProviderId, message: string, raw = "") {
    super(message);
    this.name = "ProviderOutputError";
    this.providerId = providerId;
    this.raw = raw;
  }
}

/**
 * Shared post-processing for any model-produced mission:
 * clamps numbers, trims text, forces the safety line, and honours the
 * user's time budget regardless of what the model decided.
 */
export function normalizeDraft(
  draft: MissionDraft,
  input: MissionGenerationInput,
): { mission: MissionDraft; notes: string[] } {
  const notes: string[] = [];
  const timeBudget = input.availableTime ?? input.preferences.availableTime;

  let duration = draft.duration;
  if (duration > timeBudget) {
    duration = timeBudget;
    notes.push(`Time kept inside your ${timeBudget}-minute budget.`);
  }

  const expectedDifficulty = input.difficulty ?? input.preferences.difficulty;
  const difficulty = draft.difficulty;
  if (difficulty !== expectedDifficulty && !input.surpriseMe && !input.preferences.surpriseMe) {
    notes.push(`Difficulty adjusted to ${difficulty}.`);
  }

  return {
    mission: {
      ...draft,
      duration,
      title: draft.title.trim().slice(0, 90),
      description: draft.description.trim().slice(0, 400),
      steps: draft.steps.map((step) => step.trim()).filter(Boolean).slice(0, 8),
      thingsToLookFor: draft.thingsToLookFor
        .map((item) => item.trim())
        .filter(Boolean)
        .slice(0, 6),
      safetyTips: draft.safetyTips.map((tip) => tip.trim()).filter(Boolean).slice(0, 5),
    },
    notes,
  };
}
