/**
 * Client-side offline support.
 *
 * The PWA keeps the essentials on the device so a mission can be started and
 * finished with no connection:
 *   • the mission being worked on (title, steps, safety tips)
 *   • recent mission history and preferences
 *   • a queue of completions waiting to be synced
 *
 * Every function degrades silently when storage is unavailable (private mode,
 * full disk) — losing the cache must never break the app.
 */

import type {
  CompletedMissionRecord,
  MissionRecord,
  UserPreferences,
} from "./types";

const KEYS = {
  currentMission: "tg.current-mission",
  history: "tg.history",
  preferences: "tg.preferences",
  queue: "tg.queue",
  lastSync: "tg.last-sync",
} as const;

export const QUEUE_CHANGED_EVENT = "tg:queue-changed";

export interface QueuedCompletion {
  clientId: string;
  missionId: string;
  missionTitle: string;
  duration: number;
  completedAt: string;
  note?: string;
  /** True when the mission details were read from the offline cache. */
  fromCache: boolean;
}

function available(): boolean {
  try {
    const probe = "__tg_probe__";
    window.localStorage.setItem(probe, "1");
    window.localStorage.removeItem(probe);
    return true;
  } catch {
    return false;
  }
}

function read<T>(key: string, fallback: T): T {
  if (typeof window === "undefined" || !available()) return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown): void {
  if (typeof window === "undefined" || !available()) return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage full or blocked — the app keeps working without the cache.
  }
}

function emitQueueChanged(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(QUEUE_CHANGED_EVENT));
}

/* ------------------------------------------------------------------ mission */

export function cacheMission(mission: MissionRecord, isCurrent = true): void {
  write(`tg.mission.${mission.id}`, mission);
  if (isCurrent) write(KEYS.currentMission, mission);
}

export function getCachedMission(id: string): MissionRecord | null {
  return read<MissionRecord | null>(`tg.mission.${id}`, null);
}

export function getCurrentMission(): MissionRecord | null {
  return read<MissionRecord | null>(KEYS.currentMission, null);
}

export function clearCurrentMission(): void {
  if (typeof window === "undefined" || !available()) return;
  try {
    window.localStorage.removeItem(KEYS.currentMission);
  } catch {
    // ignore
  }
}

/* ------------------------------------------------------------------ history */

export function cacheHistory(completions: CompletedMissionRecord[]): void {
  write(KEYS.history, completions.slice(0, 20));
}

export function getCachedHistory(): CompletedMissionRecord[] {
  return read<CompletedMissionRecord[]>(KEYS.history, []);
}

export function cachePreferences(preferences: UserPreferences): void {
  write(KEYS.preferences, preferences);
}

export function getCachedPreferences(): UserPreferences | null {
  return read<UserPreferences | null>(KEYS.preferences, null);
}

/* -------------------------------------------------------------------- queue */

export function listQueue(): QueuedCompletion[] {
  return read<QueuedCompletion[]>(KEYS.queue, []);
}

export function queueLength(): number {
  return listQueue().length;
}

function newClientId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `offline-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function enqueueCompletion(
  item: Omit<QueuedCompletion, "clientId" | "fromCache"> & { clientId?: string },
): QueuedCompletion {
  const entry: QueuedCompletion = {
    ...item,
    clientId: item.clientId ?? newClientId(),
    fromCache: true,
  };
  const queue = listQueue().filter((existing) => existing.missionId !== entry.missionId);
  queue.push(entry);
  write(KEYS.queue, queue);
  emitQueueChanged();
  return entry;
}

export function removeFromQueue(clientIds: string[]): void {
  const remaining = listQueue().filter((entry) => !clientIds.includes(entry.clientId));
  write(KEYS.queue, remaining);
  emitQueueChanged();
}

export function setLastSync(at: string): void {
  write(KEYS.lastSync, at);
}

export function getLastSync(): string | null {
  return read<string | null>(KEYS.lastSync, null);
}

/** Sends the queue to the server. Safe to call repeatedly; items are idempotent. */
export async function flushQueue(): Promise<{
  attempted: number;
  applied: number;
  failed: number;
}> {
  const queue = listQueue();
  if (queue.length === 0) return { attempted: 0, applied: 0, failed: 0 };

  const response = await fetch("/api/sync", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      completions: queue.map((entry) => ({
        missionId: entry.missionId,
        duration: entry.duration,
        completedAt: entry.completedAt,
        note: entry.note,
        clientId: entry.clientId,
        syncedFromOffline: true,
      })),
    }),
  });

  if (!response.ok) {
    // 401 means onboarding is missing — drop the queue rather than loop forever.
    if (response.status === 401) {
      removeFromQueue(queue.map((entry) => entry.clientId));
      return { attempted: queue.length, applied: 0, failed: queue.length };
    }
    throw new Error(`Sync failed with ${response.status}`);
  }

  const data = (await response.json()) as {
    applied: string[];
    failed: { clientId?: string }[];
  };

  // Clear everything we successfully sent, including items the server rejected
  // for a permanent reason (a missing mission cannot be fixed by retrying).
  removeFromQueue(queue.map((entry) => entry.clientId));
  setLastSync(new Date().toISOString());

  return {
    attempted: queue.length,
    applied: data.applied.length,
    failed: data.failed.length,
  };
}
