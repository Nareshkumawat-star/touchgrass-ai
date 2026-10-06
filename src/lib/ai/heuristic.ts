/**
 * Offline templates provider.
 *
 * Always available: no model, no network, no API key. Used when no AI model can
 * be reached, and as the safety fallback when a model produces something we
 * refuse to show. Missions generated here are flagged `offlineGenerated: true`
 * and the UI labels them clearly — we never pretend this is model output.
 */

import { CATEGORY_LABELS, type Difficulty, type ProviderStatus } from "@/lib/types";
import { withSafetyLine } from "@/lib/safety";
import { pickTemplate } from "./templates";
import {
  ProviderUnavailableError,
  normalizeDraft,
  type AIProvider,
  type DiscoveryAnalysisResult,
  type MissionGenerationInput,
  type MissionGenerationResult,
} from "./types";

export const OFFLINE_MODEL_ID = "touchgrass-templates-v1";

const DIFFICULTY_WEIGHT: Record<Difficulty, number> = {
  easy: 0,
  medium: 10,
  challenging: 20,
};

function scoreFor(minutes: number, difficulty: Difficulty): number {
  const raw = 60 + minutes * 0.6 + DIFFICULTY_WEIGHT[difficulty];
  return Math.max(60, Math.min(150, Math.round(raw / 5) * 5));
}

export class OfflineTemplateProvider implements AIProvider {
  readonly id = "heuristic" as const;
  readonly label = "Offline templates";
  readonly model = OFFLINE_MODEL_ID;
  readonly execution = "local" as const;

  async generateMission(
    input: MissionGenerationInput,
  ): Promise<MissionGenerationResult> {
    const availableTime = input.availableTime ?? input.preferences.availableTime;
    const difficulty = input.difficulty ?? input.preferences.difficulty;
    const activities = input.activities ?? input.preferences.activities;
    const recentTitles = input.recentMissionTitles ?? [];

    const { template, reason } = pickTemplate({
      activities,
      availableTime,
      recentTitles,
      rotation: recentTitles.length,
    });

    const steps = template.steps(availableTime, difficulty);
    const draft = {
      title: template.title,
      description: template.description,
      duration: Math.min(availableTime, Math.max(template.minMinutes, 10)),
      difficulty,
      category: template.category,
      steps,
      thingsToLookFor: template.thingsToLookFor,
      safetyTips: template.safetyTips,
      rewardPoints: scoreFor(Math.min(availableTime, 60), difficulty),
    };

    const normalized = normalizeDraft(draft, input);
    const notes = [
      `Offline mission generator used (${CATEGORY_LABELS[template.category]} template) — no AI model was contacted.`,
      reason,
    ];

    if (!input.weather) {
      notes.push("No weather data available, so the mission does not assume any conditions.");
    }

    return {
      mission: {
        ...normalized.mission,
        safetyTips: withSafetyLine(normalized.mission.safetyTips),
      },
      provider: this.id,
      model: this.model,
      offlineGenerated: true,
      notes,
    };
  }

  /**
   * There is no vision model here. Rather than inventing an identification, we
   * refuse — the resolver turns this into an honest "analysis unavailable"
   * response for the user.
   */
  async analyzeDiscovery(): Promise<DiscoveryAnalysisResult> {
    throw new ProviderUnavailableError(
      "heuristic",
      "No vision model available",
      "Templates cannot identify photos. Start Ollama with a vision model, or configure a Hugging Face token.",
    );
  }

  async status(): Promise<ProviderStatus> {
    return {
      id: this.id,
      label: this.label,
      available: true,
      model: this.model,
      execution: "local",
      visionModel: undefined,
      visionAvailable: false,
      detail: "Hand-reviewed mission templates. Always available, no model required.",
    };
  }
}
