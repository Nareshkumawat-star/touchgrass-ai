/**
 * /api/demo
 *   POST   — create the demo account and jump straight into a populated app
 *   DELETE — wipe all demo accounts and their data
 */

import { handleUnexpected, ok } from "@/lib/api";
import { rateLimit } from "@/lib/rate-limit";
import { resetDemoData, seedDemoUser } from "@/lib/services/demo";
import { setSession } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  const limit = rateLimit(`demo:${ip}`, { limit: 6, windowMs: 60_000 });
  if (!limit.allowed) {
    return ok({ error: "Too many demo sessions started — wait a moment." }, 429);
  }

  try {
    const { user, missions, discoveries } = await seedDemoUser();
    await setSession(user.id, true);
    return ok(
      {
        user,
        seeded: { missions: missions.length, discoveries: discoveries.length },
        isDemo: true,
      },
      201,
    );
  } catch (error) {
    return handleUnexpected(error);
  }
}

export async function DELETE() {
  try {
    const removed = await resetDemoData();
    return ok({ removed });
  } catch (error) {
    return handleUnexpected(error);
  }
}
