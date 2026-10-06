import Link from "next/link";
import {
  ArrowDown,
  Braces,
  CheckCircle2,
  Cpu,
  Info,
  ShieldCheck,
  Sparkles,
  WifiOff,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Callout } from "@/components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getActiveProviderStatus, getProviderStatuses } from "@/lib/ai/provider";
import { getStoreInfo } from "@/lib/db";

export const dynamic = "force-dynamic";
export const metadata = { title: "Why Open AI?" };

const REASONS = [
  {
    title: "You can run the AI locally",
    body: "The default provider talks to Ollama on your own machine. No account, no API key, no quota.",
  },
  {
    title: "Your outdoor photos do not have to be sent anywhere",
    body: "Discovery photos are analysed by a local vision model by default. A remote provider only exists as an explicitly configured, opt-in alternative.",
  },
  {
    title: "Developers can swap the model",
    body: "Everything above the AI layer speaks one interface. Dropping in a different open-weight model is a one-line environment change.",
  },
  {
    title: "You can fine-tune the behaviour",
    body: "Prompts, the mission JSON contract and the safety review all live in this repository, so a fork can retune missions for a different region or age group.",
  },
  {
    title: "The app survives vendor changes",
    body: "Pricing changes, deprecations and rate limits on a commercial API cannot break a deployment that runs its own weights.",
  },
  {
    title: "The community can inspect and improve the AI layer",
    body: "Open weights mean anyone can read the prompts, test the safety filters and send a better mission template upstream.",
  },
];

const ARCHITECTURE_CODE = `interface AIProvider {
  generateMission(input: MissionGenerationInput): Promise<MissionGenerationResult>
  analyzeDiscovery(input: DiscoveryAnalysisInput): Promise<DiscoveryAnalysisResult>
  status(): Promise<ProviderStatus>
}

AIProvider
├── LocalQwenProvider       // default — Ollama, open weights, on your machine
├── HuggingFaceProvider     // opt-in remote open-weight models
└── OfflineTemplateProvider // no model at all, reviewed templates`;

export default async function OpenAiPage() {
  const [provider, providers, store] = await Promise.all([
    getActiveProviderStatus(),
    getProviderStatuses(),
    getStoreInfo(),
  ]);

  return (
    <div className="mx-auto max-w-5xl space-y-8 px-4 py-8 sm:px-6 sm:py-12">
      <header className="space-y-3">
        <Badge variant="nature">
          <Sparkles className="size-3" /> Architecture
        </Badge>
        <h1 className="font-display text-4xl font-semibold tracking-tight sm:text-5xl">
          Why Open AI?
        </h1>
        <p className="max-w-2xl text-muted-foreground">
          TouchGrass AI is built on open-weight models rather than a single closed vendor API. The
          point is not ideology — it is that an app which sends you outside should not require you
          to hand your location and photographs to a company to work.
        </p>
      </header>

      <section className="grid gap-4 sm:grid-cols-2">
        {REASONS.map((reason, index) => (
          <Card key={reason.title}>
            <CardHeader className="flex-row items-start gap-3 pb-2">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-secondary text-sm font-semibold text-secondary-foreground">
                {index + 1}
              </span>
              <CardTitle className="text-base">{reason.title}</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">{reason.body}</CardContent>
          </Card>
        ))}
      </section>

      {/* Architecture */}
      <section className="space-y-4">
        <h2 className="font-display text-2xl font-semibold tracking-tight">How it fits together</h2>

        <div className="rounded-2xl border border-border bg-card p-6">
          <ol className="flex flex-col items-center gap-2 text-center">
            {[
              { label: "User", hint: "your preferences, time and (optionally) area" },
              { label: "TouchGrass AI", hint: "prompts, safety review, JSON validation" },
              { label: "Open-weight model", hint: "on your machine, or a host you chose" },
              { label: "Mission / Vision analysis", hint: "structured, validated output" },
            ].map((node, index) => (
              <li key={node.label} className="flex w-full flex-col items-center gap-2">
                <div className="w-full max-w-md rounded-xl border border-border bg-surface px-4 py-3">
                  <p className="font-medium">{node.label}</p>
                  <p className="text-xs text-muted-foreground">{node.hint}</p>
                </div>
                {index < 3 && <ArrowDown className="size-4 text-muted-foreground" />}
              </li>
            ))}
          </ol>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <Braces className="size-4 text-accent" /> The swap point
              </CardTitle>
            </CardHeader>
            <CardContent>
              <pre className="overflow-x-auto rounded-xl bg-surface p-4 text-xs leading-relaxed">
                <code>{ARCHITECTURE_CODE}</code>
              </pre>
              <p className="mt-3 text-sm text-muted-foreground">
                No route, service or component imports a vendor SDK. Adding a provider means writing
                one class that satisfies <code className="font-mono text-xs">AIProvider</code> and
                naming it in <code className="font-mono text-xs">AI_PROVIDER_ORDER</code>.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <Cpu className="size-4 text-accent" /> Running right now
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <p className="flex flex-wrap items-center gap-2">
                <span
                  className={`size-2 rounded-full ${
                    provider.available
                      ? provider.execution === "local"
                        ? "bg-accent"
                        : "bg-sun"
                      : "bg-muted-foreground"
                  }`}
                  aria-hidden
                />
                <span className="font-medium">{provider.label}</span>
                <Badge variant="outline" className="font-mono text-[11px]">
                  {provider.model}
                </Badge>
              </p>
              {provider.license && (
                <p className="text-xs text-muted-foreground">
                  Licence: <span className="text-foreground">{provider.license.license}</span>
                  {provider.license.commerciallyUsable
                    ? " (commercial use permitted)"
                    : " — check before commercial use"}
                  {" · "}
                  <a
                    href={provider.license.url}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="underline-offset-4 hover:underline"
                  >
                    model card
                  </a>
                </p>
              )}
              {provider.visionLicense && (
                <p className="text-xs text-muted-foreground">
                  Vision: <span className="text-foreground">{provider.visionLicense.name}</span> —{" "}
                  {provider.visionLicense.license}
                </p>
              )}
              <p className="text-xs text-muted-foreground">
                Storage: {store.description}
                {store.note ? ` — ${store.note}` : ""}
              </p>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Provider table */}
      <section className="space-y-3">
        <h2 className="font-display text-2xl font-semibold tracking-tight">Configured providers</h2>
        <div className="overflow-x-auto rounded-2xl border border-border">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="bg-surface text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">Provider</th>
                <th className="px-4 py-3 font-medium">Model</th>
                <th className="px-4 py-3 font-medium">Where it runs</th>
                <th className="px-4 py-3 font-medium">Licence</th>
                <th className="px-4 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {providers.map((entry) => (
                <tr key={entry.id}>
                  <td className="px-4 py-3 font-medium">{entry.label}</td>
                  <td className="px-4 py-3 font-mono text-xs">{entry.model}</td>
                  <td className="px-4 py-3 text-xs">
                    {entry.execution === "local" ? "Your machine" : "Remote host"}
                  </td>
                  <td className="px-4 py-3 text-xs">{entry.license?.license ?? "unknown"}</td>
                  <td className="px-4 py-3 text-xs">
                    {entry.available ? (
                      <span className="inline-flex items-center gap-1.5 text-primary">
                        <CheckCircle2 className="size-3.5" /> available
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                        <WifiOff className="size-3.5" /> unavailable
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-muted-foreground">
          Licence details come from the model registry in{" "}
          <code className="font-mono">src/lib/ai/models.ts</code>. Models that are not listed there
          are reported as unknown instead of being claimed as permissive.
        </p>
      </section>

      <Callout variant="nature" icon={<ShieldCheck className="size-4" />} title="What stays honest">
        <ul className="space-y-1 text-sm">
          <li>
            • If no model is reachable, the app says so and falls back to reviewed offline
            templates rather than pretending an AI answered.
          </li>
          <li>
            • Discovery identifications are always hedged and capped below certainty, with an
            explicit confidence level.
          </li>
          <li>• Weather and nearby places are shown only when they were actually retrieved.</li>
        </ul>
      </Callout>

      <Callout variant="info" icon={<Info className="size-4" />} title="Adaptable, not locked in">
        <p className="text-sm">
          Open weights make the project adaptable rather than locked to a single AI vendor. If a
          model disappears, changes licence or becomes too slow, the whole AI layer can be replaced
          behind one interface — without touching the missions, the rewards or the database.
        </p>
      </Callout>

      <p className="pb-4 text-sm text-muted-foreground">
        See how your own data is handled on the{" "}
        <Link href="/privacy" className="font-medium text-primary underline-offset-4 hover:underline">
          privacy page
        </Link>
        .
      </p>
    </div>
  );
}
