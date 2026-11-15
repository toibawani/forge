import { NextResponse } from "next/server";
import { getPublicEnv, isSupabaseConfigured } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";

/**
 * Deployment health, for uptime monitors and for answering "is it us or the
 * database" without reading logs.
 *
 * Deliberately unauthenticated and deliberately boring: booleans and error
 * codes, never configuration values, keys, row counts or user data. A health
 * endpoint that leaks is worse than no health endpoint.
 */

type Checks = {
  config: boolean;
  database: boolean;
  schema: boolean;
};

export async function GET() {
  const requestId = crypto.randomUUID();
  const { appUrl } = getPublicEnv();

  const checks: Checks = {
    config: isSupabaseConfigured(),
    database: false,
    schema: false,
  };

  if (!checks.config) {
    return NextResponse.json(
      {
        status: "unconfigured",
        checks,
        hint: "Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY, then apply supabase/schema.sql.",
      },
      { status: 503, headers: { "Cache-Control": "no-store" } }
    );
  }

  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return NextResponse.json(
      { status: "unconfigured", checks },
      { status: 503, headers: { "Cache-Control": "no-store" } }
    );
  }

  try {
    // A cheap read that proves the connection works. Head-only, so no rows travel.
    const { error: databaseError } = await supabase
      .from("challenges")
      .select("id", { head: true, count: "exact" })
      .limit(1);

    checks.database = !databaseError;

    if (databaseError) {
      logger.error("Health check: database unreachable", { code: databaseError.code }, undefined, requestId);
    }

    // Schema presence: the review table only exists after the review migration.
    // A missing table (42P01) is a deployment problem, not an outage, so it is
    // reported separately from the database check.
    if (checks.database) {
      const { error: schemaError } = await supabase
        .from("attempt_reviews")
        .select("id", { head: true, count: "exact" })
        .limit(1);

      checks.schema = !schemaError;
    }
  } catch (error) {
    // A health endpoint that throws tells a monitor nothing useful.
    logger.error(
      "Health check failed to run",
      { error: error instanceof Error ? error.message : String(error) },
      undefined,
      requestId
    );
    checks.database = false;
    checks.schema = false;
  }

  const status = !checks.database ? "down" : checks.schema ? "ok" : "degraded";
  const httpStatus = status === "down" ? 503 : 200;

  return NextResponse.json(
    {
      status,
      checks,
      app: new URL(appUrl).origin,
      time: new Date().toISOString(),
    },
    { status: httpStatus, headers: { "Cache-Control": "no-store" } }
  );
}
