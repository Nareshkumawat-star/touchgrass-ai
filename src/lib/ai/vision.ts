/**
 * Vision orchestration.
 *
 * Tries each configured provider in order. If none can analyse the photo we
 * return an explicit "analysis unavailable" result — we never invent an
 * identification. Demo mode may additionally return a clearly-labelled sample.
 */

import { OFFLINE_MODEL_ID } from "./heuristic";
import { getProviderChain } from "./provider";
import type { DiscoveryAnalysisResult } from "./types";

export interface DiscoveryAnalysisOutcome extends DiscoveryAnalysisResult {
  /** True when nothing identified the photo. */
  analysisUnavailable: boolean;
  /** True for the explicit demo-only sample (never presented as a real result). */
  simulated?: boolean;
  /** Why the real analysis could not run, shown to the user. */
  unavailableReason?: string;
  /** One line per provider that was tried, for transparency/debugging. */
  attempts: { provider: string; error: string }[];
}

const SAMPLE_ANALYSIS = {
  identification: "Possible neem leaf",
  confidence: 82,
  description:
    "Sample result for the demo: a leaf with a serrated edge and a single central vein, which is the usual shape of a neem leaf. A real model would look at the full photo before deciding.",
  funFact:
    "Neem trees are widely planted in South Asia and their leaves are a common sight on streets and in parks.",
  category: "leaf" as const,
};

/**
 * Identifies an outdoor discovery from a photo.
 *
 * @param simulate When true (demo mode only) a clearly-labelled sample is
 *   returned if no vision model is reachable, so the demo can continue.
 */
export async function analyzeDiscoveryImage(input: {
  imageDataUrl: string;
  hint?: string;
  simulate?: boolean;
}): Promise<DiscoveryAnalysisOutcome> {
  const chain = await getProviderChain();
  const attempts: { provider: string; error: string }[] = [];

  for (const provider of chain) {
    try {
      const result = await provider.analyzeDiscovery({
        imageDataUrl: input.imageDataUrl,
        hint: input.hint,
      });
      return { ...result, attempts };
    } catch (error) {
      attempts.push({
        provider: provider.id,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  const reason =
    attempts.find((attempt) => attempt.provider === "local")?.error ??
    "No vision model is available";

  if (input.simulate) {
    return {
      ...SAMPLE_ANALYSIS,
      provider: "heuristic",
      model: `${OFFLINE_MODEL_ID}-sample`,
      analysisUnavailable: false,
      simulated: true,
      unavailableReason: `${reason}. Showing a labelled sample result instead.`,
      attempts,
    };
  }

  return {
    identification: "We could not identify this photo",
    confidence: 0,
    description:
      "No open-weight vision model is reachable, so nothing was analysed. Your photo has not been sent anywhere.",
    funFact: "",
    category: "unknown",
    provider: chain[chain.length - 1]?.id ?? "heuristic",
    model: "unavailable",
    analysisUnavailable: true,
    unavailableReason: reason,
    attempts,
  };
}
