import { redirect } from "next/navigation";
import { Flame, Info } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Callout } from "@/components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LevelCard } from "@/components/level-card";
import { StatsGrid } from "@/components/stats-grid";
import { LEVELS, POINTS } from "@/lib/points";
import { missionHistory } from "@/lib/services/missions";
import { refreshStats } from "@/lib/services/stats";
import { getCurrentUser } from "@/lib/session";
import { CATEGORY_ICONS } from "@/lib/types";
import { formatDateTime, formatDuration, formatNumber } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const metadata = { title: "Rewards" };

export default async function RewardsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/onboarding");

  const [stats, history] = await Promise.all([
    refreshStats(user.id),
    missionHistory(user.id, 30),
  ]);

  return (
    <div className="mx-auto max-w-6xl space-y-8 px-4 py-8 sm:px-6 sm:py-10">
      <header className="space-y-2">
        <h1 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">
          Rewards
        </h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Points here measure time spent outside, not time spent in the app. There are no daily
          logins to keep, no ads, and nothing that gets worse if you ignore it for a week.
        </p>
      </header>

      <StatsGrid stats={stats} />

      <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
        <LevelCard points={stats.points} />

        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">How points are earned</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p className="flex items-center justify-between">
                <span>Mission completed</span>
                <Badge variant="nature">+{POINTS.missionCompleted}</Badge>
              </p>
              <p className="flex items-center justify-between">
                <span>Discovery saved</span>
                <Badge variant="nature">+{POINTS.discovery}</Badge>
              </p>
              <p className="flex items-center justify-between">
                <span>First outdoor mission</span>
                <Badge variant="nature">+{POINTS.firstOutdoorMission}</Badge>
              </p>
              <p className="flex items-center justify-between">
                <span>7-day outdoor streak</span>
                <Badge variant="nature">+{POINTS.streakMilestone}</Badge>
              </p>
              <Callout variant="nature" hideIcon className="mt-3 text-xs">
                Mission rewards scale slightly with duration and difficulty (60–150 points), so a
                longer walk is worth a little more than a two-minute one.
              </Callout>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Flame className="size-4 text-earth dark:text-sun" /> Streak
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-muted-foreground">
              <p>
                Current streak: <strong className="text-foreground">{stats.streakDays} days</strong> ·
                longest: <strong className="text-foreground">{stats.longestStreak} days</strong>
              </p>
              <p className="text-xs">
                A streak survives as long as you went outside today or yesterday. Breaking one costs
                you nothing except the badge — the app never nags you about it.
              </p>
              <p className="text-xs">
                Total time outside: <strong className="text-foreground">
                  {formatNumber(Math.round(stats.totalMinutesOutside))} minutes
                </strong>
                .
              </p>
            </CardContent>
          </Card>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Levels</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {LEVELS.map((level) => (
            <div
              key={level.name}
              className={`rounded-2xl border p-4 ${
                level.name === stats.level ? "border-primary bg-secondary/60" : "border-border"
              }`}
            >
              <p className="font-medium">
                <span aria-hidden className="mr-2">
                  {level.emoji}
                </span>
                {level.name}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                from {formatNumber(level.minPoints)} points
              </p>
              <p className="mt-2 text-xs text-muted-foreground">{level.blurb}</p>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Mission history</CardTitle>
        </CardHeader>
        <CardContent>
          {history.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No completed missions yet. Your first one adds 100 points plus a 100-point first
              mission bonus.
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {history.map((entry) => (
                <li key={entry.id} className="flex items-center justify-between gap-3 py-3 first:pt-0">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">
                      <span aria-hidden className="mr-1.5">
                        {CATEGORY_ICONS[entry.category]}
                      </span>
                      {entry.missionTitle}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatDateTime(entry.completedAt)} · {formatDuration(entry.duration)}
                      {entry.syncedFromOffline && " · synced from offline"}
                    </p>
                  </div>
                  <Badge variant="nature">+{entry.points}</Badge>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Callout variant="info" icon={<Info className="size-4" />}>
        <p className="text-xs">
          Points are recomputed from your actual mission and discovery history every time this page
          loads, so anything you delete is reflected immediately.
        </p>
      </Callout>
    </div>
  );
}
