import { pickChallenge, type PickResult } from "./adaptive.ts";
import { UNRATED_CHALLENGE_DEVIATION, lastAttemptByTag, ratingsBySubSkill, recentSlugs, type RatingAttempt } from "./ratings.ts";

/**
 * One function so the dashboard and the practice page agree on what today's
 * challenge is. They build different queries; the pick itself must not drift.
 */

export type PickableChallenge = {
  slug: string;
  track: string;
  subSkills: string[];
  /** Glicko display rating. Missing difficulty is treated as 1500 ± 100. */
  difficultyRating?: number | null;
};

export function dailyPick(input: {
  challenges: PickableChallenge[];
  attempts: RatingAttempt[];
  attemptedSlugs: Array<{ slug: string; at: string }>;
  today: string;
}): { challenge: PickableChallenge; reason: string; kind: PickResult["kind"] } | null {
  if (input.challenges.length === 0) return null;

  const candidates = input.challenges.map((challenge) => ({
    slug: challenge.slug,
    track: challenge.track,
    difficultyRating: challenge.difficultyRating ?? 1500,
    difficultyDeviation: UNRATED_CHALLENGE_DEVIATION,
    subSkills: challenge.subSkills,
  }));

  const result = pickChallenge({
    candidates,
    subSkillRatings: ratingsBySubSkill(input.attempts),
    lastAttemptByTag: lastAttemptByTag(input.attempts),
    recentSlugs: recentSlugs(input.attemptedSlugs),
    today: input.today,
  });

  if (!result) return null;
  const original = input.challenges.find((challenge) => challenge.slug === result.challenge.slug);
  if (!original) return null;

  return { challenge: original, reason: result.reason, kind: result.kind };
}
