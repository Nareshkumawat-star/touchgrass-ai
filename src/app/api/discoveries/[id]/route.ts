/**
 * DELETE /api/discoveries/:id — remove one of the user's own discoveries.
 *
 * Scoped by `userId` in the query itself, so an id from another account can
 * never be deleted. This backs the privacy promise: users can delete what the
 * app stored about them.
 */

import { fail, ok, withUser } from "@/lib/api";
import { deleteDiscovery } from "@/lib/services/discoveries";
import { refreshStats } from "@/lib/services/stats";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return withUser(async (user) => {
    const { id } = await params;
    const deleted = await deleteDiscovery(user, id);
    if (!deleted) return fail("Discovery not found", 404);

    const stats = await refreshStats(user.id);
    return ok({ deleted: true, id, stats });
  });
}
