/**
 * GET /api/health — what is this instance actually running on?
 *
 * Reports the storage backend and which AI provider would answer, so a judge
 * (or a deployment check) never has to guess whether Mongo, a local model or
 * the offline fallback is in play.
 */

import { ok } from "@/lib/api";
import { getProviderStatuses } from "@/lib/ai/provider";
import { getStoreInfo } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const [store, providers] = await Promise.all([getStoreInfo(), getProviderStatuses(true)]);
  const active = providers.find((provider) => provider.available) ?? providers.at(-1);

  return ok({
    status: "ok",
    time: new Date().toISOString(),
    storage: store,
    ai: {
      active: active?.id ?? "none",
      activeLabel: active?.label ?? "none",
      model: active?.model ?? "none",
      execution: active?.execution ?? "local",
      visionAvailable: Boolean(providers.find((provider) => provider.visionAvailable)),
      providers,
    },
  });
}
