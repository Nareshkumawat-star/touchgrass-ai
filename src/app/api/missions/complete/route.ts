/**
 * POST /api/missions/complete — record a finished outdoor mission.
 *
 * Idempotent when the client supplies a `clientId`, which is how an offline
 * completion is safely replayed once the phone finds a signal again.
 */

import { fail, ok, parseBody, withUser } from "@/lib/api";
import { completeMissionSchema } from "@/lib/schemas";
import { completeMission } from "@/lib/services/missions";
import { levelProgress } from "@/lib/points";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  return withUser(async (user) => {
    const parsed = await parseBody(request, completeMissionSchema);
    if (parsed.response) return parsed.response;

    try {
      const result = await completeMission(user, parsed.data);
      return ok({
        completion: result.completion,
        created: result.created,
        pointsAwarded: result.pointsAwarded,
        bonusReasons: result.bonusReasons,
        stats: {
          ...result.stats,
          levelProgress: levelProgress(result.stats.points),
        },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not complete mission";
      if (/not found/i.test(message)) return fail(message, 404);
      throw error;
    }
  });
}
