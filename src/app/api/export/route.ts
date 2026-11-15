import { apiRoute, fail, ok, okCsv } from "@/lib/api";
import { logAuditEvent } from "@/lib/audit-logger";
import { hashIp, requestIp } from "@/lib/request-meta";

/**
 * DPDP data export: everything Forge holds about the signed-in user, generated
 * on demand from their own session (RLS scoped), never from a query string id.
 */
export const GET = apiRoute(async ({ request, supabase, user, profile }) => {
  const format = new URL(request.url).searchParams.get("format") ?? "json";

  if (format !== "json" && format !== "csv") {
    return fail(400, "invalid_format", "Choose json or csv.");
  }

  const [profileResult, streakResult, attemptsResult, consentsResult, requestsResult, deletionResult] =
    await Promise.all([
      supabase
        .from("profiles")
        .select(
          "id, display_name, headline, bio, skills, role, company_name, visibility, allow_recruiter_contact, consent_at, consent_policy_version, created_at, updated_at"
        )
        .eq("id", user.id)
        .single(),
      supabase
        .from("streaks")
        .select("current_streak, longest_streak, total_practice_days, last_practice_date")
        .eq("user_id", user.id)
        .maybeSingle(),
      supabase
        .from("challenge_attempts")
        .select("id, challenge_id, score, time_spent_seconds, status, practice_date, created_at, challenges(title, category, difficulty)")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false }),
      supabase
        .from("user_consents")
        .select("purpose, policy_version, granted, granted_at, withdrawn_at")
        .eq("user_id", user.id),
      supabase
        .from("data_requests")
        .select("kind, details, status, created_at, resolved_at")
        .eq("user_id", user.id),
      supabase
        .from("account_deletions")
        .select("mode, status, requested_at, scheduled_for, completed_at")
        .eq("user_id", user.id),
    ]);

  if (profileResult.error) {
    return fail(500, "export_failed", "We could not assemble your export.");
  }

  const payload = {
    exported_at: new Date().toISOString(),
    notice:
      "This file is your personal data held by Forge. It does not include server logs beyond the audit trail shown here.",
    profile: profileResult.data,
    streaks: streakResult.data ?? null,
    attempts: attemptsResult.data ?? [],
    consents: consentsResult.data ?? [],
    data_requests: requestsResult.data ?? [],
    deletion_requests: deletionResult.data ?? [],
  };

  await logAuditEvent(supabase, user.id, {
    action: "data_exported",
    resourceType: "profiles",
    details: { format },
    ipHash: hashIp(requestIp(request.headers)),
    actorRole: profile.role,
  });

  if (format === "json") {
    return ok(payload);
  }

  const rows: string[] = [];
  const esc = (value: unknown) => `"${String(value ?? "").replace(/"/g, '""')}"`;
  rows.push("date,challenge,category,difficulty,score,minutes,status");
  for (const attempt of attemptsResult.data ?? []) {
    const challenge = Array.isArray(attempt.challenges) ? attempt.challenges[0] : attempt.challenges;
    rows.push(
      [
        esc(attempt.practice_date),
        esc(challenge?.title ?? ""),
        esc(challenge?.category ?? ""),
        esc(challenge?.difficulty ?? ""),
        esc(attempt.score),
        esc(Math.round((attempt.time_spent_seconds ?? 0) / 60)),
        esc(attempt.status),
      ].join(",")
    );
  }

  return okCsv(`${rows.join("\n")}\n`, "forge-practice-record.csv");
});
