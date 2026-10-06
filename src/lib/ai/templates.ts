/**
 * Curated mission templates — the offline fallback.
 *
 * These are hand-written, reviewed missions used when no AI model is reachable
 * (flight mode, no laptop, Ollama not running). Every template is deliberately
 * safe: no traffic, no climbing, no animals touched, no night missions.
 *
 * They are also the safety baseline: if a model produces something unsafe, we
 * fall back to one of these rather than showing the user a bad mission.
 */

import type { Activity, Difficulty, MissionCategory } from "@/lib/types";

export interface MissionTemplate {
  id: string;
  category: MissionCategory;
  title: string;
  description: string;
  /** Smallest time budget (minutes) this mission comfortably fits. */
  minMinutes: number;
  activities: Activity[];
  steps: (minutes: number, difficulty: Difficulty) => string[];
  thingsToLookFor: string[];
  safetyTips: string[];
}

const pct = (minutes: number, fraction: number, minimum: number) =>
  Math.max(minimum, Math.round(minutes * fraction));

export const MISSION_TEMPLATES: MissionTemplate[] = [
  {
    id: "nature-detective",
    category: "nature-detective",
    title: "Nature Detective Walk",
    description:
      "Take a relaxed walk outside and pay attention to the things you normally walk straight past.",
    minMinutes: 10,
    activities: ["walking", "nature", "exploration"],
    steps: (minutes) => [
      `Walk for ${pct(minutes, 0.35, 4)} minutes with your phone in your pocket.`,
      "Find two leaves with clearly different shapes and compare their edges.",
      "Find one bird or insect and watch it without moving for a full minute.",
      `Stand still for ${pct(minutes, 0.12, 1)} minutes and count how many different sounds you can pick out.`,
      "Walk back the way you came and look for one thing you missed the first time.",
    ],
    thingsToLookFor: [
      "Two different leaf shapes",
      "Something moving in a tree or hedge",
      "A sound you cannot immediately name",
    ],
    safetyTips: ["Stay on paths you know", "Keep an eye out for uneven ground"],
  },
  {
    id: "sound-map",
    category: "mindful-moment",
    title: "Five-Minute Sound Map",
    description:
      "Sit somewhere outdoors and map the sounds around you. Nothing to achieve, just listening.",
    minMinutes: 10,
    activities: ["mindfulness", "nature"],
    steps: (minutes) => [
      "Find a bench, step or wall where you can sit comfortably and safely.",
      `Close your eyes for ${pct(minutes, 0.25, 2)} minutes and count every separate sound you hear.`,
      "Open your eyes and write or remember the three loudest and the three quietest sounds.",
      "Look up and find where the closest of those sounds is coming from.",
      "Stay a little longer than feels necessary, then head home.",
    ],
    thingsToLookFor: [
      "A sound made by something alive",
      "A sound made by weather or water",
      "The quietest sound you can detect",
    ],
    safetyTips: ["Sit somewhere off the footpath, never on a road", "Keep your belongings visible"],
  },
  {
    id: "leaf-hunt",
    category: "plant-hunt",
    title: "Leaf Shape Hunt",
    description:
      "Collect five different leaf shapes in your head (not in your hand) and learn to tell them apart.",
    minMinutes: 20,
    activities: ["plants", "nature", "walking"],
    steps: (minutes) => [
      "Walk to the greenest patch you can reach in a few minutes.",
      "Find a leaf with jagged edges and one with smooth edges.",
      `Keep going for ${pct(minutes, 0.35, 5)} minutes and find three more shapes: a needle, a heart, and something you cannot name.`,
      "Look under one leaf and see what is living there.",
      "Pick your favourite and remember where it grows.",
    ],
    thingsToLookFor: [
      "A jagged-edged leaf",
      "A smooth-edged leaf",
      "Something small living under a leaf",
    ],
    safetyTips: ["Look, don't pick, unless it is your own plant", "Avoid touching unknown plants"],
  },
  {
    id: "bird-sit",
    category: "birdwatching",
    title: "Bird Sit",
    description:
      "Find a quiet spot and let the birds come to you instead of chasing them.",
    minMinutes: 20,
    activities: ["birds", "nature", "mindfulness"],
    steps: (minutes) => [
      `Walk ${pct(minutes, 0.15, 3)} minutes to a tree, hedge or water edge.`,
      "Stand or sit still and silent for two full minutes so the birds settle.",
      `Watch for ${pct(minutes, 0.4, 6)} minutes and count how many different birds you can see.`,
      "Pick one bird and notice how it moves: hops, walks, or darts?",
      "Listen for a call you can repeat back to yourself.",
    ],
    thingsToLookFor: [
      "A bird on the ground",
      "A bird high in a tree",
      "A bird call you can imitate",
    ],
    safetyTips: ["Keep a respectful distance", "Never approach a nest or young bird"],
  },
  {
    id: "texture-walk",
    category: "photography-hunt",
    title: "Texture Photo Walk",
    description:
      "A short walk where your only job is to notice texture: bark, stone, moss, water, metal.",
    minMinutes: 20,
    activities: ["photography", "walking", "exploration"],
    steps: (minutes) => [
      `Walk for ${pct(minutes, 0.3, 5)} minutes and collect five textures in your mind.`,
      "Photograph at least three of them, close enough that the texture fills the frame.",
      "Find one texture that is man-made next to one that is natural.",
      "Photograph something wet, and something dry.",
      "Walk home and note which texture you would recognise with your eyes closed.",
    ],
    thingsToLookFor: [
      "Bark, stone or brick",
      "Moss, lichen or grass",
      "Something weathered or repaired",
    ],
    safetyTips: ["Look up before you stop to photograph", "Stay off road edges"],
  },
  {
    id: "walking-challenge",
    category: "walking-challenge",
    title: "Steady Walking Challenge",
    description:
      "A simple, complete walk. Pick a comfortable pace, keep it steady, and come home.",
    minMinutes: 10,
    activities: ["walking", "running"],
    steps: (minutes) => [
      `Walk at an easy, talkable pace for ${pct(minutes, 0.35, 4)} minutes.`,
      "Pick up the pace slightly until breathing is deeper but still controlled.",
      `Hold that for ${pct(minutes, 0.35, 4)} minutes, then slow down.`,
      "Stop and check in with how your legs and breathing feel.",
      "Walk the last stretch home at a relaxed pace.",
    ],
    thingsToLookFor: [
      "Your own breathing settling into a rhythm",
      "A landmark you pass every day",
      "How the ground changes under your feet",
    ],
    safetyTips: ["Wear shoes you can walk in", "Turn back early if you feel unwell"],
  },
  {
    id: "never-noticed",
    category: "exploration",
    title: "Something You've Never Noticed",
    description:
      "Walk your most familiar street and look for five things you have genuinely never seen before.",
    minMinutes: 10,
    activities: ["exploration", "walking", "mindfulness"],
    steps: (minutes) => [
      "Leave home and take your usual direction at half your normal speed.",
      `Over the next ${pct(minutes, 0.6, 6)} minutes, find five things you have never noticed before.`,
      "One of them must be above your head.",
      "One of them must be smaller than your hand.",
      "Turn around and notice how the same street looks from the other direction.",
    ],
    thingsToLookFor: [
      "Something above head height",
      "A detail on a wall or gate",
      "A plant growing where it was not planted",
    ],
    safetyTips: ["Watch for cyclists and doorways", "Do not walk into the road to look at something"],
  },
  {
    id: "green-minute",
    category: "mindful-moment",
    title: "Ten Green Minutes",
    description:
      "A very short reset: get outside, breathe, notice, and come back in. Good for busy days.",
    minMinutes: 10,
    activities: ["mindfulness", "nature"],
    steps: () => [
      "Step outside and walk to the nearest patch of green or open sky.",
      "Stand still and take ten slow breaths, longer out than in.",
      "Name three things you can see, two you can hear, one you can smell.",
      "Find one thing that is growing and one thing that is worn out.",
      "Go back inside, or stay a bit longer if it feels good.",
    ],
    thingsToLookFor: [
      "The colour of the sky right now",
      "Something growing through a crack",
      "Something the weather has worn down",
    ],
    safetyTips: ["Step away from doors and paths", "Dress for the temperature before you go"],
  },
  {
    id: "park-loop",
    category: "exploration",
    title: "Park Loop Explorer",
    description:
      "Walk a loop of your nearest public park and complete three small observation tasks.",
    minMinutes: 30,
    activities: ["walking", "exploration", "nature", "photography"],
    steps: (minutes) => [
      "Head to the nearest public park, green or open space.",
      `Walk one full loop at an easy pace (roughly ${pct(minutes, 0.5, 8)} minutes).`,
      "Task 1: find the oldest-looking tree you can see.",
      "Task 2: find where water would flow when it rains.",
      "Task 3: find the quietest corner of the park and stand in it for a minute.",
      "Take a different route out than the one you came in by.",
    ],
    thingsToLookFor: [
      "The oldest tree you can find",
      "A drain or channel for rainwater",
      "The quietest corner of the park",
    ],
    safetyTips: ["Keep to public paths and open areas", "Note the park's closing time"],
  },
  {
    id: "run-walk",
    category: "movement",
    title: "Walk-Run Intervals",
    description:
      "Alternate easy walking and gentle running. No pace targets, no tracking, just effort you can talk through.",
    minMinutes: 20,
    activities: ["running", "walking"],
    steps: (minutes) => [
      "Warm up with 3 minutes of easy walking.",
      "Run gently until you can just feel your breathing deepen, then walk until it settles.",
      `Repeat that run-walk cycle for ${pct(minutes, 0.6, 10)} minutes.`,
      "Finish with 3 minutes of easy walking and a few slow breaths.",
      "Notice one thing about the route you would not see from a car.",
    ],
    thingsToLookFor: [
      "How your breathing resets while walking",
      "A detail on your street only visible on foot",
      "A scent that only appears at this pace",
    ],
    safetyTips: [
      "Use footpaths and parks, never roads",
      "Stop running if anything hurts",
    ],
  },
  {
    id: "sky-check",
    category: "nature-detective",
    title: "Sky And Weather Check",
    description:
      "Read the sky like a local. Learn what today's clouds are actually doing above you.",
    minMinutes: 10,
    activities: ["nature", "mindfulness", "exploration"],
    steps: () => [
      "Go outside and find a spot with a wide view of the sky.",
      "Look up for one full minute without checking anything else.",
      "Describe the clouds in three words, out loud.",
      "Find the direction the clouds are moving and the direction the wind is blowing at ground level.",
      "Guess whether it will rain in the next few hours, then go inside and see.",
    ],
    thingsToLookFor: [
      "Cloud shape and height",
      "Which way the clouds travel",
      "A sign of rain: damp air, distant sound, darker horizon",
    ],
    safetyTips: ["Step away from buildings and trees before looking up", "Come in if there is lightning"],
  },
  {
    id: "creature-tracks",
    category: "nature-detective",
    title: "Signs Of Life",
    description:
      "Find evidence that animals share your neighbourhood — without ever going near one.",
    minMinutes: 20,
    activities: ["nature", "exploration", "birds"],
    steps: (minutes) => [
      `Walk slowly for ${pct(minutes, 0.5, 8)} minutes looking at the ground as much as ahead.`,
      "Find one sign a bird has been here: a feather, droppings, a pecked fruit.",
      "Find one sign an insect has been here: a hole, a chewed leaf, a web.",
      "Find one plant growing somewhere it was clearly not planted.",
      "Leave everything exactly where you found it.",
    ],
    thingsToLookFor: [
      "A feather or a chewed leaf",
      "A web, hole or trail",
      "A plant in an unexpected place",
    ],
    safetyTips: [
      "Look, never touch or collect",
      "Never approach or feed an animal",
    ],
  },
];

export interface TemplatePick {
  template: MissionTemplate;
  reason: string;
}

const ACTIVITY_WEIGHTS: Record<string, number> = {
  walking: 2,
  running: 2,
  nature: 2,
  photography: 1,
  birds: 2,
  plants: 2,
  exploration: 1,
  mindfulness: 1,
};

/**
 * Picks a template deterministically but with variety: it scores by activity
 * overlap and time fit, then rotates using the recent-history length so the
 * same person does not get the same mission twice in a row.
 */
export function pickTemplate(options: {
  activities: Activity[];
  availableTime: number;
  recentTitles?: string[];
  /** Increases variety for repeated offline generation. */
  rotation?: number;
  preferredCategory?: MissionCategory;
}): TemplatePick {
  const { activities, availableTime, recentTitles = [], rotation = 0, preferredCategory } = options;
  const recent = new Set(recentTitles.map((title) => title.toLowerCase()));

  const eligible = MISSION_TEMPLATES.filter((template) => template.minMinutes <= availableTime);
  const pool = eligible.length > 0 ? eligible : [MISSION_TEMPLATES[0]];

  const scored = pool
    .map((template) => {
      let score = 0;
      for (const activity of activities) {
        if (template.activities.includes(activity)) {
          score += ACTIVITY_WEIGHTS[activity] ?? 1;
        }
      }
      if (activities.length === 0) score += 1;
      // Fit: the template that uses the most of the available time wins.
      score -= Math.abs(availableTime - template.minMinutes) / 20;
      if (recent.has(template.title.toLowerCase())) score -= 25;
      if (preferredCategory && template.category === preferredCategory) score += 2;
      return { template, score };
    })
    .sort((a, b) => b.score - a.score);

  const top = scored.slice(0, Math.min(4, scored.length));
  const chosen = top[rotation % top.length];

  return {
    template: chosen.template,
    reason: `Matched your preferences using a reviewed template (score ${chosen.score.toFixed(1)}).`,
  };
}
