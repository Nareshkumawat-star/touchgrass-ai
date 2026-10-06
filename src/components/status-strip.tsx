"use client";

/**
 * Status strip.
 *
 * The single clearest signal that this app is not a wrapper around one vendor's
 * API: it always says which model is answering and where it runs.
 *   🟢 Local AI        — open weights on this machine
 *   🟡 Online AI       — a remote provider, only if explicitly configured
 *   ⚪ Offline templates — no model at all, reviewed mission templates
 */

import * as React from "react";
import Link from "next/link";
import { ChevronDown, Cpu, Wifi, WifiOff } from "lucide-react";
import type { ProviderStatus } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useOffline } from "./offline-provider";

interface StatusResponse {
  active: ProviderStatus;
  providers: ProviderStatus[];
  localInference: boolean;
}

const PROVIDER_STYLE: Record<
  string,
  { dot: string; label: string; tone: string }
> = {
  local: {
    dot: "bg-accent",
    label: "Local AI",
    tone: "text-foreground",
  },
  huggingface: {
    dot: "bg-sun",
    label: "Online AI",
    tone: "text-foreground",
  },
  heuristic: {
    dot: "bg-muted-foreground",
    label: "Offline templates",
    tone: "text-muted-foreground",
  },
};

export function StatusStrip({ compact = false }: { compact?: boolean }) {
  const { online, pending, syncing } = useOffline();
  const [status, setStatus] = React.useState<StatusResponse | null>(null);
  const [open, setOpen] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const response = await fetch("/api/ai/status", { cache: "no-store" });
        if (!response.ok) return;
        const data = (await response.json()) as StatusResponse;
        if (!cancelled) setStatus(data);
      } catch {
        // Offline: keep the last known value.
      }
    };
    void load();
    const timer = setInterval(load, 60_000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, []);

  const active = status?.active;
  const style = PROVIDER_STYLE[active?.id ?? "heuristic"] ?? PROVIDER_STYLE.heuristic;

  return (
    <div className="relative">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          aria-expanded={open}
          className="focus-ring inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium shadow-soft transition-colors hover:bg-surface"
        >
          <span className={cn("size-2 rounded-full", style.dot)} aria-hidden />
          <span className={style.tone}>
            {active ? (active.id === "local" ? "Local AI" : active.label) : "Checking AI…"}
          </span>
          {!compact && active?.model && active.model !== "unavailable" && (
            <span className="hidden font-mono text-[11px] text-muted-foreground sm:inline">
              {active.model}
            </span>
          )}
          <ChevronDown className={cn("size-3 transition-transform", open && "rotate-180")} />
        </button>

        <span
          className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-xs text-muted-foreground shadow-soft"
          title={online ? "Connected" : "No connection"}
        >
          {online ? <Wifi className="size-3" /> : <WifiOff className="size-3" />}
          {online ? "Online" : "Offline"}
        </span>

        {pending > 0 && (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-sun/40 bg-sun/15 px-3 py-1.5 text-xs font-medium text-earth dark:text-sun">
            {syncing ? "Syncing…" : `${pending} saved offline`}
          </span>
        )}
      </div>

      {open && (
        <div className="animate-fade-up absolute right-0 z-40 mt-2 w-80 max-w-[calc(100vw-2rem)] rounded-2xl border border-border bg-card p-4 text-sm shadow-lift">
          <p className="mb-2 flex items-center gap-2 font-medium">
            <Cpu className="size-4 text-accent" />
            Where the AI runs
          </p>
          <ul className="space-y-2.5 text-xs">
            {(status?.providers ?? []).map((provider) => (
              <li key={provider.id} className="flex gap-2.5">
                <span
                  className={cn(
                    "mt-1 size-2 shrink-0 rounded-full",
                    PROVIDER_STYLE[provider.id]?.dot ?? "bg-muted-foreground",
                  )}
                  aria-hidden
                />
                <span>
                  <span className="font-medium">{provider.label}</span>
                  <span className="text-muted-foreground">
                    {" "}
                    · {provider.model} · {provider.execution === "local" ? "on this machine" : "remote"}
                  </span>
                  <br />
                  <span className="text-muted-foreground">
                    {provider.available ? "Available" : "Not available"}
                    {provider.detail ? ` — ${provider.detail}` : ""}
                  </span>
                </span>
              </li>
            ))}
          </ul>
          <div className="mt-3 border-t border-border pt-3 text-xs text-muted-foreground">
            Photos are analysed {status?.active.visionAvailable ? "by a local vision model" : "only when a vision model is available"}.
            <Link href="/open" className="ml-1 font-medium text-primary underline-offset-4 hover:underline">
              Why open AI?
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
