import test from "node:test";
import assert from "node:assert/strict";

import { scoreSubmission } from "./scoring.ts";

const rubric = { min_words: 60, signals: ["diagnosis", "fix"] };

test("an empty answer scores zero", () => {
  const result = scoreSubmission("   \n\n  ", rubric, "engineering");
  assert.equal(result.score, 0);
  assert.equal(result.signals.structure, 0);
  assert.equal(result.signals.specificity, 0);
  assert.match(result.notes.join(" "), /nothing was submitted/i);
});

test("scoring is deterministic", () => {
  const answer = "The query is slow because it runs per row.\n\nFix: fetch once with `in()`.";
  assert.deepEqual(
    scoreSubmission(answer, rubric, "engineering"),
    scoreSubmission(answer, rubric, "engineering")
  );
});

test("structure and evidence beat raw length", () => {
  // 300 words of filler, one block, no specifics.
  const filler = Array.from({ length: 300 }, () => "word").join(" ");
  // 60 words, structured, with a number and a code span.
  const structured = [
    "The endpoint issues N+1 queries: 1 + 240 per page.",
    "Cause: `loadCustomer` runs per row instead of one `in()` fetch.",
    "Fix: batch the lookup, then join in memory. p95 drops from 2.4s to 380ms.",
  ].join("\n\n");

  const fillerScore = scoreSubmission(filler, rubric, "engineering");
  const structuredScore = scoreSubmission(structured, rubric, "engineering");

  assert.ok(
    structuredScore.score > fillerScore.score,
    `expected structured (${structuredScore.score}) to beat filler (${fillerScore.score})`
  );
  assert.ok(fillerScore.signals.specificity < structuredScore.signals.specificity);
});

test("coverage never exceeds the minimum requirement as a reward", () => {
  const long = Array.from({ length: 600 }, (_, index) => `token${index}`).join(" ");
  const result = scoreSubmission(long, rubric, "engineering");
  assert.equal(result.signals.completeness, 100);
  assert.ok(result.score <= 100);
});

test("scores stay inside 0..100 for extreme inputs", () => {
  for (const answer of ["a", "a ".repeat(5000), "`x` 1 2 3 4 5 Aa Bb Cc"]) {
    const result = scoreSubmission(answer, rubric, "design");
    assert.ok(result.score >= 0 && result.score <= 100, `out of range: ${result.score}`);
  }
});

test("a zero-word target does not divide by zero", () => {
  const result = scoreSubmission("short but present", { min_words: 0 }, "writing");
  assert.ok(Number.isFinite(result.score));
  assert.ok(result.score >= 0 && result.score <= 100);
});

test("engineering is held to the same scale without inflating", () => {
  const answer =
    "Root cause: `charges.list` paginates at 20 and the client never follows the cursor.\n\nFix: follow `next_page` until null. 3 lines, covered by a test that asserts 240 rows.";
  const engineering = scoreSubmission(answer, rubric, "engineering");
  const writing = scoreSubmission(answer, rubric, "writing");
  assert.ok(engineering.score <= writing.score);
});
