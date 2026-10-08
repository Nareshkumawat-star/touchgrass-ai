/**
 * POST /api/ai/analyze — identify an outdoor discovery from a photo.
 *
 * Analyses but does not persist: the user sees the result first and decides
 * whether to keep it. Nothing is uploaded anywhere except to a local model, or
 * to the remote provider if the user's deployment has explicitly enabled it.
 */

import { fail, ok, parseBody, withUser } from "@/lib/api";
import { analyzeRequestSchema } from "@/lib/schemas";
import { rateLimit } from "@/lib/rate-limit";
import { analyzeDiscoveryImage } from "@/lib/ai/vision";
import { appConfig } from "@/lib/config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  return withUser(async (user) => {
    const limit = rateLimit(`analyze:${user.id}`, { limit: 15, windowMs: 60_000 });
    if (!limit.allowed) {
      return fail(`Too many photo analyses — retry in ${limit.retryAfterSeconds}s.`, 429);
    }

    const parsed = await parseBody(request, analyzeRequestSchema);
    if (parsed.response) return parsed.response;

    const estimatedBytes = parsed.data.imageUrl.length * 0.75;
    if (estimatedBytes > appConfig.maxUploadBytes) {
      return fail(
        "That photo is too large. Please retake it — the app downsizes photos before analysis.",
        413,
      );
    }

    const outcome = await analyzeDiscoveryImage({
      imageDataUrl: parsed.data.imageUrl,
      hint: parsed.data.hint,
    });

    return ok(outcome);
  });
}
