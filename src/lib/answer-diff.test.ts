import test from "node:test";
import assert from "node:assert/strict";

import {
  compareAnswer,
  extractSpecifics,
  highestLeverageFix,
  splitSentences,
} from "./answer-diff.ts";

const REFERENCE =
  "The endpoint issues an N+1 query: one call per order, then one per customer. Batch the lookup with a single in() call and join in memory. p95 drops from 2400ms to 380ms.";

test("an empty reference has nothing to compare with", () => {
  assert.equal(compareAnswer("anything", "   "), null);
});

test("an answer matching the reference covers every reference point", () => {
  const comparison = compareAnswer(REFERENCE, REFERENCE);

  assert.ok(comparison);
  assert.equal(comparison.overlapPercent, 100);
  assert.deepEqual(comparison.missingSpecifics, []);
  assert.deepEqual(comparison.unmatchedReference, []);
});

test("missing specifics are the numbers and identifiers the reference used", () => {
  const comparison = compareAnswer(
    "The endpoint issues an N+1 query. Batch the lookup so it runs once instead of per row.",
    REFERENCE
  );

  assert.ok(comparison);
  assert.ok(comparison.missingSpecifics.some((specific) => /2400|380|in\(\)/i.test(specific)));
  assert.ok(!comparison.missingSpecifics.some((specific) => /N\+1/i.test(specific)));
});

test("unrelated content leaves reference points unmatched", () => {
  const comparison = compareAnswer(
    "A brand palette should hold at most three colours with one accent.",
    REFERENCE
  );

  assert.ok(comparison);
  assert.equal(comparison.sharedSentences, 0);
  assert.equal(comparison.overlapPercent, 0);
  assert.equal(comparison.unmatchedReference.length, 3);
});

test("paraphrase still counts as covering the point", () => {
  const comparison = compareAnswer(
    "The endpoint makes one call per order and then one per customer. Batch the customer lookup into a single query and join it in memory.",
    REFERENCE
  );

  assert.ok(comparison);
  assert.ok(comparison.overlapPercent >= 60);
});

test("lists are capped so the panel stays readable", () => {
  const reference = Array.from(
    { length: 12 },
    (_, index) => `Point ${index} mentions latency_${index} and reaches ${1000 + index}ms.`
  ).join(" ");

  const comparison = compareAnswer("Nothing relevant here.", reference);
  assert.ok(comparison);
  assert.ok(comparison.missingSpecifics.length <= 6);
  assert.ok(comparison.unmatchedReference.length <= 4);
});

test("specifics ignore list markers and short numbers but keep code and paths", () => {
  const specifics = extractSpecifics(
    "1. Call `batchLookup` from lib/query.ts and expect 380ms, not 2.4s. Retry at 3."
  );

  assert.ok(specifics.includes("`batchLookup`") || specifics.includes("batchLookup"));
  assert.ok(specifics.some((specific) => specific.includes("lib/query.ts")));
  assert.ok(specifics.some((specific) => specific.includes("380ms")));
  assert.ok(!specifics.includes("3"));
});

test("sentence splitting survives newlines and multiple terminators", () => {
  assert.equal(splitSentences("One. Two!\n\nThree?").length, 3);
});

test("the fix is the weakest dimension, not the longest label", () => {
  const fix = highestLeverageFix({
    dimensions: [
      { id: "concision", label: "Concision", score: 4, maxScore: 4 },
      { id: "action", label: "Action", score: 1, maxScore: 4 },
      { id: "honesty", label: "Honesty", score: 3, maxScore: 4 },
    ],
  });

  assert.ok(fix);
  assert.match(fix.title, /action/);
  assert.match(fix.detail, /1 of 4/);
});

test("without grader dimensions the feedback focus is used verbatim", () => {
  const fix = highestLeverageFix({ focus: "Name the cause before the fix." });
  assert.deepEqual(fix, { title: "The one thing to change", detail: "Name the cause before the fix." });
});

test("no dimensions and no focus means no invented advice", () => {
  assert.equal(highestLeverageFix({}), null);
});
