/**
 * POST /api/sync — replay missions completed while offline.
 *
 * Each queued item carries a `clientId`, so replaying the same queue twice can
 * never award points twice. The response reports what was applied so the client
 * can safely clear those items from its local queue.
 */

import { ok, parseBody, withUser } from "@/lib/api";
import { syncSchema } from "@/lib/schemas";
import { completeMission } from "@/lib/services/missions";
import { refreshStats } from "@/lib/services/stats";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  return withUser(async (user) => {
    const parsed = await parseBody(request, syncSchema);
    if (parsed.response) return parsed.response;

    const applied: string[] = [];
    const failed: { clientId?: string; missionId: string; error: string }[] = [];
    let pointsAwarded = 0;

    for (const item of parsed.data.completions) {
      try {
        const result = await completeMission(user, {
          ...item,
          syncedFromOffline: true,
        });
        if (item.clientId) applied.push(item.clientId);
        pointsAwarded += result.pointsAwarded;
      } catch (error) {
        failed.push({
          clientId: item.clientId,
          missionId: item.missionId,
          error: error instanceof Error ? error.message : "Sync failed",
        });
      }
    }

    const stats = await refreshStats(user.id);

    return ok({
      applied,
      failed,
      pointsAwarded,
      stats,
      syncedAt: new Date().toISOString(),
    });
  });
}
