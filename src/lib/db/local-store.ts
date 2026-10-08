/**
 * Local JSON store — the offline-friendly fallback.
 *
 * When MONGODB_URI is not configured (or Mongo is unreachable) the app keeps
 * working with real persistence in a single JSON file. Writes are serialized
 * and atomic (temp file + rename) so a crash mid-write cannot corrupt the
 * database. Same document shapes as the Mongoose models.
 */

import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { dbConfig } from "@/lib/config";
import { levelFor } from "@/lib/points";
import type {
  CompletedMissionRecord,
  DiscoveryRecord,
  MissionRecord,
  UserRecord,
  UserStatsRecord,
} from "@/lib/types";
import type {
  CreateCompletionInput,
  CreateDiscoveryInput,
  CreateMissionInput,
  CreateUserInput,
  StatsPatch,
  TouchGrassStore,
} from "./store-types";

interface Database {
  version: 1;
  users: UserRecord[];
  missions: MissionRecord[];
  completions: CompletedMissionRecord[];
  discoveries: DiscoveryRecord[];
  stats: UserStatsRecord[];
}

const EMPTY_DB: Database = {
  version: 1,
  users: [],
  missions: [],
  completions: [],
  discoveries: [],
  stats: [],
};

export class LocalJsonStore implements TouchGrassStore {
  readonly kind = "local-file" as const;
  readonly description =
    "Local JSON store (.touchgrass-data/db.json) — set MONGODB_URI to use MongoDB";

  private readonly file: string;
  private queue: Promise<unknown> = Promise.resolve();
  private cache: Database | null = null;

  constructor(directory: string = dbConfig.localStoreDir) {
    this.file = path.join(process.cwd(), directory, "db.json");
  }

  private async load(): Promise<Database> {
    if (this.cache) return this.cache;
    try {
      const raw = await readFile(this.file, "utf8");
      const parsed = JSON.parse(raw) as Partial<Database>;
      this.cache = {
        version: 1,
        users: parsed.users ?? [],
        missions: parsed.missions ?? [],
        completions: parsed.completions ?? [],
        discoveries: parsed.discoveries ?? [],
        stats: parsed.stats ?? [],
      };
    } catch {
      this.cache = structuredClone(EMPTY_DB);
    }
    return this.cache;
  }

  /** Serializes writes and flushes atomically. */
  private async mutate<T>(fn: (db: Database) => T | Promise<T>): Promise<T> {
    const run = this.queue.then(async () => {
      const db = await this.load();
      const result = await fn(db);
      const dir = path.dirname(this.file);
      await mkdir(dir, { recursive: true });
      const tmp = `${this.file}.${process.pid}.tmp`;
      await writeFile(tmp, JSON.stringify(db, null, 2), "utf8");
      await rename(tmp, this.file);
      return result;
    });
    // Keep the chain alive even if this mutation rejected.
    this.queue = run.catch(() => undefined);
    return run;
  }

  async createUser(input: CreateUserInput): Promise<UserRecord> {
    const user: UserRecord = {
      id: randomUUID(),
      name: input.name,
      preferences: input.preferences,
      locationPermission: input.locationPermission,
      approximateLocation: input.approximateLocation,
      createdAt: new Date().toISOString(),
    };
    return this.mutate((db) => {
      db.users.push(user);
      return user;
    });
  }

  async getUser(id: string): Promise<UserRecord | null> {
    const db = await this.load();
    return db.users.find((user) => user.id === id) ?? null;
  }

  async updateUserPreferences(id: string, preferences: UserRecord["preferences"]) {
    return this.mutate((db) => {
      const user = db.users.find((entry) => entry.id === id);
      if (!user) return null;
      user.preferences = preferences;
      return user;
    });
  }

  async updateUserLocation(
    id: string,
    locationPermission: boolean,
    approximateLocation?: UserRecord["approximateLocation"],
  ) {
    return this.mutate((db) => {
      const user = db.users.find((entry) => entry.id === id);
      if (!user) return null;
      user.locationPermission = locationPermission;
      user.approximateLocation = approximateLocation;
      return user;
    });
  }

  async deleteUserData(id: string): Promise<void> {
    await this.mutate((db) => {
      db.users = db.users.filter((user) => user.id !== id);
      db.missions = db.missions.filter((mission) => mission.userId !== id);
      db.completions = db.completions.filter((entry) => entry.userId !== id);
      db.discoveries = db.discoveries.filter((entry) => entry.userId !== id);
      db.stats = db.stats.filter((entry) => entry.userId !== id);
    });
  }

  async createMission(input: CreateMissionInput): Promise<MissionRecord> {
    const { userId, generatedBy, model, offlineGenerated, ...draft } = input;
    const mission: MissionRecord = {
      ...draft,
      id: randomUUID(),
      userId,
      generatedBy,
      model,
      offlineGenerated,
      createdAt: input.createdAt ?? new Date().toISOString(),
    };
    return this.mutate((db) => {
      db.missions.push(mission);
      return mission;
    });
  }

  async getMission(id: string): Promise<MissionRecord | null> {
    const db = await this.load();
    return db.missions.find((mission) => mission.id === id) ?? null;
  }

  async listMissions(userId: string, limit = 25): Promise<MissionRecord[]> {
    const db = await this.load();
    return db.missions
      .filter((mission) => mission.userId === userId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, limit);
  }

  async createCompletion(input: CreateCompletionInput) {
    return this.mutate((db) => {
      if (input.clientId) {
        const existing = db.completions.find(
          (entry) => entry.userId === input.userId && entry.clientId === input.clientId,
        );
        if (existing) return { record: existing, created: false as const };
      }
      const record: CompletedMissionRecord = {
        id: randomUUID(),
        ...input,
        completedAt: input.completedAt,
      };
      db.completions.push(record);
      return { record, created: true as const };
    });
  }

  async listCompletions(userId: string, limit = 200): Promise<CompletedMissionRecord[]> {
    const db = await this.load();
    return db.completions
      .filter((entry) => entry.userId === userId)
      .sort((a, b) => b.completedAt.localeCompare(a.completedAt))
      .slice(0, limit);
  }

  async countCompletions(userId: string): Promise<number> {
    const db = await this.load();
    return db.completions.filter((entry) => entry.userId === userId).length;
  }

  async createDiscovery(input: CreateDiscoveryInput): Promise<DiscoveryRecord> {
    const discovery: DiscoveryRecord = {
      id: randomUUID(),
      ...input,
      createdAt: input.createdAt ?? new Date().toISOString(),
    };
    return this.mutate((db) => {
      db.discoveries.push(discovery);
      return discovery;
    });
  }

  async getDiscovery(id: string): Promise<DiscoveryRecord | null> {
    const db = await this.load();
    return db.discoveries.find((entry) => entry.id === id) ?? null;
  }

  async listDiscoveries(userId: string, limit = 60): Promise<DiscoveryRecord[]> {
    const db = await this.load();
    return db.discoveries
      .filter((entry) => entry.userId === userId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, limit);
  }

  async deleteDiscovery(id: string, userId: string): Promise<boolean> {
    return this.mutate((db) => {
      const before = db.discoveries.length;
      db.discoveries = db.discoveries.filter(
        (entry) => !(entry.id === id && entry.userId === userId),
      );
      return db.discoveries.length < before;
    });
  }

  async getStats(userId: string): Promise<UserStatsRecord | null> {
    const db = await this.load();
    return db.stats.find((entry) => entry.userId === userId) ?? null;
  }

  async upsertStats(userId: string, patch: StatsPatch): Promise<UserStatsRecord> {
    return this.mutate((db) => {
      const existing = db.stats.find((entry) => entry.userId === userId);
      const base: UserStatsRecord =
        existing ??
        ({
          userId,
          points: 0,
          streakDays: 0,
          longestStreak: 0,
          missionsCompleted: 0,
          discoveries: 0,
          totalMinutesOutside: 0,
          rewardedStreakMilestones: [],
          firstMissionBonusAwarded: false,
          level: levelFor(0).name,
          updatedAt: new Date().toISOString(),
        } satisfies UserStatsRecord);

      const merged: UserStatsRecord = {
        ...base,
        ...patch,
        userId,
        level: levelFor(patch.points ?? base.points).name,
        updatedAt: new Date().toISOString(),
      };

      if (existing) Object.assign(existing, merged);
      else db.stats.push(merged);
      return merged;
    });
  }
}
