import { apiRoute, created, fail, rateLimited, readJson } from "@/lib/api";
import { rateLimit } from "@/lib/rate-limit";
import { startPracticeSessionSchema } from "@/lib/validations";
import { isValidTimeZone } from "@/lib/timezone";

/**
 * Opens a practice session before the prompt is shown.
 *
 * The session timestamp is the only trustworthy clock in the product: the
 * attempt endpoint derives `time_spent_seconds` from it, so a client cannot
 * claim a duration. Sessions expire after two hours.
 */
export const POST = apiRoute(async ({ request, supabase, user, profile }) => {
  const rate = await rateLimit(`session:${user.id}`, 40, 60 * 60 * 1000);
  if (!rate.success) {
    return rateLimited("You have opened a lot of sessions today. Try again shortly.", rate.resetTime);
  }

  if (!profile.consent_at) {
    return fail(
      403,
      "consent_required",
      "Record consent to store your practice record in Settings before practising."
    );
  }

  const input = await readJson(request, startPracticeSessionSchema);

  // The zone is unverified client input, so it is resolved against Intl before
  // it is stored. An unresolvable zone is ignored rather than rejected: the
  // session still opens on the profile's existing zone.
  if (input.timeZone && isValidTimeZone(input.timeZone) && input.timeZone !== profile.timezone) {
    await supabase.from("profiles").update({ timezone: input.timeZone }).eq("id", user.id);
  }

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
