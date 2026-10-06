"use client";

/**
 * What the user sees when the device has no connection.
 *
 * The current mission was cached the moment it was generated, so it is fully
 * readable here — steps, things to look for and safety tips — and finishing it
 * queues the completion instead of failing.
 */

import * as React from "react";
import Link from "next/link";
import { Check, Clock, Leaf, ListChecks, RefreshCw, ShieldCheck, WifiOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useOffline } from "@/components/offline-provider";
import {
  clearCurrentMission,
  enqueueCompletion,
  getCachedHistory,
  getCurrentMission,
} from "@/lib/offline";
import { formatDuration, relativeDay } from "@/lib/utils";
import type { CompletedMissionRecord, MissionRecord } from "@/lib/types";

export function OfflineMissionView() {
  const { online, pending, syncing, syncNow } = useOffline();
  const [mission, setMission] = React.useState<MissionRecord | null>(null);
  const [history, setHistory] = React.useState<CompletedMissionRecord[]>([]);
  const [queued, setQueued] = React.useState(false);

  React.useEffect(() => {
    setMission(getCurrentMission());
    setHistory(getCachedHistory());
  }, []);

  function finish() {
    if (!mission) return;
    enqueueCompletion({
      missionId: mission.id,
      missionTitle: mission.title,
      duration: mission.duration,
      completedAt: new Date().toISOString(),
    });
    clearCurrentMission();
    setQueued(true);
  }

  return (
    <div className="mx-auto max-w-2xl space-y-5 px-4 py-8 sm:px-6">
      <div className="flex items-center gap-2 text-sm">
        {online ? (
          <Badge variant="nature">
            <Check className="size-3" /> Back online
          </Badge>
        ) : (
          <Badge variant="sun">
            <WifiOff className="size-3" /> Offline
          </Badge>
        )}
        {pending > 0 && (
          <Badge variant="outline">
            {pending} completion{pending === 1 ? "" : "s"} waiting to sync
          </Badge>
        )}
      </div>

      {queued && (
        <div className="rounded-2xl border border-accent/35 bg-accent/10 p-4 text-sm">
          Saved on this device. It will be added to your history — exactly once — when there is a
          connection again.
        </div>
      )}

      {mission ? (
        <div className="space-y-4 rounded-2xl border border-border bg-card p-5 shadow-soft">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Your saved mission
            </p>
            <h1 className="font-display mt-2 text-2xl font-semibold">{mission.title}</h1>
            <p className="mt-1 text-sm text-muted-foreground">{mission.description}</p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Badge variant="outline">
              <Clock className="size-3" /> {formatDuration(mission.duration)}
            </Badge>
            <Badge variant="outline">
              <Leaf className="size-3" /> {mission.difficulty}
            </Badge>
            <Badge variant="outline">
              <ListChecks className="size-3" /> {mission.steps.length} steps
            </Badge>
          </div>

          <ol className="space-y-2 text-sm">
            {mission.steps.map((step, index) => (
              <li key={step} className="flex gap-2">
                <span className="font-medium">{index + 1}.</span>
                <span className="text-muted-foreground">{step}</span>
              </li>
            ))}
          </ol>

          {mission.safetyTips.length > 0 && (
            <div className="flex items-start gap-2 rounded-xl bg-surface p-3 text-xs text-muted-foreground">
              <ShieldCheck className="mt-0.5 size-4 shrink-0 text-accent" />
              <ul className="space-y-1">
                {mission.safetyTips.map((tip) => (
                  <li key={tip}>{tip}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="flex flex-wrap gap-3 border-t border-border pt-4">
            <Button type="button" size="lg" onClick={finish}>
              <Check /> Finish mission offline
            </Button>
            {online && (
              <Button
                type="button"
                size="lg"
                variant="outline"
                onClick={() => void syncNow()}
                disabled={syncing}
              >
                <RefreshCw className={syncing ? "animate-spin" : ""} /> Sync now
              </Button>
            )}
          </div>
        </div>
      ) : (
        <div className="rounded-2xl border border-border bg-card p-6 text-sm text-muted-foreground">
          <p className="font-medium text-foreground">No mission saved on this device</p>
          <p className="mt-2">
            Generate a mission while you still have a connection and it will be kept here
            automatically. Everything on this screen works without one.
          </p>
          <Button asChild variant="outline" className="mt-4">
            <Link href="/dashboard">Back to the app</Link>
          </Button>
        </div>
      )}

      {history.length > 0 && (
        <div className="rounded-2xl border border-border bg-card p-5">
          <p className="text-sm font-medium">Recent missions (saved on this device)</p>
          <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
            {history.slice(0, 5).map((entry) => (
              <li key={entry.id} className="flex items-center justify-between gap-3">
                <span className="truncate">{entry.missionTitle}</span>
                <span className="shrink-0 text-xs">{relativeDay(entry.completedAt)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <p className="text-center text-xs text-muted-foreground">
        Offline mode keeps your current mission, its steps and your recent history on the device.
        Nothing is lost if the signal drops.
      </p>
    </div>
  );
}
