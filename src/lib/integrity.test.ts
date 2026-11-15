import test from "node:test";
import assert from "node:assert/strict";

import {
  DUPLICATE_THRESHOLD,
  MAX_PLAUSIBLE_WPM,
  assessAttempt,
  containment,
  duplicateRisk,
  integritySummary,
  similarity,
} from "./integrity.ts";

const ANSWER =
  "The endpoint issues N+1 queries: one call per order, then one per customer. Fix: batch the customer lookup with a single in() query, then join in memory. p95 drops from 2.4s to 380ms.";

test("identical answers are a perfect match, ignoring case and punctuation", () => {
  // Only substitutions between non-word characters: rewriting "2.4s" as "24s"
  // genuinely changes the tokens, so that would not be a fair comparison.
  const variant = ANSWER.toLowerCase().replace(/[:+]/g, " ");
  assert.equal(similarity(ANSWER, variant), 1);
});

test("unrelated answers are not similar", () => {
  const score = similarity(ANSWER, "A brand palette should hold at most three colours with one accent.");
  assert.ok(score < 0.2, `expected low similarity, got ${score}`);
});

test("shared vocabulary alone is not a duplicate", () => {
  // Same words, different claim: unigram overlap would call this a copy.
  const left = "the query is slow because it runs per row";
  const right = "the cache is slow because it runs per request";
  const score = similarity(left, right);
  assert.ok(score < DUPLICATE_THRESHOLD, `expected below threshold, got ${score}`);
});

test("containment reports how much of the smaller text is reused", () => {
  const longer = `${ANSWER} I would also add a cache in front of it.`;
  assert.equal(containment(ANSWER, longer), 1);
  assert.ok(containment(ANSWER, "Entirely different content about hiring.") < 0.1);
});

test("a copy with an extra sentence appended is caught", () => {
  const risk = duplicateRisk(ANSWER, [
    { id: "copy", answer: `${ANSWER} I would also add a cache in front of it.` },
  ]);

  assert.equal(risk.flagged, true, `score was ${risk.score}`);
  assert.equal(risk.matchId, "copy");
});

test("a short phrase contained in a long answer is not a copy", () => {
  const risk = duplicateRisk("Use an index.", [
    { id: "long", answer: `${ANSWER} Use an index. ${ANSWER}` },
  ]);
  assert.equal(risk.flagged, false);
});

test("no other attempts means no duplicate claim", () => {
  const risk = duplicateRisk(ANSWER, []);
  assert.equal(risk.flagged, false);
  assert.equal(risk.score, 0);
  assert.equal(risk.matchId, null);
});

test("typing faster than a human can is flagged", () => {
  const report = assessAttempt({ answer: ANSWER, seconds: 5 });
  assert.ok(report.flags.includes("implausibly_fast"));
  assert.ok((report.wordRate ?? 0) > MAX_PLAUSIBLE_WPM);
  assert.ok(report.notes.length > 0);
});

test("a normal pace is left alone", () => {
  const report = assessAttempt({ answer: ANSWER, seconds: 180 });
  assert.deepEqual(report.flags, []);
  assert.equal(integritySummary(report), null);
});

test("a long answer in seconds is flagged even below the WPM ceiling", () => {
  const answer = Array.from({ length: 60 }, () => "word").join(" ");
  const report = assessAttempt({ answer, seconds: 15 });
  assert.ok(report.flags.includes("too_fast_for_length"));
});

test("a short answer written quickly is not treated as suspicious", () => {
  const report = assessAttempt({ answer: "Use an index on created_at.", seconds: 8 });
  assert.ok(!report.flags.includes("too_fast_for_length"));
});

test("an unknown duration cannot produce a rate", () => {
  const report = assessAttempt({ answer: ANSWER, seconds: null });
  assert.equal(report.wordRate, null);
  assert.deepEqual(report.flags, []);
});

test("flags are deduplicated and reported once", () => {
  const report = assessAttempt({
    answer: ANSWER,
    seconds: 2,
    others: [{ id: "x", answer: ANSWER }],
  });

  assert.deepEqual(report.flags, ["implausibly_fast", "too_fast_for_length", "duplicate_answer"]);
  assert.equal(new Set(report.flags).size, report.flags.length);
});

test("an empty answer produces no false accusations", () => {
  const report = assessAttempt({ answer: "   ", seconds: 60 });
  assert.equal(report.flags.length, 0);
  assert.equal(report.wordRate, null);
});
