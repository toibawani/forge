import test from "node:test";
import assert from "node:assert/strict";

import { variantPick } from "./variant.ts";

const CHALLENGES = [
  { slug: "n-plus-one", track: "coding", subSkills: ["performance", "sql"], difficultyRating: 1500 },
  { slug: "cache-stampede", track: "coding", subSkills: ["performance"], difficultyRating: 1520 },
  { slug: "index-choice", track: "coding", subSkills: ["sql"], difficultyRating: 1480 },
  { slug: "brief-audit", track: "design", subSkills: ["briefs"], difficultyRating: 1500 },
];

test("needs the current challenge to be known", () => {
  assert.equal(
    variantPick({ challenges: CHALLENGES, currentSlug: "missing", attemptedSlugs: [] }),
    null
  );
});

test("a variant shares the skill and is never the same prompt", () => {
  const pick = variantPick({ challenges: CHALLENGES, currentSlug: "n-plus-one", attemptedSlugs: [] });

  assert.ok(pick);
  assert.notEqual(pick.slug, "n-plus-one");
  assert.match(pick.reason, /different prompt/);
});

test("already-answered variants are skipped", () => {
  const pick = variantPick({
    challenges: CHALLENGES,
    currentSlug: "n-plus-one",
    attemptedSlugs: ["cache-stampede"],
  });

  assert.ok(pick);
  assert.equal(pick.slug, "index-choice");
});

test("another track is never suggested", () => {
  const pick = variantPick({
    challenges: CHALLENGES,
    currentSlug: "brief-audit",
    attemptedSlugs: [],
  });

  assert.equal(pick, null);
});

test("more shared sub-skills wins, then nearest difficulty, then slug order", () => {
  const pick = variantPick({
    challenges: [
      { slug: "b", track: "coding", subSkills: ["performance"], difficultyRating: 1700 },
      { slug: "c", track: "coding", subSkills: ["performance", "sql"], difficultyRating: 1600 },
      { slug: "a", track: "coding", subSkills: ["performance"], difficultyRating: 1500 },
    ],
    currentSlug: "current",
    attemptedSlugs: [],
  });

  // No `current` in the list, so the pick is refused rather than guessed.
  assert.equal(pick, null);
});

test("the shared sub-skill is named in the reason", () => {
  const pick = variantPick({
    challenges: [
      { slug: "current", track: "coding", subSkills: ["sql"], difficultyRating: 1500 },
      { slug: "other", track: "coding", subSkills: ["sql", "joins"], difficultyRating: 1510 },
    ],
    currentSlug: "current",
    attemptedSlugs: [],
  });

  assert.ok(pick);
  assert.match(pick.reason, /sql/);
});
