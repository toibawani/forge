import { apiRoute, fail, ok } from "@/lib/api";
import { recruiterSearchSchema } from "@/lib/validations";
import { logAuditEvent } from "@/lib/audit-logger";
import { hashIp, requestIp } from "@/lib/request-meta";
import { rateLimit } from "@/lib/rate-limit";

/**
 * Recruiter discovery, served from the `profile_cards` view.
 *
 * The view only exposes opted-in practitioners and never includes email or any
 * other contact detail. Raw `profiles` rows stay behind RLS, so search cannot
 * become a data-dump endpoint. Every search is audited.
 */
export const GET = apiRoute(
  async ({ request, supabase, user, requestId, profile }) => {
    const ipHash = hashIp(requestIp(request.headers));
    const rate = rateLimit(`recruiter-search:${user.id}`, 30, 60 * 1000);
    if (!rate.success) {
      return fail(429, "rate_limited", "Too many searches. Wait a minute.");
    }

    const { searchParams } = new URL(request.url);
    const parseList = (value: string | null) =>
      value
        ? value
            .split(",")
            .map((item) => item.trim())
            .filter(Boolean)
        : undefined;

    const candidate = recruiterSearchSchema.safeParse({
      skills: parseList(searchParams.get("skills")),
      minStreak: searchParams.get("minStreak") ? Number(searchParams.get("minStreak")) : undefined,
      minAvgScore: searchParams.get("minAvgScore") ? Number(searchParams.get("minAvgScore")) : undefined,
      category: searchParams.get("category") ?? undefined,
      limit: searchParams.get("limit") ? Number(searchParams.get("limit")) : undefined,
      offset: searchParams.get("offset") ? Number(searchParams.get("offset")) : undefined,
    });

    if (!candidate.success) {
      return fail(400, "invalid_search", "Some filters are not valid.", candidate.error.issues);
    }

    const { skills, minStreak, minAvgScore, limit, offset } = candidate.data;

    let query = supabase
      .from("profile_cards")
      .select(
        "id, display_name, headline, bio, skills, visibility, current_streak, longest_streak, total_practice_days, last_practice_date",
        { count: "exact" }
      )
      .order("current_streak", { ascending: false })
      .order("total_practice_days", { ascending: false });

    if (skills && skills.length > 0) query = query.contains("skills", skills);
    if (minStreak !== undefined) query = query.gte("current_streak", minStreak);

    const { data: cards, error, count } = await query.range(offset, offset + limit - 1);

    if (error) {
      return fail(500, "search_failed", "Search is unavailable right now.", { requestId });
    }

    const ids = (cards ?? []).map((card) => card.id);
    let signals: Array<Record<string, unknown>> = [];

    if (ids.length > 0) {
      const { data: signalRows } = await supabase
        .from("skill_signals")
        .select("user_id, category, attempts_30d, avg_score_30d, best_score, active_days, last_attempt_at")
        .in("user_id", ids);
      signals = signalRows ?? [];
    }

    const byUser = new Map<string, Array<Record<string, unknown>>>();
    for (const signal of signals) {
      const key = String(signal.user_id);
      byUser.set(key, [...(byUser.get(key) ?? []), signal]);
    }

    let results = (cards ?? []).map((card) => ({
      ...card,
      signals: byUser.get(card.id) ?? [],
    }));

    if (minAvgScore !== undefined) {
      results = results.filter((candidateRow) => {
        const scores = candidateRow.signals
          .map((signal) => Number(signal.avg_score_30d ?? 0))
          .filter((score) => Number.isFinite(score));
        if (scores.length === 0) return false;
        return Math.max(...scores) >= minAvgScore;
      });
    }

    await logAuditEvent(supabase, user.id, {
      action: "recruiter_search",
      resourceType: "profile_cards",
      details: { filters: { skills, minStreak, minAvgScore }, results: results.length },
      ipHash,
      actorRole: profile.role,
    });

    return ok({ results, count: count ?? results.length, limit, offset });
  },
  { roles: ["recruiter", "admin"] }
);
