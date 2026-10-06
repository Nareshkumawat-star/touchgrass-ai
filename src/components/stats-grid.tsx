import { Flame, Footprints, Sparkles, Star } from "lucide-react";
import type { UserStatsRecord } from "@/lib/types";
import { formatNumber } from "@/lib/utils";

/**
 * Outdoor stats. Deliberately about time spent outside — there is no metric
 * here that rewards using the app more.
 */
export function StatsGrid({ stats }: { stats: UserStatsRecord }) {
  const items = [
    {
      icon: Flame,
      value: `${stats.streakDays}`,
      unit: stats.streakDays === 1 ? "day streak" : "day streak",
      tone: "text-earth dark:text-sun",
    },
    {
      icon: Footprints,
      value: `${stats.missionsCompleted}`,
      unit: "missions",
      tone: "text-primary",
    },
    {
      icon: Sparkles,
      value: `${stats.discoveries}`,
      unit: "discoveries",
      tone: "text-sky",
    },
    {
      icon: Star,
      value: formatNumber(stats.points),
      unit: "points",
      tone: "text-accent",
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {items.map((item) => (
        <div
          key={item.unit}
          className="rounded-2xl border border-border bg-card p-4 shadow-soft"
        >
          <item.icon className={`size-5 ${item.tone}`} aria-hidden />
          <p className="mt-2 font-display text-2xl font-semibold leading-none">{item.value}</p>
          <p className="mt-1 text-xs text-muted-foreground">{item.unit}</p>
        </div>
      ))}
      <div className="col-span-2 rounded-2xl border border-border bg-surface/70 p-4 text-xs text-muted-foreground sm:col-span-4">
        {stats.totalMinutesOutside > 0
          ? `That's about ${Math.round(stats.totalMinutesOutside / 60)} hours spent outside instead of on a screen. Longest streak: ${stats.longestStreak} days.`
          : "Nothing tracked yet. The first mission is the only one that needs willpower."}
      </div>
    </div>
  );
}
