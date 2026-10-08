"use client";

/**
 * Discovery mode.
 *
 * Photograph something you found, have an open-weight vision model look at it,
 * and see a hedged identification with the visual reasoning behind it. The
 * result is never presented as fact, and nothing is saved until the user says so.
 */

import * as React from "react";
import {
  Camera,
  Check,
  Image as ImageIcon,
  Info,
  Loader2,
  RefreshCw,
  Save,
  Sparkles,
  Upload,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Callout } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { formatBytes, prepareImage } from "@/lib/image-client";
import { confidenceLabel, cn } from "@/lib/utils";
import { DISCOVERY_CATEGORY_LABELS, type DiscoveryCategory } from "@/lib/types";

interface AnalysisResult {
  identification: string;
  confidence: number;
  description: string;
  funFact: string;
  category: DiscoveryCategory;
  provider: "local" | "huggingface" | "heuristic";
  model: string;
  analysisUnavailable: boolean;
  unavailableReason?: string;
  attempts: { provider: string; error: string }[];
}

export function DiscoveryUploader({ missionId }: { missionId?: string }) {
  const [image, setImage] = React.useState<{ dataUrl: string; meta: string } | null>(null);
  const [hint, setHint] = React.useState("");
  const [analyzing, setAnalyzing] = React.useState(false);
  const [result, setResult] = React.useState<AnalysisResult | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [saved, setSaved] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const inputRef = React.useRef<HTMLInputElement | null>(null);

  async function handleFile(file: File | undefined) {
    if (!file) return;
    setError(null);
    setResult(null);
    setSaved(false);
    try {
      const prepared = await prepareImage(file);
      setImage({
        dataUrl: prepared.dataUrl,
        meta:
          prepared.finalBytes < prepared.originalBytes
            ? `${prepared.width}×${prepared.height} · shrunk from ${formatBytes(
                prepared.originalBytes,
              )} to ${formatBytes(prepared.finalBytes)}`
            : `${prepared.width}×${prepared.height}`,
      });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not read that photo");
    }
  }

  async function analyze() {
    if (!image) return;
    setAnalyzing(true);
    setError(null);
    try {
      const response = await fetch("/api/ai/analyze", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          imageUrl: image.dataUrl,
          missionId,
          hint: hint.trim() || undefined,
        }),
      });
      const data = (await response.json()) as AnalysisResult & { error?: string };
      if (!response.ok) throw new Error(data.error ?? "The vision model did not answer");
      setResult(data);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Could not analyse the photo. Check your connection and try again.",
      );
    } finally {
      setAnalyzing(false);
    }
  }

  async function save() {
    if (!image || !result) return;
    setSaving(true);
    setError(null);
    try {
      const response = await fetch("/api/discoveries", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          imageUrl: image.dataUrl,
          identification: result.identification,
          confidence: result.confidence,
          description: result.description,
          funFact: result.funFact,
          category: result.category,
          missionId,
          provider: result.provider,
          model: result.model,
          analysisUnavailable: result.analysisUnavailable,
        }),
      });
      if (!response.ok) {
        const data = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? "Could not save the discovery");
      }
      setSaved(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not save the discovery");
    } finally {
      setSaving(false);
    }
  }

  function reset() {
    setImage(null);
    setResult(null);
    setSaved(false);
    setError(null);
    setHint("");
    if (inputRef.current) inputRef.current.value = "";
  }

  return (
    <div className="space-y-5">
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="sr-only"
        id="discovery-photo"
        onChange={(event) => void handleFile(event.target.files?.[0])}
      />

      {!image ? (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="focus-ring flex w-full flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-border bg-card px-6 py-12 text-center transition-colors hover:border-primary/50 hover:bg-surface"
        >
          <span className="flex size-14 items-center justify-center rounded-full bg-secondary text-secondary-foreground">
            <Camera className="size-6" />
          </span>
          <span className="font-display text-lg font-medium">Did you discover something?</span>
          <span className="max-w-sm text-sm text-muted-foreground">
            Tap to take a photo or pick one from your gallery. Leaves, flowers, birds, insects,
            trees — anything you noticed.
          </span>
        </button>
      ) : (
        <div className="space-y-4">
          <div className="overflow-hidden rounded-2xl border border-border bg-card">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={image.dataUrl}
              alt="Your outdoor discovery"
              className="max-h-80 w-full object-cover"
            />
            <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-2">
                <ImageIcon className="size-3.5" /> {image.meta}
              </span>
              <span className="inline-flex items-center gap-2">
                <Info className="size-3.5" /> Location data stripped from the photo
              </span>
            </div>
          </div>

          <div className="flex flex-wrap items-end gap-3">
            <div className="min-w-52 flex-1 space-y-1.5">
              <label htmlFor="discovery-hint" className="text-xs font-medium text-muted-foreground">
                Optional hint (the model treats this as a hint, not a fact)
              </label>
              <Input
                id="discovery-hint"
                value={hint}
                onChange={(event) => setHint(event.target.value)}
                placeholder="e.g. found near a river"
                maxLength={160}
              />
            </div>
            <Button
              type="button"
              size="lg"
              onClick={() => void analyze()}
              disabled={analyzing}
            >
              {analyzing ? <Loader2 className="animate-spin" /> : <Sparkles />}
              {analyzing ? "Analysing photo…" : "Analyse with vision AI"}
            </Button>
            <Button type="button" size="lg" variant="ghost" onClick={reset} disabled={analyzing}>
              <RefreshCw /> Pick another photo
            </Button>
          </div>

          {analyzing && (
            <Callout hideIcon>
              <span className="inline-flex items-center gap-2">
                <Loader2 className="size-4 animate-spin" /> A local vision model is reading the
                photo. On a laptop CPU this can take a while — nothing is uploaded anywhere.
              </span>
            </Callout>
          )}

          {error && (
            <Callout variant="danger" title="Analysis failed">
              {error}
            </Callout>
          )}

          {result && (
            <div className="animate-fade-up space-y-4 rounded-2xl border border-border bg-card p-5">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={result.analysisUnavailable ? "muted" : "nature"}>
                  {result.analysisUnavailable ? "Not identified" : "AI estimate"}
                </Badge>
                <Badge variant="outline" className="font-mono text-[11px]">
                  {result.model}
                </Badge>
                <Badge variant="outline">
                  {result.provider === "local"
                    ? "🟢 Local AI"
                    : result.provider === "huggingface"
                      ? "🟡 Online AI"
                      : "⚪ Offline"}
                </Badge>
              </div>

              <div>
                <h3 className="font-display text-2xl font-semibold">
                  {result.identification}
                </h3>
                {!result.analysisUnavailable && (
                  <>
                    <div className="mt-3 flex items-center gap-3">
                      <div className="h-2 w-full max-w-56 overflow-hidden rounded-full bg-muted">
                        <div
                          className={cn(
                            "h-full rounded-full",
                            result.confidence >= 70 ? "bg-accent" : "bg-sun",
                          )}
                          style={{ width: `${result.confidence}%` }}
                        />
                      </div>
                      <span className="text-sm">
                        {confidenceLabel(result.confidence)} · {result.confidence}%
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      This is an estimate from a photo, never a confirmed identification.
                    </p>
                  </>
                )}
              </div>

              <p className="text-sm text-muted-foreground">{result.description}</p>

              {result.funFact && (
                <div className="rounded-xl bg-surface p-4 text-sm">
                  <p className="font-medium">Did you know?</p>
                  <p className="mt-1 text-muted-foreground">{result.funFact}</p>
                </div>
              )}

              {result.unavailableReason && (
                <Callout variant="warning" hideIcon>
                  {result.unavailableReason}
                </Callout>
              )}

              {result.analysisUnavailable && (
                <Callout variant="warning" title="No vision model is available">
                  <p>
                    Your photo is still on your device — it was not sent anywhere and nothing was
                    invented. Start Ollama with a vision model (for example{" "}
                    <code className="font-mono text-xs">ollama pull qwen2.5vl:3b</code>) and try
                    again.
                  </p>
                </Callout>
              )}

              <div className="flex flex-wrap items-center gap-3 border-t border-border pt-4">
                {saved ? (
                  <p className="inline-flex items-center gap-2 text-sm font-medium text-primary">
                    <Check className="size-4" /> Saved to your discoveries (+50 points)
                  </p>
                ) : (
                  <>
                    <Button type="button" size="lg" onClick={() => void save()} disabled={saving}>
                      {saving ? <Loader2 className="animate-spin" /> : <Save />}
                      {saving ? "Saving…" : "Save Discovery"}
                    </Button>
                    <Button
                      type="button"
                      size="lg"
                      variant="outline"
                      onClick={() => void analyze()}
                      disabled={analyzing}
                    >
                      <Upload /> Try another
                    </Button>
                  </>
                )}
                <span className="text-xs text-muted-foreground">
                  {result.analysisUnavailable
                    ? "Saving keeps the photo with your notes; nothing is claimed about it."
                    : `${DISCOVERY_CATEGORY_LABELS[result.category]} · stored privately in your account`}
                </span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
