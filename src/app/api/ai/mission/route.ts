/**
 * POST /api/ai/mission — generate a personalized outdoor mission.
 *
 * The user's stored preferences are the source of truth; the request body can
 * only nudge time/difficulty/activities. Provider selection happens inside the
 * AI layer, so this route never needs to know which model answered.
 */

import { fail, handleUnexpected, ok, parseBody, withUser } from "@/lib/api";
import { missionRequestSchema } from "@/lib/schemas";
import { rateLimit } from "@/lib/rate-limit";
import { generateMissionForUser } from "@/lib/services/missions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  return withUser(async (user) => {
    const limit = rateLimit(`mission:${user.id}`, { limit: 12, windowMs: 60_000 });
    if (!limit.allowed) {
      return fail(
        `Slow down a little — try again in ${limit.retryAfterSeconds}s.`,
        429,
      );
    }

    const parsed = await parseBody(request, missionRequestSchema);
    if (parsed.response) return parsed.response;

    try {
      const result = await generateMissionForUser(user, parsed.data);
      return ok({
        mission: result.mission,
        provider: result.provider,
        model: result.model,
        offlineGenerated: result.offlineGenerated,
        notes: result.notes,
        attempts: result.attempts,
        providerStatus: result.providerStatus,
        weatherUsed: result.weatherUsed,
        nearbyPlace: result.nearbyPlace,
      });
    } catch (error) {
      // The offline provider is a guaranteed floor, so reaching here means
      // something structurally wrong happened (e.g. storage failure).
      return handleUnexpected(error);
    }
  });
}
