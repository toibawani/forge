import test from "node:test";
import assert from "node:assert/strict";

import { buildFeedback, measureAnswer } from "./feedback.ts";

const signals = (completeness: number, structure: number, specificity: number) => ({
  completeness,
  structure,
  specificity,
});

const STRONG = [
  "The endpoint issues N+1 queries: `orders.list` runs once, then `loadCustomer` runs per row, so 1 + 240 queries per page.",
  "Fix: replace the per-row lookup with a single `in()` fetch and join in memory.",
  "That takes p95 from 2.4s to 380ms in the 240-row case.",
].join("\n\n");

const WEAK =
  "I think the code is probably slow because it does a lot of queries. Maybe we should add a cache or something.";

test("measures the evidence it claims to measure", () => {
  const metrics = measureAnswer(STRONG);
  assert.equal(metrics.codeSpans, 3);
  assert.ok(metrics.numbers >= 4, `expected several figures, got ${metrics.numbers}`);
  assert.equal(metrics.paragraphs, 3);
  assert.equal(metrics.hedges, 0);
  assert.ok(metrics.identifiers >= 1, "camelCase identifier is counted");
});

test("hedging and vague quantities are counted, not guessed", () => {
  const metrics = measureAnswer(WEAK);
  assert.equal(metrics.hedges, 3, "i think + probably + maybe");
  assert.ok(metrics.vagueQuantifiers >= 2, "a lot + something");
  assert.equal(metrics.codeSpans, 0);
});

test("a strong answer produces specific strengths and no invented criticism", () => {
  const feedback = buildFeedback({
    answer: STRONG,
    signals: signals(92, 88, 90),
    minWords: 60,
    category: "engineering",
  });

  assert.ok(feedback.strengths.length >= 2);
  assert.equal(feedback.improvements.length, 0);
  assert.match(feedback.headline, /strong answer/i);
  assert.equal(feedback.dimensions.length, 3);
  for (const dimension of feedback.dimensions) {
    assert.equal(dimension.verdictTone, "strong");
    assert.ok(dimension.verdict.length > 0);
  }
});

test("a weak answer names the weak dimension and gives one focus", () => {
  const feedback = buildFeedback({
    answer: WEAK,
    signals: signals(45, 40, 30),
    minWords: 60,
    category: "engineering",
  });

  assert.ok(feedback.improvements.length > 0);
  const titles = feedback.improvements.map((item) => item.title).join(" | ");
  assert.match(titles, /evidence|hedging|vague/i);
  assert.match(feedback.headline, /holds the score back/i);
  assert.equal(feedback.focus.split("Next attempt:").length, 2, "focus is a single instruction");
  assert.ok(feedback.improvements.every((item) => item.detail.length > 20));
});

test("every improvement carries a concrete rewrite, not a restated rule", () => {
  const feedback = buildFeedback({
    answer: WEAK,
    signals: signals(45, 40, 30),
    minWords: 60,
    category: "writing",
  });

  const withExample = feedback.improvements.filter((item) => item.example);
  assert.equal(withExample.length, feedback.improvements.length);
});

test("feedback is deterministic", () => {
  const input = {
    answer: WEAK,
    signals: signals(45, 40, 30),
    minWords: 60,
    category: "engineering",
  };
  assert.deepEqual(buildFeedback(input), buildFeedback(input));
});

test("an empty answer still produces usable, non-crashing feedback", () => {
  const feedback = buildFeedback({
    answer: "",
    signals: signals(0, 0, 0),
    minWords: 60,
    category: "engineering",
  });

  assert.equal(feedback.metrics.words, 0);
  assert.ok(feedback.headline.length > 0);
  assert.ok(feedback.focus.startsWith("Next attempt:"));
  assert.ok(feedback.improvements.length > 0);
});

test("feedback never exceeds three items per column", () => {
  const feedback = buildFeedback({
    answer: WEAK,
    signals: signals(20, 20, 20),
    minWords: 400,
    category: "engineering",
  });

  assert.ok(feedback.strengths.length <= 3);
  assert.ok(feedback.improvements.length <= 3);
});
