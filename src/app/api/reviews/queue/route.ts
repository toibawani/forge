import { apiRoute, fail, ok } from "@/lib/api";
import { rateLimit } from "@/lib/rate-limit";

/**
 * Unreviewed attempts, oldest first.
 *
 * Served through the `review_queue` function rather than the attempts table:
 * reviewers get the answer and the rubric score, never the author. Blind review
 * is a fairness property, not a nicety.
 */
export const GET = apiRoute(
  async ({ request, user, supabase }) => {
    const rate = await rateLimit(`review-queue:${user.id}`, 60, 60 * 1000);
    if (!rate.success) {
      return fail(429, "rate_limited", "Slow down for a moment.");
    }

    const limitParam = new URL(request.url).searchParams.get("limit");
    const requested = Number(limitParam ?? 10);
    const limit = Number.isFinite(requested) ? Math.min(Math.max(requested, 1), 25) : 10;

    const { data, error } = await supabase.rpc("review_queue", { p_limit: limit });

    if (error) {
      return fail(500, "queue_unavailable", "The review queue is unavailable right now.");
    }

    return ok({ items: data ?? [], limit });
  },
  { roles: ["reviewer", "admin"] }
);
