import Link from "next/link";
import { Database, Eye, ImageOff, MapPin, ShieldCheck, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Callout } from "@/components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DeleteMyData } from "@/components/delete-my-data";
import { getStoreInfo } from "@/lib/db";
import { getActiveProviderStatus } from "@/lib/ai/provider";
import { getCurrentUser } from "@/lib/session";

export const dynamic = "force-dynamic";
export const metadata = { title: "Privacy" };

const PRINCIPLES = [
  {
    icon: MapPin,
    title: "Location is optional",
    body: "Missions are generated without location. If you enable it, only a position rounded to about 1 km is stored, and it is used for nearby green spaces and weather only.",
  },
  {
    icon: ImageOff,
    title: "Photos are private by default",
    body: "A discovery photo is downscaled and stripped of EXIF metadata (including camera GPS) on your device, then stored inside your own account. It is never published, indexed or shared.",
  },
  {
    icon: Eye,
    title: "No public exposure of exact locations",
    body: "There is no feed, no profile, no map of other users. Nothing you do here is visible to anyone else.",
  },
  {
    icon: Trash2,
    title: "You can delete anything",
    body: "Every discovery has a delete action, and one button removes your entire account with its missions, discoveries and points.",
  },
  {
    icon: Database,
    title: "Minimal stored data",
    body: "A display name, the preferences needed to write missions, and your activity. No email, no password, no advertising identifiers, no third-party analytics.",
  },
  {
    icon: ShieldCheck,
    title: "You are told where inference happens",
    body: "The header always shows whether the AI is local, remote or the offline generator — so you know whether a photo left your machine.",
  },
];

export default async function PrivacyPage() {
  const [user, provider, store] = await Promise.all([
    getCurrentUser(),
    getActiveProviderStatus(),
    getStoreInfo(),
  ]);

  const localInference = provider.execution === "local" && provider.available;

  return (
    <div className="mx-auto max-w-5xl space-y-8 px-4 py-8 sm:px-6 sm:py-12">
      <header className="space-y-3">
        <Badge variant="nature">
          <ShieldCheck className="size-3" /> Privacy
        </Badge>
        <h1 className="font-display text-4xl font-semibold tracking-tight sm:text-5xl">
          Your data, and what happens to it
        </h1>
        <p className="max-w-2xl text-muted-foreground">
          An app that asks you to go outside should not be quietly collecting everything it can.
          These are the rules this implementation actually follows.
        </p>
      </header>

      <Callout
        variant={localInference ? "success" : "warning"}
        icon={<ShieldCheck className="size-4" />}
        title={
          localInference
            ? "Right now: inference is local"
            : `Right now: inference is ${provider.execution === "remote" ? "remote" : "offline templates"}`
        }
      >
        <p className="text-sm">
          {localInference
            ? `Missions and photos are processed by ${provider.model} on this machine through Ollama. Nothing is sent to a third party.`
            : provider.execution === "remote"
              ? `This deployment is configured to use a remote model (${provider.model}). Prompts and photos are sent there. A local Ollama setup avoids that entirely.`
              : "No model is reachable, so reviewed offline templates are generating missions and no photo analysis is possible."}
        </p>
      </Callout>

      <section className="grid gap-4 sm:grid-cols-2">
        {PRINCIPLES.map((principle) => (
          <Card key={principle.title}>
            <CardHeader className="flex-row items-start gap-3 pb-2">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-secondary text-secondary-foreground">
                <principle.icon className="size-4" />
              </span>
              <CardTitle className="text-base">{principle.title}</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">{principle.body}</CardContent>
          </Card>
        ))}
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">What is stored, exactly</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <ul className="space-y-2">
              <li>
                <strong className="text-foreground">User:</strong> display name, preferences,
                whether location is allowed, and (if allowed) a rounded approximate area.
              </li>
              <li>
                <strong className="text-foreground">Missions:</strong> the generated mission text,
                which provider and model produced it, and when.
              </li>
              <li>
                <strong className="text-foreground">Completed missions:</strong> duration, points
                and timestamp.
              </li>
              <li>
                <strong className="text-foreground">Discoveries:</strong> your photo, the hedged
                identification, the confidence value and the model used.
              </li>
              <li>
                <strong className="text-foreground">Stats:</strong> points, streak, totals —
                recomputed from the records above.
              </li>
            </ul>
            <p className="pt-2 text-xs">
              Storage backend currently in use: {store.description}
              {store.note ? ` (${store.note})` : ""}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Delete everything</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm text-muted-foreground">
            <p>
              This removes your account, missions, completions, discoveries and stats from the
              database in one request, then clears your session. It cannot be undone, and there is
              no copy kept anywhere else.
            </p>
            {user ? (
              <DeleteMyData />
            ) : (
              <p className="text-xs">
                You do not have a session, so there is nothing stored against you right now.
              </p>
            )}
            <p className="text-xs">
              Individual discoveries can also be deleted from the{" "}
              <Link
                href="/discoveries"
                className="font-medium text-primary underline-offset-4 hover:underline"
              >
                discoveries page
              </Link>
              .
            </p>
          </CardContent>
        </Card>
      </section>

      <Callout variant="info" hideIcon>
        <p className="text-xs">
          Note on scope: this is a hackathon project, not a legal privacy notice. There are no
          third-party trackers in the app, no cookies beyond a single signed session cookie, and no
          data shared with any external service other than the map tiles and weather lookup
          described above.
        </p>
      </Callout>
    </div>
  );
}
