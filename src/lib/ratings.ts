import {
  INITIAL_RATING,
  describeRating,
  formatRating,
  rebuildRating,
  type RatingState,
} from "./glicko2.ts";

/**
 * Turns the immutable attempt log into the numbers a person sees.
 *
 * Ratings are never stored as the source of truth: `rebuildRating` replays the
 * attempts, and everything here is a view over that. A challenge with no
 * `initial_rating` is treated as 1500 with a wide deviation, which is the honest
 * starting assumption rather than a confident guess.
 */

export type RatingAttempt = {
  /** Track id, e.g. "coding". */
  track: string;
  /** Sub-skill tags the challenge carried. */
  subSkills: string[];
  score: number | null;
  challengeRating: number;
  challengeDeviation: number;
  /** ISO day or timestamp; order is derived, never assumed. */
  at: string;
};

export type RatingView = {
  track: string;
  /** Human name for the track, falling back to its id. */
  trackName: string;
  state: RatingState;
  /** "1420 ± 80" */
  label: string;
  /** What the interval means in words. */
  description: string;
  attempts: number;
};

export const UNRATED_CHALLENGE_DEVIATION = 100;

function group(attempts: RatingAttempt[], keyOf: (attempt: RatingAttempt) => string[]) {
  const groups = new Map<string, RatingAttempt[]>();

  for (const attempt of attempts) {
    for (const key of keyOf(attempt)) {
      groups.set(key, [...(groups.get(key) ?? []), attempt]);
    }
  }

  return groups;
}

export function ratingsByTrack(attempts: RatingAttempt[]): Map<string, RatingState> {
  const result = new Map<string, RatingState>();
  for (const [track, rows] of group(attempts, (attempt) => [attempt.track])) {
    result.set(track, rebuildRating(rows.map(toRebuildInput)));
  }
  return result;
}

export function ratingsBySubSkill(attempts: RatingAttempt[]): Map<string, RatingState> {
  const result = new Map<string, RatingState>();
  for (const [tag, rows] of group(attempts, (attempt) => attempt.subSkills)) {
    result.set(tag, rebuildRating(rows.map(toRebuildInput)));
  }
  return result;
}

function toRebuildInput(attempt: RatingAttempt) {
  return {
    score: attempt.score,
    challengeRating: attempt.challengeRating,
    challengeDeviation: attempt.challengeDeviation,
    at: attempt.at,
  };
}

/**
 * One row per track, only for tracks that have at least one scored attempt.
 * Sorted by rating so the strongest skill is first.
 */
export function ratingViews(
  attempts: RatingAttempt[],
  trackNames: Map<string, string>
): RatingView[] {
  const ratings = ratingsByTrack(attempts);

  return [...ratings]
    .filter(([, state]) => state.rating !== INITIAL_RATING.rating || state.deviation !== INITIAL_RATING.deviation)
    .map(([track, state]) => ({
      track,
      trackName: trackNames.get(track) ?? track,
      state,
      label: formatRating(state),
      description: describeRating(state),
      attempts: attempts.filter((attempt) => attempt.track === track && attempt.score !== null).length,
    }))
    .sort((left, right) => right.state.rating - left.state.rating);
}

/** The most recent practice day per sub-skill, used by the spaced-review rule. */
export function lastAttemptByTag(attempts: RatingAttempt[]): Map<string, string> {
  const latest = new Map<string, string>();

  for (const attempt of attempts) {
    for (const tag of attempt.subSkills) {
      const current = latest.get(tag);
      if (!current || attempt.at > current) latest.set(tag, attempt.at.slice(0, 10));
    }
  }

  return latest;
}

/** Slugs in most-recent-first order, for the repeat window. */
export function recentSlugs(attempts: Array<{ slug: string; at: string }>): string[] {
  return [...attempts]
    .sort((left, right) => right.at.localeCompare(left.at))
    .map((attempt) => attempt.slug);
}
