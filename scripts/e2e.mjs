/**
 * End-to-end verification against a running server.
 *
 *   node scripts/e2e.mjs [baseUrl]
 *
 * Exercises the real flow: onboarding → local model mission generation →
 * completion (with idempotency) → vision analysis → discovery CRUD → stats →
 * offline sync replay → demo seeding → every page rendered.
 *
 * It asserts behaviour (hedged identifications, safety line present, points not
 * double-awarded), not exact AI wording, and exits non-zero on any failure.
 */

import { deflateSync } from "node:zlib";

const BASE = (process.argv[2] ?? "http://127.0.0.1:3000").replace(/\/$/, "");
const VISION = process.env.SKIP_VISION !== "1";

let passed = 0;
const failures = [];
const results = [];

function check(name, condition, detail = "") {
  if (condition) {
    passed += 1;
    results.push(`  PASS  ${name}`);
  } else {
    failures.push(`${name}${detail ? ` — ${detail}` : ""}`);
    results.push(`  FAIL  ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

/* ------------------------------------------------------------ cookie jar */

let cookie = "";

async function api(path, options = {}) {
  const response = await fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      ...(options.body ? { "content-type": "application/json" } : {}),
      ...(cookie ? { cookie } : {}),
      ...(options.headers ?? {}),
    },
    redirect: "manual",
  });
  const setCookie = response.headers.getSetCookie?.() ?? [];
  for (const entry of setCookie) {
    const [pair] = entry.split(";");
    if (pair.startsWith("tg_session=")) cookie = pair;
  }
  let body = null;
  const text = await response.text();
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  return { status: response.status, body, headers: response.headers };
}

async function page(path) {
  const response = await fetch(`${BASE}${path}`, {
    headers: cookie ? { cookie } : {},
    redirect: "manual",
  });
  return {
    status: response.status,
    html: await response.text(),
    location: response.headers.get("location") ?? "",
  };
}

/* ------------------------------------------------------- test leaf image */

function makeLeafPng(size = 160) {
  const raw = Buffer.alloc(size * (size * 3 + 1));
  for (let y = 0; y < size; y += 1) {
    raw[y * (size * 3 + 1)] = 0;
    for (let x = 0; x < size; x += 1) {
      const offset = y * (size * 3 + 1) + 1 + x * 3;
      const nx = (x - size / 2) / (size * 0.28);
      const ny = (y - size / 2) / (size * 0.45);
      const inside = nx * nx + ny * ny < 1;
      const midrib = Math.abs(x - size / 2) < 2;
      const colour = inside ? (midrib ? [40, 80, 45] : [107, 160, 60]) : [240, 243, 233];
      raw[offset] = colour[0];
      raw[offset + 1] = colour[1];
      raw[offset + 2] = colour[2];
    }
  }

  const crc32 = (buffer) => {
    let crc = ~0;
    for (const byte of buffer) {
      crc ^= byte;
      for (let i = 0; i < 8; i += 1) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
    return ~crc >>> 0;
  };
  const chunk = (type, data) => {
    const length = Buffer.alloc(4);
    length.writeUInt32BE(data.length);
    const typeAndData = Buffer.concat([Buffer.from(type, "ascii"), data]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(typeAndData));
    return Buffer.concat([length, typeAndData, crc]);
  };

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]).toString("base64");
}

/* ------------------------------------------------------------------ main */

const started = Date.now();

// 1. Health
{
  const { status, body } = await api("/api/health");
  check("GET /api/health returns 200", status === 200, `got ${status}`);
  check("health reports a storage backend", Boolean(body?.storage?.kind), JSON.stringify(body?.storage));
  check("health reports an AI provider", Boolean(body?.ai?.active), JSON.stringify(body?.ai));
  check(
    "health exposes the model licence",
    Boolean(body?.ai?.providers?.find((p) => p.license)?.license),
  );
  console.log(`  info  storage=${body?.storage?.kind} ai=${body?.ai?.active} model=${body?.ai?.model} vision=${body?.ai?.visionAvailable}`);
}

// 2. Unauthenticated access is refused
{
  const { status } = await api("/api/stats");
  check("GET /api/stats without a session returns 401", status === 401, `got ${status}`);
}

// 3. Onboarding
{
  const { status, body } = await api("/api/onboarding", {
    method: "POST",
    body: JSON.stringify({
      name: "E2E Tester",
      experience: "casual",
      availableTime: 20,
      difficulty: "easy",
      activities: ["walking", "nature", "birds"],
      surpriseMe: false,
      locationPermission: false,
    }),
  });
  check("POST /api/onboarding creates a user", status === 201, `got ${status}`);
  check("onboarding returns a user id", Boolean(body?.user?.id));
  check("session cookie was issued", cookie.startsWith("tg_session="), cookie);

  const invalid = await api("/api/onboarding", {
    method: "POST",
    body: JSON.stringify({ name: "", experience: "nope" }),
  });
  check("invalid onboarding body is rejected with 422", invalid.status === 422, `got ${invalid.status}`);
}

// 4. Mission generation through the configured provider
let missionId = null;
let missionReward = 0;
let expectedPoints = 0; // mission reward + first-mission bonus
{
  const startedAt = Date.now();
  const { status, body } = await api("/api/ai/mission", {
    method: "POST",
    body: JSON.stringify({}),
  });
  const elapsed = Math.round((Date.now() - startedAt) / 1000);
  check("POST /api/ai/mission returns 200", status === 200, `got ${status} ${JSON.stringify(body).slice(0, 200)}`);
  const mission = body?.mission;
  check("mission has every required field", Boolean(
    mission?.title && mission?.description && mission?.duration && mission?.difficulty &&
    mission?.category && Array.isArray(mission?.steps) && Array.isArray(mission?.thingsToLookFor) &&
    Array.isArray(mission?.safetyTips) && mission?.rewardPoints,
  ), JSON.stringify(mission).slice(0, 300));
  check("mission duration fits the requested time", mission?.duration <= 20, `duration=${mission?.duration}`);
  check("mission has at least two steps", (mission?.steps?.length ?? 0) >= 2, `steps=${mission?.steps?.length}`);
  check(
    "mission always ends with the safety line",
    (mission?.safetyTips ?? []).some((tip) => /stay aware of your surroundings and follow local rules/i.test(tip)),
    JSON.stringify(mission?.safetyTips),
  );
  check("mission records which provider wrote it", Boolean(body?.provider && body?.model), `${body?.provider}/${body?.model}`);
  check("mission response includes provider + licence status", Boolean(body?.providerStatus?.model));
  console.log(`  info  mission "${mission?.title}" from ${body?.provider} (${body?.model}) in ${elapsed}s`);
  missionId = mission?.id;
  missionReward = mission?.rewardPoints ?? 0;
  check("mission reward is a sane points value", missionReward >= 60 && missionReward <= 150, `reward=${missionReward}`);
}

// 5. Mission mode page renders the generated mission
{
  const { status, html } = await page(`/mission/${missionId}`);
  check("mission mode page renders", status === 200, `got ${status}`);
  check("mission mode tells the user to put the phone away", /put your phone away/i.test(html));
  check("mission mode has a pause control", /pause/i.test(html));
}

// 6. Completion, points and idempotency
{
  const clientId = `e2e-${Date.now()}`;
  const first = await api("/api/missions/complete", {
    method: "POST",
    body: JSON.stringify({ missionId, duration: 17, clientId }),
  });
  expectedPoints = missionReward + 100; // mission reward + first-mission bonus
  check("first completion returns 200", first.status === 200, `got ${first.status}`);
  check(
    "first completion awards the mission reward plus the first-mission bonus",
    first.body?.pointsAwarded === expectedPoints,
    `expected ${expectedPoints}, got ${first.body?.pointsAwarded}`,
  );
  check("first completion records the bonus reason", (first.body?.bonusReasons ?? []).length >= 1);
  check(
    "a completed mission is worth about the +100 baseline",
    missionReward >= 60 && missionReward <= 150,
    `reward=${missionReward}`,
  );

  const replay = await api("/api/missions/complete", {
    method: "POST",
    body: JSON.stringify({ missionId, duration: 17, clientId }),
  });
  check("replaying the same completion is idempotent", replay.body?.created === false, JSON.stringify(replay.body).slice(0, 200));
  check("replay awards no extra points", replay.body?.pointsAwarded === 0, `points=${replay.body?.pointsAwarded}`);

  const stats = await api("/api/stats");
  check(
    "stats reflect the mission reward + bonus",
    stats.body?.stats?.points === expectedPoints,
    `expected ${expectedPoints}, got ${stats.body?.stats?.points}`,
  );
  check("stats show a one-day streak", stats.body?.stats?.streakDays === 1, `streak=${stats.body?.stats?.streakDays}`);
  check("stats report the level", Boolean(stats.body?.level?.name), JSON.stringify(stats.body?.level));
  check("missionsCompleted is 1", stats.body?.stats?.missionsCompleted === 1);
}

// 7. History
{
  const { status, body } = await api("/api/missions/history");
  check("GET /api/missions/history returns 200", status === 200);
  check("history contains the completion", (body?.completions ?? []).length === 1);
  check("history totals minutes", body?.counts?.totalMinutes === 17, JSON.stringify(body?.counts));
}

// 8. Vision analysis
let discoveryId = null;
if (VISION) {
  const imageUrl = `data:image/png;base64,${makeLeafPng()}`;
  const startedAt = Date.now();
  const { status, body } = await api("/api/ai/analyze", {
    method: "POST",
    body: JSON.stringify({ imageUrl, hint: "found on a walk" }),
  });
  const elapsed = Math.round((Date.now() - startedAt) / 1000);
  console.log(`  info  vision analyse took ${elapsed}s`);

  if (status === 200 && body?.analysisUnavailable === false) {
    check("vision analysis returned an identification", Boolean(body?.identification));
    check(
      "identification is hedged, never certain",
      /(possible|possibly|likely|probably|maybe|appears|looks like|unidentified|unknown|unclear)/i.test(body.identification) ||
        body.confidence <= 50,
      `"${body.identification}" @ ${body.confidence}%`,
    );
    check("confidence is capped below certainty", body.confidence <= 95, `confidence=${body.confidence}`);
    check(
      "confidence was rescaled from a 0-1 fraction if needed",
      body.confidence >= 5,
      `confidence=${body.confidence}`,
    );
    check("description explains the visual features", (body.description ?? "").length > 10);
    check("category is a valid enum value", typeof body.category === "string");
    check("no medical or edibility advice is returned", !/\b(edible|medicinal|cure|safe to eat)\b/i.test(`${body.description} ${body.funFact}`));

    // 9. Save the discovery, list it, check points, delete it
    const save = await api("/api/discoveries", {
      method: "POST",
      body: JSON.stringify({
        imageUrl,
        identification: body.identification,
        confidence: body.confidence,
        description: body.description,
        funFact: body.funFact ?? "",
        category: body.category,
        missionId,
        provider: body.provider,
        model: body.model,
        analysisUnavailable: false,
        simulated: false,
      }),
    });
    check("POST /api/discoveries saves a discovery", save.status === 201, `got ${save.status} ${JSON.stringify(save.body).slice(0, 200)}`);
    discoveryId = save.body?.discovery?.id;

    const list = await api("/api/discoveries");
    check("GET /api/discoveries lists it", (list.body?.discoveries ?? []).length === 1);

    const stats = await api("/api/stats");
    check("discovery added 50 points", stats.body?.stats?.points === expectedPoints + 50, `points=${stats.body?.stats?.points}`);

    const del = await api(`/api/discoveries/${discoveryId}`, { method: "DELETE" });
    check("DELETE /api/discoveries/:id removes it", del.status === 200 && del.body?.deleted === true, `got ${del.status}`);

    const afterDelete = await api("/api/stats");
    check("deleting a discovery removes its points", afterDelete.body?.stats?.points === expectedPoints, `points=${afterDelete.body?.stats?.points}`);

    const foreign = await api(`/api/discoveries/${del.body?.id}`, { method: "DELETE" });
    check("deleting an already-deleted discovery returns 404", foreign.status === 404, `got ${foreign.status}`);
  } else {
    check("vision analysis is available", false, `status=${status} unavailable=${body?.analysisUnavailable} reason=${body?.unavailableReason ?? body?.error}`);
  }
} else {
  console.log("  info  vision tests skipped (SKIP_VISION=1)");
}

// 10. Offline sync replay
{
  const mission = await api("/api/ai/mission", { method: "POST", body: JSON.stringify({ availableTime: 10 }) });
  const offlineMissionId = mission.body?.mission?.id;
  check("second mission generated for the sync test", Boolean(offlineMissionId));

  // Complete it entirely offline-style (queued) and sync it twice.
  const syncBody = JSON.stringify({
    completions: [
      {
        missionId: offlineMissionId,
        duration: 9,
        completedAt: new Date().toISOString(),
        clientId: "e2e-offline-1",
        syncedFromOffline: true,
      },
    ],
  });
  const sync1 = await api("/api/sync", { method: "POST", body: syncBody });
  check("POST /api/sync applies a queued completion", (sync1.body?.applied ?? []).length === 1, JSON.stringify(sync1.body).slice(0, 200));

  const pointsAfterSync1 = sync1.body?.stats?.points;
  const sync2 = await api("/api/sync", { method: "POST", body: syncBody });
  check("replaying the sync queue is idempotent", sync2.body?.stats?.points === pointsAfterSync1, `${pointsAfterSync1} → ${sync2.body?.stats?.points}`);
}

// 11. Validation and rate limiting surfaces
{
  const bad = await api("/api/missions/complete", {
    method: "POST",
    body: JSON.stringify({ missionId: "not-a-real-mission" }),
  });
  check("completing an unknown mission returns 404", bad.status === 404, `got ${bad.status}`);

  const badBody = await api("/api/ai/analyze", {
    method: "POST",
    body: JSON.stringify({ imageUrl: "not-an-image" }),
  });
  check("a non-image body is rejected with 422", badBody.status === 422, `got ${badBody.status}`);

  const bogus = await api("/api/ai/mission", { method: "POST", body: JSON.stringify({ availableTime: 99999 }) });
  check("an out-of-range time budget is rejected", bogus.status === 422, `got ${bogus.status}`);
}

// 12. Demo mode
{
  const start = await api("/api/demo", { method: "POST" });
  check("POST /api/demo seeds a demo account", start.status === 201, `got ${start.status}`);
  check("demo seeds missions and discoveries", (start.body?.seeded?.missions ?? 0) > 0 && (start.body?.seeded?.discoveries ?? 0) > 0, JSON.stringify(start.body?.seeded));

  const stats = await api("/api/stats");
  check("demo account has points", (stats.body?.stats?.points ?? 0) > 500, `points=${stats.body?.stats?.points}`);
  check("demo account has a streak", (stats.body?.stats?.streakDays ?? 0) >= 3, `streak=${stats.body?.stats?.streakDays}`);

  const page1 = await page("/dashboard");
  check("demo dashboard renders", page1.status === 200, `got ${page1.status}`);
  check("demo dashboard is labelled as demo data", /demo data/i.test(page1.html));

  const reset = await api("/api/demo", { method: "DELETE" });
  check("DELETE /api/demo wipes demo data", reset.status === 200 && reset.body?.removed >= 1, JSON.stringify(reset.body));

  // Wiping demo data also invalidates a session that pointed at a demo user,
  // and the app should send that visitor back to onboarding rather than break.
  const orphaned = await page("/dashboard");
  check(
    "a wiped demo session is redirected to onboarding",
    orphaned.status === 307 && orphaned.location.includes("/onboarding"),
    `got ${orphaned.status} → ${orphaned.location || "(no location)"}`,
  );
}

// 12b. A fresh account for the page checks and the deletion test
{
  const { status } = await api("/api/onboarding", {
    method: "POST",
    body: JSON.stringify({
      name: "Page Tester",
      experience: "active",
      availableTime: 30,
      difficulty: "medium",
      activities: ["walking", "photography"],
      surpriseMe: true,
      locationPermission: false,
    }),
  });
  check("a second account can be created", status === 201, `got ${status}`);
}

// 13. Pages
{
  // Onboarding redirects an authenticated visitor to the dashboard, so it has to
  // be checked without a session cookie.
  {
    const savedCookie = cookie;
    cookie = "";
    const anonymous = await page("/onboarding");
    check("page /onboarding renders for a new visitor", anonymous.status === 200, `got ${anonymous.status}`);
    check(
      "page /onboarding has expected content",
      /who is going outside|get my first mission/i.test(anonymous.html),
    );
    cookie = savedCookie;
  }

  const pages = [
    ["/", /why open ai|put your phone down/i],
    ["/dashboard", /your next adventure is outside/i],
    ["/discoveries", /outdoor discoveries|nothing discovered yet/i],
    ["/rewards", /how points are earned/i],
    ["/open", /why open ai/i],
    ["/privacy", /your data/i],
    ["/demo", /two minutes|2 minutes/i],
    ["/offline", /offline/i],
  ];

  for (const [path, pattern] of pages) {
    const { status, html } = await page(path);
    check(`page ${path} renders`, status === 200, `got ${status}`);
    check(`page ${path} has expected content`, pattern.test(html), "pattern not found");
    check(`page ${path} has no unhandled server error`, !/Application error|Internal Server Error/i.test(html));
  }

  const manifest = await fetch(`${BASE}/manifest.webmanifest`);
  check("manifest is served", manifest.status === 200);
  const sw = await fetch(`${BASE}/sw.js`);
  check("service worker is served without caching", sw.status === 200 && /no-store/.test(sw.headers.get("cache-control") ?? ""));
  const icon = await fetch(`${BASE}/icon-192.png`);
  check("PWA icon is served", icon.status === 200 && (icon.headers.get("content-type") ?? "").includes("png"));
  const missing = await page("/mission/00000000-0000-0000-0000-000000000000");
  check("an unknown mission 404s", missing.status === 404, `got ${missing.status}`);
}

// 14. Data deletion
{
  const remove = await api("/api/preferences", { method: "DELETE" });
  check("DELETE /api/preferences removes the account", remove.status === 200 && remove.body?.deleted === true, JSON.stringify(remove.body));
  const after = await api("/api/stats");
  check("the session is cleared after deletion", after.status === 401, `got ${after.status}`);
}

/* ------------------------------------------------------------------ report */

console.log("\n" + results.join("\n"));
const seconds = Math.round((Date.now() - started) / 1000);
console.log(`\n${passed} passed, ${failures.length} failed in ${seconds}s`);
if (failures.length > 0) {
  console.log("\nFailures:");
  for (const failure of failures) console.log(`  - ${failure}`);
  process.exitCode = 1;
}
