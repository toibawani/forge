import { expectedScore, INITIAL_RATING, type RatingState } from "./glicko2.ts";

/**
 * The daily pick.
 *
 * Rules, in priority order:
 *   1. never the same challenge inside the repeat window;
 *   2. every few days, one spaced-review item from a tag that was weak 3-10 days
 *      ago, because that is when re-testing actually helps;
 *   3. otherwise the challenge whose expected score is closest to the target
 *      band, biased toward the weakest tag.
 *
 * Deterministic for a given day: the same inputs and the same date pick the same
 * challenge, so a refresh does not shuffle the day out from under someone.
 */

export type AdaptiveCandidate = {
  slug: string;
  track: string;
  difficultyRating: number;
  difficultyDeviation: number;
  subSkills: string[];
};

export type PickContext = {
  candidates: AdaptiveCandidate[];
  /** Rating per sub-skill tag, as of now. */
  subSkillRatings: Map<string, RatingState>;
  /** Sub-skill tags with the last attempt date, ISO day. */
  lastAttemptByTag: Map<string, string>;
  /** Slugs attempted recently, most recent first. */
  recentSlugs: string[];
  today: string;
};

export type PickResult = {
  challenge: AdaptiveCandidate;
  reason: string;
  kind: "spaced-review" | "weakest-tag" | "target-band";
};

const TARGET_SCORE = 0.7;
const REPEAT_WINDOW = 14;
const SPACED_MIN_DAYS = 3;
const SPACED_MAX_DAYS = 10;
const SPACED_EVERY_DAYS = 4;

function daysBetween(fromIso: string, toIso: string): number {
  const from = Date.parse(`${fromIso}T00:00:00Z`);
  const to = Date.parse(`${toIso}T00:00:00Z`);
  if (Number.isNaN(from) || Number.isNaN(to)) return Number.POSITIVE_INFINITY;
  return Math.round((to - from) / 86_400_000);
}

function subSkillState(context: PickContext, tag: string): RatingState {
  return context.subSkillRatings.get(tag) ?? INITIAL_RATING;
}

function weakestTag(candidate: AdaptiveCandidate, context: PickContext): string | null {
  let weakest: string | null = null;
  let lowest = Number.POSITIVE_INFINITY;

  for (const tag of candidate.subSkills) {
    const rating = subSkillState(context, tag).rating;
    if (rating < lowest) {
      lowest = rating;
      weakest = tag;
    }
  }

  return weakest;
}

/** Stable tie-break so the same day produces the same pick. */
function tieBreak(a: AdaptiveCandidate, b: AdaptiveCandidate, today: string): number {
  const seed = today.replace(/-/g, "");
  const hash = (slug: string) =>
    [...slug].reduce((sum, char) => (sum * 31 + char.charCodeAt(0)) % 10_007, 0);
  return hash(`${a.slug}${seed}`) - hash(`${b.slug}${seed}`);
}

export function pickChallenge(context: PickContext): PickResult | null {
  const recent = new Set(context.recentSlugs.slice(0, REPEAT_WINDOW));
  const eligible = context.candidates.filter((candidate) => !recent.has(candidate.slug));
  if (eligible.length === 0) return null;

  // Spaced review: on a schedule, and only for a tag that has gone stale but is
  // not forgotten. A tag failed 3-10 days ago is the useful window.
  const spacedDue = Number(context.today.replace(/-/g, "")) % SPACED_EVERY_DAYS === 0;
  if (spacedDue && context.lastAttemptByTag.size > 0) {
    type StalePick = { candidate: AdaptiveCandidate; tag: string; days: number };
    const stale: StalePick[] = [];

    for (const candidate of eligible) {
      let best: StalePick | null = null;

      for (const tag of candidate.subSkills) {
        const last = context.lastAttemptByTag.get(tag);
        if (!last) continue;

        const days = daysBetween(last, context.today);
        if (days < SPACED_MIN_DAYS || days > SPACED_MAX_DAYS) continue;
        if (!best || days > best.days) best = { candidate, tag, days };
      }

      if (best) stale.push(best);
    }

    stale.sort((left, right) => right.days - left.days);
    const chosen = stale[0];
    if (chosen) {
      return {
        challenge: chosen.candidate,
        kind: "spaced-review",
        reason: `${chosen.tag} was last practised ${chosen.days} days ago — a short re-test now is worth more than a new topic.`,
      };
    }
  }

  // Target band: closest expected score to 0.7, with a nudge for the weakest tag.
  const scored = eligible
    .map((candidate) => {
      const tag = weakestTag(candidate, context);
      const state = tag ? subSkillState(context, tag) : INITIAL_RATING;
      const expectation = expectedScore(state, {
        rating: candidate.difficultyRating,
        deviation: candidate.difficultyDeviation,
      });

      // A weak tag is worth some difficulty risk: half a point of expected score
      // per 1,000 rating points below the baseline. Enough to steer practice
      // toward a gap, not enough to hand someone an impossible challenge.
      const weakPenalty = tag ? (INITIAL_RATING.rating - state.rating) / 2_000 : 0;
      const distance = Math.abs(expectation - TARGET_SCORE) - weakPenalty;

      return { candidate, tag, expectation, distance };
    })
    .sort((left, right) => left.distance - right.distance || tieBreak(left.candidate, right.candidate, context.today));

  const best = scored[0];
  const kind: PickResult["kind"] = best.tag ? "weakest-tag" : "target-band";
  const percent = Math.round(best.expectation * 100);

  return {
    challenge: best.candidate,
    kind,
    reason:
      kind === "weakest-tag"
        ? `Aimed where a good result is likely but not guaranteed (expected ~${percent}%), weighted toward ${best.tag}, your weakest tag here.`
        : `Chosen to sit in the useful difficulty band — expected score around ${percent}%.`,
  };
}
