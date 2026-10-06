import { notFound, redirect } from "next/navigation";
import { CompleteMissionFlow } from "@/components/complete-mission-flow";
import { getStore } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";

export const dynamic = "force-dynamic";
export const metadata = { title: "Mission complete" };

export default async function CompleteMissionPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ duration?: string }>;
}) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const user = await getCurrentUser();
  if (!user) redirect("/onboarding");

  const store = await getStore();
  const mission = await store.getMission(id);
  if (!mission || mission.userId !== user.id) notFound();

  const parsed = Number(query.duration);
  const durationMinutes = Number.isFinite(parsed)
    ? Math.min(600, Math.max(1, Math.round(parsed)))
    : mission.duration;

  return <CompleteMissionFlow mission={mission} durationMinutes={durationMinutes} />;
}
