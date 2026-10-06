/**
 * Dashboard aggregation — one round trip for the home screen.
 */

import { getActiveProviderStatus } from "@/lib/ai/provider";
import type { DashboardPayload, UserRecord } from "@/lib/types";
import { listDiscoveries } from "./discoveries";
import { getTodaysMission, missionHistory } from "./missions";
import { refreshStats } from "./stats";

export async function getDashboardData(user: UserRecord): Promise<DashboardPayload> {
  const [stats, todayMission, recentMissions, recentDiscoveries, provider] =
    await Promise.all([
      refreshStats(user.id),
      getTodaysMission(user),
      missionHistory(user.id, 5),
      listDiscoveries(user.id, 6),
      getActiveProviderStatus(),
    ]);

  return { user, stats, todayMission, recentMissions, recentDiscoveries, provider };
}
