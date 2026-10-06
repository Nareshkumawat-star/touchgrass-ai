/**
 * /api/preferences
 *   GET  — the user's current preferences
 *   POST — update them
 *   DELETE — delete everything stored about this user
 *
 * The DELETE handler is the "right to be forgotten" implementation: it removes
 * the user record, every mission, completion, discovery and stat in one call,
 * then clears the session cookie.
 */

import { getStore } from "@/lib/db";
import { ok, parseBody, withUser, handleUnexpected } from "@/lib/api";
import { preferencesSchema } from "@/lib/schemas";
import { updatePreferences } from "@/lib/services/user";
import { clearSession, getCurrentUser } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return withUser(async (user) => ok({ preferences: user.preferences }));
}

export async function POST(request: Request) {
  return withUser(async (user) => {
    const parsed = await parseBody(request, preferencesSchema);
    if (parsed.response) return parsed.response;
    const updated = await updatePreferences(user, parsed.data);
    return ok({ user: updated });
  });
}

export async function DELETE() {
  try {
    const user = await getCurrentUser();
    if (!user) return ok({ deleted: false, reason: "No session" });

    const store = await getStore();
    await store.deleteUserData(user.id);
    await clearSession();
    return ok({ deleted: true });
  } catch (error) {
    return handleUnexpected(error);
  }
}
