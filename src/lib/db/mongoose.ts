/**
 * Mongoose connection handling.
 *
 * The connection is cached on `globalThis` so Next.js dev-mode hot reloads and
 * warm serverless invocations reuse one pool instead of opening a new one per
 * request. If no `MONGODB_URI` is configured, or the server is unreachable,
 * this module reports "unavailable" and the app falls back to the local store
 * instead of crashing.
 */

import mongoose from "mongoose";
import { dbConfig } from "@/lib/config";

type MongooseCache = {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
  /**
   * Timestamp until which connection attempts are skipped. A transient failure
   * (database still starting, brief network blip) must not disable MongoDB for
   * the whole life of the process — that would silently push a production
   * deployment onto the fallback store until a restart.
   */
  retryAfter: number;
  lastError?: string;
};

declare global {
  var __touchgrassMongoose: MongooseCache | undefined;
}

const RETRY_COOLDOWN_MS = 15_000;

const cache: MongooseCache =
  globalThis.__touchgrassMongoose ??
  (globalThis.__touchgrassMongoose = {
    conn: null,
    promise: null,
    retryAfter: 0,
  });

export function mongoConfigured(): boolean {
  return Boolean(dbConfig.uri);
}

export function mongoUnavailableReason(): string | undefined {
  if (!dbConfig.uri) return "MONGODB_URI is not set";
  return cache.lastError;
}

export async function connectMongo(): Promise<typeof mongoose | null> {
  if (!dbConfig.uri) return null;
  if (cache.conn) return cache.conn;
  // Back off briefly after a failure instead of giving up permanently.
  if (Date.now() < cache.retryAfter) return null;

  if (!cache.promise) {
    cache.promise = mongoose
      .connect(dbConfig.uri, {
        dbName: dbConfig.dbName,
        // Fail fast so a cold dashboard render never hangs on a dead database.
        serverSelectionTimeoutMS: 4_000,
        socketTimeoutMS: 20_000,
        maxPoolSize: 10,
        bufferCommands: false,
      })
      .then((connection) => {
        cache.lastError = undefined;
        return connection;
      })
      .catch((error: unknown) => {
        cache.lastError = error instanceof Error ? error.message : String(error);
        cache.retryAfter = Date.now() + RETRY_COOLDOWN_MS;
        cache.promise = null;
        console.warn(
          `[touchgrass] MongoDB unavailable (${cache.lastError}). Using the local store; retrying in ${RETRY_COOLDOWN_MS / 1000}s.`,
        );
        return null as unknown as typeof mongoose;
      });
  }

  const resolved = await cache.promise;
  if (!resolved) return null;

  cache.conn = resolved;
  return resolved;
}

/** Only used by scripts (e.g. seeding) that need a clean exit. */
export async function disconnectMongo(): Promise<void> {
  if (cache.conn) {
    await mongoose.disconnect();
    cache.conn = null;
    cache.promise = null;
  }
}
