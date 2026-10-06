/**
 * Captures real screenshots from a running build.
 *
 *   npm run build
 *   set PORT=3100 && npm start
 *   node scripts/screenshots.mjs http://127.0.0.1:3100
 *
 * Uses headless Chrome over the DevTools protocol (no extra dependencies — the
 * WebSocket client is built into Node 22+). It seeds the demo account first so
 * the authenticated screens show populated state, then writes PNGs to
 * docs/screenshots/.
 */

import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const CHROME =
  process.env.CHROME_PATH ?? "C:/Program Files/Google/Chrome/Application/chrome.exe";
const BASE = (process.argv[2] ?? "http://127.0.0.1:3100").replace(/\/$/, "");
const OUT_DIR = "docs/screenshots";
const DEBUG_PORT = Number(process.env.CDP_PORT ?? 9333);

mkdirSync(OUT_DIR, { recursive: true });

/* ------------------------------------------------------- authenticated setup */

async function seedDemoSession() {
  const response = await fetch(`${BASE}/api/demo`, { method: "POST" });
  if (!response.ok) throw new Error(`demo seeding failed: ${response.status}`);
  const setCookie = response.headers.getSetCookie?.() ?? [];
  const session = setCookie.find((entry) => entry.startsWith("tg_session="));
  if (!session) throw new Error("no session cookie returned by /api/demo");
  const value = session.split(";")[0].split("=").slice(1).join("=");
  const cookieHeader = session.split(";")[0];

  const history = await fetch(`${BASE}/api/missions/history`, {
    headers: { cookie: cookieHeader },
  });
  const body = await history.json();
  const pendingMissionId = body?.pendingMissions?.[0]?.id ?? null;

  return { value, pendingMissionId };
}

/* --------------------------------------------------------- CDP mini client */

class Cdp {
  constructor(socket) {
    this.socket = socket;
    this.nextId = 1;
    this.pending = new Map();
    this.listeners = new Map();
    socket.addEventListener("message", (event) => {
      const message = JSON.parse(event.data);
      if (message.id && this.pending.has(message.id)) {
        const { resolve, reject } = this.pending.get(message.id);
        this.pending.delete(message.id);
        if (message.error) reject(new Error(`${message.error.message} (${JSON.stringify(message.error)})`));
        else resolve(message.result);
        return;
      }
      if (message.method) {
        const key = `${message.sessionId ?? ""}:${message.method}`;
        for (const listener of this.listeners.get(key) ?? []) listener(message.params);
      }
    });
  }

  send(method, params = {}, sessionId) {
    const id = this.nextId++;
    const payload = { id, method, params };
    if (sessionId) payload.sessionId = sessionId;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.socket.send(JSON.stringify(payload));
      setTimeout(() => {
        if (this.pending.has(id)) {
          this.pending.delete(id);
          reject(new Error(`CDP timeout for ${method}`));
        }
      }, 60_000);
    });
  }

  once(sessionId, event, timeoutMs = 30_000) {
    return new Promise((resolve, reject) => {
      const key = `${sessionId ?? ""}:${event}`;
      const listener = (params) => {
        clearTimeout(timer);
        this.listeners.set(key, (this.listeners.get(key) ?? []).filter((l) => l !== listener));
        resolve(params);
      };
      const timer = setTimeout(() => reject(new Error(`timeout waiting for ${event}`)), timeoutMs);
      this.listeners.set(key, [...(this.listeners.get(key) ?? []), listener]);
    });
  }
}

async function waitForDebugger(timeoutMs = 30_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`http://127.0.0.1:${DEBUG_PORT}/json/version`);
      if (response.ok) return response.json();
    } catch {
      // not up yet
    }
    await new Promise((resolve) => setTimeout(resolve, 300));
  }
  throw new Error("Chrome never opened the debugging port");
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/* ------------------------------------------------------------------ capture */

const SHOTS = [
  { file: "01-landing.png", path: "/", width: 1440, height: 1000, fullPage: false },
  { file: "02-onboarding.png", path: "/onboarding", width: 1440, height: 1000, anonymous: true },
  { file: "03-dashboard.png", path: "/dashboard", width: 1440, height: 1100 },
  { file: "04-discovery.png", path: "/discoveries", width: 1440, height: 1100 },
  { file: "05-rewards.png", path: "/rewards", width: 1440, height: 1100 },
  { file: "06-open-ai.png", path: "/open", width: 1440, height: 1300 },
  { file: "07-privacy.png", path: "/privacy", width: 1440, height: 1100 },
  { file: "08-mobile-dashboard.png", path: "/dashboard", width: 390, height: 844, mobile: true },
];

async function main() {
  const { value: sessionCookie, pendingMissionId } = await seedDemoSession();
  console.log(`seeded demo session (${pendingMissionId ? "with a pending mission" : "no pending mission"})`);

  if (pendingMissionId) {
    SHOTS.push({
      file: "09-mission-mode.png",
      path: `/mission/${pendingMissionId}`,
      width: 390,
      height: 844,
      mobile: true,
    });
  }

  const chrome = spawn(
    CHROME,
    [
      "--headless=new",
      "--disable-gpu",
      "--hide-scrollbars",
      "--no-first-run",
      "--no-default-browser-check",
      "--disable-extensions",
      `--remote-debugging-port=${DEBUG_PORT}`,
      `--user-data-dir=${join(tmpdir(), `touchgrass-shots-${Date.now()}`)}`,
      "--window-size=1600,1200",
      "about:blank",
    ],
    { stdio: ["ignore", "ignore", "pipe"] },
  );

  chrome.stderr.on("data", (data) => {
    const text = data.toString();
    if (/error/i.test(text) && !/DevTools listening/i.test(text)) {
      process.stderr.write(`[chrome] ${text}`);
    }
  });

  const version = await waitForDebugger();
  const cdp = new Cdp(new WebSocket(version.webSocketDebuggerUrl));
  await new Promise((resolve, reject) => {
    cdp.socket.addEventListener("open", resolve, { once: true });
    cdp.socket.addEventListener("error", reject, { once: true });
  });

  const { targetId } = await cdp.send("Target.createTarget", { url: "about:blank" });
  const { sessionId } = await cdp.send("Target.attachToTarget", { targetId, flatten: true });

  await cdp.send("Page.enable", {}, sessionId);
  await cdp.send("Network.enable", {}, sessionId);

  for (const shot of SHOTS) {
    await cdp.send(
      "Network.setCookie",
      shot.anonymous
        ? { name: "tg_session", value: "expired", url: BASE, expires: 1 }
        : { name: "tg_session", value: sessionCookie, url: BASE },
      sessionId,
    );

    await cdp.send(
      "Emulation.setDeviceMetricsOverride",
      {
        width: shot.width,
        height: shot.height,
        deviceScaleFactor: 1,
        mobile: Boolean(shot.mobile),
      },
      sessionId,
    );

    const loaded = cdp.once(sessionId, "Page.loadEventFired");
    await cdp.send("Page.navigate", { url: `${BASE}${shot.path}` }, sessionId);
    await loaded;
    // Let the entrance animations settle so nothing is captured mid-fade.
    await sleep(900);

    const { data } = await cdp.send(
      "Page.captureScreenshot",
      { format: "png", captureBeyondViewport: shot.fullPage === true, fromSurface: true },
      sessionId,
    );
    writeFileSync(join(OUT_DIR, shot.file), Buffer.from(data, "base64"));
    console.log(`  captured ${shot.file}`);
  }

  cdp.socket.close();
  chrome.kill();
  console.log(`\nScreenshots written to ${OUT_DIR}/`);
}

main().catch((error) => {
  console.error("screenshot run failed:", error);
  process.exit(1);
});
