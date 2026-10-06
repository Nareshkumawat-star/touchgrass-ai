/**
 * Safety guard for AI-generated missions.
 *
 * The system prompt already forbids unsafe missions, but a language model is
 * not a security boundary. Every generated mission is scanned here, and if it
 * asks the user to do something unsafe the mission is rejected and replaced
 * with a known-safe template.
 */

const BLOCKED_PATTERNS: { pattern: RegExp; reason: string }[] = [
  {
    pattern: /\b(trespass|private property|jump (a |the )?fence|cut through (a |the )?(yard|field|farm)|restricted area|no entry|do not enter|military)\b/i,
    reason: "trespassing or restricted areas",
  },
  {
    pattern: /\b(climb(ing)? (a |the )?(tree|cliff|rock face|building|fence)|scrambl(e|ing)|rock climb|abseil|rappel)\b/i,
    reason: "dangerous climbing",
  },
  {
    pattern: /\b(swim|wade|jump into|enter the (water|river|lake|sea|ocean)|ice)\b/i,
    reason: "water/ice hazards",
  },
  {
    pattern: /\b(approach|feed|touch|hold|pick up|catch|chase|provoke|pet)\b[^.]{0,30}\b(wild|animal|snake|bear|boar|dog|bull|cow|stray)\b/i,
    reason: "approaching or touching animals",
  },
  {
    pattern: /\b(at night|after dark|midnight|nighttime|2 ?am|3 ?am|before sunrise|alone in the (dark|woods)|remote trail alone at night)\b/i,
    reason: "going out alone in the dark",
  },
  {
    pattern: /\b(cross the (road|street|highway|motorway)|walk (in|on|along|near) (traffic|the road|the highway|a busy road)|jaywalk|train tracks|railway)\b/i,
    reason: "traffic and rail hazards",
  },
  {
    pattern: /\b(go off[- ]trail|off[- ]piste|leave the marked (path|trail)|bushwhack|unmarked trail)\b/i,
    reason: "leaving marked trails",
  },
  {
    pattern: /\b(abandoned|derelict|construction site|cave|mine shaft|tunnel)\b/i,
    reason: "unsafe locations",
  },
];

export const SAFETY_LINE =
  "Stay aware of your surroundings and follow local rules.";

export interface SafetyVerdict {
  safe: boolean;
  reason?: string;
}

/** Scans every piece of model-written mission text for unsafe instructions. */
export function reviewMissionText(parts: string[]): SafetyVerdict {
  const joined = parts.join(" \n");
  for (const { pattern, reason } of BLOCKED_PATTERNS) {
    if (pattern.test(joined)) return { safe: false, reason };
  }
  return { safe: true };
}

/** Always present, always last, whatever the model produced. */
export function withSafetyLine(tips: string[]): string[] {
  const cleaned = tips
    .map((tip) => tip.trim())
    .filter((tip) => tip.length > 0)
    .filter((tip) => !/stay aware of your surroundings/i.test(tip));
  return [...cleaned, SAFETY_LINE].slice(-5);
}
