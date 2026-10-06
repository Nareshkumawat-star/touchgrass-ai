/**
 * Minimal Ollama client (no SDK dependency).
 *
 * Supports both text chat and multimodal chat (images), JSON-mode output and
 * a hard timeout so a slow local model can never hang a request forever.
 */

import { aiConfig } from "@/lib/config";
import type { AIProviderId } from "@/lib/types";
import { ProviderUnavailableError } from "./types";

export interface OllamaMessage {
  role: "system" | "user" | "assistant";
  content: string;
  /** Base64 (no data-URL prefix) images for vision models. */
  images?: string[];
}

export interface OllamaChatOptions {
  model: string;
  messages: OllamaMessage[];
  /** Force valid JSON output. */
  json?: boolean;
  temperature?: number;
  maxTokens?: number;
  timeoutMs?: number;
  providerId?: AIProviderId;
}

export interface OllamaModelInfo {
  name: string;
  family?: string;
  parameterSize?: string;
  capabilities?: string[];
}

async function request<T>(
  path: string,
  init: RequestInit & { timeoutMs: number },
  providerId: AIProviderId = "local",
): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), init.timeoutMs);
  try {
    const response = await fetch(`${aiConfig.ollama.baseUrl}${path}`, {
      ...init,
      signal: controller.signal,
      cache: "no-store",
    });
    if (!response.ok) {
      const body = await response.text().catch(() => "");
      throw new ProviderUnavailableError(
        providerId,
        `Ollama responded ${response.status}`,
        body.slice(0, 300),
      );
    }
    return (await response.json()) as T;
  } catch (error) {
    if (error instanceof ProviderUnavailableError) throw error;
    const aborted = error instanceof Error && error.name === "AbortError";
    throw new ProviderUnavailableError(
      providerId,
      aborted
        ? `Ollama timed out after ${init.timeoutMs}ms`
        : "Ollama is not reachable",
      error instanceof Error ? error.message : String(error),
    );
  } finally {
    clearTimeout(timer);
  }
}

/** Lists locally installed models. Throws when Ollama is not running. */
export async function listModels(timeoutMs = 2_500): Promise<OllamaModelInfo[]> {
  const data = await request<{
    models?: { name: string; details?: { family?: string; parameter_size?: string } }[];
  }>(
    "/api/tags",
    { method: "GET", timeoutMs },
    "local",
  );
  return (data.models ?? []).map((model) => ({
    name: model.name,
    family: model.details?.family,
    parameterSize: model.details?.parameter_size,
  }));
}

/** Reports the capabilities (completion / vision) of an installed model. */
export async function showModel(
  model: string,
  timeoutMs = 2_500,
): Promise<OllamaModelInfo | null> {
  try {
    const data = await request<{
      capabilities?: string[];
      details?: { family?: string; parameter_size?: string };
    }>(`/api/show`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ model }),
      timeoutMs,
    });
    return {
      name: model,
      family: data.details?.family,
      parameterSize: data.details?.parameter_size,
      capabilities: data.capabilities,
    };
  } catch {
    return null;
  }
}

export async function chat(options: OllamaChatOptions): Promise<string> {
  const {
    model,
    messages,
    json = false,
    temperature = aiConfig.ollama.temperature,
    maxTokens = 900,
    timeoutMs = aiConfig.ollama.timeoutMs,
    providerId = "local",
  } = options;

  const data = await request<{
    message?: { content?: string };
    error?: string;
  }>(
    "/api/chat",
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      timeoutMs,
      body: JSON.stringify({
        model,
        messages,
        stream: false,
        // Ollama's JSON mode constrains sampling to valid JSON.
        ...(json ? { format: "json" } : {}),
        keep_alive: aiConfig.ollama.keepAlive,
        options: {
          temperature,
          num_predict: maxTokens,
          num_ctx: 4096,
          top_p: 0.9,
          repeat_penalty: 1.1,
        },
      }),
    },
    providerId,
  );

  if (data.error) {
    throw new ProviderUnavailableError(providerId, "Ollama returned an error", data.error);
  }
  return data.message?.content ?? "";
}

interface WarmState {
  at: number;
  model: string;
}

declare global {
  var __touchgrassWarm: WarmState | undefined;
}

/**
 * Loads a model into memory ahead of the first real request.
 *
 * A cold 3B model can spend a minute just being read from disk; doing that in
 * the background while the dashboard renders means "Generate My Mission"
 * answers in seconds instead. Fire-and-forget by design: failure is harmless.
 */
export function warmUp(model: string, maxAgeMs = 5 * 60_000): void {
  const last = globalThis.__touchgrassWarm;
  if (last && last.model === model && Date.now() - last.at < maxAgeMs) return;
  globalThis.__touchgrassWarm = { at: Date.now(), model };
  void chat({
    model,
    messages: [{ role: "user", content: "hi" }],
    maxTokens: 1,
    timeoutMs: 120_000,
  }).catch(() => undefined);
}

/** Splits a data URL into base64 payload, validating the mime type. */
export function dataUrlToBase64(dataUrl: string): string {
  const match = /^data:image\/(png|jpe?g|webp|gif);base64,(.+)$/i.exec(dataUrl.trim());
  if (!match) {
    throw new ProviderUnavailableError(
      "local",
      "Unsupported image format",
      "Expected a PNG, JPEG, WebP or GIF data URL",
    );
  }
  return match[2];
}
