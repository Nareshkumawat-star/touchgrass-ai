/**
 * Direct probe of the local Qwen vision path: the same call shape the
 * LocalQwenProvider.analyzeDiscovery() makes, minus Next.js. Prints each
 * failure reason explicitly so "no vision model is available" can be traced.
 *
 *   node scripts/probe-vision.mjs [imageDataUrlOrPath]
 */

import { readFileSync } from "node:fs";

const BASE = process.env.OLLAMA_BASE_URL ?? "http://127.0.0.1:11434";
const MODEL = process.env.OLLAMA_VISION_MODEL ?? "qwen2.5vl:3b";

const arg = process.argv[2];
if (!arg) {
  console.error("usage: node scripts/probe-vision.mjs <image file or data URL>");
  process.exit(2);
}
const imageDataUrl = arg.startsWith("data:")
  ? arg
  : `data:image/png;base64,${readFileSync(arg).toString("base64")}`;
const base64 = imageDataUrl.split(",")[1] ?? "";
console.log(`image bytes (base64): ${base64.length}`);

async function main() {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 240_000);
  const started = Date.now();
  try {
    const response = await fetch(`${BASE}/api/chat`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        model: MODEL,
        stream: false,
        format: "json",
        options: { num_predict: 500, temperature: 0.2 },
        messages: [
          {
            role: "user",
            content:
              'Identify what is in this photo. Return JSON with exactly these keys: {"identification": string, "confidence": number, "description": string, "funFact": string, "category": string, "uncertain": boolean}',
            images: [base64],
          },
        ],
      }),
      signal: controller.signal,
    });
    console.log(`HTTP ${response.status} in ${Math.round((Date.now() - started) / 1000)}s`);
    const text = await response.text();
    if (!response.ok) {
      console.error("error body:", text.slice(0, 500));
      process.exit(1);
    }
    const data = JSON.parse(text);
    console.log("model:", data.model);
    console.log("message.content:", String(data.message?.content ?? "").slice(0, 400));
    if (data.error) {
      console.error("ollama error:", JSON.stringify(data.error));
      process.exit(1);
    }
  } catch (error) {
    console.error("probe failed:", error.name, error.message, error.cause?.code ?? "");
    process.exit(1);
  } finally {
    clearTimeout(timer);
  }
}

main();
