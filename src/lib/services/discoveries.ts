/**
 * Discovery service.
 *
 * A discovery is only ever stored from an analysis result that either came
 * from a real vision model or was explicitly labelled as unavailable —
 * the image is kept as a data URL in the user's own record and is never
 * written to a public location.
 */

import { getStore } from "@/lib/db";
import type { CreateDiscoveryInput } from "@/lib/db/store-types";
import type { DiscoveryRecord, UserRecord } from "@/lib/types";
import { refreshStats } from "./stats";

export async function saveDiscovery(
  user: UserRecord,
  input: Omit<CreateDiscoveryInput, "userId">,
): Promise<DiscoveryRecord> {
  const store = await getStore();
  const discovery = await store.createDiscovery({ ...input, userId: user.id });
  await refreshStats(user.id, store);
  return discovery;
}

export async function listDiscoveries(
  userId: string,
  limit = 60,
): Promise<DiscoveryRecord[]> {
  const store = await getStore();
  return store.listDiscoveries(userId, limit);
}

export async function deleteDiscovery(
  user: UserRecord,
  discoveryId: string,
): Promise<boolean> {
  const store = await getStore();
  const deleted = await store.deleteDiscovery(discoveryId, user.id);
  if (deleted) await refreshStats(user.id, store);
  return deleted;
}
