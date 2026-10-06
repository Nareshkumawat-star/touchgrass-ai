"use client";

/**
 * Onboarding wizard.
 *
 * Four short steps, all of them tappable chips rather than form fields, because
 * this is filled in on a phone. Location consent is the final step and is
 * entirely optional — declining still produces a complete experience.
 */

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Loader2,
  MapPin,
  Sparkles,
  Wand2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Callout } from "@/components/ui/alert";
import { Input, Label } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { cachePreferences } from "@/lib/offline";
import {
  ACTIVITIES,
  ACTIVITY_LABELS,
  DIFFICULTIES,
  DIFFICULTY_LABELS,
  EXPERIENCE_LABELS,
  EXPERIENCE_LEVELS,
  TIME_LABELS,
  TIME_OPTIONS,
  type Activity,
  type Difficulty,
  type ExperienceLevel,
} from "@/lib/types";

const STEPS = ["About you", "Time & difficulty", "What you enjoy", "Location"] as const;

function Chip({
  selected,
  onClick,
  children,
  describe,
}: {
  selected: boolean;
  onClick: () => void;
  children: React.ReactNode;
  describe?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={cn(
        "focus-ring flex min-h-14 flex-col items-start justify-center rounded-2xl border px-4 py-3 text-left transition-all",
        selected
          ? "border-primary bg-secondary text-secondary-foreground shadow-soft"
          : "border-border bg-card hover:border-primary/40 hover:bg-surface",
      )}
    >
      <span className="flex items-center gap-2 text-base font-medium">
        {selected && <Check className="size-4 text-primary" />}
        {children}
      </span>
      {describe && <span className="mt-0.5 text-xs text-muted-foreground">{describe}</span>}
    </button>
  );
}

export function OnboardingWizard() {
  const router = useRouter();
  const [step, setStep] = React.useState(0);
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [locationBusy, setLocationBusy] = React.useState(false);
  const [locationNote, setLocationNote] = React.useState<string | null>(null);

  const [name, setName] = React.useState("");
  const [experience, setExperience] = React.useState<ExperienceLevel | null>(null);
  const [availableTime, setAvailableTime] = React.useState<number | null>(null);
  const [difficulty, setDifficulty] = React.useState<Difficulty | null>(null);
  const [activities, setActivities] = React.useState<Activity[]>([]);
  const [surpriseMe, setSurpriseMe] = React.useState(false);
  const [locationPermission, setLocationPermission] = React.useState(false);
  const [coords, setCoords] = React.useState<{ lat: number; lng: number } | null>(null);

  const canContinue = [
    name.trim().length > 1 && experience !== null,
    availableTime !== null && difficulty !== null,
    true,
    true,
  ][step];

  function toggleActivity(activity: Activity) {
    setActivities((current) =>
      current.includes(activity)
        ? current.filter((entry) => entry !== activity)
        : [...current, activity],
    );
  }

  async function requestLocation() {
    if (!("geolocation" in navigator)) {
      setLocationNote("This browser does not support location. Everything still works.");
      return;
    }
    setLocationBusy(true);
    setLocationNote(null);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setCoords({ lat: position.coords.latitude, lng: position.coords.longitude });
        setLocationPermission(true);
        setLocationNote(
          "Got it. Only a rounded, roughly 1 km approximation is stored — never your exact position.",
        );
        setLocationBusy(false);
      },
      () => {
        setLocationPermission(false);
        setLocationNote(
          "No problem — missions work fine without location, they are just written to work anywhere.",
        );
        setLocationBusy(false);
      },
      { enableHighAccuracy: false, timeout: 8_000, maximumAge: 600_000 },
    );
  }

  async function submit(skipLocation = false) {
    setSubmitting(true);
    setError(null);
    try {
      const payload = {
        name: name.trim(),
        experience,
        availableTime,
        difficulty,
        activities,
        surpriseMe,
        locationPermission: skipLocation ? false : locationPermission,
        // Coordinates are only ever sent together with an explicit opt-in.
        approximateLocation:
          skipLocation || !locationPermission ? undefined : (coords ?? undefined),
      };

      const response = await fetch("/api/onboarding", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const data = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? "Could not save your preferences");
      }

      // Cache preferences locally so the app is useful before the first fetch.
      cachePreferences({
        experience: experience ?? "casual",
        availableTime: availableTime ?? 30,
        activities,
        difficulty: difficulty ?? "easy",
        surpriseMe,
      });

      router.push("/dashboard");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Something went wrong");
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-8 sm:px-6 sm:py-12">
      <div className="mb-6 flex items-center gap-3">
        {STEPS.map((label, index) => (
          <div key={label} className="flex-1">
            <div
              className={cn(
                "h-1.5 rounded-full transition-colors",
                index <= step ? "bg-accent" : "bg-muted",
              )}
            />
            <p
              className={cn(
                "mt-2 hidden text-xs sm:block",
                index <= step ? "text-foreground" : "text-muted-foreground",
              )}
            >
              {label}
            </p>
          </div>
        ))}
      </div>

      <h1 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">
        {step === 0 && "Who is going outside?"}
        {step === 1 && "How much time do you have?"}
        {step === 2 && "What do you actually enjoy?"}
        {step === 3 && "Should missions know where you are?"}
      </h1>
      <p className="mt-3 text-sm text-muted-foreground">
        {step === 0 && "Just a first name and how much outdoor experience you have."}
        {step === 1 && "Missions are built to fit exactly inside this window."}
        {step === 2 && "Pick as many as you like, or let the AI surprise you."}
        {step === 3 && "Optional. It only personalizes nearby suggestions and weather."}
      </p>

      <div className="mt-7 space-y-6">
        {step === 0 && (
          <>
            <div className="space-y-2">
              <Label htmlFor="name">Your name</Label>
              <Input
                id="name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="e.g. Aarav"
                autoComplete="given-name"
                maxLength={60}
              />
              <p className="text-xs text-muted-foreground">
                Stored locally only. No email, no password, no account.
              </p>
            </div>
            <div className="space-y-2">
              <Label>Outdoor experience</Label>
              <div className="grid gap-2 sm:grid-cols-2">
                {EXPERIENCE_LEVELS.map((level) => (
                  <Chip
                    key={level}
                    selected={experience === level}
                    onClick={() => setExperience(level)}
                    describe={
                      level === "beginner"
                        ? "Rarely outside, start gentle"
                        : level === "casual"
                          ? "A walk now and then"
                          : level === "active"
                            ? "Outside most weeks"
                            : "Always looking for a trail"
                    }
                  >
                    {EXPERIENCE_LABELS[level]}
                  </Chip>
                ))}
              </div>
            </div>
          </>
        )}

        {step === 1 && (
          <>
            <div className="space-y-2">
              <Label>Available time</Label>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {TIME_OPTIONS.map((minutes) => (
                  <Chip
                    key={minutes}
                    selected={availableTime === minutes}
                    onClick={() => setAvailableTime(minutes)}
                  >
                    {TIME_LABELS[minutes]}
                  </Chip>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <Label>Difficulty</Label>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                {DIFFICULTIES.map((level) => (
                  <Chip
                    key={level}
                    selected={difficulty === level}
                    onClick={() => setDifficulty(level)}
                  >
                    {DIFFICULTY_LABELS[level]}
                  </Chip>
                ))}
              </div>
            </div>
          </>
        )}

        {step === 2 && (
          <>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {ACTIVITIES.map((activity) => (
                <Chip
                  key={activity}
                  selected={activities.includes(activity)}
                  onClick={() => toggleActivity(activity)}
                >
                  {ACTIVITY_LABELS[activity]}
                </Chip>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setSurpriseMe((value) => !value)}
              aria-pressed={surpriseMe}
              className={cn(
                "focus-ring flex w-full items-center gap-3 rounded-2xl border px-4 py-4 text-left transition-all",
                surpriseMe
                  ? "border-primary bg-secondary text-secondary-foreground"
                  : "border-border bg-card hover:border-primary/40",
              )}
            >
              <Wand2 className="size-5 text-primary" />
              <span>
                <span className="block font-medium">Surprise me</span>
                <span className="block text-xs text-muted-foreground">
                  Ignore the list and let the model pick something unexpected
                </span>
              </span>
            </button>
          </>
        )}

        {step === 3 && (
          <>
            <Callout variant="nature" title="Use your location to personalize outdoor missions?">
              <ul className="mt-1 space-y-1">
                <li>• Your exact position is never stored — only an area rounded to ~1 km.</li>
                <li>• It is never shown to anyone else and never published.</li>
                <li>• It is used to suggest nearby parks and to adapt to the weather.</li>
                <li>• You can turn it off again at any time, and the app still works.</li>
              </ul>
            </Callout>

            <div className="flex flex-wrap gap-3">
              <Button
                type="button"
                size="lg"
                variant={locationPermission ? "secondary" : "default"}
                onClick={requestLocation}
                disabled={locationBusy}
              >
                {locationBusy ? <Loader2 className="animate-spin" /> : <MapPin />}
                {locationPermission ? "Location enabled" : "Allow approximate location"}
              </Button>
              <Button
                type="button"
                size="lg"
                variant="outline"
                onClick={() => {
                  setLocationPermission(false);
                  setCoords(null);
                  setLocationNote("Location off. Missions will be written to work anywhere.");
                }}
              >
                Keep it off
              </Button>
            </div>

            {locationNote && <p className="text-sm text-muted-foreground">{locationNote}</p>}
          </>
        )}
      </div>

      {error && (
        <Callout variant="danger" title="Could not save" className="mt-6">
          {error}
        </Callout>
      )}

      <div className="mt-8 flex items-center justify-between gap-3">
        <Button
          type="button"
          variant="ghost"
          size="lg"
          onClick={() => (step === 0 ? router.push("/") : setStep(step - 1))}
          disabled={submitting}
        >
          <ArrowLeft /> {step === 0 ? "Home" : "Back"}
        </Button>

        {step < STEPS.length - 1 ? (
          <Button
            type="button"
            size="lg"
            onClick={() => setStep(step + 1)}
            disabled={!canContinue}
          >
            Continue <ArrowRight />
          </Button>
        ) : (
          <Button
            type="button"
            size="lg"
            onClick={() => submit(false)}
            disabled={submitting}
          >
            {submitting ? <Loader2 className="animate-spin" /> : <Sparkles />}
            {submitting ? "Setting up…" : "Get My First Mission"}
          </Button>
        )}
      </div>

      {step === 3 && (
        <button
          type="button"
          onClick={() => submit(true)}
          disabled={submitting}
          className="focus-ring mt-4 text-xs text-muted-foreground underline-offset-4 hover:underline"
        >
          Skip location and continue
        </button>
      )}
    </div>
  );
}
