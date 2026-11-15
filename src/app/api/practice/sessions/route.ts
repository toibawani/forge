import { apiRoute, created, fail, readJson } from "@/lib/api";
import { rateLimit } from "@/lib/rate-limit";
import { startPracticeSessionSchema } from "@/lib/validations";

/**
 * Opens a practice session before the prompt is shown.
 *
 * The session timestamp is the only trustworthy clock in the product: the
 * attempt endpoint derives `time_spent_seconds` from it, so a client cannot
 * claim a duration. Sessions expire after two hours.
 */
export const POST = apiRoute(async ({ request, supabase, user, profile }) => {
  const rate = rateLimit(`session:${user.id}`, 40, 60 * 60 * 1000);
  if (!rate.success) {
    return fail(429, "rate_limited", "You have opened a lot of sessions today. Try again shortly.");
  }

  if (!profile.consent_at) {
    return fail(
      403,
      "consent_required",
      "Record consent to store your practice record in Settings before practising."
    );
  }

  const input = await readJson(request, startPracticeSessionSchema);

  const { data: challenge } = await supabase
    .from("challenges")
    .select("id")
    .eq("id", input.challengeId)
    .eq("is_active", true)
    .maybeSingle();

  if (!challenge) {
    return fail(404, "challenge_not_found", "That challenge is not available.");
  }

  // Abandoned tabs should not pile up indefinitely.
  const { count: openSessions } = await supabase
    .from("practice_sessions")
    .select("*", { count: "exact", head: true })
    .eq("user_id", user.id)
    .is("submitted_attempt_id", null)
    .gt("expires_at", new Date().toISOString());

  if ((openSessions ?? 0) >= 5) {
    return fail(
      429,
      "too_many_open_sessions",
      "Five sessions are already open. Finish or let one expire before starting another."
    );
  }

  const { data: session, error } = await supabase
    .from("practice_sessions")
    .insert({ user_id: user.id, challenge_id: challenge.id })
    .select("id, started_at, expires_at")
    .single();

  if (error) {
    return fail(500, "session_failed", "We could not start that session. Try again.");
  }

  return created({ session });
});
