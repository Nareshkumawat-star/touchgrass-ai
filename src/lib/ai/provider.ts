/**
 * Provider registry — the swap point.
 *
 * The application calls `generateMission()` and `analyzeDiscoveryImage()`.
 * Which model answers is decided here, from configuration, never hard-coded:
 *
 *   AIProvider
 *   ├── LocalQwenProvider      (default — open weights, on your machine)
 *   ├── HuggingFaceProvider    (opt-in remote open-weight models)
 *   └── OfflineTemplateProvider (always available, no model at all)
 *
 * Adding a vendor = one class implementing `AIProvider` + one entry in
 * `PROVIDER_FACTORIES`.
 */

import { aiConfig } from "@/lib/config";
import type { ProviderStatus } from "@/lib/types";
import { HuggingFaceProvider } from "./huggingface";
import { OfflineTemplateProvider } from "./heuristic";
import { licenseFor } from "./models";
import { LocalQwenProvider } from "./qwen";
import {
  ProviderOutputError,
  ProviderUnavailableError,
  type AIProvider,
  type DiscoveryAnalysisInput,
  type DiscoveryAnalysisResult,
  type MissionGenerationInput,
  type MissionGenerationResult,
} from "./types";

export type { AIProvider } from "./types";

const PROVIDER_FACTORIES: Record<string, () => AIProvider> = {
  local: () => new LocalQwenProvider(),
  huggingface: () => new HuggingFaceProvider(),
  heuristic: () => new OfflineTemplateProvider(),
};

/** Providers in configured priority order. Unknown names are ignored. */
export function createProviders(): AIProvider[] {
  const ordered = aiConfig.providerOrder
    .map((id) => PROVIDER_FACTORIES[id])
    .filter((factory): factory is () => AIProvider => Boolean(factory));

  const instances = ordered.map((factory) => factory());
  // The offline provider must always exist, last, as the guaranteed floor.
  if (!instances.some((provider) => provider.id === "heuristic")) {
    instances.push(new OfflineTemplateProvider());
  } else {
    instances.sort((a, b) => (a.id === "heuristic" ? 1 : b.id === "heuristic" ? -1 : 0));
  }
  return instances;
}

let cachedChain: AIProvider[] | null = null;

export async function getProviderChain(): Promise<AIProvider[]> {
  if (!cachedChain) cachedChain = createProviders();
  return cachedChain;
}

export async function getProvider(id: string): Promise<AIProvider | null> {
  const chain = await getProviderChain();
  return chain.find((provider) => provider.id === id) ?? null;
}

export interface MissionGenerationOutcome {
  result: MissionGenerationResult;
  /** Why earlier providers in the chain were skipped or failed. */
  attempts: { provider: string; error: string; unavailable: boolean }[];
  /** Set when we had to fall back from a model to reviewed templates. */
  fellBackToTemplates: boolean;
}

/**
 * Generates a mission, walking the provider chain.
 *
 * A failing model (not installed, timed out, invalid JSON, unsafe content)
 * never breaks the app: the next provider is tried, and the offline template
 * provider guarantees a usable, safe mission at the end.
 */
export async function generateMission(
  input: MissionGenerationInput,
  options: { forceOffline?: boolean } = {},
): Promise<MissionGenerationOutcome> {
  const chain = await getProviderChain();
  const attempts: MissionGenerationOutcome["attempts"] = [];

  for (const provider of chain) {
    if (options.forceOffline && provider.id !== "heuristic") continue;
    // Skip remote providers that are not configured, without a network hop.
    if (provider.id === "huggingface") {
      const status = await provider.status();
      if (!status.available) {
        attempts.push({
          provider: provider.id,
          error: "Not configured",
          unavailable: true,
        });
        continue;
      }
    }

    try {
      const result = await provider.generateMission(input);
      return {
        result,
        attempts,
        fellBackToTemplates: result.provider === "heuristic" && attempts.length > 0,
      };
    } catch (error) {
      const unavailable =
        error instanceof ProviderUnavailableError || error instanceof ProviderOutputError;
      attempts.push({
        provider: provider.id,
        error:
          error instanceof ProviderUnavailableError && error.detail
            ? `${error.message} — ${error.detail}`
            : error instanceof Error
              ? error.message
              : String(error),
        unavailable,
      });
    }
  }

  // Unreachable: the offline provider is always in the chain and cannot fail
  // for availability reasons, but we keep a hard floor anyway.
  throw new Error("No AI provider could generate a mission");
}

/** Identifies a photo with the first provider that can actually do it. */
export async function analyzeDiscovery(
  input: DiscoveryAnalysisInput,
): Promise<DiscoveryAnalysisResult> {
  const { analyzeDiscoveryImage } = await import("./vision");
  return analyzeDiscoveryImage(input);
}

interface StatusCache {
  statuses: ProviderStatus[];
  fetchedAt: number;
}

declare global {
  var __touchgrassStatusCache: StatusCache | undefined;
}

const STATUS_TTL_MS = 10_000;

/** Status of every configured provider, in priority order (cached briefly). */
export async function getProviderStatuses(force = false): Promise<ProviderStatus[]> {
  const cached = globalThis.__touchgrassStatusCache;
  if (!force && cached && Date.now() - cached.fetchedAt < STATUS_TTL_MS) {
    return cached.statuses;
  }
  const statuses = await probeStatuses();
  globalThis.__touchgrassStatusCache = { statuses, fetchedAt: Date.now() };
  return statuses;
}

async function probeStatuses(): Promise<ProviderStatus[]> {
  const chain = await getProviderChain();
  const statuses = await Promise.all(
    chain.map(async (provider) => {
      try {
        return await provider.status();
      } catch (error) {
        return {
          id: provider.id,
          label: provider.label,
          available: false,
          model: provider.model,
          execution: provider.execution,
          visionAvailable: false,
          detail: error instanceof Error ? error.message : "Unavailable",
        } satisfies ProviderStatus;
      }
    }),
  );

  // Attach the exact model + licence so the UI never has to guess.
  return statuses.map((status) => ({
    ...status,
    license: licenseFor(status.model),
    visionLicense: status.visionModel ? licenseFor(status.visionModel) : undefined,
  }));
}

/** The provider that would answer a mission request right now. */
export async function getActiveProviderStatus(): Promise<ProviderStatus> {
  const statuses = await getProviderStatuses();
  const active =
    statuses.find((status) => status.id === "local" && status.available) ??
    statuses.find((status) => status.available) ??
    statuses[statuses.length - 1];

  // Vision availability is reported from whichever provider can do it.
  const visionFrom = statuses.find((status) => status.visionAvailable);
  return {
    ...active,
    visionAvailable: Boolean(visionFrom),
    visionModel: visionFrom?.visionModel ?? active.visionModel,
  };
}
