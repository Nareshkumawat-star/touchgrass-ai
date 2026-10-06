"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, Sparkles } from "lucide-react";
import { Button, type ButtonProps } from "@/components/ui/button";

/**
 * Seeds the demo account (a clearly-labelled sample user with history) and
 * drops the visitor straight into a populated dashboard.
 */
export function DemoButton({
  children = "Try Demo",
  variant = "outline",
  size = "lg",
  ...props
}: ButtonProps) {
  const router = useRouter();
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function startDemo() {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/demo", { method: "POST" });
      if (!response.ok) {
        const data = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? "Could not start the demo");
      }
      router.push("/dashboard");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not start the demo");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col items-start gap-2">
      <Button
        type="button"
        onClick={startDemo}
        disabled={loading}
        variant={variant}
        size={size}
        {...props}
      >
        {loading ? <Loader2 className="animate-spin" /> : <Sparkles />}
        {loading ? "Preparing demo data…" : children}
      </Button>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
