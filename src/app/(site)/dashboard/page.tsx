import Link from "next/link";
import { redirect } from "next/navigation";
import {
  ArrowRight,
  CalendarDays,
  Clock,
  Mountain,
  Play,
  Sparkles,
  Trees,
} from "lucide-react";
import { Callout } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { GenerateMissionButton } from "@/components/generate-mission-button";
import { Greeting } from "@/components/greeting";
import { LevelCard } from "@/components/level-card";
import { LocationConsent } from "@/components/location-consent";
import { StatsGrid } from "@/components/stats-grid";
import { getDashboardData } from "@/lib/services/dashboard";
import { getCurrentUser } from "@/lib/session";
import {
  CATEGORY_ICONS,
  CATEGORY_LABELS,
  DIFFICULTY_LABELS,
  DISCOVERY_CATEGORY_LABELS,
} from "@/lib/types";
import { formatDuration, relativeDay } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const metadata = { title: "Today" };

export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/onboarding");

  const { stats, todayMission, recentMissions, recentDiscoveries, provider } =
    await getDashboardData(user);

  return (
    <div className="mx-auto max-w-6xl space-y-8 px-4 py-8 sm:px-6 sm:py-10">
      <header className="space-y-2">
        <Greeting name={user.name} />
        <h1 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">
          Your next adventure is outside.
        </h1>
        <p className="text-sm text-muted-foreground">
          {todayMission
            ? "One mission at a time. When it is done, the app has nothing else to show you."
            : "No mission waiting. Generate one and get moving."}
        </p>
      </header>

      <section className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <div className="space-y-4">
          {todayMission ? (
            <Card className="animate-fade-up border-primary/25">
              <CardHeader className="gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="nature">
                    <CalendarDays className="size-3" /> Today&apos;s Mission
                  </Badge>
                  <Badge variant="outline">
                    <Clock className="size-3" /> {formatDuration(todayMission.duration)}
                  </Badge>
                  <Badge variant="outline">
                    <Mountain className="size-3" /> {DIFFICULTY_LABELS[todayMission.difficulty]}
                  </Badge>
                  {todayMission.offlineGenerated && (
                    <Badge variant="muted">Offline generator</Badge>
                  )}
                </div>
                <CardTitle className="font-display text-2xl sm:text-3xl">
                  <span aria-hidden className="mr-2">
                    {CATEGORY_ICONS[todayMission.category]}
                  </span>
                  {todayMission.title}
                </CardTitle>
                <p className="text-sm text-muted-foreground">{todayMission.description}</p>
              </CardHeader>
              <CardContent className="space-y-4">
                <ol className="space-y-2 text-sm text-muted-foreground">
                  {todayMission.steps.slice(0, 3).map((step, index) => (
                    <li key={step} className="flex gap-2">
                      <span className="font-medium text-foreground">{index + 1}.</span>
                      {step}
                    </li>
                  ))}
                  {todayMission.steps.length > 3 && (
                    <li className="text-xs">
                      + {todayMission.steps.length - 3} more step
                      {todayMission.steps.length - 3 === 1 ? "" : "s"} in mission mode
                    </li>
                  )}
                </ol>
                <div className="flex flex-wrap items-center gap-3">
                  <Button asChild size="lg">
                    <Link href={`/mission/${todayMission.id}`}>
                      <Play /> Start Mission
                    </Link>
                  </Button>
                  <span className="text-xs text-muted-foreground">
                    {CATEGORY_LABELS[todayMission.category]} · +{todayMission.rewardPoints} points
                  </span>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Sparkles className="size-5 text-accent" /> Generate your next mission
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  The model reads your time, level and preferences, then writes one mission you can
                  actually finish today.
                </p>
                <GenerateMissionButton withOptions />
              </CardContent>
            </Card>
          )}

          <Callout variant="nature" title="Put your phone away 🌳">
            Once a mission starts, the screen shows only a timer and the current step. Everything
            else can wait until you are back.
          </Callout>

          <StatsGrid stats={stats} />
        </div>

        <div className="space-y-4">
          <LevelCard points={stats.points} />

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Trees className="size-4 text-accent" /> AI answering right now
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p className="flex items-center gap-2">
                <span
                  className={`size-2 rounded-full ${
                    provider.available
                      ? provider.execution === "local"
                        ? "bg-accent"
                        : "bg-sun"
                      : "bg-muted-foreground"
                  }`}
                  aria-hidden
                />
                <span className="font-medium">{provider.label}</span>
                <span className="font-mono text-xs text-muted-foreground">{provider.model}</span>
              </p>
              <p className="text-xs text-muted-foreground">
                {provider.execution === "local"
                  ? "Runs on this machine through Ollama. Your prompts and photos do not leave it."
                  : "A remote open-weight model answers. Only used because it is configured in this deployment."}
              </p>
              <p className="text-xs text-muted-foreground">
                Vision: {provider.visionAvailable ? "available for discoveries" : "not available — photos will say so honestly"}
              </p>
              <Link
                href="/open"
                className="inline-flex items-center gap-1 text-xs font-medium text-primary underline-offset-4 hover:underline"
              >
                Why open AI? <ArrowRight className="size-3" />
              </Link>
            </CardContent>
          </Card>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Recent missions</CardTitle>
          </CardHeader>
          <CardContent>
            {recentMissions.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No completed missions yet. Your history appears here after the first one.
              </p>
            ) : (
              <ul className="divide-y divide-border">
                {recentMissions.map((entry) => (
                  <li key={entry.id} className="flex items-center justify-between gap-3 py-3 first:pt-0">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{entry.missionTitle}</p>
                      <p className="text-xs text-muted-foreground">
                        {relativeDay(entry.completedAt)} · {formatDuration(entry.duration)}
                        {entry.syncedFromOffline && " · synced from offline"}
                      </p>
                    </div>
                    <Badge variant="nature">+{entry.points}</Badge>
                  </li>
                ))}
              </ul>
            )}
            <Link
              href="/rewards"
              className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-primary underline-offset-4 hover:underline"
            >
              See rewards and history <ArrowRight className="size-3" />
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Latest discoveries</CardTitle>
          </CardHeader>
          <CardContent>
            {recentDiscoveries.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Nothing found yet. After a mission, photograph something outside and an open-weight
                vision model will help you understand it.
              </p>
            ) : (
              <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {recentDiscoveries.map((discovery) => (
                  <li key={discovery.id} className="space-y-1.5">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={discovery.imageUrl}
                      alt={discovery.identification}
                      className="h-24 w-full rounded-xl border border-border object-cover"
                      loading="lazy"
                    />
                    <p className="line-clamp-2 text-xs font-medium">{discovery.identification}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {DISCOVERY_CATEGORY_LABELS[discovery.category]} · {discovery.confidence}%
                    </p>
                  </li>
                ))}
              </ul>
            )}
            <Link
              href="/discoveries"
              className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-primary underline-offset-4 hover:underline"
            >
              All discoveries <ArrowRight className="size-3" />
            </Link>
          </CardContent>
        </Card>
      </section>

      <section>
        <LocationConsent
          initialPermission={user.locationPermission}
          initialCoords={user.approximateLocation}
        />
      </section>
    </div>
  );
}
