/**
 * Walks the onboarding wizard in a real browser and asserts the UI flow:
 * step gating → submission → dashboard redirect → no console errors.
 *
 *   npm run build && npm start   (port 3000)
 *   npm run test:ui
 *
 * An explicit base URL still works: node scripts/onboarding-ui.mjs http://127.0.0.1:3100
 *
 * Headless Chrome over the DevTools protocol — no extra dependencies, the
 * WebSocket client is built into Node 22+. Every interaction waits for the
 * UI to actually reach the expected state instead of sleeping a fixed time,
 * and each run binds its own free debugging port so a leftover browser from a
 * previous run cannot be picked up by mistake.
 */

import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const CHROME =
  process.env.CHROME_PATH ?? "C:/Program Files/Google/Chrome/Application/chrome.exe";
// Same default as scripts/e2e.mjs, so both bare npm scripts work against a
// plain `npm run start` (Next serves port 3000).
const BASE = (process.argv[2] ?? "http://127.0.0.1:3000").replace(/\/$/, "");
const profile = mkdtempSync(join(tmpdir(), "tg-wizard-"));
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const results = [];
function check(name, ok, detail = "") {
  results.push({ name, ok, detail });
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${name}${ok ? "" : `  → ${detail}`}`);
}

/** Asks the OS for a port nobody is listening on. */
async function freePort() {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const port = 9450 + Math.floor(Math.random() * 500);
    const available = await new Promise((resolve) => {
      const server = createServer();
      server.once("error", () => resolve(false));
      server.once("listening", () => server.close(() => resolve(true)));
      server.listen(port, "127.0.0.1");
    });
    if (available) return port;
  }
  throw new Error("no free debugging port found");
}

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
        if (message.error) reject(new Error(message.error.message));
        else resolve(message.result);
        return;
      }
      if (message.method) {
        const key = `${message.sessionId ?? ""}:${message.method}`;
        for (const listener of this.listeners.get(key) ?? []) listener(message.params);
      }
    });
  }

  send(method, params = {}) {
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.socket.send(JSON.stringify({ id, method, params }));
      setTimeout(() => {
        if (this.pending.has(id)) {
          this.pending.delete(id);
          reject(new Error(`CDP timeout for ${method}`));
        }
      }, 30_000);
    });
  }
}

const debugPort = await freePort();
const chrome = spawn(
  CHROME,
  [
    "--headless=new",
    `--remote-debugging-port=${debugPort}`,
    `--user-data-dir=${profile}`,
    "--no-first-run",
    "--no-default-browser-check",
    "--disable-gpu",
    "--window-size=1280,1000",
    "about:blank",
  ],
  { stdio: "ignore" },
);

let socketUrl = null;
for (let attempt = 0; attempt < 100 && !socketUrl; attempt += 1) {
  try {
    const list = await (await fetch(`http://127.0.0.1:${debugPort}/json/list`)).json();
    socketUrl = list.find((entry) => entry.type === "page")?.webSocketDebuggerUrl ?? null;
  } catch {
    // browser not up yet
  }
  if (!socketUrl) await sleep(300);
}
if (!socketUrl) {
  chrome.kill();
  rmSync(profile, { recursive: true, force: true });
  throw new Error("Chrome never opened a debugging port");
}

const cdp = new Cdp(new WebSocket(socketUrl));
await new Promise((resolve, reject) => {
  cdp.socket.addEventListener("open", resolve, { once: true });
  cdp.socket.addEventListener("error", reject, { once: true });
  if (cdp.socket.readyState === WebSocket.OPEN) resolve();
});

const consoleErrors = [];
cdp.listeners.set(":Runtime.exceptionThrown", [
  (params) => consoleErrors.push(params.exceptionDetails?.exception?.description ?? "exception"),
]);
cdp.listeners.set(":Log.entryAdded", [
  (params) => {
    if (params.entry?.level === "error") consoleErrors.push(params.entry.text);
  },
]);
await cdp.send("Page.enable");
await cdp.send("Runtime.enable");
await cdp.send("Log.enable");

async function evaluate(expression) {
  const result = await cdp.send("Runtime.evaluate", {
    expression,
    awaitPromise: true,
    returnByValue: true,
  });
  if (result.exceptionDetails) {
    throw new Error(result.exceptionDetails.exception?.description ?? "evaluate failed");
  }
  return result.result?.value;
}

/** Re-runs an expression until it returns { ok: true } or the deadline passes. */
async function waitFor(expression, label, timeoutMs = 20_000) {
  const deadline = Date.now() + timeoutMs;
  let last = null;
  while (Date.now() < deadline) {
    last = await evaluate(expression);
    if (last?.ok) return last;
    await sleep(250);
  }
  throw new Error(`${label} never became true (last: ${JSON.stringify(last)})`);
}

const CONTINUE = `[...document.querySelectorAll('button')].find((b) => /^\\s*Continue\\b/.test(b.textContent))`;
const PAGE_TEXT = "document.body.innerText";
/** Current visible page text, for failure messages. */
async function pageText() {
  const value = await evaluate(PAGE_TEXT);
  return typeof value === "string" ? value.slice(0, 400) : String(value);
}

async function navigate(url) {
  await cdp.send("Page.navigate", { url });
  await waitFor(
    `({ ok: document.readyState === 'complete' })`,
    `${url} to finish loading`,
  );
}

/** Clicks a chip and waits for React to mark it selected — proves hydration. */
async function pickChip(matcher, label) {
  await waitFor(`(() => {
    const chip = [...document.querySelectorAll('button')].find((b) => ${matcher});
    if (!chip) return { ok: false, detail: 'no matching chip' };
    if (chip.getAttribute('aria-pressed') === 'true') return { ok: true };
    chip.click();
    return { ok: chip.getAttribute('aria-pressed') === 'true', detail: 'click did not register' };
  })()`, label);
}

async function clickContinue() {
  await waitFor(`(() => {
    const button = ${CONTINUE};
    if (!button) return { ok: false, detail: 'no Continue button' };
    if (button.disabled) return { ok: false, detail: 'Continue still disabled' };
    button.click();
    return { ok: true };
  })()`, "Continue to become clickable");
}

let fatal = null;
try {
  console.log(`walking ${BASE}/onboarding`);
  await navigate(`${BASE}/onboarding`);

  check("wizard renders the first step", /Who is going outside\?/i.test(await pageText()), await pageText());
  check("a name field is present", Boolean(await evaluate(`Boolean(document.querySelector('#name'))`)));

  const gated = await evaluate(`(() => {
    const button = ${CONTINUE};
    return { disabled: button?.disabled ?? null };
  })()`);
  check("Continue is gated before the step is filled", gated.disabled === true, JSON.stringify(gated));

  // Step 1: pick the experience chip first — its aria-pressed flip is the proof
  // that React has hydrated and is receiving our clicks.
  await pickChip(`/Casual/i.test(b.textContent)`, "selecting the Casual experience");
  await evaluate(`(() => {
    const input = document.querySelector('#name');
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    setter.call(input, 'Aarav');
    input.dispatchEvent(new Event('input', { bubbles: true }));
  })()`);
  await waitFor(`(() => {
    const button = ${CONTINUE};
    return { ok: Boolean(button) && !button.disabled, detail: button ? 'still gated' : 'missing' };
  })()`, "Continue to enable on step 1");
  await clickContinue();
  check(
    "step 2 opens after Continue",
    /How much time do you have\?/i.test(await pageText()),
    await pageText(),
  );

  const step1Gate = await evaluate(`(${CONTINUE})?.disabled ?? null`);
  check("step 2 is gated until time + difficulty are picked", step1Gate === true, `disabled=${step1Gate}`);

  await pickChip(`/^\\s*30 minutes/i.test(b.textContent)`, "selecting 30 minutes");
  await pickChip(`/^\\s*Medium/i.test(b.textContent)`, "selecting medium difficulty");
  await clickContinue();
  check("step 3 opens", /What do you actually enjoy\?/i.test(await pageText()), await pageText());

  await pickChip(`/Photography/i.test(b.textContent)`, "selecting Photography");
  await clickContinue();
  check("step 4 (location) opens", /Should missions know where you are\?/i.test(await pageText()), await pageText());
  check("location step explains the ~1 km rounding", /1 km/i.test(await pageText()), await pageText());

  await evaluate(`(() => {
    const skip = [...document.querySelectorAll('button')].find((b) => /Skip location and continue/i.test(b.textContent));
    skip?.click();
    return Boolean(skip);
  })()`);
  await waitFor(`({ ok: location.pathname === '/dashboard' })`, "navigation to /dashboard", 30_000);
  const landedOn = await evaluate(`location.pathname`);
  check("submitting navigates off the wizard", landedOn === "/dashboard", landedOn);
  check(
    "the dashboard renders for the new account",
    /your next adventure is outside/i.test(await pageText()),
    await pageText(),
  );

  await navigate(`${BASE}/onboarding`);
  check(
    "returning to /onboarding redirects to the dashboard",
    (await evaluate(`location.pathname`)) === "/dashboard",
    await evaluate(`location.pathname`),
  );

  const realErrors = consoleErrors.filter((entry) => !/favicon/i.test(entry));
  check("no console errors during onboarding", realErrors.length === 0, realErrors.slice(0, 3).join(" | "));
} catch (error) {
  fatal = error;
  check("the walkthrough completed", false, error.message);
  console.log(error.stack ?? error.message);
}

await new Promise((resolve) => {
  chrome.once("exit", resolve);
  chrome.kill();
  setTimeout(resolve, 5000);
});

// Chrome releases its profile a moment after exiting; cleanup is best-effort so
// it can never mask a real result.
for (let attempt = 0; attempt < 4; attempt += 1) {
  try {
    rmSync(profile, { recursive: true, force: true });
    break;
  } catch {
    await sleep(500);
  }
}

const failures = results.filter((entry) => !entry.ok);
console.log(`\n${results.length - failures.length} passed, ${failures.length} failed`);
if (fatal) console.log(`${fatal.message}`);
if (failures.length) process.exitCode = 1;
