/**
 * Model registry.
 *
 * Open weights only make sense if you know what you are actually running, so
 * the app displays the exact model and its licence wherever an AI answer is
 * shown. Licences change between releases, so anything not listed here is
 * reported as "unknown — check the model card" rather than guessed at.
 *
 * Sources (checked when this registry was written):
 *   Qwen2.5 model card / Qwen release notes: 0.5B, 1.5B, 7B, 14B, 32B are
 *   Apache-2.0; the 3B and 72B checkpoints ship under the Qwen Research
 *   License (non-commercial). Qwen2.5-VL checkpoints (3B, 7B, 72B) are
 *   Apache-2.0.
 */

export interface ModelLicenseInfo {
  /** Canonical model name. */
  name: string;
  license: string;
  /** True when commercial use is permitted without extra terms. */
  commerciallyUsable: boolean;
  url: string;
  notes?: string;
}

const REGISTRY: Record<string, ModelLicenseInfo> = {
  "qwen2.5:1.5b": {
    name: "Qwen2.5-1.5B-Instruct",
    license: "Apache-2.0",
    commerciallyUsable: true,
    url: "https://huggingface.co/Qwen/Qwen2.5-1.5B-Instruct",
    notes: "Default text model: small enough to answer in seconds on a laptop CPU.",
  },
  "qwen2.5:0.5b": {
    name: "Qwen2.5-0.5B-Instruct",
    license: "Apache-2.0",
    commerciallyUsable: true,
    url: "https://huggingface.co/Qwen/Qwen2.5-0.5B-Instruct",
    notes: "Fastest option; weakest at following the JSON contract.",
  },
  "qwen2.5:3b": {
    name: "Qwen2.5-3B-Instruct",
    license: "Qwen Research License (non-commercial)",
    commerciallyUsable: false,
    url: "https://huggingface.co/Qwen/Qwen2.5-3B-Instruct",
    notes:
      "Better mission writing than 1.5B, but the licence restricts commercial use — check the model card before shipping.",
  },
  "qwen2.5:7b": {
    name: "Qwen2.5-7B-Instruct",
    license: "Apache-2.0",
    commerciallyUsable: true,
    url: "https://huggingface.co/Qwen/Qwen2.5-7B-Instruct",
    notes: "Best quality/commercial-use balance, but needs a GPU to feel quick.",
  },
  "qwen2.5vl:3b": {
    name: "Qwen2.5-VL-3B-Instruct",
    license: "Apache-2.0",
    commerciallyUsable: true,
    url: "https://huggingface.co/Qwen/Qwen2.5-VL-3B-Instruct",
    notes: "Default vision model for discovery identification.",
  },
  "qwen2.5vl:7b": {
    name: "Qwen2.5-VL-7B-Instruct",
    license: "Apache-2.0",
    commerciallyUsable: true,
    url: "https://huggingface.co/Qwen/Qwen2.5-VL-7B-Instruct",
    notes: "More accurate identifications; slower on CPU.",
  },
  "qwen/qwen2.5-7b-instruct": {
    name: "Qwen2.5-7B-Instruct (Hugging Face router)",
    license: "Apache-2.0",
    commerciallyUsable: true,
    url: "https://huggingface.co/Qwen/Qwen2.5-7B-Instruct",
  },
  "qwen/qwen2.5-vl-7b-instruct": {
    name: "Qwen2.5-VL-7B-Instruct (Hugging Face router)",
    license: "Apache-2.0",
    commerciallyUsable: true,
    url: "https://huggingface.co/Qwen/Qwen2.5-VL-7B-Instruct",
  },
  "touchgrass-templates-v1": {
    name: "TouchGrass reviewed mission templates",
    license: "Part of this project (see repository LICENSE)",
    commerciallyUsable: true,
    url: "https://github.com/",
    notes: "Hand-written missions used when no model is available.",
  },
};

function normalize(model: string): string {
  return model.trim().toLowerCase();
}

export function licenseFor(model: string): ModelLicenseInfo {
  const key = normalize(model);
  if (REGISTRY[key]) return REGISTRY[key];

  // Match a bare family name without a tag, e.g. "qwen2.5" → ":latest" variants.
  const withoutTag = key.split(":")[0];
  const match = Object.entries(REGISTRY).find(([id]) => id.split(":")[0] === withoutTag);
  if (match) return match[1];

  return {
    name: model,
    license: "Unknown — check this model's own model card",
    commerciallyUsable: false,
    url: "https://ollama.com/library",
    notes: "This model is not in the registry above, so no licence claim is made about it.",
  };
}

export const CONFIGURED_MODELS = REGISTRY;
