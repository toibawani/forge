import "server-only";

import { rateLimit } from "@/lib/rate-limit";

/**
 * Cost control for rubric grading.
 *
 * Every graded answer costs two or three model calls. The cap is per user per
 * day and deliberately generous enough that a normal practice habit never
 * touches it — it exists to bound a script, not to make practice feel metered.
 */
const DAILY_GRADES = 40;

export async function consumeGradingBudget(userId: string): Promise<{
  allowed: boolean;
  retryAfterSeconds: number;
}> {
  const result = await rateLimit(`grade:${userId}`, DAILY_GRADES, 24 * 60 * 60 * 1000);

  return {
    allowed: result.success,
    retryAfterSeconds: Math.max(1, Math.ceil((result.resetTime - Date.now()) / 1000)),
  };
}

export const DAILY_GRADE_LIMIT = DAILY_GRADES;
