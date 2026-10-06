/**
 * GET /api/missions/history — completed missions, newest first.
 *
 * Also returns the pending (not yet completed) missions so the offline client
 * can pre-cache what the user might start while out of signal.
 */

import { ok, withUser } from "@/lib/api";
import { getStore } from "@/lib/db";
import { missionHistory } from "@/lib/services/missions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return withUser(async (user) => {
    const url = new URL(request.url);
    const limit = Math.min(100, Math.max(1, Number(url.searchParams.get("limit") ?? 30)));

    const store = await getStore();
    const [completions, missions] = await Promise.all([
      missionHistory(user.id, limit),
      store.listMissions(user.id, 10),
    ]);

    const completedIds = new Set(completions.map((entry) => entry.missionId));

    return ok({
      completions,
      pendingMissions: missions.filter((mission) => !completedIds.has(mission.id)),
      counts: {
        completions: completions.length,
        totalMinutes: completions.reduce((total, entry) => total + entry.duration, 0),
      },
    });
  });
}
