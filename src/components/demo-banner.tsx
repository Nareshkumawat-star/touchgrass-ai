"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, Trash2, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Everything in the demo account is sample data. Saying that clearly — and
 * offering one click to remove it — is the honest way to ship a demo mode.
 */
export function DemoBanner() {
  const router = useRouter();
  const [busy, setBusy] = React.useState<"reset" | "clear" | null>(null);

  async function resetDemo() {
    setBusy("reset");
    await fetch("/api/demo", { method: "DELETE" }).catch(() => undefined);
    setBusy(null);
    router.push("/");
  }

  async function clearAndOnboard() {
    setBusy("clear");
    await fetch("/api/preferences", { method: "DELETE" }).catch(() => undefined);
    setBusy(null);
    router.push("/onboarding");
  }

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-sun/45 bg-sun/12 p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-3 text-sm">
        <TriangleAlert className="mt-0.5 size-4 shrink-0 text-earth dark:text-sun" />
        <p>
          <span className="font-medium">Demo data.</span>{" "}
          <span className="text-muted-foreground">
            This account is a sample: missions, completions, discoveries and points were seeded so
            you can see the whole app immediately. Photos are illustrative, not real captures.
          </span>
        </p>
      </div>
      <div className="flex shrink-0 flex-wrap gap-2">
        <Button type="button" size="sm" variant="outline" onClick={clearAndOnboard} disabled={busy !== null}>
          {busy === "clear" ? <Loader2 className="animate-spin" /> : null}
          Start my own
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={resetDemo} disabled={busy !== null}>
          {busy === "reset" ? <Loader2 className="animate-spin" /> : <Trash2 />}
          Remove demo data
        </Button>
      </div>
    </div>
  );
}
