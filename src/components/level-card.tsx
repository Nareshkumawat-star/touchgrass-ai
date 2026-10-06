import { Progress } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { LEVELS, levelFor, levelProgress, nextLevel } from "@/lib/points";
import { formatNumber } from "@/lib/utils";

export function LevelCard({ points }: { points: number }) {
  const level = levelFor(points);
  const next = nextLevel(points);
  const progress = levelProgress(points);
  const remaining = next ? Math.max(0, next.minPoints - points) : 0;

  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-soft">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Current level
          </p>
          <p className="font-display mt-1 text-2xl font-semibold">
            <span aria-hidden className="mr-2">
              {level.emoji}
            </span>
            {level.name}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">{level.blurb}</p>
        </div>
        <Badge variant="nature">{formatNumber(points)} pts</Badge>
      </div>

      <div className="mt-5 space-y-2">
        <Progress value={Math.round(progress * 100)} />
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
          {next ? (
            <>
              <span>
                {formatNumber(remaining)} points to{" "}
                <span className="font-medium text-foreground">
                  {next.emoji} {next.name}
                </span>
              </span>
              <span>
                {formatNumber(points)} / {formatNumber(next.minPoints)}
              </span>
            </>
          ) : (
            <span>Top level reached. Nothing else to unlock here.</span>
          )}
        </div>
      </div>

      <div className="mt-5 grid gap-1.5 border-t border-border pt-4 text-xs text-muted-foreground">
        <p className="font-medium text-foreground">How levels work</p>
        {LEVELS.map((entry) => (
          <p key={entry.name}>
            {entry.emoji} {entry.name} — from {formatNumber(entry.minPoints)} points
          </p>
        ))}
      </div>
    </div>
  );
}
