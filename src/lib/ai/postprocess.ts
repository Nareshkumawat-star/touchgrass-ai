/**
 * Post-processing for vision output.
 *
 * Two jobs:
 *  1. Never let the UI claim certainty. Identifications are hedged and the
 *     confidence is capped, no matter how confident the model sounded.
 *  2. Strip medical / edibility / safety advice. A vision model must never be
 *     the reason someone eats or touches something in the wild.
 */

import type { VisionDraftInput } from "@/lib/schemas";
import type { DiscoveryCategory } from "@/lib/types";
import { clampConfidence } from "@/lib/utils";

const HEDGE_WORDS = /^(possible|possibly|likely|probably|maybe|perhaps|appears|looks like|seems|unidentified|unknown|unclear|a |an |the )/i;

const MEDICAL_OR_EDIBILITY =
  /\b(edible|inedible|safe to eat|can be eaten|tasty|delicious|medicinal|medicine|remedy|cure|treat(s|ment)?|heal|poisonous|toxic|venomous|dangerous to (touch|eat)|do not (eat|touch))\b/i;

const CERTAINTY = /\b(definitely|100%|certainly|guaranteed|without doubt|for sure|confirmed)\b/i;

export interface SafeVisionOutput {
  identification: string;
  confidence: number;
  description: string;
  funFact: string;
  category: DiscoveryCategory;
}

/**
 * Vision models are inconsistent about scale: some answer "82", others "0.82".
 * Anything at or below 1 is read as a fraction, because a model that means
 * "1% confident" is not a real case, while "0.99" is common.
 */
function normalizeConfidence(value: number): number {
  if (!Number.isFinite(value)) return 20;
  if (value > 0 && value <= 1) return value * 100;
  return value;
}

/** Applies hedging and content rules to a raw vision result. */
export function withSafety(draft: VisionDraftInput): SafeVisionOutput {
  let identification = draft.identification.trim().replace(/\s+/g, " ");
  // Drop trailing certainty punctuation like "Leaf!!" or "Neem (confirmed)".
  identification = identification.replace(/\(?\b(confirmed|certain|identified)\b\)?/gi, "").trim();
  if (identification.length === 0) identification = "Unidentified outdoor find";
  if (!HEDGE_WORDS.test(identification)) {
    identification = `Possible ${identification.charAt(0).toLowerCase()}${identification.slice(1)}`;
  }
  identification = identification.charAt(0).toUpperCase() + identification.slice(1);
  if (identification.length > 120) identification = `${identification.slice(0, 117)}...`;

  let description = draft.description.trim();
  description = description.replace(CERTAINTY, "likely");
  if (description.length > 600) description = `${description.slice(0, 597)}...`;

  let funFact = draft.funFact?.trim() ?? "";
  if (MEDICAL_OR_EDIBILITY.test(funFact) || CERTAINTY.test(funFact)) {
    // Drop rather than rewrite: we will not put words in the model's mouth.
    funFact = "";
  }
  if (funFact.length > 400) funFact = `${funFact.slice(0, 397)}...`;

  return {
    identification,
    confidence: clampConfidence(normalizeConfidence(draft.confidence)),
    description,
    funFact,
    category: draft.category,
  };
}
