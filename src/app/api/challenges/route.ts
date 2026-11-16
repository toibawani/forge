import { apiRoute, created, fail, ok, rateLimited, readJson } from "@/lib/api";
import { challengeAttemptSchema } from "@/lib/validations";
import { scoreSubmission, type Rubric } from "@/lib/scoring";
import { buildFeedback } from "@/lib/feedback";
import { assessAttempt } from "@/lib/integrity";
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

const MAX_SESSION_SECONDS = 7200;

/**
 * Records a practice attempt.
 *
 * Three things the client cannot influence:
 *   * the score — computed here from the challenge rubric;
 *   * the duration — derived from the server-written session, not the body;
 *   * the record — attempts are immutable after insert.
 *
 * Idempotency keys make a network retry safe: the same key returns the
 * attempt that already exists instead of writing a second one.
 */
export const POST = apiRoute(async ({ request, supabase, user, requestId, profile }) => {
  const ipHash = hashIp(requestIp(request.headers));
  const rate = await rateLimit(`attempt:${user.id}`, 30, 60 * 60 * 1000);
  if (!rate.success) {
    return rateLimited("You have logged a lot of practice today. Come back later.", rate.resetTime);
  }

  if (!profile.consent_at) {
    return fail(
      403,
      "consent_required",
      "Record consent to store your practice record in Settings before practising."
    );
  }

  const input = await readJson(request, challengeAttemptSchema);

  const { data: session } = await supabase
    .from("practice_sessions")
    .select("id, challenge_id, started_at, expires_at, submitted_attempt_id")
    .eq("id", input.sessionId)
    .maybeSingle();

  // RLS already scopes this to the caller: a guessed id resolves to nothing.
  if (!session) {
    return fail(404, "session_not_found", "Start a practice session for this challenge first.");
  }

  if (session.challenge_id !== input.challengeId) {
    return fail(400, "session_mismatch", "That session belongs to a different challenge.");
  }

  if (session.submitted_attempt_id) {
    return fail(409, "already_submitted", "This session was already submitted.");
  }

  const startedAt = new Date(session.started_at).getTime();
  const expiresAt = new Date(session.expires_at).getTime();
  const now = Date.now();

  if (now > expiresAt) {
    return fail(410, "session_expired", "That session expired. Start the challenge again.");
  }

  const elapsedSeconds = Math.min(
    MAX_SESSION_SECONDS,
    Math.max(1, Math.round((now - startedAt) / 1000))
  );

  const { data: challenge, error: challengeError } = await supabase
    .from("challenges")
    .select("id, category, rubric, is_active")
    .eq("id", input.challengeId)
    .eq("is_active", true)
    .maybeSingle();

  if (challengeError || !challenge) {
    return fail(404, "challenge_not_found", "That challenge is not available.");
  }

  const rubric = (challenge.rubric as Rubric | null) ?? null;
  const breakdown = scoreSubmission(input.answer, rubric, challenge.category);

  // Feedback is written with the attempt, so an exported record explains itself
  // later without depending on the rubric implementation of the day.
  const feedback = buildFeedback({
    answer: input.answer,
    signals: breakdown.signals,
    minWords: rubric?.min_words ?? 25,
    category: challenge.category,
  });

  // Signals, not a verdict: flags are recorded with the attempt and can be
  // reviewed later. Nothing here rejects the submission.
  const integrity = assessAttempt({ answer: input.answer, seconds: elapsedSeconds });

  const { data: attempt, error: insertError } = await supabase
    .from("challenge_attempts")
    .insert({
      user_id: user.id,
      challenge_id: challenge.id,
      submission: {
        answer: input.answer,
        scoring: breakdown,
        feedback,
        integrity,
      },
      score: breakdown.score,
      time_spent_seconds: elapsedSeconds,
      status: "completed",
      idempotency_key: input.idempotencyKey ?? null,
      ip_hash: ipHash,
    })
    .select("id, score, practice_date, created_at, time_spent_seconds")
    .single();

  if (insertError) {
    // Unique idempotency key: return the existing attempt instead of failing.
    if (insertError.code === "23505" && input.idempotencyKey) {
      const { data: existing } = await supabase
        .from("challenge_attempts")
        .select("id, score, practice_date, created_at, time_spent_seconds")
        .eq("idempotency_key", input.idempotencyKey)
        .eq("user_id", user.id)
        .maybeSingle();

      if (existing) {
        return ok({ attempt: existing, scoring: breakdown, feedback, idempotent: true });
      }
    }

    // A closed session loses the race: report it as already submitted.
    if (insertError.code === "23505") {
      return fail(409, "already_submitted", "This session was already submitted.");
    }

    logger.error("Attempt insert failed", { code: insertError.code }, user.id, requestId);
    return fail(500, "attempt_failed", "We could not save that attempt. Try again.");
  }

  // The streak trigger has just run; read it back so the result page can show
  // the new state without a second round trip.
  const { data: streak } = await supabase
    .from("streaks")
    .select("current_streak, longest_streak, total_practice_days, last_practice_date")
    .eq("user_id", user.id)
    .maybeSingle();

  await logAuditEvent(supabase, user.id, {
    action: "practice_recorded",
    resourceType: "challenge_attempts",
    resourceId: attempt.id,
    details: {
      challengeId: challenge.id,
      score: breakdown.score,
      integrityFlags: integrity.flags,
    },
    ipHash,
    actorRole: profile.role,
  });

  return created({ attempt, scoring: breakdown, feedback, streak: streak ?? null });
});
