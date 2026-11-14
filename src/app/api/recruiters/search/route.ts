import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/client";
import { recruiterSearchSchema } from "@/lib/validations";
import { requireRole } from "@/lib/auth-helpers";
import { logAuditEvent } from "@/lib/audit-logger";
import { logger } from "@/lib/logger";
import { rateLimit } from "@/lib/rate-limit";

export async function GET(request: NextRequest) {
  const requestId = crypto.randomUUID();
  const ip = request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "unknown";

  try {
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
      return NextResponse.json({ error: "Database service not configured" }, { status: 503 });
    }

    const currentUser = await requireRole(["recruiter", "admin"]);

    const rateLimitResult = rateLimit(ip, 30, 60000);
    if (!rateLimitResult.success) {
      logger.warn("Rate limit exceeded for recruiter search", { ip }, currentUser.user.id, requestId);
      return NextResponse.json({ error: "Too many search requests" }, { status: 429 });
    }

    const { searchParams } = new URL(request.url);
    const query = {
      skills: searchParams.get("skills")?.split(","),
      difficulty: searchParams.get("difficulty"),
      category: searchParams.get("category"),
      minStreak: searchParams.get("minStreak") ? parseInt(searchParams.get("minStreak")!) : undefined,
      minScore: searchParams.get("minScore") ? parseInt(searchParams.get("minScore")!) : undefined,
      timeFrame: searchParams.get("timeFrame"),
      visibility: searchParams.get("visibility") || "public",
      limit: parseInt(searchParams.get("limit") || "20"),
      offset: parseInt(searchParams.get("offset") || "0"),
    };

    const validationResult = recruiterSearchSchema.safeParse(query);
    if (!validationResult.success) {
      return NextResponse.json({ error: "Invalid search parameters", details: validationResult.error.issues }, { status: 400 });
    }

    const supabase = createClient();

    let profilesQuery = supabase
      .from("profiles")
      .select(`
        id,
        email,
        display_name,
        bio,
        skills,
        visibility,
        profile_views_count,
        created_at,
        streaks (
          current_streak,
          longest_streak,
          total_practice_days
        ),
        challenge_attempts (
          score,
          created_at
        )
      `, { count: "exact" })
      .in("visibility", ["public", "recruiters_only"])
      .order("created_at", { ascending: false });

    if (validationResult.data.skills && validationResult.data.skills.length > 0) {
      profilesQuery = profilesQuery.contains("skills", validationResult.data.skills);
    }

    if (validationResult.data.minStreak) {
      profilesQuery = profilesQuery.gte("streaks.current_streak", validationResult.data.minStreak);
    }

    const { data: profiles, error, count } = await profilesQuery.range(
      validationResult.data.offset,
      validationResult.data.offset + validationResult.data.limit - 1
    );

    if (error) {
      logger.error("Recruiter search failed", { error: error.message }, currentUser.user.id, requestId);
      return NextResponse.json({ error: "Search failed" }, { status: 500 });
    }

    await logAuditEvent(
      currentUser.user.id,
      "search_candidates",
      "profiles",
      undefined,
      { query: validationResult.data, resultsCount: count },
      ip
    );

    logger.info("Recruiter search completed", { resultsCount: count }, currentUser.user.id, requestId);

    return NextResponse.json({ profiles, count, limit: validationResult.data.limit, offset: validationResult.data.offset }, { status: 200 });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error instanceof Error && error.message === "Forbidden") {
      return NextResponse.json({ error: "Forbidden - recruiter access required" }, { status: 403 });
    }
    logger.error("Unexpected error in recruiter search", { error: error instanceof Error ? error.message : String(error) }, undefined, requestId);
    return NextResponse.json({ error: "An unexpected error occurred" }, { status: 500 });
  }
}
