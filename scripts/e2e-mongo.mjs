/**
 * Runs the full end-to-end suite against the **MongoDB** store.
 *
 *   npm run test:db
 *
 * `scripts/with-mongo.mjs` provides an in-memory MongoDB and injects
 * MONGODB_URI into the environment; this script starts the production server
 * with that environment on a free port, waits until `/api/health` reports the
 * Mongoose store is actually in use, runs `scripts/e2e.mjs` against it, and
 * shuts everything down again.
 *
 * Run `npm run build` first (this uses `next start`).
 */

import { spawn, spawnSync } from "node:child_process";

const PORT = process.env.MONGO_TEST_PORT ?? "3200";
const BASE = `http://127.0.0.1:${PORT}`;

if (!process.env.MONGODB_URI) {
  console.error("MONGODB_URI is not set — run this through scripts/with-mongo.mjs");
  process.exit(1);
}

// Fail fast and clearly if something already holds the port, rather than
// trying and misreporting why the store is wrong.
try {
  const probe = await fetch(`${BASE}/api/health`, { cache: "no-store" });
  if (probe.ok) {
    console.error(
      `[e2e-mongo] something is already listening on ${BASE}. Stop it first, or set MONGO_TEST_PORT.`,
    );
    process.exit(1);
  }
} catch {
  // Nothing listening — good.
}

console.log(`[e2e-mongo] starting the app on ${BASE} with MongoDB ${process.env.MONGODB_URI}`);

// Run Next directly: no shell, no argument-escaping surprises on Windows.
const server = spawn(
  process.execPath,
  ["node_modules/next/dist/bin/next", "start", "-p", String(PORT)],
  { stdio: ["ignore", "pipe", "pipe"], env: { ...process.env, PORT: String(PORT) } },
);

let serverOutput = "";
server.stdout.on("data", (data) => {
  serverOutput += data.toString();
});
server.stderr.on("data", (data) => {
  serverOutput += data.toString();
});

async function waitForMongoStore(timeoutMs = 90_000) {
  const deadline = Date.now() + timeoutMs;
  let last = null;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${BASE}/api/health`, { cache: "no-store" });
      if (response.ok) {
        last = await response.json();
        if (last?.storage?.kind === "mongodb") return { health: last };
      }
    } catch {
      // server not up yet
    }
    await new Promise((resolve) => setTimeout(resolve, 1_000));
  }
  return { health: null, last };
}

const { health, last } = await waitForMongoStore();

if (!health) {
  console.error("[e2e-mongo] the app never reported the MongoDB store.");
  if (last) console.error("  last /api/health payload:", JSON.stringify(last.storage));
  console.error("  server output:\n", serverOutput.slice(-2000));
  server.kill();
  process.exit(1);
}

console.log(`[e2e-mongo] app is using ${health.storage.description}`);

const result = spawnSync(process.execPath, ["scripts/e2e.mjs", BASE], {
  stdio: "inherit",
  env: process.env,
});

// Next prints page-render exceptions (with stack traces) to its own stdout/stderr.
// Surface them when the suite fails, otherwise they are silently swallowed.
if (result.status !== 0) {
  console.error("\n[e2e-mongo] suite failed — last server output:\n", serverOutput.slice(-4000));
}

server.kill();
for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => {
    server.kill();
    process.exit(1);
  });
}

process.exit(result.status ?? 1);
