/**
 * Store resolution.
 *
 * `getStore()` is the only thing the rest of the app imports. It prefers
 * MongoDB, and transparently falls back to the local JSON store when Mongo is
 * not configured or not reachable — so the app is never broken by a missing
 * database, which matters for demos and for offline use.
 */

import { connectMongo, mongoConfigured, mongoUnavailableReason } from "./mongoose";
import { LocalJsonStore } from "./local-store";
import { MongoStore } from "./mongo-store";
import type { TouchGrassStore } from "./store-types";

declare global {
  var __touchgrassLocalStore: LocalJsonStore | undefined;
}

const localStore: LocalJsonStore =
  globalThis.__touchgrassLocalStore ?? (globalThis.__touchgrassLocalStore = new LocalJsonStore());

export interface StoreInfo {
  kind: TouchGrassStore["kind"];
  description: string;
  mongoConfigured: boolean;
  note?: string;
}

export async function getStore(): Promise<TouchGrassStore> {
  if (mongoConfigured()) {
    const connection = await connectMongo();
    if (connection) return new MongoStore();
    return localStore;
  }
  return localStore;
}

/** Used by `/api/health` and the "Why Open AI?" page to be honest about storage. */
export async function getStoreInfo(): Promise<StoreInfo> {
  if (!mongoConfigured()) {
    return {
      kind: "local-file",
      description: localStore.description,
      mongoConfigured: false,
      note: "Running with the built-in local store. Set MONGODB_URI to persist in MongoDB.",
    };
  }
  const connection = await connectMongo();
  if (connection) {
    return { kind: "mongodb", description: "MongoDB (Mongoose)", mongoConfigured: true };
  }
  return {
    kind: "local-file",
    description: localStore.description,
    mongoConfigured: true,
    note: `MongoDB was configured but is unreachable (${mongoUnavailableReason()}). Using the local store so the app keeps working.`,
  };
}

export type { TouchGrassStore } from "./store-types";
export { localStore };
