import Link from "next/link";
import { redirect } from "next/navigation";
import { Leaf, ShieldCheck } from "lucide-react";
import { Callout } from "@/components/ui/alert";
import { DiscoveryGallery } from "@/components/discovery-gallery";
import { listDiscoveries } from "@/lib/services/discoveries";
import { getCurrentUser } from "@/lib/session";

export const dynamic = "force-dynamic";
export const metadata = { title: "Discoveries" };

export default async function DiscoveriesPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/onboarding");

  const discoveries = await listDiscoveries(user.id, 60);

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-8 sm:px-6 sm:py-10">
      <header className="space-y-2">
        <h1 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">
          Your outdoor discoveries
        </h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Everything you photographed is stored privately in your own account, with the AI estimate
          that was made at the time — including the confidence level. Nothing here is a confirmed
          identification.
        </p>
      </header>

      <Callout variant="nature" icon={<ShieldCheck className="size-4" />} title="Private by default">
        <p>
          Photos stay in your account. Location data is stripped from every image on your device
          before it is analysed — including the GPS coordinates your camera writes into the file.{" "}
          <Link href="/privacy" className="font-medium text-primary underline-offset-4 hover:underline">
            Read the privacy principles →
          </Link>
        </p>
      </Callout>

      {discoveries.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card px-6 py-16 text-center">
          <span className="mx-auto flex size-14 items-center justify-center rounded-full bg-secondary text-secondary-foreground">
            <Leaf className="size-6" />
          </span>
          <p className="font-display mt-4 text-xl font-medium">Nothing discovered yet</p>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
            After an outdoor mission you can photograph a leaf, flower, bird or insect and an
            open-weight vision model will help you understand what you found.
          </p>
          <Link
            href="/dashboard"
            className="mt-5 inline-flex items-center gap-1 text-sm font-medium text-primary underline-offset-4 hover:underline"
          >
            Go to today&apos;s mission →
          </Link>
        </div>
      ) : (
        <DiscoveryGallery discoveries={discoveries} />
      )}
    </div>
  );
}
