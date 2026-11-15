import { apiRoute, created, fail, readJson } from "@/lib/api";
import { logAuditEvent } from "@/lib/audit-logger";
import { rateLimit } from "@/lib/rate-limit";
import { hashIp, requestIp } from "@/lib/request-meta";
import { reviewSchema } from "@/lib/validations";

/**
 * Records a human verdict on one attempt.
 *
 * The write goes through `submit_attempt_review`, which enforces the reviewer
 * role, refuses self-review, refuses a second verdict for the same attempt, and
 * stamps the rubric score at review time for calibration. Attempts themselves
 * are never touched.
 */
export const POST = apiRoute(
  async ({ request, requestId, supabase, user, profile }) => {
    const rate = await rateLimit(`review-submit:${user.id}`, 60, 60 * 1000);
    if (!rate.success) {
      return fail(429, "rate_limited", "You are reviewing quickly. Pause and try again.");
    }

    const input = await readJson(request, reviewSchema);

    const { data, error } = await supabase.rpc("submit_attempt_review", {
      p_attempt: input.attemptId,
      p_verdict: input.verdict,
      p_note: input.note,
    });

    if (error) {
      // The function raises with a stable prefix; map it rather than leaking
      // database text to the client.
      if (error.message.includes("already reviewed")) {
        return fail(409, "already_reviewed", "That attempt already has a verdict.");
      }
      if (error.message.includes("cannot review your own")) {
        return fail(403, "self_review", "You cannot review your own attempt.");
      }
      if (error.message.includes("reviewer role required")) {
        return fail(403, "forbidden", "You do not have access to review.");
      }
      if (error.message.includes("not found")) {
        return fail(404, "not_found", "That attempt no longer exists.");
      }

      return fail(500, "review_failed", "We could not save that review.", { requestId });
    }

    await logAuditEvent(supabase, user.id, {
      action: "attempt_reviewed",
      resourceType: "attempt_reviews",
      details: { verdict: input.verdict, reviewId: data },
      ipHash: hashIp(requestIp(request.headers)),
      actorRole: profile.role,
    });

    return created({ status: "recorded", reviewId: data });
  },
  { roles: ["reviewer", "admin"], mutation: true }
);
