/**
 * HuggingFaceProvider — the remote, opt-in alternative.
 *
 * Speaks the OpenAI-compatible chat-completions API exposed by the Hugging Face
 * router, so any hosted open-weight model (Qwen2.5, Qwen2.5-VL, ...) works by
 * changing an environment variable. It is only used when it is explicitly
 * enabled AND a token is configured: sending a photo to a server must always be
 * a deliberate choice, never a silent fallback.
 */

import { aiConfig } from "@/lib/config";
import { missionDraftSchema, visionDraftSchema } from "@/lib/schemas";
import { reviewMissionText, withSafetyLine } from "@/lib/safety";
import type { MissionDraft, ProviderStatus } from "@/lib/types";
import { clampConfidence } from "@/lib/utils";
import { extractJson } from "./json";
import { withSafety } from "./postprocess";
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

interface ChatMessage {
  role: "system" | "user" | "assistant";
  content:
    | string
    | { type: "text"; text: string }[]
    | ({ type: "image_url"; image_url: { url: string } } | { type: "text"; text: string })[];
}

export class HuggingFaceProvider implements AIProvider {
  readonly id = "huggingface" as const;
  readonly label = "Online AI";
  readonly execution = "remote" as const;

  get model(): string {
    return aiConfig.huggingface.model;
  }

  private get token(): string | undefined {
    return aiConfig.huggingface.token;
  }

  private async complete(
    body: Record<string, unknown>,
    timeoutMs: number,
  ): Promise<string> {
    const token = this.token;
    if (!token) {
      throw new ProviderUnavailableError(
        "huggingface",
        "No Hugging Face token configured",
        "Set HUGGINGFACE_API_TOKEN to enable the online provider",
      );
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(
        `${aiConfig.huggingface.baseUrl.replace(/\/$/, "")}/chat/completions`,
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
            authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(body),
          signal: controller.signal,
          cache: "no-store",
        },
      );

      if (!response.ok) {
        const detail = await response.text().catch(() => "");
        throw new ProviderUnavailableError(
          "huggingface",
          `Hugging Face responded ${response.status}`,
          detail.slice(0, 300),
        );
      }

      const data = (await response.json()) as {
        choices?: { message?: { content?: string } }[];
      };
      return data.choices?.[0]?.message?.content ?? "";
    } catch (error) {
      if (error instanceof ProviderUnavailableError) throw error;
      const aborted = error instanceof Error && error.name === "AbortError";
      throw new ProviderUnavailableError(
        "huggingface",
        aborted ? "Hugging Face request timed out" : "Hugging Face is not reachable",
        error instanceof Error ? error.message : String(error),
      );
    } finally {
      clearTimeout(timer);
    }
  }

  async generateMission(
    input: MissionGenerationInput,
  ): Promise<MissionGenerationResult> {
    const messages: ChatMessage[] = [
      { role: "system", content: MISSION_SYSTEM_PROMPT },
      { role: "user", content: missionUserPrompt(input) },
    ];

    let raw = await this.complete(
      {
        model: this.model,
        messages,
        temperature: 0.7,
        max_tokens: 900,
        response_format: { type: "json_object" },
      },
      aiConfig.huggingface.timeoutMs,
    );

    let draft: MissionDraft;
    try {
      draft = this.parseMission(raw);
    } catch (error) {
      raw = await this.complete(
        {
          model: this.model,
          messages: [
            ...messages,
            { role: "assistant", content: raw.slice(0, 1500) },
            {
              role: "user",
              content: missionRepairPrompt(
                raw,
                error instanceof Error ? error.message : "invalid output",
              ),
            },
          ],
          temperature: 0.4,
          max_tokens: 900,
          response_format: { type: "json_object" },
        },
        aiConfig.huggingface.timeoutMs,
      );
      draft = this.parseMission(raw);
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
        "huggingface",
        `Generated mission rejected by the safety review (${verdict.reason})`,
        raw,
      );
    }

    const normalized = normalizeDraft(draft, input);
    return {
      mission: {
        ...normalized.mission,
        safetyTips: withSafetyLine(normalized.mission.safetyTips),
      },
      provider: this.id,
      model: this.model,
      offlineGenerated: false,
      notes: [
        `Generated remotely by ${this.model} via the Hugging Face router.`,
        ...normalized.notes,
      ],
    };
  }

  private parseMission(raw: string): MissionDraft {
    let parsed: unknown;
    try {
      parsed = extractJson(raw);
    } catch (error) {
      throw new ProviderOutputError(
        "huggingface",
        error instanceof Error ? error.message : "Unparseable mission",
        raw,
      );
    }
    const result = missionDraftSchema.safeParse(parsed);
    if (!result.success) {
      throw new ProviderOutputError(
        "huggingface",
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
    const raw = await this.complete(
      {
        model: aiConfig.huggingface.visionModel,
        temperature: 0.3,
        max_tokens: 600,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: VISION_SYSTEM_PROMPT },
          {
            role: "user",
            content: [
              { type: "text", text: visionUserPrompt(input.hint) },
              { type: "image_url", image_url: { url: input.imageDataUrl } },
            ],
          },
        ],
      },
      aiConfig.huggingface.timeoutMs,
    );

    let parsed: unknown;
    try {
      parsed = extractJson(raw);
    } catch (error) {
      throw new ProviderOutputError(
        "huggingface",
        error instanceof Error ? error.message : "Unparseable vision output",
        raw,
      );
    }
    const result = visionDraftSchema.safeParse(parsed);
    if (!result.success) {
      throw new ProviderOutputError(
        "huggingface",
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
      model: aiConfig.huggingface.visionModel,
      analysisUnavailable: false,
    };
  }

  async status(): Promise<ProviderStatus> {
    const configured = Boolean(this.token);
    return {
      id: this.id,
      label: this.label,
      available: configured,
      model: this.model,
      execution: "remote",
      visionModel: aiConfig.huggingface.visionModel,
      visionAvailable: configured,
      detail: configured
        ? `Hugging Face token configured. Photos and prompts are sent to ${aiConfig.huggingface.baseUrl}.`
        : "No HUGGINGFACE_API_TOKEN set — this provider is disabled.",
    };
  }
}
