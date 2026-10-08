/**
 * Central runtime configuration.
 *
 * Every value is read from the environment so the same build can run with a
 * local Ollama model, a Hugging Face endpoint, or (later) any other provider.
 * Nothing here is secret-consuming on the client: only the server imports this
 * module, and only non-secret flags are ever forwarded to the browser.
 */

function optional(name: string): string | undefined {
  const raw = process.env[name];
  if (raw === undefined) return undefined;
  const value = raw.trim();
  return value.length > 0 ? value : undefined;
}

function num(name: string, fallback: number): number {
  const raw = optional(name);
  if (!raw) return fallback;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : fallback;
}

/**
 * Default local models.
 *
 * Qwen2.5-1.5B-Instruct is the text default because it is Apache-2.0 licensed
 * *and* responds in seconds on a laptop CPU. Swap in qwen2.5:7b (also
 * Apache-2.0) if you have a GPU; note that qwen2.5:3b ships under the
 * non-commercial Qwen Research License.
 *
 * Qwen2.5-VL-3B-Instruct (Apache-2.0) handles photo identification.
 */
const DEFAULT_QWEN_MODEL = "qwen2.5:1.5b";
const DEFAULT_QWEN_VL_MODEL = "qwen2.5vl:3b";

export const serverConfig = {
  nodeEnv: optional("NODE_ENV") ?? "development",
  isProduction: process.env.NODE_ENV === "production",
} as const;

export const aiConfig = {
  /**
   * Provider selection order. The first provider that reports itself as
   * available wins. Default is local-first, which is the whole point of the
   * project: open weights running on your own machine.
   */
  providerOrder: (optional("AI_PROVIDER_ORDER") ?? "local, huggingface, heuristic")
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean),

  ollama: {
    baseUrl: optional("OLLAMA_BASE_URL") ?? "http://127.0.0.1:11434",
    model: optional("OLLAMA_MODEL") ?? DEFAULT_QWEN_MODEL,
    visionModel: optional("OLLAMA_VISION_MODEL") ?? DEFAULT_QWEN_VL_MODEL,
    temperature: num("OLLAMA_TEMPERATURE", 0.75),
    /** Hard ceiling so a slow laptop never hangs a request forever. */
    timeoutMs: num("OLLAMA_TIMEOUT_MS", 90_000),
    /**
     * Vision gets its own, longer ceiling: reading a photo with a 3B model on a
     * CPU-only machine regularly exceeds two minutes, and timing out early
     * would be reported as "no vision model available" — which would be a lie.
     */
    visionTimeoutMs: num("OLLAMA_VISION_TIMEOUT_MS", 240_000),
    /** Keeps the model resident between requests (faster follow-ups). */
    keepAlive: optional("OLLAMA_KEEP_ALIVE") ?? "10m",
  },

  huggingface: {
    token: optional("HUGGINGFACE_API_TOKEN"),
    /** OpenAI-compatible router by default; any HF inference endpoint works. */
    baseUrl: optional("HUGGINGFACE_BASE_URL") ?? "https://router.huggingface.co/v1",
    model: optional("HUGGINGFACE_MODEL") ?? "Qwen/Qwen2.5-7B-Instruct",
    visionModel: optional("HUGGINGFACE_VISION_MODEL") ?? "Qwen/Qwen2.5-VL-7B-Instruct",
    timeoutMs: num("HUGGINGFACE_TIMEOUT_MS", 60_000),
  },
} as const;

export const dbConfig = {
  /** When set, Mongoose is used. Otherwise the app falls back to the
   *  persistent local JSON store so it stays fully functional offline. */
  uri: optional("MONGODB_URI"),
  dbName: optional("MONGODB_DB") ?? "touchgrass",
  /** Directory (relative to process.cwd()) used by the fallback store. */
  localStoreDir: optional("LOCAL_STORE_DIR") ?? ".touchgrass-data",
} as const;

export const appConfig = {
  sessionCookie: "tg_session",
  maxUploadBytes: num("MAX_UPLOAD_BYTES", 4 * 1024 * 1024),
  /** Hard safety cap on generated missions, independent of the model. */
  maxMissionMinutes: num("MAX_MISSION_MINUTES", 180),
} as const;

export const providerLabels: Record<string, string> = {
  local: "Local AI",
  huggingface: "Online AI",
  heuristic: "Offline templates",
};

export type ProviderId = "local" | "huggingface" | "heuristic";
