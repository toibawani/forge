type RateLimitEntry = { count: number; resetTime: number };

const rateLimitStore = new Map<string, RateLimitEntry>();
let lastSweep = Date.now();

/**
 * In-memory fixed-window rate limiter.
 *
 * Good enough to blunt credential stuffing and accidental loops on a single
 * instance. On a multi-instance deployment this must move to Redis (or the
 * platform's rate limiting) because each instance keeps its own counters —
 * documented here so nobody mistakes it for a distributed guarantee.
 */
export function rateLimit(
  identifier: string,
  limit = 10,
  windowMs = 60_000
): { success: boolean; remaining: number; resetTime: number } {
  const now = Date.now();

  // Opportunistic sweep instead of a background interval, which would keep a
  // serverless instance warm for no reason.
  if (now - lastSweep > 60_000) {
    for (const [key, entry] of rateLimitStore) {
      if (now > entry.resetTime) rateLimitStore.delete(key);
    }
    lastSweep = now;
  }

  const entry = rateLimitStore.get(identifier);

  if (!entry || now > entry.resetTime) {
    const fresh: RateLimitEntry = { count: 1, resetTime: now + windowMs };
    rateLimitStore.set(identifier, fresh);
    return { success: true, remaining: limit - 1, resetTime: fresh.resetTime };
  }

  if (entry.count >= limit) {
    return { success: false, remaining: 0, resetTime: entry.resetTime };
  }

  entry.count += 1;
  return { success: true, remaining: limit - entry.count, resetTime: entry.resetTime };
}
