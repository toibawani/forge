import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { challengeFromRow } from "./challenge-row.ts";
import type { Challenge } from "./challenge-model.ts";

const WRITING = JSON.parse(
  readFileSync(new URL("../../content/challenges/writing.json", import.meta.url), "utf8")
)[0] as Challenge;

test("a row without a model document stays on rubric-v1", () => {
  assert.equal(challengeFromRow({ slug: "legacy", category: "engineering", rubric: { min_words: 20 } }), null);
});

test("a null row is not a challenge", () => {
  assert.equal(challengeFromRow(null), null);
});

test("a row carrying a valid model resolves to that challenge", () => {
  const parsed = challengeFromRow({ slug: WRITING.slug, model: WRITING });

  assert.ok(parsed);
  assert.equal(parsed.slug, WRITING.slug);
  assert.equal(parsed.format, "rewrite");
});

test("a corrupt model document is refused rather than half-applied", () => {
  const broken = { ...WRITING, rubric: undefined };
  assert.equal(challengeFromRow({ slug: WRITING.slug, model: broken }), null);

  const wrongShape = { ...WRITING, tests: "not an array" };
  assert.equal(challengeFromRow({ slug: WRITING.slug, model: wrongShape }), null);
});
