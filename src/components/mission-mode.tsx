"use client";

/**
 * Mission mode.
 *
 * The design brief: show as little as possible. Title, timer, the current step,
 * progress, pause, finish. No navigation, no feed, no notifications — the whole
 * point is that you close the app and come back when it is done.
 */

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  Check,
  ChevronLeft,
  ChevronRight,
  CirclePause,
  CirclePlay,
  Flag,
  Leaf,
  WifiOff,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/input";
import { useOffline } from "@/components/offline-provider";
import { cn, formatDuration } from "@/lib/utils";
import { cacheMission } from "@/lib/offline";
import { CATEGORY_ICONS, type MissionRecord } from "@/lib/types";

function formatClock(seconds: number): string {
  const safe = Math.max(0, seconds);
  const minutes = Math.floor(safe / 60);
  const rest = safe % 60;
  return `${String(minutes).padStart(2, "0")}:${String(rest).padStart(2, "0")}`;
}

export function MissionMode({ mission }: { mission: MissionRecord }) {
  const router = useRouter();
  const { online } = useOffline();

  const totalSeconds = mission.duration * 60;
  const [remaining, setRemaining] = React.useState(totalSeconds);
  const [running, setRunning] = React.useState(true);
  const [currentStep, setCurrentStep] = React.useState(0);
  const [startedAt] = React.useState(() => Date.now());

  // Keep this mission on the device so a lost signal cannot lose the steps.
  React.useEffect(() => {
    cacheMission(mission, true);
  }, [mission]);

  React.useEffect(() => {
    if (!running || remaining <= 0) return;
    const timer = setInterval(() => setRemaining((value) => Math.max(0, value - 1)), 1_000);
    return () => clearInterval(timer);
  }, [running, remaining]);

  const elapsedSeconds = totalSeconds - remaining;
  const elapsedMinutes = Math.max(1, Math.round(elapsedSeconds / 60));
  const stepProgress = ((currentStep + (remaining === 0 ? 1 : 0)) / mission.steps.length) * 100;
  const timerProgress = (elapsedSeconds / totalSeconds) * 100;

  function finish() {
    const params = new URLSearchParams({
      duration: String(elapsedMinutes),
    });
    router.push(`/mission/${mission.id}/complete?${params.toString()}`);
  }

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-xl flex-col px-5 py-6">
      <div className="flex items-center justify-between gap-3">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.push("/dashboard")}
          className="text-muted-foreground"
        >
          <ChevronLeft /> Back
        </Button>
        {!online && (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-sun/40 bg-sun/12 px-3 py-1.5 text-xs text-earth dark:text-sun">
            <WifiOff className="size-3" /> Offline — steps saved
          </span>
        )}
      </div>

      <div className="mt-6 flex flex-1 flex-col">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          {CATEGORY_ICONS[mission.category]} {formatDuration(mission.duration)} ·{" "}
          {mission.steps.length} steps
        </p>
        <h1 className="font-display mt-2 text-3xl font-semibold leading-tight tracking-tight">
          {mission.title}
        </h1>

        {/* Timer */}
        <div className="mt-8 rounded-3xl border border-border bg-card p-6 text-center shadow-soft">
          <p
            className="font-mono text-6xl font-semibold tabular-nums leading-none sm:text-7xl"
            aria-live="off"
          >
            {formatClock(remaining)}
          </p>
          <p className="mt-2 text-xs text-muted-foreground">
            {remaining === 0 ? "Time is up — head back whenever you're ready" : "remaining"}
          </p>
          <div className="mt-5 flex items-center justify-center gap-3">
            <Button
              type="button"
              size="lg"
              variant={running ? "secondary" : "default"}
              onClick={() => setRunning((value) => !value)}
            >
              {running ? <CirclePause /> : <CirclePlay />}
              {running ? "Pause" : "Resume"}
            </Button>
            {mission.duration <= 30 && (
              <Button
                type="button"
                size="lg"
                variant="ghost"
                onClick={() => setRemaining((value) => value + 120)}
              >
                +2 min
              </Button>
            )}
          </div>
          <Progress value={timerProgress} className="mt-5 h-1.5" />
        </div>

        {/* Current step */}
        <div className="mt-8">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Step {currentStep + 1} of {mission.steps.length}
          </p>
          <p className="mt-2 text-2xl font-medium leading-snug">
            {mission.steps[currentStep]}
          </p>
          <Progress value={stepProgress} className="mt-4" />

          <div className="mt-5 flex items-center gap-3">
            <Button
              type="button"
              variant="outline"
              size="lg"
              onClick={() => setCurrentStep((value) => Math.max(0, value - 1))}
              disabled={currentStep === 0}
            >
              <ChevronLeft /> Previous
            </Button>
            {currentStep < mission.steps.length - 1 ? (
              <Button
                type="button"
                size="lg"
                onClick={() => setCurrentStep((value) => value + 1)}
              >
                <Check /> Done, next step
              </Button>
            ) : (
              <Button type="button" size="lg" onClick={finish}>
                <Flag /> Finish Mission
              </Button>
            )}
          </div>
        </div>

        {/* Remaining steps, deliberately quiet */}
        <details className="mt-8 rounded-2xl border border-border bg-surface/60 p-4">
          <summary className="cursor-pointer text-sm font-medium">
            All steps ({mission.steps.length})
          </summary>
          <ol className="mt-3 space-y-2 text-sm text-muted-foreground">
            {mission.steps.map((step, index) => (
              <li
                key={step}
                className={cn(
                  "flex gap-2",
                  index === currentStep && "font-medium text-foreground",
                )}
              >
                <span className={cn(index < currentStep && "text-accent")}>
                  {index < currentStep ? "✓" : `${index + 1}.`}
                </span>
                <span>{step}</span>
              </li>
            ))}
          </ol>
          {mission.thingsToLookFor.length > 0 && (
            <div className="mt-4 border-t border-border pt-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Look for
              </p>
              <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
                {mission.thingsToLookFor.map((item) => (
                  <li key={item}>• {item}</li>
                ))}
              </ul>
            </div>
          )}
          <div className="mt-4 border-t border-border pt-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Safety
            </p>
            <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
              {mission.safetyTips.map((tip) => (
                <li key={tip}>• {tip}</li>
              ))}
            </ul>
          </div>
        </details>
      </div>

      {/* The instruction that matters most */}
      <div className="sticky bottom-0 -mx-5 mt-8 bg-gradient-to-t from-background via-background to-transparent px-5 pt-6 pb-5">
        <div className="flex items-center justify-between gap-4 rounded-2xl border border-primary/25 bg-secondary px-5 py-4">
          <p className="flex items-center gap-2 font-display text-lg font-medium text-secondary-foreground">
            <Leaf className="size-5 text-primary" /> Put your phone away 🌳
          </p>
          <Button type="button" variant="ghost" size="sm" onClick={finish}>
            I&apos;m done
          </Button>
        </div>
        <p className="mt-2 text-center text-[11px] text-muted-foreground">
          Started {Math.max(1, Math.round((Date.now() - startedAt) / 60000))} min ago · tap finish
          when you are back
        </p>
      </div>

      {currentStep === mission.steps.length - 1 && remaining > 0 && (
        <div className="pb-4">
          <Button type="button" variant="outline" className="w-full" size="lg" onClick={finish}>
            <ChevronRight /> Finish early and log it
          </Button>
        </div>
      )}
    </div>
  );
}
