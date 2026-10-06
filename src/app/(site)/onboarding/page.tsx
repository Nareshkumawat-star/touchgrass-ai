import { redirect } from "next/navigation";
import { OnboardingWizard } from "@/components/onboarding-wizard";
import { getCurrentUser } from "@/lib/session";

export const dynamic = "force-dynamic";

export const metadata = { title: "Set up your missions" };

export default async function OnboardingPage() {
  const user = await getCurrentUser();
  if (user) redirect("/dashboard");

  return <OnboardingWizard />;
}
