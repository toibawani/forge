import { getPublicEnv, isSupabaseConfigured } from "@/lib/env";
import { logger } from "@/lib/logger";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * One implementation of "is this deployment healthy", shared by the JSON
 * endpoint a monitor polls and the human status page.
 *
 * Reports booleans and codes only: no keys, counts, versions or user data.
 */

export type HealthStatus = "ok" | "degraded" | "down" | "unconfigured";

export type HealthReport = {
  status: HealthStatus;
  checks: {
    config: boolean;
    database: boolean;
    schema: boolean;
  };
  hint?: string;
  origin?: string;
  time: string;
};

export async function checkHealth(): Promise<HealthReport> {
  const { appUrl } = getPublicEnv();
  const checks = { config: isSupabaseConfigured(), database: false, schema: false };
  const time = new Date().toISOString();

  if (!checks.config) {
    return {
      status: "unconfigured",
      checks,
      hint: "Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY, then apply supabase/schema.sql.",
      time,
    };
  }

  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return {
      status: "unconfigured",
      checks,
      hint: "The server could not create a database client from the configured environment.",
      time,
    };
  }

  try {
    // Head-only reads: no rows travel, and neither query touches user data.
    const { error: databaseError } = await supabase
      .from("challenges")
      .select("id", { head: true, count: "exact" })
      .limit(1);

    checks.database = !databaseError;

    if (databaseError) {
      logger.error("Health check: database unreachable", { code: databaseError.code });
    }

    // Schema presence is reported separately: a missing table after a partial
    // migration is a deployment fault, not an outage.
    if (checks.database) {
      const { error: schemaError } = await supabase
        .from("attempt_reviews")
        .select("id", { head: true, count: "exact" })
        .limit(1);

      checks.schema = !schemaError;
    }
  } catch (error) {
    logger.error("Health check failed to run", {
      error: error instanceof Error ? error.message : "unknown",
    });
    checks.database = false;
    checks.schema = false;
  }

  const status: HealthStatus = !checks.database ? "down" : checks.schema ? "ok" : "degraded";

  return {
    status,
    checks,
    hint: checks.schema
      ? undefined
      : "Apply the latest supabase/schema.sql — the review tables are missing.",
    origin: new URL(appUrl).origin,
    time,
  };
}
