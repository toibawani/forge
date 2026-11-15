import test from "node:test";
import assert from "node:assert/strict";

import {
  LEVELS,
  consistencyTrend,
  distinctDays,
  levelsByCategory,
  nextMilestone,
  progressFor,
  recentAverage,
  scoreTrend,
  targetDifficulty,
  type ScoredAttempt,
} from "./progression.ts";

const DAY = 24 * 60 * 60 * 1000;

/** `days` attempts, one per day, newest first, all with the same score. */
function series(days: number, score: number | null, category: string | null = "engineering"): ScoredAttempt[] {
  const now = Date.now();
  return Array.from({ length: days }, (_, index) => ({
    score,
    practice_date: new Date(now - index * DAY).toISOString().slice(0, 10),
    created_at: new Date(now - index * DAY).toISOString(),
    category,
  }));
}

test("no attempts is Foundations, not a free level", () => {
  const progress = progressFor([]);
  assert.equal(progress.level.name, "Foundations");
  assert.equal(progress.percent, 0);
  assert.equal(progress.average, null);
  assert.match(progress.requirement, /3 more practice days/);
});

test("level requires both days and quality", () => {
  // Plenty of days, poor scores: stays at Foundations.
  const manyBadDays = progressFor(series(20, 40));
  assert.equal(manyBadDays.level.name, "Foundations");

  // Plenty of quality, two days: still not a record.
  const twoGoodDays = progressFor(series(2, 95));
  assert.equal(twoGoodDays.level.name, "Foundations");

  // Both requirements met.
  const earned = progressFor(series(9, 70));
  assert.equal(earned.level.name, "Consistent");
  assert.equal(earned.next?.name, "Proficient");
  assert.equal(earned.missingDays, 7);
  assert.equal(earned.missingAverage, 5);
});

test("only the ten most recent attempts set the average, so coasting decays it", () => {
  const oldHighs = Array.from({ length: 10 }, (_, index) => ({
    score: 95,
    practice_date: new Date(Date.now() - (index + 20) * DAY).toISOString().slice(0, 10),
    created_at: new Date(Date.now() - (index + 20) * DAY).toISOString(),
    category: "engineering",
  }));
  const recentLows = series(10, 40);

  const coasting = [...recentLows, ...oldHighs];
  assert.equal(recentAverage(coasting), 40);
});

test("unscored attempts never enter the average", () => {
  const mixed = [...series(4, 80), ...series(4, null)];
  assert.equal(recentAverage(mixed), 80);
});

test("distinct days collapse multiple attempts on the same day", () => {
  const attempts = [
    ...series(1, 70),
    ...series(1, 90),
    ...series(1, 60),
  ];
  assert.equal(distinctDays(attempts), 1);
});

test("top level is terminal and says so", () => {
  const proven = progressFor(series(30, 85));
  assert.equal(proven.level.name, "Proven");
  assert.equal(proven.next, null);
  assert.equal(proven.percent, 100);
  assert.match(proven.requirement, /top level/i);
});

test("level thresholds are ordered and start at zero", () => {
  assert.equal(LEVELS[0].index, 0);
  assert.equal(LEVELS[0].minDays, 0);
  for (let index = 1; index < LEVELS.length; index += 1) {
    assert.ok(LEVELS[index].minDays > LEVELS[index - 1].minDays);
    assert.ok(LEVELS[index].minAverage >= LEVELS[index - 1].minAverage);
  }
});

test("levels are tracked per skill, separately", () => {
  const attempts = [...series(9, 70, "engineering"), ...series(1, 40, "writing")];
  const levels = levelsByCategory(attempts);

  assert.equal(levels.get("engineering")?.level.name, "Consistent");
  assert.equal(levels.get("writing")?.level.name, "Foundations");
});

test("score trend compares the newest window to the one before it", () => {
  const attempts = [
    ...series(5, 80),
    ...series(5, 60).map((attempt) => ({
      ...attempt,
      created_at: new Date(new Date(attempt.created_at).getTime() - 10 * DAY).toISOString(),
    })),
  ];

  const trend = scoreTrend(attempts, 5);
  assert.equal(trend.recent, 80);
  assert.equal(trend.previous, 60);
  assert.equal(trend.delta, 20);
});

test("consistency counts days in the trailing window", () => {
  const trend = consistencyTrend(series(4, 70), 7);
  assert.equal(trend.thisWindow, 4);
  assert.equal(trend.previousWindow, 0);
  assert.equal(trend.delta, 4);
});

test("difficulty ramps with level and never regresses", () => {
  const mapping = [0, 1, 2, 3, 4].map(targetDifficulty);
  assert.deepEqual(mapping, ["beginner", "beginner", "intermediate", "advanced", "advanced"]);
});

test("milestones advance and stop", () => {
  assert.equal(nextMilestone(0), 3);
  assert.equal(nextMilestone(3), 7);
  assert.equal(nextMilestone(365), null);
});
