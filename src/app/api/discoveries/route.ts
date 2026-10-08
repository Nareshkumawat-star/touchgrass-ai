/**
 * /api/discoveries
 *   GET  — the user's saved discoveries (newest first)
 *   POST — save an analysis result as a discovery
 *
 * The photo arrives as a data URL that the client already downscaled, and it
 * is stored inside the user's own record. It is never written to a public path
 * and never listed anywhere public.
 */

import { ok, parseBody, withUser } from "@/lib/api";
import { createDiscoverySchema } from "@/lib/schemas";
import { listDiscoveries, saveDiscovery } from "@/lib/services/discoveries";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return withUser(async (user) => {
    const url = new URL(request.url);
    const limit = Math.min(200, Math.max(1, Number(url.searchParams.get("limit") ?? 60)));
    const discoveries = await listDiscoveries(user.id, limit);
    return ok({ discoveries });
  });
}

export async function POST(request: Request) {
  return withUser(async (user) => {
    const parsed = await parseBody(request, createDiscoverySchema);
    if (parsed.response) return parsed.response;

    const discovery = await saveDiscovery(user, {
      missionId: parsed.data.missionId,
      imageUrl: parsed.data.imageUrl,
      identification: parsed.data.identification,
      confidence: parsed.data.confidence,
      description: parsed.data.description,
      funFact: parsed.data.funFact,
      category: parsed.data.category,
      provider: parsed.data.provider,
      model: parsed.data.model,
      analysisUnavailable: parsed.data.analysisUnavailable,
      createdAt: parsed.data.createdAt,
    });

    return ok({ discovery }, 201);
  });
}
