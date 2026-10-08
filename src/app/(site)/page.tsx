import Link from "next/link";
import {
  ArrowRight,
  Camera,
  Cpu,
  Leaf,
  MapPin,
  RadioTower,
  ShieldCheck,
  Timer,
  TreePine,
  WifiOff,
} from "lucide-react";
import { getActiveProviderStatus } from "@/lib/ai/provider";
import { FlowDiagram } from "@/components/flow-diagram";
import { MissionPreview } from "@/components/mission-preview";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Callout } from "@/components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const dynamic = "force-dynamic";

const HOW_IT_WORKS = [
  {
    icon: Leaf,
    title: "Tell us how much time you have",
    body: "Two taps: your experience level, how long you have, and what you enjoy. That is the whole setup. No account, no email.",
  },
  {
    icon: Timer,
    title: "Get one mission, then leave",
    body: "An open-weight model writes a single mission that fits your time and your street. Then the screen goes quiet on purpose.",
  },
  {
    icon: Camera,
    title: "Discover something",
    body: "Photograph a leaf, bird, flower or insect afterwards and an open-weight vision model tells you what it might be — with an honest confidence level.",
  },
  {
    icon: TreePine,
    title: "Points for time outside",
    body: "Points track minutes outdoors and streaks, never screen time. The best outcome is you closing the app.",
  },
];

export default async function LandingPage() {
  const provider = await getActiveProviderStatus();
  const localModel = provider.execution === "local" && provider.available;

  return (
    <div className="topo">
      {/* Hero */}
      <section className="mx-auto max-w-6xl px-4 pt-14 pb-10 sm:px-6 sm:pt-20">
        <div className="grid items-start gap-10 lg:grid-cols-[1.15fr_0.85fr]">
          <div className="animate-rise">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="nature">
                <span className="size-2 rounded-full bg-accent" aria-hidden /> Open weights
              </Badge>
              <Badge variant="outline">Runs on your machine</Badge>
              <Badge variant="outline">Works offline</Badge>
            </div>

            <h1 className="font-display mt-6 text-5xl leading-[0.95] font-semibold tracking-tight sm:text-6xl lg:text-7xl">
              TouchGrass AI
            </h1>
            <p className="mt-5 max-w-xl text-xl text-muted-foreground sm:text-2xl">
              AI that gives you a reason to put your phone down.
            </p>
            <p className="mt-5 max-w-xl text-base text-muted-foreground">
              This is not another chatbot. It writes you one short outdoor mission, then asks
              you to leave the screen behind and go do it. Everything it learns works better the
              less you use it.
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Button asChild size="lg">
                <Link href="/onboarding">
                  Get My First Mission <ArrowRight />
                </Link>
              </Button>
              <Button asChild variant="outline" size="lg">
                <Link href="#how-it-works">How It Works</Link>
              </Button>
            </div>

            <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-2">
                <span
                  className={`size-2 rounded-full ${localModel ? "bg-accent" : "bg-sun"}`}
                  aria-hidden
                />
                {localModel
                  ? `Local AI ready — ${provider.model} via Ollama`
                  : `Active provider: ${provider.label}`}
              </span>
              <span className="inline-flex items-center gap-2">
                <ShieldCheck className="size-3.5" /> No account, no email, no tracking
              </span>
              <span className="inline-flex items-center gap-2">
                <MapPin className="size-3.5" /> Location is always optional
              </span>
            </div>
          </div>

          <MissionPreview className="animate-fade-up" />
        </div>
      </section>

      {/* Philosophy */}
      <section className="border-y border-border bg-surface/70">
        <div className="mx-auto max-w-4xl px-4 py-10 text-center sm:px-6">
          <p className="font-display text-2xl leading-snug font-medium sm:text-3xl">
            “The app should help you leave the app.”
          </p>
          <p className="mt-3 text-sm text-muted-foreground">
            Every mission ends with one instruction: put the phone away. There is no feed, no
            streak pressure, and nothing to scroll.
          </p>
        </div>
      </section>

      {/* Flow */}
      <section id="how-it-works" className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <h2 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">
          How it works
        </h2>
        <p className="mt-3 max-w-2xl text-muted-foreground">
          Five steps, and four of them happen away from a screen.
        </p>
        <FlowDiagram className="mt-8" />

        <div className="mt-10 grid gap-4 sm:grid-cols-2">
          {HOW_IT_WORKS.map((step, index) => (
            <Card key={step.title}>
              <CardHeader className="flex-row items-start gap-4">
                <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-secondary text-secondary-foreground">
                  <step.icon className="size-5" />
                </span>
                <div>
                  <p className="text-xs font-semibold text-muted-foreground">
                    STEP {index + 1}
                  </p>
                  <CardTitle className="mt-1">{step.title}</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">{step.body}</CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* Vision + offline */}
      <section className="mx-auto max-w-6xl px-4 pb-16 sm:px-6">
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Camera className="size-5 text-accent" /> Discovery mode
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm text-muted-foreground">
              <p>
                After a mission you can photograph whatever you found. An open-weight
                vision-language model suggests an identification with the visual features behind
                it.
              </p>
              <div className="rounded-2xl border border-border bg-background p-4">
                <p className="font-medium text-foreground">Possible neem leaf</p>
                <div className="mt-2 flex items-center gap-3">
                  <div className="h-1.5 w-full max-w-40 overflow-hidden rounded-full bg-muted">
                    <div className="h-full w-[82%] rounded-full bg-accent" />
                  </div>
                  <span className="text-xs">Confidence: 82%</span>
                </div>
                <p className="mt-3 text-xs">
                  Neem leaves are commonly found across South Asia and are known for their
                  distinctive serrated edges.
                </p>
              </div>
              <p className="text-xs">
                An estimate, never a certainty. No medical, safety or edibility claims — ever.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <WifiOff className="size-5 text-accent" /> Built for bad signal
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm text-muted-foreground">
              <p>
                Parks have terrible signal. Your current mission, its steps and your recent
                history are cached on the device, and a completed mission is queued locally and
                synced when you are back.
              </p>
              <ul className="space-y-2">
                <li className="flex items-start gap-2">
                  <RadioTower className="mt-0.5 size-4 shrink-0 text-accent" />
                  Mission instructions stored on the device
                </li>
                <li className="flex items-start gap-2">
                  <Cpu className="mt-0.5 size-4 shrink-0 text-accent" />
                  With Ollama running, mission generation itself never leaves your machine
                </li>
                <li className="flex items-start gap-2">
                  <Leaf className="mt-0.5 size-4 shrink-0 text-accent" />
                  No model at all? A reviewed offline generator still gives you a mission
                </li>
              </ul>
            </CardContent>
          </Card>
        </div>

        <Callout
          variant="nature"
          title="Why open AI?"
          className="mt-6"
        >
          <p>
            TouchGrass AI is built on open-weight models instead of a closed API, so you can run
            it locally, your outdoor photos do not have to be sent to a vendor, and the model can
            be swapped or fine-tuned by anyone.{" "}
            <Link href="/open" className="font-medium text-primary underline-offset-4 hover:underline">
              Read the full explanation →
            </Link>
          </p>
        </Callout>
      </section>

      {/* Final CTA */}
      <section className="mx-auto max-w-4xl px-4 pb-8 text-center sm:px-6">
        <h2 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">
          Your next adventure is outside.
        </h2>
        <p className="mx-auto mt-3 max-w-xl text-muted-foreground">
          Thirty seconds to set up, one mission to complete, and then you are done here.
        </p>
        <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
          <Button asChild size="lg">
            <Link href="/onboarding">
              Get My First Mission <ArrowRight />
            </Link>
          </Button>
        </div>
      </section>
    </div>
  );
}
