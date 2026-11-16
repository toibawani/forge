import { challengeSchema, type Challenge } from "./challenge-model.ts";

/**
 * Maps a `challenges` row to the versioned model.
 *
 * Only rows carrying a `model` document are eligible for the new graders. Rows
 * created before Phase 1 have no tests, no reference and a legacy rubric shape,
 * so they resolve to null and stay on rubric-v1 — the alternative would be to
 * invent tests for them and start scoring against a rubric nobody wrote.
 */
export function challengeFromRow(row: Record<string, unknown> | null): Challenge | null {
  if (!row || !row.model) return null;

  const parsed = challengeSchema.safeParse(row.model);
  return parsed.success ? parsed.data : null;
}
