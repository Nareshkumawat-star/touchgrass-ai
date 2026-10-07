# TouchGrass AI 🌳

**AI that gives you a reason to put your phone down.**

TouchGrass AI is not another chatbot. It generates one short, safe, personalized
outdoor mission — then it asks you to close the app and go do it. When you come
back, you can photograph what you found and an open-weight vision model helps you
understand it.

The design rule behind every decision:

> **The app should help you leave the app.**

---

## Table of contents

- [The idea](#the-idea)
- [Features](#features)
- [Architecture](#architecture)
- [Screenshots](#screenshots)
- [Quick start](#quick-start)
- [Local AI setup with Ollama](#local-ai-setup-with-ollama)
- [The model used, and its licence](#the-model-used-and-its-licence)
- [Environment variables](#environment-variables)
- [Database](#database)
- [API routes](#api-routes)
- [Offline mode](#offline-mode)
- [Privacy](#privacy)
- [Safety](#safety)
- [Two-minute demo](#two-minute-demo)
- [Deployment](#deployment)
- [Verification: what was actually tested](#verification-what-was-actually-tested)
- [Planned features (not implemented)](#planned-features-not-implemented)
- [Project structure](#project-structure)

---

## The idea

Most "AI" products are optimised to keep you in them. This one is optimised to
get you out.

- **One mission at a time.** Not a feed of suggestions.
- **The mission screen is deliberately empty**: a timer, the current step, and
  "Put your phone away 🌳".
- **Points measure minutes outdoors**, never session time. There is no daily
  login bonus, no streak guilt, no ads.
- **The AI runs on your own machine** by default, so your photos and location do
  not have to go anywhere.

Example missions the app produces:

| Mission | Time | Category |
| --- | --- | --- |
| 30-Minute Nature Detective — walk, find two leaf shapes, one bird, listen for 2 minutes | 30 min | Nature detective |
| Five-Minute Sound Map — sit outdoors and map every sound you can hear | 10 min | Mindful moment |
| Leaf Shape Hunt — find five different leaf shapes, look under one of them | 20 min | Plant hunt |
| Texture Photo Walk — photograph five textures, natural next to man-made | 20 min | Photography hunt |

---

## Features

**Mission generation**
- Structured missions: title, description, duration, difficulty, category, steps,
  things to look for, safety tips, reward points.
- Personalised from stored preferences, available time, difficulty, preferred
  activities, weather (when it can actually be fetched), approximate location
  (only if allowed), previous missions and previous discoveries.
- Server-side validation of every model response (Zod) with one automatic
  repair attempt, plus a **safety review** that rejects unsafe missions.

**Discovery (vision)**
- Photograph a plant, leaf, flower, bird, insect, tree or object.
- Open-weight vision model returns a **hedged** identification, an honest
  confidence value (capped below certainty), the visual features behind the
  guess, and one safe fact.
- Refuses to give medical, edibility or safety advice.
- If no vision model is reachable it says so instead of inventing a result.

**Rewards**
- Mission +100 (scaled 60–150 with duration/difficulty), discovery +50, first
  outdoor mission +100, 7-day streak +500.
- Levels: Grass Starter → Nature Walker → Trail Explorer → Outdoor Regular →
  TouchGrass Legend.
- Points and streaks are **derived** from real history on every read, so nothing
  drifts and deleting a discovery adjusts the total immediately.

**Offline / PWA**
- Installable, with a service worker that caches the app shell and an `/offline`
  screen that shows your saved mission.
- The current mission, its instructions, preferences and recent history live on
  the device; a completion made offline is queued and synced idempotently later.

**Location (optional)**
- Nothing is requested until you press the button. Only a ~1 km rounded area is
  stored. Nearby parks come from OpenStreetMap; weather from Open-Meteo. Denying
  permission leaves a fully working app.

**Maps**
- Leaflet + OpenStreetMap tiles, plus the Overpass API for nearby green spaces.
  No paid map API and no map API key.

**Demo mode**
- One button seeds a clearly-labelled demo account with missions, completions,
  discoveries, a streak and points, so a judge can see the whole loop in seconds.

---

## Architecture

```
Browser (Next.js App Router, React 19, Tailwind v4, shadcn/ui, Leaflet)
   │  server actions / route handlers
   ▼
Services  (lib/services/*)                    ← missions, stats, discoveries, demo
   │
   ├──────────────► AI layer (lib/ai/*)       ← the swap point
   │                   AIProvider
   │                   ├── LocalQwenProvider        (default: Ollama, open weights)
   │                   ├── HuggingFaceProvider      (opt-in remote open weights)
   │                   └── OfflineTemplateProvider  (no model, reviewed templates)
   │
   └──────────────► Data layer (lib/db/*)
                       TouchGrassStore
                       ├── MongoStore     (Mongoose models: User, Mission,
                       │                   CompletedMission, Discovery, UserStats)
                       └── LocalJsonStore (atomic JSON file, zero-setup fallback)
```

Everything above the AI layer speaks one interface, so **no route, service or
component imports a vendor SDK**:

```ts
interface AIProvider {
  generateMission(input: MissionGenerationInput): Promise<MissionGenerationResult>;
  analyzeDiscovery(input: DiscoveryAnalysisInput): Promise<DiscoveryAnalysisResult>;
  status(): Promise<ProviderStatus>;
}
```

Adding a provider = one class in `src/lib/ai/` implementing `AIProvider`, plus an
entry in `PROVIDER_FACTORIES` and in `AI_PROVIDER_ORDER`. Files:
`lib/ai/provider.ts` (registry), `lib/ai/qwen.ts`, `lib/ai/huggingface.ts`,
`lib/ai/heuristic.ts`, `lib/ai/vision.ts`, `lib/ai/prompts.ts`,
`lib/ai/models.ts` (model registry + licences), `lib/ai/safety` reviews in
`lib/safety.ts`.

**Fallback chain**: if the local model is missing, times out, returns invalid
JSON or produces something the safety review rejects, the next provider is tried
and the reviewed offline templates guarantee a usable mission. The UI always
states which provider answered.

### Tech stack

| Layer | Choice |
| --- | --- |
| Framework | Next.js 15 (App Router), React 19, TypeScript strict |
| Styling | Tailwind CSS v4 + shadcn/ui-style primitives, Lucide icons |
| Data | MongoDB + Mongoose (or the built-in local JSON store) |
| AI | Open-weight Qwen models via Ollama (default), Hugging Face (optional) |
| Maps | Leaflet + OpenStreetMap + Overpass API |
| Weather | Open-Meteo (no API key) |
| Validation | Zod on every trust boundary |
| PWA | Hand-written service worker + manifest (no plugin) |

---

## Screenshots

Captured from the running app (`docs/screenshots/`, generated with headless
Chrome against a local production build):

| Screen | File |
| --- | --- |
| Landing page | `docs/screenshots/01-landing.png` |
| Onboarding | `docs/screenshots/02-onboarding.png` |
| Dashboard | `docs/screenshots/03-dashboard.png` |
| Discoveries + vision result | `docs/screenshots/04-discovery.png` |
| Rewards | `docs/screenshots/05-rewards.png` |
| Why Open AI? | `docs/screenshots/06-open-ai.png` |
| Privacy | `docs/screenshots/07-privacy.png` |
| Mobile dashboard | `docs/screenshots/08-mobile-dashboard.png` |
| Mission mode (mobile) | `docs/screenshots/09-mission-mode.png` |

To regenerate them: `npm run build`, then `PORT=3100 npm start` in one shell and
`node scripts/screenshots.mjs http://127.0.0.1:3100` in another. The script seeds
the demo account first, so the authenticated screens show real populated state.

---

## Quick start

Requirements: Node.js 20+ and, for AI, [Ollama](https://ollama.com/download).

```bash
git clone <your-fork-url> touchgrass-ai
cd touchgrass-ai
npm install

# Optional but recommended: local open-weight models
ollama pull qwen2.5:1.5b      # text  (Apache-2.0)
ollama pull qwen2.5vl:3b      # vision (Apache-2.0)

cp .env.example .env.local    # adjust if needed
npm run dev
```

Open http://localhost:3000.

**No database and no API key are required.** With an empty `.env.local` the app
uses the local JSON store at `.touchgrass-data/db.json` and, if Ollama is not
running, falls back to the reviewed offline mission templates — so the app is
always runnable and always honest about what it is doing.

Useful scripts:

```bash
npm run dev         # development server
npm run build       # production build
npm run start       # production server
npm run typecheck   # tsc --noEmit (strict)
npm run lint        # eslint
npm run verify      # typecheck + lint
npm run test:e2e    # full API suite against a server on :3000 (99 checks)
npm run test:db     # MongoDB store smoke test (mongodb-memory-server)
npm run test:ui     # onboarding wizard in headless Chrome (server on :3000)
npm run icons       # regenerate the PWA PNG icons
```

---

## Local AI setup with Ollama

1. Install Ollama and start it (`ollama serve`, or the desktop app).
2. Pull the models:

   ```bash
   ollama pull qwen2.5:1.5b      # mission writing  (Apache-2.0)
   ollama pull qwen2.5vl:3b      # photo analysis  (Apache-2.0)
   ```

3. Verify they are visible: `ollama list`.
4. Start the app. The header should read **🟢 Local AI** with the model name.

The app never assumes a model exists — it probes Ollama, reports what it found,
and can even use a different installed model if the configured one is missing
(it tells you when it does that).

**Speed note.** On a laptop CPU, a 1.5B model writes a mission in roughly 10–25
seconds; a 7B model needs a GPU. The UI shows a live elapsed timer while
generating, and the dashboard warms the model in the background so the first
mission is faster. If you want the fastest possible demo, set
`OLLAMA_MODEL=qwen2.5:0.5b`.

---

## The model used, and its licence

The app displays the exact model and licence wherever an AI answer appears, and
the full registry lives in [`src/lib/ai/models.ts`](src/lib/ai/models.ts).
Models not in that registry are reported as **unknown**, never guessed at.

| Role | Default model | Licence | Commercial use |
| --- | --- | --- | --- |
| Mission generation | `qwen2.5:1.5b` (Qwen2.5-1.5B-Instruct) | Apache-2.0 | ✅ permitted |
| Discovery vision | `qwen2.5vl:3b` (Qwen2.5-VL-3B-Instruct) | Apache-2.0 | ✅ permitted |
| Offline fallback | reviewed templates in this repo | project licence (MIT) | ✅ permitted |

**Careful with other Qwen sizes.** In the Qwen2.5 family, the **3B and 72B**
checkpoints (for example `qwen2.5:3b`) ship under the **Qwen Research License,
which is non-commercial**, while 0.5B / 1.5B / 7B / 14B / 32B are Apache-2.0.
That is exactly why the default here is 1.5B rather than 3B, and why `lib/ai/models.ts`
records the licence per model instead of claiming the family is uniform. Always
check the model card before shipping a different checkpoint:

- <https://huggingface.co/Qwen/Qwen2.5-1.5B-Instruct>
- <https://huggingface.co/Qwen/Qwen2.5-VL-3B-Instruct>
- <https://huggingface.co/Qwen/Qwen2.5-3B-Instruct> (Qwen Research License)

Qwen models may also carry an acceptable-use policy on top of the licence; read
the model card before any commercial deployment.

---

## Environment variables

Every variable is optional and documented in [`.env.example`](.env.example). The
important ones:

| Variable | Default | Purpose |
| --- | --- | --- |
| `OLLAMA_BASE_URL` | `http://127.0.0.1:11434` | Where Ollama listens |
| `OLLAMA_MODEL` | `qwen2.5:1.5b` | Text model for missions |
| `OLLAMA_VISION_MODEL` | `qwen2.5vl:3b` | Vision model for discoveries |
| `OLLAMA_TIMEOUT_MS` | `90000` | Hard ceiling on one model request |
| `AI_PROVIDER_ORDER` | `local,huggingface,heuristic` | Provider priority |
| `HUGGINGFACE_API_TOKEN` | *(unset)* | Enables the optional remote provider |
| `HUGGINGFACE_MODEL` / `..._VISION_MODEL` | `Qwen/Qwen2.5-7B-Instruct`, `Qwen/Qwen2.5-VL-7B-Instruct` | Remote models |
| `MONGODB_URI` | *(unset)* | Set to use MongoDB instead of the JSON store |
| `MONGODB_DB` | `touchgrass` | Database name |
| `LOCAL_STORE_DIR` | `.touchgrass-data` | JSON store directory |
| `SESSION_SECRET` | dev default | Signs the anonymous session cookie — **set this in production** |
| `MAX_UPLOAD_BYTES` | `4194304` | Photo size ceiling after client downscaling |

**No API key is ever exposed to the browser.** Only the server reads `.env.local`;
the client learns about AI state through `/api/ai/status`, which returns provider
metadata and never credentials.

---

## Database

Models (`src/lib/db/models.ts`), all Mongoose, mirrored exactly by the local store:

```
User              { name, preferences{experience, availableTime, activities[],
                    difficulty, surpriseMe}, locationPermission,
                    approximateLocation{lat,lng,label}, isDemo, createdAt }
Mission           { userId, title, description, duration, difficulty, category,
                    steps[], thingsToLookFor[], safetyTips[], rewardPoints,
                    generatedBy, model, offlineGenerated, placeName, createdAt }
CompletedMission  { userId, missionId, missionTitle, category, completedAt,
                    duration, points, syncedFromOffline, note, clientId }
Discovery         { userId, missionId, imageUrl, identification, confidence,
                    description, funFact, category, provider, model,
                    analysisUnavailable, simulated, createdAt }
UserStats         { userId, points, streakDays, longestStreak, missionsCompleted,
                    discoveries, totalMinutesOutside,
                    rewardedStreakMilestones[], firstMissionBonusAwarded,
                    lastMissionDate, level }
```

Notable choices:

- `CompletedMission` has a **partial unique index** on `{ userId, clientId }`, so
  replaying the offline queue can never pay out twice.
- `imageUrl` holds a data URL that the client already downscaled to ≤1024 px and
  re-encoded (which also strips EXIF/GPS). Photos are never written to a public
  path.
- Stats are recomputed from history on read (`lib/services/stats.ts`), so points
  and streaks cannot drift.

To use MongoDB, set `MONGODB_URI` and restart. The app reports the active store in
`/api/health` and on the "Why Open AI?" page. If Mongo is configured but
unreachable, the app logs a warning and keeps working on the JSON store instead of
failing requests. Verify the Mongo path any time with `npm run test:db`.

---

## API routes

| Method | Route | Purpose |
| --- | --- | --- |
| `POST` | `/api/onboarding` | Create the anonymous user + preferences |
| `POST` | `/api/ai/mission` | Generate and store a mission |
| `POST` | `/api/ai/analyze` | Analyse a discovery photo (does not persist) |
| `GET` | `/api/ai/status` | Which provider is live, plus model + licence |
| `POST` | `/api/missions/complete` | Log a completion, award points (idempotent) |
| `GET` | `/api/missions/history` | Completed missions + pending missions |
| `GET` | `/api/stats` | Points, streak, level, progress |
| `GET`/`POST` | `/api/discoveries` | List / save discoveries |
| `DELETE` | `/api/discoveries/:id` | Delete one discovery (owner-scoped) |
| `POST` | `/api/sync` | Replay offline completions |
| `GET`/`POST` | `/api/location` | Location consent, nearby parks + weather |
| `GET`/`POST`/`DELETE` | `/api/preferences` | Read / update / delete everything |
| `POST`/`DELETE` | `/api/demo` | Seed or wipe demo data |
| `GET` | `/api/health` | Storage backend + provider readiness |

All bodies are validated with Zod; all handlers return consistent JSON errors.
AI endpoints are rate-limited per user (in-memory, per process).

---

## Offline mode

| Concern | Implementation |
| --- | --- |
| App shell | Service worker precaches `/`, `/offline`, manifest and icons |
| Page navigations | Network-first, cache fallback, then the `/offline` screen |
| Static assets | Cache-first (content-hashed, immutable) |
| API calls | Never cached — stale AI output would be worse than an error |
| Current mission | Written to `localStorage` the moment it is generated |
| Recent history / preferences | Cached on the device |
| Completing offline | Queued locally with a UUID `clientId`, synced via `/api/sync` |
| Duplicate protection | Unique `{userId, clientId}` index on `CompletedMission` |
| AI without internet | Ollama runs locally, so generation itself needs no internet |

**Honest boundary:** the app is server-rendered, so a *never-before-visited* page
cannot be rendered without a connection. What works fully offline is the app
shell you have already loaded, the saved mission (readable and completable), and
mission *generation* whenever the server is reachable and Ollama is local.

---

## Privacy

- **Location is optional.** Nothing is requested until you press the button, only
  a ~1 km rounded area is stored, and it is never published.
- **Photos are private.** Downscaled and EXIF-stripped on your device, stored in
  your own record, never written to a public path.
- **No accounts.** A single HMAC-signed, `httpOnly` session cookie identifies an
  anonymous user. No email, no password, no third-party analytics, no trackers.
- **You can delete anything.** Per-discovery delete, plus a one-click "delete my
  data" that removes the user, missions, completions, discoveries and stats.
- **You are told where inference happens**: 🟢 Local AI / 🟡 Online AI / ⚪
  Offline templates, always visible in the header and explained on `/privacy`.

---

## Safety

Outdoor missions are constrained by a system prompt **and** enforced server-side
in `src/lib/safety.ts`, which scans every generated mission for:

- trespassing, private property, restricted or abandoned locations
- climbing cliffs, trees, fences; scrambling
- water, ice and swimming
- approaching, feeding, touching or provoking animals
- going out alone in the dark
- traffic, roads and railway lines
- leaving marked trails

If a mission trips the review it is **rejected** and the reviewed offline
template takes over. Every mission also ends with:

> Stay aware of your surroundings and follow local rules.

Weather and nearby-place data are attached only when they were actually
retrieved; when they are missing, the app says so instead of inventing them.

---

## Two-minute demo

A scripted flow is built into the app at `/demo`. Short version:

1. **Try Demo** on the landing page → a labelled sample account opens.
2. **Generate My Mission** → the local model writes a mission (provider shown in
   the header).
3. **Start Mission** → mission mode: timer, one step, "Put your phone away 🌳".
4. **Finish** → points, bonuses, streak, level.
5. **Upload a photo** → open-weight vision model returns a hedged identification
   with confidence.
6. **Save Discovery** → appears on `/discoveries` and adds 50 points.
7. Open **Why Open AI?** → provider table, live model, exact licences.
8. Change `OLLAMA_MODEL` in `.env.local`, restart → the AI layer changes with no
   code edits.

---

## Deployment

**Vercel / any Node host**

1. Set the environment variables from `.env.example` (`SESSION_SECRET` is
   required in production, plus `MONGODB_URI` and `HUGGINGFACE_API_TOKEN` if you
   want AI to work there).
2. Deploy. Serverless platforms cannot reach `127.0.0.1:11434`, so a hosted
   deployment needs either the Hugging Face provider or a reachable Ollama host
   (`OLLAMA_BASE_URL` can point at any machine running Ollama).
3. The JSON fallback store is not suitable for serverless filesystems — use
   MongoDB (or Atlas) there.

**Self-hosted with local AI** (the intended way to run this project)

```bash
git clone <repo> && cd touchgrass-ai
npm ci && npm run build
OLLAMA_BASE_URL=http://127.0.0.1:11434 npm start
```

The Docker/VM only needs to reach your Ollama instance; use a persistent volume
for `.touchgrass-data` if you stay on the JSON store.

---

## Verification: what was actually tested

Everything below was run against the real app, not asserted:

- `npm run typecheck` (TypeScript strict) and `npm run lint` — clean.
- `npm run build` — production build succeeds.
- The full API flow exercised over HTTP against a running server: onboarding →
  mission generation with a real local Qwen model → completion with points and
  streak → vision analysis of a photo → discovery save/list/delete → stats →
  offline `/api/sync` replay (including duplicate-replay idempotency) → demo
  seeding and reset → `/api/health` — **99 checks, 0 failures**
  (`node scripts/e2e.mjs http://127.0.0.1:3100`). Onboarding is covered there by
  the privacy rule (coordinates sent while location is declined are dropped), the
  idempotency rule (re-submitting onboarding reuses the account instead of
  orphaning it), and the ~1 km rounding of an opted-in position.
- The same 99 checks re-run against the MongoDB store with `mongodb-memory-server`
  (`npm run test:db`) — **99 checks, 0 failures** — because no MongoDB daemon runs
  on the development machine.
- The onboarding wizard itself driven in a real browser (headless Chrome over the
  DevTools protocol): step gating, submission, the redirect to the dashboard, the
  authenticated `/onboarding` redirect, and a clean console — **12 checks,
  0 failures** (`npm run test:ui`), passing five consecutive runs.
- Offline behaviour verified by completing a mission with the network
  interrupted: it queues locally, then syncs and awards points exactly once.
- Screenshots captured from the running production build with headless Chrome.

**Measured on the development machine** (Windows, CPU-only inference, no GPU):

| Operation | Model | Time |
| --- | --- | --- |
| Mission generation (cold model load) | `qwen2.5:3b` | ~68 s |
| Mission generation | `qwen2.5:1.5b` | ~15–27 s |
| Vision identification | `qwen2.5vl:3b` | ~85 s cold, faster warm |

This is why the default model is 1.5B and why the UI shows live progress rather
than a silent spinner. With a GPU (or a hosted provider) these drop to a few
seconds.

> **One gotcha when reproducing this:** `next dev` and `next start` share the
> `.next` directory. If a dev server is still running on another port while you
> build, it overwrites the production server chunks and pages start returning 500
> (`Cannot read properties of undefined` inside `webpack-runtime.js`). Stop any
> dev server before `npm run build`, then `next start` and re-run the suite.

---

## Planned features (not implemented)

Being explicit about the gaps:

- **Push notifications / reminders** — deliberately absent; the product should not
  nag. A "walking now" reminder was cut on purpose.
- **Real authentication** — sessions are anonymous and cookie-based; a production
  fork would add an auth provider (the session module is isolated for that).
- **Fine-tuned mission model** — the prompts and JSON contract are ready for
  fine-tuning but no adapter/weights are shipped.
- **Server-side photo storage** — photos are data URLs inside the user record.
  Fine at this scale; a large deployment should use object storage.
- **Multi-user social features** — none, by design: no feed, no sharing, no
  leaderboards.
- **Background sync** (service-worker `sync` events) — currently sync happens
  when the app is open and the network returns.
- **i18n** — English only for now.

---

## Project structure

```
src/
├── app/
│   ├── (site)/                  # pages with header/footer
│   │   ├── page.tsx             # landing
│   │   ├── onboarding/          # preference wizard
│   │   ├── dashboard/           # today's mission + stats
│   │   ├── discoveries/         # gallery, delete
│   │   ├── rewards/             # levels, points table, history
│   │   ├── open/                # "Why Open AI?"
│   │   ├── privacy/
│   │   └── demo/                # 2-minute judge script
│   ├── mission/[id]/            # mission mode (no chrome)
│   │   └── complete/            # log + discovery flow
│   ├── offline/                 # service-worker fallback screen
│   └── api/                     # route handlers (see table above)
├── components/                  # UI + feature components
│   └── ui/                      # shadcn-style primitives
├── lib/
│   ├── ai/                      # provider interface + implementations
│   ├── db/                      # Mongoose models + local store
│   ├── services/                # mission, stats, discovery, demo logic
│   ├── safety.ts                # mission safety review
│   ├── points.ts                # rewards, levels, streaks
│   ├── schemas.ts               # Zod contracts
│   ├── offline.ts               # device cache + sync queue
│   └── session.ts               # anonymous signed sessions
└── public/                      # manifest, service worker, icons
```

---

## Licence

Project code: MIT (see [LICENSE](LICENSE)). Model weights keep their own licences,
listed in [the model section](#the-model-used-and-its-licence) and in
`src/lib/ai/models.ts`.

---

Built for Hacktoberfest season, 2026. Identifications are AI estimates — never
certain — and are not medical or safety advice.
