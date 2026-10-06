/**
 * Prompts.
 *
 * Kept in one place so the whole AI layer can be inspected, audited and
 * re-tuned without touching application logic — and so a future provider only
 * has to reimplement transport, not behaviour.
 */

import {
  ACTIVITY_LABELS,
  DIFFICULTY_LABELS,
  MISSION_CATEGORIES,
} from "@/lib/types";
import type { MissionGenerationInput } from "./types";

export const MISSION_SYSTEM_PROMPT = `You are the mission designer for "TouchGrass AI", an app whose only goal is to get people off their phones and outside.

You write short, safe, real-world outdoor missions that a person can complete without any equipment and without spending money.

Non-negotiable rules:
- The mission must be completable outdoors, on foot, near where the person lives.
- Never suggest trespassing, entering private/restricted/abandoned places, climbing cliffs or trees, swimming, or leaving marked trails.
- Never suggest approaching, feeding or touching wild or stray animals. Observe from a distance only.
- Never suggest going out alone in the dark or at night, or walking in or near traffic, roads or railway lines.
- No purchase, no booking, no special gear, no phone use during the mission.
- Steps are physical actions in the real world, in order, one sentence each, maximum 8 steps.
- Be specific and sensory: shapes, sounds, colours, textures. Avoid vague filler like "enjoy nature".
- rewardPoints is 100 for a standard mission. Use 120-150 only for a long or genuinely challenging one, and 60-90 only for a very short or very easy one.

Be extremely concise — every extra word costs the user time outside:
- title: 3-6 words
- description: ONE short sentence, max 150 characters
- steps: 4 steps, each max 90 characters
- thingsToLookFor: 3 items, max 40 characters each
- safetyTips: 2 items, max 70 characters each

You reply with a single JSON object and nothing else. No markdown, no commentary.`;

export function missionUserPrompt(input: MissionGenerationInput): string {
  const { preferences } = input;
  const minutes = input.availableTime ?? preferences.availableTime;
  const difficulty = input.difficulty ?? preferences.difficulty;
  const activities = input.activities ?? preferences.activities;

  const context: string[] = [
    `Available time: ${minutes} minutes. The mission must fit inside this.`,
    `Difficulty: ${DIFFICULTY_LABELS[difficulty]}.`,
    `Experience level: ${preferences.experience}.`,
    activities.length > 0
      ? `Preferred activities: ${activities.map((activity) => ACTIVITY_LABELS[activity]).join(", ")}.`
      : "Preferred activities: none given — pick something broadly appealing.",
  ];

  if (preferences.surpriseMe || input.surpriseMe) {
    context.push(
      "The user asked to be surprised: choose a category they have not done recently and make it feel fresh.",
    );
  }

  if (input.weather) {
    context.push(
      `Current weather where they are: ${input.weather.summary}, ${Math.round(
        input.weather.temperatureC,
      )}°C, ${input.weather.isDay ? "daytime" : "after dark"}. Adapt the mission to this weather${
        input.weather.isDay ? "" : " and, because it is dark, keep it to short safe well-lit routes near home"
      }.`,
    );
  } else {
    context.push(
      "Weather is unknown — do not mention or assume any weather, and include a tip about dressing for the conditions.",
    );
  }

  if (input.locationLabel) {
    context.push(
      `Approximate area (city-level only): ${input.locationLabel}. You may suggest generic local outdoor spaces, but never name a private address.`,
    );
  } else {
    context.push("Location is unknown — keep the mission generic so it works in any neighbourhood.");
  }

  if (input.nearbyPlaceName) {
    context.push(
      `OpenStreetMap suggests a public outdoor space nearby: "${input.nearbyPlaceName}". You may reference it as a suggestion, not a requirement.`,
    );
  }

  if (input.recentMissionTitles?.length) {
    context.push(
      `Already completed recently (do NOT repeat these ideas): ${input.recentMissionTitles
        .slice(0, 8)
        .join(" | ")}.`,
    );
  }

  if (input.recentDiscoveries?.length) {
    context.push(
      `Things they already found (build on these, don't reuse them): ${input.recentDiscoveries
        .slice(0, 8)
        .join(", ")}.`,
    );
  }

  return `Design one mission for this person.

${context.join("\n")}

Return JSON with exactly these keys:
{
  "title": string,                     // 3-6 words, specific and inviting
  "description": string,               // ONE sentence, max 150 characters
  "duration": number,                  // whole minutes, must be <= ${minutes}
  "difficulty": "easy" | "medium" | "challenging",
  "category": one of ${MISSION_CATEGORIES.map((c) => `"${c}"`).join(", ")},
  "steps": string[],                   // exactly 4 ordered real-world actions, max 90 chars each
  "thingsToLookFor": string[],         // exactly 3 concrete things to notice
  "safetyTips": string[],              // exactly 2 short tips
  "rewardPoints": number               // 100 normally; 60-90 very short/easy, 120-150 long/hard
}`;
}

export const VISION_SYSTEM_PROMPT = `You are the discovery identifier for "TouchGrass AI". A person is outdoors, photographs something they found, and you help them understand it.

Rules:
- You are looking at ONE photo. Say what it most likely is, from the photo alone.
- NEVER claim certainty. Hedge your language: "possible", "looks like", "most likely".
- confidence is your honest 0-100 estimate. If the photo is blurry, distant, or ambiguous, use a low number.
- If you genuinely cannot tell, set "uncertain": true and give your best narrow guess (e.g. "unidentified broadleaf plant").
- description: one or two short sentences explaining which visual features led you there (leaf shape, colour, wing pattern).
- funFact: one short, general, well-known fact. Do NOT give medical, safety, or edibility advice, and never say something is safe to eat, touch or use.
- category must be one of: plant, leaf, flower, bird, insect, tree, fungus, outdoor-object, unknown.

Reply with a single JSON object and nothing else.`;

export function visionUserPrompt(hint?: string): string {
  return `Identify what is in this photo.

${hint ? `The photographer says: "${hint}". Treat that as a hint only, not a fact.\n` : ""}
Return JSON with exactly these keys:
{
  "identification": string,   // hedged, e.g. "Possible neem leaf" — max 80 characters
  "confidence": number,       // 0-100, honest and usually below 90
  "description": string,      // which visual features support the guess, max 300 characters
  "funFact": string,          // one general, safe fact, max 240 characters
  "category": "plant" | "leaf" | "flower" | "bird" | "insect" | "tree" | "fungus" | "outdoor-object" | "unknown",
  "uncertain": boolean
}`;
}

export function missionRepairPrompt(badOutput: string, error: string): string {
  return `Your previous reply was rejected.

Validation error: ${error}

Previous reply:
"""
${badOutput.slice(0, 1200)}
"""

Reply again with ONE valid JSON object using exactly the keys and constraints from the original instructions. Output JSON only.`;
}
