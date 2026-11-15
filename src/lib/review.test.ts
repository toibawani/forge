import test from "node:test";
import assert from "node:assert/strict";

import {
  calibration,
  reviewSummary,
  rubricBand,
  verdictLabel,
  verdictTone,
  type Verdict,
} from "./review.ts";

test("no review means no verified claim", () => {
  const summary = reviewSummary(null);
  assert.equal(summary.verified, false);
  assert.equal(summary.reviewed, 0);
  assert.match(summary.text, /no human review/i);
});

test("all-correct reviews read as clean", () => {
  const summary = reviewSummary({ reviewed_attempts: 4, correct: 4 });
  assert.equal(summary.verified, true);
  assert.equal(summary.tone, "success");
  assert.match(summary.text, /4 reviewed: 4 correct/);
});

test("an incorrect verdict is never averaged away", () => {
  const summary = reviewSummary({
    reviewed_attempts: 10,
    correct: 9,
    partially_correct: 1,
    incorrect: 1,
  });

  assert.equal(summary.incorrect, 1);
  assert.equal(summary.tone, "error");
  assert.match(summary.text, /1 incorrect/);
});

test("partial verdicts are reported as their own tone", () => {
  const summary = reviewSummary({ reviewed_attempts: 2, partially_correct: 2 });
  assert.equal(summary.tone, "warning");
  assert.match(summary.text, /2 partly correct/);
});

test("verdict labels and tones are stable for the UI", () => {
  assert.equal(verdictLabel("correct"), "Correct");
  assert.equal(verdictLabel("partially_correct"), "Partly correct");
  assert.equal(verdictLabel("incorrect"), "Incorrect");
  assert.equal(verdictLabel("something-else"), "Not reviewed");
  assert.equal(verdictTone("incorrect"), "error");
  assert.equal(verdictTone(null), "none");
});

test("the rubric band maps a score to the verdict it implies", () => {
  assert.equal(rubricBand(90), "correct");
  assert.equal(rubricBand(75), "correct");
  assert.equal(rubricBand(74), "partially_correct");
  assert.equal(rubricBand(50), "partially_correct");
  assert.equal(rubricBand(49), "incorrect");
});

test("calibration is empty rather than zero when nothing is reviewed", () => {
  const result = calibration([]);
  assert.equal(result.total, 0);
  assert.equal(result.agreement, null);
});

test("calibration separates overrating from underrating", () => {
  const pairs: Array<{ rubricScore: number; verdict: Verdict }> = [
    { rubricScore: 88, verdict: "correct" }, // agrees
    { rubricScore: 82, verdict: "incorrect" }, // overrated
    { rubricScore: 40, verdict: "correct" }, // underrated
    { rubricScore: 60, verdict: "partially_correct" }, // agrees
  ];

  const result = calibration(pairs);
  assert.equal(result.total, 4);
  assert.equal(result.agreement, 50);
  assert.equal(result.overrated, 1);
  assert.equal(result.underrated, 1);
});

test("full agreement is 100, not rounded oddly", () => {
  const result = calibration([
    { rubricScore: 90, verdict: "correct" },
    { rubricScore: 20, verdict: "incorrect" },
  ]);
  assert.equal(result.agreement, 100);
  assert.equal(result.overrated, 0);
  assert.equal(result.underrated, 0);
});
