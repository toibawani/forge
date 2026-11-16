import test from "node:test";
import assert from "node:assert/strict";

import {
  buildSubmissions,
  mapJudge0Status,
  sandboxFeedback,
  scoreOutcomes,
  type TestOutcome,
} from "./sandbox-core.ts";
import type { TestCase } from "./challenge-model.ts";

const TESTS: TestCase[] = [
  { category: "empty input", name: "empty", stdin: "", expectedStdout: "", hidden: true },
  { category: "large input", name: "large", stdin: "9", expectedStdout: "45", hidden: true },
  { category: "example", name: "visible", stdin: "3", expectedStdout: "6", hidden: false },
];

test("submissions carry the language id and each test's stdin", () => {
  const submissions = buildSubmissions("javascript", "console.log(1)", TESTS);

  assert.equal(submissions.length, 3);
  assert.equal(submissions[0].language_id, 63);
  assert.equal(submissions[1].stdin, "9");
  assert.equal(submissions[2].expected_output, "6");
});

test("python and sql map to their own ids", () => {
  assert.equal(buildSubmissions("python", "", []).length, 0);
  assert.equal(buildSubmissions("python", "print(1)", TESTS)[0].language_id, 71);
  assert.equal(buildSubmissions("sql", "select 1", TESTS)[0].language_id, 82);
});

test("an unknown language is refused rather than guessed", () => {
  assert.throws(() => buildSubmissions("ruby", "", TESTS), /unsupported_language:ruby/);
});

test("judge0 statuses collapse into the distinctions we act on", () => {
  assert.equal(mapJudge0Status(3), "accepted");
  assert.equal(mapJudge0Status(4), "wrong_answer");
  assert.equal(mapJudge0Status(5), "time_limit");
  assert.equal(mapJudge0Status(6), "compile_error");
  assert.equal(mapJudge0Status(11), "runtime_error");
  assert.equal(mapJudge0Status(1), "sandbox_error");
  assert.equal(mapJudge0Status(99), "sandbox_error");
});

test("all tests passing quickly scores high without being a perfect 100", () => {
  const outcomes: TestOutcome[] = TESTS.map((testCase) => ({
    name: testCase.name,
    category: testCase.category,
    passed: true,
    hidden: testCase.hidden,
  }));

  const grade = scoreOutcomes(outcomes, 3_000, 60);

  assert.equal(grade.passedAll, true);
  assert.equal(grade.correctness, 1);
  assert.equal(grade.efficiencyTier, 4);
  // 75 correctness + 15 efficiency + ~9.5 time.
  assert.ok(grade.score >= 95 && grade.score <= 100);
});

test("a partial pass is scored on correctness, not rounded up to a pass", () => {
  const outcomes: TestOutcome[] = TESTS.map((testCase, index) => ({
    name: testCase.name,
    category: testCase.category,
    passed: index !== 1,
    hidden: testCase.hidden,
  }));

  const grade = scoreOutcomes(outcomes, 20_000, 60);

  assert.equal(grade.passedAll, false);
  assert.equal(grade.correctness, 2 / 3);
  assert.deepEqual(grade.failures, [{ name: "large", category: "large input" }]);
});

test("using the whole allowance costs the efficiency tier", () => {
  const outcomes: TestOutcome[] = TESTS.map((testCase) => ({
    name: testCase.name,
    category: testCase.category,
    passed: true,
    hidden: testCase.hidden,
  }));

  const grade = scoreOutcomes(outcomes, 58_000, 60);
  assert.equal(grade.efficiencyTier, 1);
});

test("no tests is not a pass", () => {
  const grade = scoreOutcomes([], 0, 60);
  assert.equal(grade.passedAll, false);
  assert.equal(grade.score, 0);
});

test("feedback names categories and never hidden inputs or expected output", () => {
  const outcomes: TestOutcome[] = TESTS.map((testCase, index) => ({
    name: testCase.name,
    category: testCase.category,
    passed: index === 2,
    hidden: testCase.hidden,
    ...(testCase.hidden ? {} : { expected: "6", actual: "5" }),
  }));

  const grade = scoreOutcomes(outcomes, 10_000, 60);
  const lines = sandboxFeedback(grade).join("\n");

  assert.match(lines, /1 of 3 tests passed/);
  assert.match(lines, /Failing category: empty input/);
  assert.match(lines, /Failing category: large input/);
  assert.ok(!lines.includes("45"), "hidden expected output must not leak");
});
