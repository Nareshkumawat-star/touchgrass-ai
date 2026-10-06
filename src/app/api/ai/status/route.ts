/**
 * GET /api/ai/status — which AI is answering right now?
 *
 * Public (no session required) on purpose: the "local vs online" indicator is
 * the clearest evidence that this project is built on open weights rather than
 * one vendor's API.
 */

import { ok } from "@/lib/api";
import { getActiveProviderStatus, getProviderStatuses } from "@/lib/ai/provider";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const [providers, active] = await Promise.all([
    getProviderStatuses(true),
    getActiveProviderStatus(),
  ]);

  return ok({
    active,
    providers,
    // True when a photo would be processed on this machine.
    localInference: active.id === "local" && active.available,
  });
}
