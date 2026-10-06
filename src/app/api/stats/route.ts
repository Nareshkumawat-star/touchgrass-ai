/**
 * GET /api/stats — points, streak, level and totals.
 *
 * Stats are recomputed from stored activity on every read, so this endpoint is
 * always internally consistent even after offline syncs.
 */

import { ok, withUser } from "@/lib/api";
import { POINTS, levelFor, levelProgress, nextLevel } from "@/lib/points";
import { refreshStats } from "@/lib/services/stats";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return withUser(async (user) => {
    const stats = await refreshStats(user.id);
    const level = levelFor(stats.points);
    const upcoming = nextLevel(stats.points);

    return ok({
      stats,
      level,
      nextLevel: upcoming,
      levelProgress: levelProgress(stats.points),
      pointsToNextLevel: upcoming ? upcoming.minPoints - stats.points : 0,
      pointsTable: POINTS,
    });
  });
}
