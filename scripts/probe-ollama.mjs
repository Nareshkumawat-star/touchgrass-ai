// Throwaway probe: measures Ollama JSON-mode latency and schema compliance.
const body = {
  model: process.argv[2] || "qwen2.5:3b",
  stream: false,
  format: "json",
  keep_alive: "10m",
  options: { temperature: 0.75, num_predict: 800, num_ctx: 4096 },
  messages: [
    {
      role: "system",
      content:
        "You are the mission designer for TouchGrass AI. You write short, safe, real-world outdoor missions. Never suggest trespassing, climbing, water, night walks, traffic or approaching animals. Reply with a single JSON object and nothing else.",
    },
    {
      role: "user",
      content: `Design one mission for someone with 30 minutes, casual experience, easy difficulty, who likes Walking, Nature and Birds.

Return JSON with exactly these keys:
{ "title": string, "description": string, "duration": number, "difficulty": "easy"|"medium"|"challenging", "category": "nature-detective"|"walking-challenge"|"mindful-moment"|"photography-hunt"|"birdwatching"|"plant-hunt"|"exploration"|"movement", "steps": string[], "thingsToLookFor": string[], "safetyTips": string[], "rewardPoints": number }`,
    },
  ],
};

const started = Date.now();
const response = await fetch("http://127.0.0.1:11434/api/chat", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify(body),
});
const elapsed = Date.now() - started;
const data = await response.json();
const content = data.message?.content ?? "";
console.log(`elapsed_ms=${elapsed} chars=${content.length}`);
try {
  const parsed = JSON.parse(content);
  console.log("keys:", Object.keys(parsed).join(","));
  console.log(JSON.stringify(parsed, null, 2).slice(0, 900));
} catch (error) {
  console.log("NOT VALID JSON:", content.slice(0, 400));
}
