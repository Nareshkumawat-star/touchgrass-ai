/**
 * POST /api/onboarding — create the anonymous user from the onboarding wizard.
 *
 * No password, no email: the only things stored are a display name, the
 * preferences needed to generate missions, and — only if the user opted in —
 * a rounded approximate location.
 */

import { handleUnexpected, ok, parseBody } from "@/lib/api";
import { onboardingSchema } from "@/lib/schemas";
import { createUserFromOnboarding } from "@/lib/services/user";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const parsed = await parseBody(request, onboardingSchema);
  if (parsed.response) return parsed.response;

  try {
    const user = await createUserFromOnboarding(parsed.data);
    return ok({ user }, 201);
  } catch (error) {
    return handleUnexpected(error);
  }
}
