/**
 * Runs any command with MONGODB_URI pointing at a temporary, in-memory MongoDB.
 *
 *   node scripts/with-mongo.mjs npm start
 *   node scripts/with-mongo.mjs npm run dev
 *   node scripts/with-mongo.mjs node scripts/e2e.mjs
 *
 * There is no MongoDB daemon on most development machines, which would leave
 * the Mongoose path untested. This makes it testable without installing
 * anything: mongodb-memory-server downloads a mongod binary once and runs it in
 * a temp directory, so the app is exercised against a real MongoDB.
 */

import { spawn } from "node:child_process";

const command = process.argv.slice(2);
if (command.length === 0) {
  console.error("usage: node scripts/with-mongo.mjs <command> [args...]");
  process.exit(1);
}

let mongod;
try {
  const { MongoMemoryServer } = await import("mongodb-memory-server");
  mongod = await MongoMemoryServer.create({ instance: { dbName: "touchgrass" } });
} catch (error) {
  console.error(
    "Could not start an in-memory MongoDB. Install it with:\n  npm install -D mongodb-memory-server\n",
    error instanceof Error ? error.message : error,
  );
  process.exit(1);
}

const uri = mongod.getUri();
console.log(`[with-mongo] temporary MongoDB at ${uri}`);
console.log(`[with-mongo] running: ${command.join(" ")}`);

const child = spawn(command[0], command.slice(1), {
  stdio: "inherit",
  env: { ...process.env, MONGODB_URI: uri, MONGODB_DB: "touchgrass" },
  shell: process.platform === "win32",
});

async function shutdown(code) {
  try {
    await mongod?.stop();
  } catch {
    // ignore
  }
  process.exit(code ?? 0);
}

child.on("exit", (code) => void shutdown(code ?? 0));
for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => {
    child.kill(signal);
    void shutdown(0);
  });
}
