"use client";

/**
 * "Back from outside" flow.
 *
 * Logs the completion (or queues it if there is no signal), shows what it was
 * worth, and then offers exactly one optional next action: add a photo of
 * something you found. After that, the session is over on purpose.
 */

import * as React from "react";
import Link from "next/link";
import {
  ArrowRight,
  Check,
  CircleSlash,
  Loader2,
  Star,
  Trophy,
  WifiOff,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Callout } from "@/components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DiscoveryUploader } from "@/components/discovery-uploader";
import { useOffline } from "@/components/offline-provider";
import { enqueueCompletion } from "@/lib/offline";
import { levelFor } from "@/lib/points";
import type { MissionRecord, UserStatsRecord } from "@/lib/types";

interface CompletionResponse {
  completion: { id: string; points: number; duration: number };
  created: boolean;
  pointsAwarded: number;
  bonusReasons: string[];
  stats: UserStatsRecord;
  error?: string;
}

export function CompleteMissionFlow({
  mission,
  durationMinutes,
}: {
  mission: MissionRecord;
  durationMinutes: number;
}) {
  const { online, syncNow } = useOffline();
  const [state, setState] = React.useState<"submitting" | "saved" | "queued">("submitting");
  const [result, setResult] = React.useState<CompletionResponse | null>(null);
  const submitted = React.useRef(false);

  React.useEffect(() => {
    if (submitted.current) return;
    submitted.current = true;

    (async () => {
      if (!navigator.onLine) {
        queueOffline();
        return;
      }
      try {
        const response = await fetch("/api/missions/complete", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ missionId: mission.id, duration: durationMinutes }),
        });
        const data = (await response.json()) as CompletionResponse;
        if (!response.ok) throw new Error(data.error ?? "Could not log the mission");
        setResult(data);
        setState("saved");
      } catch {
        // The network dropped mid-request: keep the completion on the device.
        queueOffline();
      }
    })();

    function queueOffline() {
      enqueueCompletion({
        missionId: mission.id,
        missionTitle: mission.title,
        duration: durationMinutes,
        completedAt: new Date().toISOString(),
      });
      setState("queued");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const level = result ? levelFor(result.stats.points) : null;

  return (
    <div className="mx-auto max-w-2xl space-y-6 px-4 py-8 sm:px-6 sm:py-10">
      <div className="text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          Mission complete
        </p>
        <h1 className="font-display mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
          {mission.title}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {durationMinutes} minutes outside. That is the whole point of this app.
        </p>
      </div>

      {state === "submitting" && (
        <Card>
          <CardContent className="flex items-center gap-3 pt-6 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> Logging your mission…
          </CardContent>
        </Card>
      )}

      {state === "saved" && result && (
        <Card className="border-primary/25">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Trophy className="size-5 text-accent" /> +{result.pointsAwarded} Grass Points
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {result.bonusReasons.length > 0 && (
              <ul className="space-y-1 text-sm text-muted-foreground">
                {result.bonusReasons.map((reason) => (
                  <li key={reason} className="inline-flex items-center gap-2">
                    <Star className="size-3.5 text-sun" /> {reason}
                  </li>
                ))}
              </ul>
            )}
            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="rounded-2xl bg-surface p-3">
                <p className="font-display text-xl font-semibold">{result.stats.points}</p>
                <p className="text-xs text-muted-foreground">total points</p>
              </div>
              <div className="rounded-2xl bg-surface p-3">
                <p className="font-display text-xl font-semibold">{result.stats.streakDays}</p>
                <p className="text-xs text-muted-foreground">day streak</p>
              </div>
              <div className="rounded-2xl bg-surface p-3">
                <p className="font-display text-xl font-semibold">
                  {result.stats.missionsCompleted}
                </p>
                <p className="text-xs text-muted-foreground">missions</p>
              </div>
            </div>
            {level && (
              <p className="text-sm text-muted-foreground">
                Level: <span className="font-medium text-foreground">{level.emoji} {level.name}</span>
              </p>
            )}
            {!result.created && (
              <Callout variant="info" hideIcon>
                This mission was already in your history, so no points were added twice.
              </Callout>
            )}
          </CardContent>
        </Card>
      )}

      {state === "queued" && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <WifiOff className="size-5 text-earth dark:text-sun" /> Saved on this device
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm text-muted-foreground">
            <p>
              There is no connection right now, so this completion is queued locally. It will be
              synced — and the points added exactly once — the moment you are back online.
            </p>
            <Button type="button" variant="outline" onClick={() => void syncNow()} disabled={!online}>
              <Loader2 className={online ? "hidden" : "animate-spin"} /> Try syncing now
            </Button>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Optional: did you discover something?
          </CardTitle>
        </CardHeader>
        <CardContent>
          {online ? (
            <DiscoveryUploader missionId={mission.id} />
          ) : (
            <Callout variant="warning" title="Photos need a connection" hideIcon>
              Vision analysis needs the app to be reachable (it still runs locally on your own
              machine). Try again when you are back online.
            </Callout>
          )}
        </CardContent>
      </Card>

      <div className="flex flex-wrap items-center justify-center gap-3 pb-6">
        <Button asChild size="lg">
          <Link href="/dashboard">
            <Check /> Done for today <ArrowRight />
          </Link>
        </Button>
        <Button asChild variant="ghost" size="lg">
          <Link href="/rewards">
            <CircleSlash /> Nothing to add
          </Link>
        </Button>
      </div>
    </div>
  );
}
