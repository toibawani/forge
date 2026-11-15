import { apiRoute, created, fail, ok, readJson } from "@/lib/api";
import { challengeAttemptSchema } from "@/lib/validations";
import { scoreSubmission, type Rubric } from "@/lib/scoring";
import { hashIp, requestIp } from "@/lib/request-meta";
import { rateLimit } from "@/lib/rate-limit";
import { logAuditEvent } from "@/lib/audit-logger";
import { logger } from "@/lib/logger";

/** Public challenge catalogue. No personal data, so it is safely cacheable. */
export const GET = apiRoute(
  async ({ request, supabase }) => {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get("category");
    const difficulty = searchParams.get("difficulty");

    let query = supabase
      .from("challenges")
      .select("id, slug, title, description, difficulty, category, estimated_minutes, time_limit_seconds")
      .eq("is_active", true)
      .order("difficulty");

    if (category) query = query.eq("category", category);
    if (difficulty) query = query.eq("difficulty", difficulty);

    const { data, error } = await query;

    if (error) {
      logger.error("Challenge list failed", { code: error.code });
      return fail(500, "challenge_list_failed", "We could not load challenges.");
    }

    return ok({ challenges: data ?? [] });
  },
  { auth: "public" }
);

/**
 * Records a practice attempt.
 *
 * The score is computed server-side from the challenge rubric — the client
 * cannot submit its own score — and the attempt is immutable once written.
 * Idempotency keys make retries safe on flaky networks.
 */
export const POST = apiRoute(async ({ request, supabase, user, requestId, profile }) => {
  const ipHash = hashIp(requestIp(request.headers));
  const rate = rateLimit(`attempt:${user.id}`, 30, 60 * 60 * 1000);
  if (!rate.success) {
    return fail(429, "rate_limited", "You have logged a lot of practice today. Come back later.");
  }

  const input = await readJson(request, challengeAttemptSchema);

  const { data: challenge, error: challengeError } = await supabase
    .from("challenges")
    .select("id, category, rubric, title, is_active")
    .eq("id", input.challengeId)
    .eq("is_active", true)
    .maybeSingle();

  if (challengeError || !challenge) {
    return fail(404, "challenge_not_found", "That challenge is not available.");
  }

  const breakdown = scoreSubmission(
    input.answer,
    (challenge.rubric as Rubric | null) ?? null,
    challenge.category
  );

  const { data: attempt, error: insertError } = await supabase
    .from("challenge_attempts")
    .insert({
      user_id: user.id,
      challenge_id: challenge.id,
      submission: {
        answer: input.answer,
        scoring: breakdown,
      },
      score: breakdown.score,
      time_spent_seconds: input.timeSpent,
      status: "completed",
      idempotency_key: input.idempotencyKey ?? null,
      ip_hash: ipHash,
    })
    .select("id, score, practice_date, created_at")
    .single();

  if (insertError) {
    // Unique idempotency key: return the existing attempt instead of failing.
    if (insertError.code === "23505" && input.idempotencyKey) {
      const { data: existing } = await supabase
        .from("challenge_attempts")
        .select("id, score, practice_date, created_at")
        .eq("idempotency_key", input.idempotencyKey)
        .eq("user_id", user.id)
        .maybeSingle();

      if (existing) {
        return ok({ attempt: existing, scoring: breakdown, idempotent: true });
      }
    }

    logger.error("Attempt insert failed", { code: insertError.code }, user.id, requestId);
    return fail(500, "attempt_failed", "We could not save that attempt. Try again.");
  }

  await logAuditEvent(supabase, user.id, {
    action: "practice_recorded",
    resourceType: "challenge_attempts",
    resourceId: attempt.id,
    details: { challengeId: challenge.id, score: breakdown.score },
    ipHash,
    actorRole: profile.role,
  });

  return created({ attempt, scoring: breakdown });
});
