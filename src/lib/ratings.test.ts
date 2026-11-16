import test from "node:test";
import assert from "node:assert/strict";

import {
  UNRATED_CHALLENGE_DEVIATION,
  lastAttemptByTag,
  ratingViews,
  ratingsBySubSkill,
  ratingsByTrack,
  recentSlugs,
  type RatingAttempt,
} from "./ratings.ts";
import { INITIAL_RATING } from "./glicko2.ts";

function attempt(overrides: Partial<RatingAttempt> = {}): RatingAttempt {
  return {
    track: "coding",
    subSkills: ["arrays"],
    score: 80,
    challengeRating: 1500,
    challengeDeviation: UNRATED_CHALLENGE_DEVIATION,
    at: "2026-11-01",
    ...overrides,
  };
}

test("no attempts means no rating rows rather than a default one", () => {
  assert.equal(ratingsByTrack([]).size, 0);
  assert.deepEqual(ratingViews([], new Map()), []);
});

test("attempts are grouped by track and by sub-skill", () => {
  const attempts = [
    attempt({ track: "coding", subSkills: ["arrays", "edge-cases"] }),
    attempt({ track: "writing", subSkills: ["concision"], at: "2026-11-02" }),
  ];

  assert.deepEqual([...ratingsByTrack(attempts).keys()].sort(), ["coding", "writing"]);
  assert.deepEqual([...ratingsBySubSkill(attempts).keys()].sort(), ["arrays", "concision", "edge-cases"]);
});

test("a strong result moves the rating up, a weak one down", () => {
  const strong = ratingsByTrack([attempt({ score: 95 })]).get("coding");
  const weak = ratingsByTrack([attempt({ score: 20 })]).get("coding");

  assert.ok(strong && weak);
  assert.ok(strong.rating > 1500);
  assert.ok(weak.rating < 1500);
});

test("unscored attempts do not move a rating", () => {
  const state = ratingsByTrack([attempt({ score: null })]).get("coding");
  assert.ok(state);
  assert.equal(Math.round(state.rating), Math.round(INITIAL_RATING.rating));
});

test("the view carries the interval and a plain-words explanation", () => {
  const views = ratingViews([attempt({ score: 90 })], new Map([["coding", "Coding"]]));

  assert.equal(views.length, 1);
  assert.match(views[0].label, /^\d+ ± \d+$/);
  assert.ok(views[0].description.length > 10);
  assert.equal(views[0].trackName, "Coding");
  assert.equal(views[0].attempts, 1);
});

test("views are ordered by rating and skip untouched tracks", () => {
  const views = ratingViews(
    [
      attempt({ track: "coding", score: 40 }),
      attempt({ track: "writing", score: 95 }),
    ],
    new Map()
  );

  assert.deepEqual(views.map((view) => view.track), ["writing", "coding"]);
});

test("the last attempt per tag keeps the most recent day", () => {
  const tags = lastAttemptByTag([
    attempt({ at: "2026-11-01T10:00:00Z", subSkills: ["arrays"] }),
    attempt({ at: "2026-11-08T10:00:00Z", subSkills: ["arrays"] }),
    attempt({ at: "2026-11-03T10:00:00Z", subSkills: ["strings"] }),
  ]);

  assert.equal(tags.get("arrays"), "2026-11-08");
  assert.equal(tags.get("strings"), "2026-11-03");
});

test("recent slugs come back newest first regardless of input order", () => {
  assert.deepEqual(
    recentSlugs([
      { slug: "old", at: "2026-11-01" },
      { slug: "new", at: "2026-11-09" },
    ]),
    ["new", "old"]
  );
});
