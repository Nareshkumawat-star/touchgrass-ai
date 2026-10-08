"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Callout } from "@/components/ui/alert";

/**
 * One-button "delete everything about me". Two-step confirmation because it is
 * irreversible — and because a single mis-tap should never wipe someone's
 * mission history.
 */
export function DeleteMyData() {
  const router = useRouter();
  const [confirming, setConfirming] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function remove() {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/preferences", { method: "DELETE" });
      if (!response.ok) throw new Error("Could not delete your data");
      router.push("/");
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not delete your data");
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      {confirming ? (
        <div className="flex flex-wrap items-center gap-3">
          <Button type="button" variant="destructive" size="lg" onClick={remove} disabled={busy}>
            {busy ? <Loader2 className="animate-spin" /> : <Trash2 />}
            Yes, delete everything
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="lg"
            onClick={() => setConfirming(false)}
            disabled={busy}
          >
            Cancel
          </Button>
        </div>
      ) : (
        <Button type="button" variant="outline" size="lg" onClick={() => setConfirming(true)}>
          <Trash2 /> Delete my data
        </Button>
      )}

      {error && (
        <Callout variant="danger" hideIcon>
          {error}
        </Callout>
      )}
    </div>
  );
}
