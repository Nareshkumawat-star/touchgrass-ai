"use client";

/**
 * "Generate My Mission".
 *
 * Local models can take a while on a laptop CPU, so this shows a live elapsed
 * timer with honest progress text instead of a dead spinner — and it reports
 * when the offline template generator had to step in.
 */

import * as React from "react";
import { useRouter } from "next/navigation";
import { Clock, Loader2, Mountain, RefreshCw, Sparkles, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Callout } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { cacheMission } from "@/lib/offline";
import {
  DIFFICULTIES,
  DIFFICULTY_LABELS,
  TIME_LABELS,
  type MissionRecord,
} from "@/lib/types";

interface MissionResponse {
  mission: MissionRecord;
  provider: string;
  model: string;
  offlineGenerated: boolean;
  notes: string[];
  attempts: { provider: string; error: string }[];
  weatherUsed: boolean;
  nearbyPlace?: string;
}

const QUICK_TIMES = [10, 30, 60] as const;

export function GenerateMissionButton({
  label = "Generate My Mission",
  size = "lg",
  variant = "default",
  withOptions = false,
  className,
}: {
  label?: string;
  size?: "default" | "lg" | "xl";
  variant?: "default" | "secondary" | "outline" | "earth";
  withOptions?: boolean;
  className?: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = React.useState(false);
  const [elapsed, setElapsed] = React.useState(0);
  const [error, setError] = React.useState<string | null>(null);
  const [notes, setNotes] = React.useState<string[]>([]);
  const [showOptions, setShowOptions] = React.useState(false);
  const [availableTime, setAvailableTime] = React.useState<number | null>(null);
  const [difficulty, setDifficulty] = React.useState<string | null>(null);
  const [surpriseMe, setSurpriseMe] = React.useState(false);

  React.useEffect(() => {
    if (!loading) return;
    const started = Date.now();
    const timer = setInterval(() => setElapsed(Math.round((Date.now() - started) / 1000)), 500);
    return () => clearInterval(timer);
  }, [loading]);

  async function generate() {
    setLoading(true);
    setError(null);
    setNotes([]);
    setElapsed(0);

    try {
      const response = await fetch("/api/ai/mission", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          availableTime: availableTime ?? undefined,
          difficulty: difficulty ?? undefined,
          surpriseMe: surpriseMe || undefined,
        }),
      });

      if (response.status === 401) {
        router.push("/onboarding");
        return;
      }

      const data = (await response.json()) as MissionResponse & { error?: string };
      if (!response.ok || !data.mission) {
        throw new Error(data.error ?? "The mission generator did not answer");
      }

      // Cache locally before navigating: the mission must survive a lost signal.
      cacheMission(data.mission, true);
      router.push(`/mission/${data.mission.id}`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Something went wrong");
      setLoading(false);
    }
  }

  return (
    <div className={cn("w-full", className)}>
      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" size={size} variant={variant} onClick={generate} disabled={loading}>
          {loading ? <Loader2 className="animate-spin" /> : <Sparkles />}
          {loading ? `Writing your mission… ${elapsed}s` : label}
        </Button>

        {withOptions && (
          <Button
            type="button"
            size={size === "xl" ? "lg" : "default"}
            variant="ghost"
            onClick={() => setShowOptions((value) => !value)}
            aria-expanded={showOptions}
            disabled={loading}
          >
            <Wand2 /> Adjust
          </Button>
        )}
      </div>

      {showOptions && !loading && (
        <div className="animate-fade-up mt-4 space-y-4 rounded-2xl border border-border bg-card p-4">
          <div>
            <p className="mb-2 flex items-center gap-2 text-sm font-medium">
              <Clock className="size-4 text-accent" /> Time for this one
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setAvailableTime(null)}
                className={cn(
                  "focus-ring rounded-full border px-3.5 py-2 text-sm",
                  availableTime === null
                    ? "border-primary bg-secondary text-secondary-foreground"
                    : "border-border hover:bg-surface",
                )}
              >
                Use my default
              </button>
              {QUICK_TIMES.map((minutes) => (
                <button
                  key={minutes}
                  type="button"
                  onClick={() => setAvailableTime(minutes)}
                  className={cn(
                    "focus-ring rounded-full border px-3.5 py-2 text-sm",
                    availableTime === minutes
                      ? "border-primary bg-secondary text-secondary-foreground"
                      : "border-border hover:bg-surface",
                  )}
                >
                  {TIME_LABELS[minutes]}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="mb-2 flex items-center gap-2 text-sm font-medium">
              <Mountain className="size-4 text-accent" /> Difficulty
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setDifficulty(null)}
                className={cn(
                  "focus-ring rounded-full border px-3.5 py-2 text-sm",
                  difficulty === null
                    ? "border-primary bg-secondary text-secondary-foreground"
                    : "border-border hover:bg-surface",
                )}
              >
                My default
              </button>
              {DIFFICULTIES.map((level) => (
                <button
                  key={level}
                  type="button"
                  onClick={() => setDifficulty(level)}
                  className={cn(
                    "focus-ring rounded-full border px-3.5 py-2 text-sm",
                    difficulty === level
                      ? "border-primary bg-secondary text-secondary-foreground"
                      : "border-border hover:bg-surface",
                  )}
                >
                  {DIFFICULTY_LABELS[level]}
                </button>
              ))}
            </div>
          </div>

          <button
            type="button"
            onClick={() => setSurpriseMe((value) => !value)}
            aria-pressed={surpriseMe}
            className={cn(
              "focus-ring flex w-full items-center gap-2 rounded-xl border px-4 py-3 text-sm",
              surpriseMe
                ? "border-primary bg-secondary text-secondary-foreground"
                : "border-border hover:bg-surface",
            )}
          >
            <RefreshCw className="size-4" /> Surprise me — pick something unexpected
          </button>
        </div>
      )}

      {loading && (
        <div className="mt-4 space-y-2 text-sm text-muted-foreground" aria-live="polite">
          <p>
            {elapsed < 4
              ? "Asking the open-weight model for one mission…"
              : elapsed < 20
                ? "Still thinking. Local models on a laptop CPU are not instant."
                : "Taking longer than usual. If it fails, the offline generator takes over automatically."}
          </p>
          <div className="h-1.5 w-full max-w-xs overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-accent transition-all duration-500"
              style={{ width: `${Math.min(95, 8 + elapsed * 3)}%` }}
            />
          </div>
        </div>
      )}

      {notes.length > 0 && !loading && (
        <Callout variant="warning" title="While you were generating" className="mt-4">
          <ul className="space-y-1">
            {notes.map((note) => (
              <li key={note}>{note}</li>
            ))}
          </ul>
        </Callout>
      )}

      {error && (
        <Callout variant="danger" title="Could not generate a mission" className="mt-4">
          {error}
          <Badge variant="outline" className="mt-2 block w-fit">
            Check the AI status in the header
          </Badge>
        </Callout>
      )}
    </div>
  );
}
