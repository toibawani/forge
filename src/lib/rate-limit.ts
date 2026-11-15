import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { logger } from "@/lib/logger";

/**
 * Rate limiting.
 *
 * Counters live in Postgres (`consume_rate_limit`), incremented atomically, so
 * the limit is shared by every instance of the app. An in-memory limiter looks
 * equivalent in tests and is useless in production: N instances means N times
 * the allowance, which is exactly the case an attacker spreads requests across.
 *
 * The database is the limiter because Forge already depends on it. Adding Redis
 * would be a second stateful service to secure, monitor and pay for, to store
 * integer counters.
 *
 * Fallback: when the service-role key or the SQL function is unavailable, this
 * degrades to per-instance counters rather than failing requests, and says so
 * once in the logs. That keeps local development usable without pretending the
 * limit is distributed — `mode` reports which one is active.
 */

export type RateLimitMode = "shared" | "instance";

export type RateLimitResult = {
  success: boolean;
  remaining: number;
  resetTime: number;
  mode: RateLimitMode;
};

type LocalEntry = { count: number; resetTime: number };

const localStore = new Map<string, LocalEntry>();
let lastSweep = Date.now();
let fallbackWarned = false;

function warnFallback(reason: string): void {
  if (fallbackWarned) return;
  fallbackWarned = true;
  logger.warn("Rate limiting is using per-instance counters", { reason });
}

function instanceRateLimit(
  identifier: string,
  limit: number,
  windowMs: number
): RateLimitResult {
  const now = Date.now();

  // Opportunistic sweep instead of a background interval, which would keep a
  // serverless instance warm for no reason.
  if (now - lastSweep > 60_000) {
    for (const [key, entry] of localStore) {
      if (now > entry.resetTime) localStore.delete(key);
    }
    lastSweep = now;
  }

  const entry = localStore.get(identifier);

  if (!entry || now > entry.resetTime) {
    const fresh: LocalEntry = { count: 1, resetTime: now + windowMs };
    localStore.set(identifier, fresh);
    return { success: true, remaining: limit - 1, resetTime: fresh.resetTime, mode: "instance" };
  }

  if (entry.count >= limit) {
    return { success: false, remaining: 0, resetTime: entry.resetTime, mode: "instance" };
  }

  entry.count += 1;
  return { success: true, remaining: limit - entry.count, resetTime: entry.resetTime, mode: "instance" };
}

type ConsumeRow = { allowed: boolean; remaining: number | null; reset_at: string | null };

/**
 * Consumes one unit from `identifier`.
 *
 * Identifiers are always built server-side from a verified user id or a hashed
 * IP — never from a client-supplied string, which would let a caller burn
 * someone else's budget.
 */
export async function rateLimit(
  identifier: string,
  limit = 10,
  windowMs = 60_000
): Promise<RateLimitResult> {
  const windowSeconds = Math.max(1, Math.round(windowMs / 1000));
  const admin = createAdminClient();

  if (!admin) {
    warnFallback("SUPABASE_SERVICE_ROLE_KEY is not set");
    return instanceRateLimit(identifier, limit, windowMs);
  }

  const { data, error } = await admin.rpc("consume_rate_limit", {
    p_key: identifier,
    p_limit: limit,
    p_window_seconds: windowSeconds,
  });

  if (error) {
    warnFallback(error.message);
    return instanceRateLimit(identifier, limit, windowMs);
  }

  const row = (Array.isArray(data) ? data[0] : data) as ConsumeRow | null;
  if (!row) {
    warnFallback("consume_rate_limit returned no row");
    return instanceRateLimit(identifier, limit, windowMs);
  }

  return {
    success: Boolean(row.allowed),
    remaining: Number(row.remaining ?? 0),
    resetTime: row.reset_at ? new Date(row.reset_at).getTime() : Date.now() + windowMs,
    mode: "shared",
  };
}
