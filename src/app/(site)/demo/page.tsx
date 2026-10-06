import Link from "next/link";
import { Clock, Sparkles, TriangleAlert } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Callout } from "@/components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DemoButton } from "@/components/demo-button";

export const dynamic = "force-dynamic";
export const metadata = { title: "Two-minute demo" };

const FLOW = [
  "Open TouchGrass AI and press “Get My Mission”.",
  "The local open-weight model writes a personalized outdoor mission.",
  "Point out the header: 🟢 Local AI, and that it works with no vendor API.",
  "Press Start Mission — the screen drops to a timer and one step.",
  "Show “Put your phone away 🌳” and that mission mode works with no signal.",
  "Finish the mission and log it.",
  "Upload a leaf, bird or plant photo.",
  "The vision model returns a hedged identification with a confidence level.",
  "Save the discovery.",
  "Show points, streak and level on the rewards screen.",
  "Open “Why Open AI?” and show the provider table and licences.",
  "Switch the model in .env (OLLAMA_MODEL) and restart — nothing else changes.",
];

export default function DemoPage() {
  return (
    <div className="mx-auto max-w-4xl space-y-8 px-4 py-8 sm:px-6 sm:py-12">
      <header className="space-y-3">
        <Badge variant="sun">
          <Clock className="size-3" /> ~2 minutes
        </Badge>
        <h1 className="font-display text-4xl font-semibold tracking-tight sm:text-5xl">
          Judge the app in two minutes
        </h1>
        <p className="max-w-2xl text-muted-foreground">
          Demo mode seeds a labelled sample account — missions, completions, discoveries, a streak
          and points — so you can experience the whole loop without a long onboarding.
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Start demo mode</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Everything created is marked as demo data and can be removed again in one click from the
            dashboard.
          </p>
          <DemoButton size="lg" variant="default">
            Enter the populated demo
          </DemoButton>
          <div className="flex flex-wrap gap-3 text-sm">
            <Link
              href="/open"
              className="font-medium text-primary underline-offset-4 hover:underline"
            >
              Read why the AI is open-weight →
            </Link>
            <Link
              href="/api/health"
              className="font-medium text-primary underline-offset-4 hover:underline"
            >
              Check system status →
            </Link>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="size-4 text-accent" /> Suggested 2-minute flow
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ol className="space-y-2 text-sm text-muted-foreground">
            {FLOW.map((step, index) => (
              <li key={step} className="flex gap-3">
                <span className="font-mono text-xs text-muted-foreground">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <span>{step}</span>
              </li>
            ))}
          </ol>
        </CardContent>
      </Card>

      <Callout variant="warning" icon={<TriangleAlert className="size-4" />} title="Be honest in the demo">
        <ul className="space-y-1 text-sm">
          <li>
            • The demo photos are illustrative samples, and their identifications are labelled as
            samples. A real capture runs the live vision model.
          </li>
          <li>
            • If no vision model is installed, the app says so instead of inventing an
            identification.
          </li>
          <li>• Local generation on a laptop CPU can take 10–30 seconds; the UI shows progress.</li>
        </ul>
      </Callout>
    </div>
  );
}
