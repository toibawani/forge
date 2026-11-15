import test from "node:test";
import assert from "node:assert/strict";

import { BENCHMARK_MIN_ATTEMPTS, benchmarkFor } from "./benchmark.ts";

test("no stats means no claim", () => {
  const result = benchmarkFor(80, null);
  assert.equal(result.available, false);
  assert.match(result.text, /no benchmark yet/i);
});

test("a small sample is suppressed, even with a median", () => {
  const result = benchmarkFor(90, { attempts: BENCHMARK_MIN_ATTEMPTS - 1, median_score: 60 });
  assert.equal(result.available, false);
  assert.equal(result.attempts, 4);
});

test("five attempts is enough to show the median", () => {
  const result = benchmarkFor(null, { attempts: BENCHMARK_MIN_ATTEMPTS, median_score: 71 });
  assert.equal(result.available, true);
  assert.match(result.text, /5 attempts so far · median 71/);
});

test("a score above the median is stated as a distance, not a grade", () => {
  const result = benchmarkFor(84, { attempts: 22, median_score: 71 });
  assert.equal(result.text, "22 attempts · median 71 · you are 13 points above the median");
});

test("a score at the median says so plainly", () => {
  const result = benchmarkFor(71, { attempts: 22, median_score: 71 });
  assert.match(result.text, /level with the median/);
});

test("the singular point case does not say '1 points'", () => {
  const result = benchmarkFor(70, { attempts: 9, median_score: 71 });
  assert.match(result.text, /1 point below the median$/);
});

test("a median of zero is a real value, not missing data", () => {
  const result = benchmarkFor(12, { attempts: 6, median_score: 0 });
  assert.equal(result.available, true);
  assert.match(result.text, /median 0/);
});

test("attempts present but median missing stays unavailable", () => {
  const result = benchmarkFor(80, { attempts: 40, median_score: null });
  assert.equal(result.available, false);
});
