import test from "node:test";
import assert from "node:assert/strict";

import { pickChallenge, type AdaptiveCandidate, type PickContext } from "./adaptive.ts";
import { INITIAL_RATING, type RatingState } from "./glicko2.ts";

const CANDIDATES: AdaptiveCandidate[] = [
  { slug: "arrays-basic", track: "coding", difficultyRating: 1200, difficultyDeviation: 100, subSkills: ["arrays"] },
  { slug: "arrays-hard", track: "coding", difficultyRating: 1750, difficultyDeviation: 100, subSkills: ["arrays"] },
  { slug: "strings-basic", track: "coding", difficultyRating: 1350, difficultyDeviation: 100, subSkills: ["strings"] },
];

function context(overrides: Partial<PickContext> = {}): PickContext {
  return {
    candidates: CANDIDATES,
    subSkillRatings: new Map<string, RatingState>(),
    lastAttemptByTag: new Map<string, string>(),
    recentSlugs: [],
    today: "2026-11-16",
    ...overrides,
  };
}

test("a recent challenge is not offered again", () => {
  const result = pickChallenge(context({ recentSlugs: ["arrays-hard"] }));
  assert.ok(result);
  assert.notEqual(result.challenge.slug, "arrays-hard");
});

test("nothing eligible means no pick rather than a repeat", () => {
  const result = pickChallenge(
    context({ recentSlugs: CANDIDATES.map((candidate) => candidate.slug) })
  );
  assert.equal(result, null);
});

test("the pick sits near the target difficulty for a new player", () => {
  const result = pickChallenge(context());
  assert.ok(result);
  // 1500 player: 1350 and 1200 are both plausible; 1750 is a stretch.
  assert.notEqual(result.challenge.slug, "arrays-hard");
  assert.match(result.reason, /expected ~\d+%/);
});

test("a weaker tag pulls the pick toward it, and the reason names it", () => {
  const subSkillRatings = new Map<string, RatingState>([
    ["arrays", { ...INITIAL_RATING, rating: 1750, deviation: 60 }],
    ["strings", { ...INITIAL_RATING, rating: 1150, deviation: 60 }],
  ]);

  const result = pickChallenge(context({ subSkillRatings }));
  assert.ok(result);
  assert.equal(result.challenge.slug, "strings-basic");
  assert.equal(result.kind, "weakest-tag");
  assert.match(result.reason, /strings/);
});

test("the same day and inputs pick the same challenge", () => {
  const first = pickChallenge(context());
  const second = pickChallenge(context());
  assert.equal(first?.challenge.slug, second?.challenge.slug);
});

test("a stale tag gets a spaced-review pick when the day is due", () => {
  // 2026-11-16 is day 16 of the month; 16 % 4 === 0, so spaced review is due.
  const result = pickChallenge(
    context({
      lastAttemptByTag: new Map([["arrays", "2026-11-08"]]),
    })
  );

  assert.ok(result);
  assert.equal(result.kind, "spaced-review");
  assert.match(result.reason, /8 days ago/);
});

test("a tag practised yesterday is not treated as stale", () => {
  const result = pickChallenge(
    context({
      lastAttemptByTag: new Map([["arrays", "2026-11-15"]]),
    })
  );

  assert.ok(result);
  assert.notEqual(result.kind, "spaced-review");
});

test("spaced review does not fire on a day that is not due", () => {
  const result = pickChallenge(
    context({
      today: "2026-11-17",
      lastAttemptByTag: new Map([["arrays", "2026-11-08"]]),
    })
  );

  assert.ok(result);
  assert.notEqual(result.kind, "spaced-review");
});
