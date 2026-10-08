"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, MapPin, Sparkles, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn, confidenceLabel, relativeDay } from "@/lib/utils";
import { DISCOVERY_CATEGORY_LABELS, type DiscoveryRecord } from "@/lib/types";

export function DiscoveryGallery({ discoveries }: { discoveries: DiscoveryRecord[] }) {
  const router = useRouter();
  const [pendingId, setPendingId] = React.useState<string | null>(null);
  const [confirmId, setConfirmId] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  async function remove(id: string) {
    setPendingId(id);
    setError(null);
    try {
      const response = await fetch(`/api/discoveries/${id}`, { method: "DELETE" });
      if (!response.ok) throw new Error("Could not delete that discovery");
      setConfirmId(null);
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not delete that discovery");
    } finally {
      setPendingId(null);
    }
  }

  return (
    <div className="space-y-4">
      {error && <p className="text-sm text-destructive">{error}</p>}

      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {discoveries.map((discovery) => (
          <li
            key={discovery.id}
            className="overflow-hidden rounded-2xl border border-border bg-card shadow-soft"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={discovery.imageUrl}
              alt={discovery.identification}
              className="h-48 w-full object-cover"
              loading="lazy"
            />
            <div className="space-y-3 p-4">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline">{DISCOVERY_CATEGORY_LABELS[discovery.category]}</Badge>
                {discovery.analysisUnavailable && <Badge variant="muted">Not identified</Badge>}
                <Badge variant="outline" className="font-mono text-[10px]">
                  {discovery.model}
                </Badge>
              </div>

              <div>
                <p className="font-medium leading-snug">{discovery.identification}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {relativeDay(discovery.createdAt)}
                  {discovery.confidence > 0 &&
                    ` · ${confidenceLabel(discovery.confidence)} (${discovery.confidence}%)`}
                </p>
              </div>

              {discovery.confidence > 0 && (
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className={cn(
                      "h-full rounded-full",
                      discovery.confidence >= 70 ? "bg-accent" : "bg-sun",
                    )}
                    style={{ width: `${discovery.confidence}%` }}
                  />
                </div>
              )}

              <p className="text-sm text-muted-foreground">{discovery.description}</p>

              {discovery.funFact && (
                <p className="flex gap-2 text-xs text-muted-foreground">
                  <Sparkles className="mt-0.5 size-3.5 shrink-0 text-accent" />
                  {discovery.funFact}
                </p>
              )}

              <div className="flex items-center justify-between gap-2 border-t border-border pt-3">
                <span className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
                  <MapPin className="size-3" />
                  {discovery.provider === "local"
                    ? "Analysed locally"
                    : discovery.provider === "huggingface"
                      ? "Analysed remotely"
                      : "No model used"}
                </span>

                {confirmId === discovery.id ? (
                  <span className="flex items-center gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="destructive"
                      onClick={() => void remove(discovery.id)}
                      disabled={pendingId === discovery.id}
                    >
                      {pendingId === discovery.id ? <Loader2 className="animate-spin" /> : <Trash2 />}
                      Delete
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => setConfirmId(null)}
                    >
                      Cancel
                    </Button>
                  </span>
                ) : (
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => setConfirmId(discovery.id)}
                    aria-label={`Delete ${discovery.identification}`}
                  >
                    <Trash2 />
                  </Button>
                )}
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
