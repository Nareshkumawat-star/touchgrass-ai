/**
 * LocalQwenProvider — the default provider.
 *
 * Runs an open-weight Qwen model on the user's own machine through Ollama.
 * No account, no API key, and no photo ever leaves the device. The model name
 * is configurable (OLLAMA_MODEL / OLLAMA_VISION_MODEL) so any open-weight chat
 * or vision model can be dropped in without code changes.
 */

import { aiConfig } from "@/lib/config";
import { withSafety } from "./postprocess";
import { missionDraftSchema, visionDraftSchema } from "@/lib/schemas";
import { reviewMissionText, withSafetyLine } from "@/lib/safety";
import type { MissionDraft, ProviderStatus } from "@/lib/types";
import { clampConfidence } from "@/lib/utils";
import { extractJson } from "./json";
import {
  chat,
  dataUrlToBase64,
  listModels,
  showModel,
  warmUp,
  type OllamaModelInfo,
} from "./ollama-client";
import {
  MISSION_SYSTEM_PROMPT,
  VISION_SYSTEM_PROMPT,
  missionRepairPrompt,
  missionUserPrompt,
  visionUserPrompt,
} from "./prompts";
import {
  ProviderOutputError,
  ProviderUnavailableError,
  normalizeDraft,
  type AIProvider,
  type DiscoveryAnalysisInput,
  type DiscoveryAnalysisResult,
  type MissionGenerationInput,
  type MissionGenerationResult,
} from "./types";

interface ModelCache {
  models: OllamaModelInfo[];
  fetchedAt: number;
}

declare global {
  var __touchgrassOllamaModels: ModelCache | undefined;
}

const CACHE_TTL_MS = 10_000;

/** Vision-capable open-weight families Ollama users commonly have installed. */
const VISION_HINTS = /(vl|vision|llava|minicpm-v|moondream|gemma3|llama3\.2-vision)/i;

async function installedModels(force = false): Promise<OllamaModelInfo[]> {
  const cached = globalThis.__touchgrassOllamaModels;
  if (!force && cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
    return cached.models;
  }
  const models = await listModels();
  globalThis.__touchgrassOllamaModels = { models, fetchedAt: Date.now() };
  return models;
}

function normalizeName(name: string): string {
  return name.includes(":") ? name : `${name}:latest`;
}

/**
 * Picks the chat model: the configured one if installed, otherwise any usable
 * installed model (reported honestly in `notes`, never silently).
 */
async function resolveChatModel(): Promise<{
  model: string;
  fallbackNote?: string;
  models: OllamaModelInfo[];
}> {
  const models = await installedModels();
  const configured = normalizeName(aiConfig.ollama.model);
  if (models.some((model) => model.name === configured)) {
    return { model: configured, models };
  }
  const alternate = models.find((model) => !VISION_HINTS.test(model.name));
  if (!alternate) {
    throw new ProviderUnavailableError(
      "local",
      `Ollama is running but no chat model is installed`,
      `Run: ollama pull ${aiConfig.ollama.model}`,
    );
  }
  return {
    model: alternate.name,
    fallbackNote: `Configured model ${configured} is not installed — used ${alternate.name} instead.`,
    models,
  };
}

async function resolveVisionModel(): Promise<{
  model: string | null;
  note?: string;
  models: OllamaModelInfo[];
}> {
  const models = await installedModels();
  const configured = normalizeName(aiConfig.ollama.visionModel);
  if (models.some((model) => model.name === configured)) {
    return { model: configured, models };
  }

  const hinted = models.find((model) => VISION_HINTS.test(model.name));
  if (hinted) {
    return {
      model: hinted.name,
      note: `Configured vision model ${configured} is not installed — used ${hinted.name}.`,
      models,
    };
  }

  // Ask Ollama about capabilities before giving up (max 3 probes to stay fast).
  for (const model of models.slice(0, 3)) {
    const info = await showModel(model.name);
    if (info?.capabilities?.includes("vision")) {
      return {
        model: model.name,
        note: `Used ${model.name} (reported vision capability).`,
        models,
      };
    }
  }
  return { model: null, models };
}

export class LocalQwenProvider implements AIProvider {
  readonly id = "local" as const;
  readonly label = "Local AI";
  readonly execution = "local" as const;

  get model(): string {
    return aiConfig.ollama.model;
  }

  async generateMission(
    input: MissionGenerationInput,
  ): Promise<MissionGenerationResult> {
    const { model, fallbackNote } = await resolveChatModel();
    const notes: string[] = [];
    if (fallbackNote) notes.push(fallbackNote);

    const messages = [
      { role: "system" as const, content: MISSION_SYSTEM_PROMPT },
      { role: "user" as const, content: missionUserPrompt(input) },
    ];

    // Output length dominates latency on CPU inference, so the budget is tight.
    let raw = await chat({ model, messages, json: true, maxTokens: 420 });
    let draft: MissionDraft;
    const problems: string[] = [];

    try {
      draft = this.parseMission(raw);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      // One repair attempt — cheap, and it rescues most malformed replies.
      raw = await chat({
        model,
        messages: [
          ...messages,
          { role: "assistant" as const, content: raw.slice(0, 1500) },
          { role: "user" as const, content: missionRepairPrompt(raw, message) },
        ],
        json: true,
        maxTokens: 420,
      });
      draft = this.parseMission(raw);
      notes.push("The model was asked once more to fix its formatting.");
    }

    const verdict = reviewMissionText([
      draft.title,
      draft.description,
      ...draft.steps,
      ...draft.thingsToLookFor,
      ...draft.safetyTips,
    ]);
    if (!verdict.safe) {
      throw new ProviderOutputError(
        "local",
        `Generated mission rejected by the safety review (${verdict.reason})`,
        raw,
      );
    }

    const normalized = normalizeDraft(draft, input);
    problems.push(...normalized.notes);

    return {
      mission: {
        ...normalized.mission,
        safetyTips: withSafetyLine(normalized.mission.safetyTips),
      },
      provider: this.id,
      model,
      offlineGenerated: false,
      notes,
    };
  }

  private parseMission(raw: string): MissionDraft {
    let parsed: unknown;
    try {
      parsed = extractJson(raw);
    } catch (error) {
      throw new ProviderOutputError(
        "local",
        error instanceof Error ? error.message : "Unparseable mission",
        raw,
      );
    }
    const result = missionDraftSchema.safeParse(parsed);
    if (!result.success) {
      throw new ProviderOutputError(
        "local",
        result.error.issues
          .map((issue) => `${issue.path.join(".") || "mission"}: ${issue.message}`)
          .join("; "),
        raw,
      );
    }
    return result.data;
  }

  async analyzeDiscovery(
    input: DiscoveryAnalysisInput,
  ): Promise<DiscoveryAnalysisResult> {
    const { model } = await resolveVisionModel();
    if (!model) {
      throw new ProviderUnavailableError(
        "local",
        "No local vision model is installed",
        `Run: ollama pull ${aiConfig.ollama.visionModel}`,
      );
    }

    const base64 = dataUrlToBase64(input.imageDataUrl);
    const raw = await chat({
      model,
      json: true,
      maxTokens: 500,
      // Vision is far slower than text on CPU: encoding a 1024px photo plus a
      // 3B vision model can take 90s+ on a laptop. A too-short timeout here
      // would look like "no vision model available", which would be wrong.
      timeoutMs: Math.max(aiConfig.ollama.timeoutMs, aiConfig.ollama.visionTimeoutMs),
      messages: [
        { role: "system", content: VISION_SYSTEM_PROMPT },
        {
          role: "user",
          content: visionUserPrompt(input.hint),
          images: [base64],
        },
      ],
    });

    let parsed: unknown;
    try {
      parsed = extractJson(raw);
    } catch (error) {
      throw new ProviderOutputError(
        "local",
        error instanceof Error ? error.message : "Unparseable vision output",
        raw,
      );
    }
    const result = visionDraftSchema.safeParse(parsed);
    if (!result.success) {
      throw new ProviderOutputError(
        "local",
        result.error.issues.map((issue) => issue.message).join("; "),
        raw,
      );
    }

    const hedged = withSafety(result.data);
    return {
      ...hedged,
      confidence: result.data.uncertain
        ? Math.min(hedged.confidence, 45)
        : clampConfidence(hedged.confidence),
      provider: this.id,
      model,
      analysisUnavailable: false,
    };
  }

  async status(): Promise<ProviderStatus> {
    const base: ProviderStatus = {
      id: this.id,
      label: this.label,
      available: false,
      model: aiConfig.ollama.model,
      execution: "local",
      visionModel: aiConfig.ollama.visionModel,
      visionAvailable: false,
    };

    try {
      const chatModel = await resolveChatModel();
      const vision = await resolveVisionModel();
      // Warm the text model in the background so the first mission is fast.
      warmUp(chatModel.model);
      return {
        ...base,
        available: true,
        model: chatModel.model,
        visionModel: vision.model ?? aiConfig.ollama.visionModel,
        visionAvailable: Boolean(vision.model),
        detail: [
          `Ollama at ${aiConfig.ollama.baseUrl}`,
          chatModel.fallbackNote,
          vision.note,
        ]
          .filter(Boolean)
          .join(" · "),
      };
    } catch (error) {
      return {
        ...base,
        detail:
          error instanceof ProviderUnavailableError
            ? `${error.message}${error.detail ? ` — ${error.detail}` : ""}`
            : error instanceof Error
              ? error.message
              : "Ollama unavailable",
      };
    }
  }
}
