import test from "node:test";
import assert from "node:assert/strict";

import {
  consistencyLabel,
  hasHumanReview,
  lastActivityAt,
  recencyLabel,
  sortCandidates,
  strongestSignal,
  summariseCandidate,
  totalDays30,
  type Candidate,
  type SkillSignal,
} from "./recruiter.ts";

const DAY = 24 * 60 * 60 * 1000;
const NOW = Date.UTC(2026, 10, 15, 12, 0, 0);
const daysAgo = (days: number) => new Date(NOW - days * DAY).toISOString();

function signal(partial: Partial<SkillSignal> & { category: string }): SkillSignal {
  return {
    total_attempts: 10,
    attempts_30d: 5,
    days_30d: 4,
    avg_score_30d: 70,
    avg_score_90d: 72,
    best_score: 88,
    strong_days_90d: 6,
    last_attempt_at: daysAgo(1),
    ...partial,
  };
}

function candidate(overrides: Partial<Candidate> = {}): Candidate {
  return {
    id: "c-1",
    display_name: "Asha",
    headline: null,
    bio: null,
    skills: ["typescript"],
    visibility: "recruiters_only",
    current_streak: 3,
    longest_streak: 12,
    total_practice_days: 20,
    last_practice_date: daysAgo(1).slice(0, 10),
    signals: [signal({ category: "engineering" })],
    ...overrides,
  };
}

test("recency is described in words, not raw timestamps", () => {
  assert.equal(recencyLabel(daysAgo(0), NOW), "Practised today");
  assert.equal(recencyLabel(daysAgo(1), NOW), "Practised yesterday");
  assert.equal(recencyLabel(daysAgo(4), NOW), "Practised 4 days ago");
  assert.equal(recencyLabel(daysAgo(9), NOW), "Practised last week");
  assert.equal(recencyLabel(daysAgo(30), NOW), "Practised 4 weeks ago");
  assert.equal(recencyLabel(daysAgo(80), NOW), "No practice in over a month");
  assert.equal(recencyLabel(null, NOW), "No recorded practice");
});

test("an unparseable timestamp is not reported as recent", () => {
  assert.equal(recencyLabel("not-a-date", NOW), "No recorded practice");
});

test("consistency thresholds reflect how much practice is behind the claim", () => {
  assert.equal(consistencyLabel(20).tone, "strong");
  assert.equal(consistencyLabel(9).tone, "steady");
  assert.equal(consistencyLabel(1).tone, "thin");
  assert.equal(consistencyLabel(0).tone, "none");
  assert.match(consistencyLabel(1).label, /1 day in the last 30/);
});

test("strongest skill is chosen by 90-day average, ignoring unscored skills", () => {
  const strongest = strongestSignal([
    signal({ category: "writing", avg_score_90d: 61 }),
    signal({ category: "engineering", avg_score_90d: 84 }),
    signal({ category: "analysis", avg_score_90d: null }),
  ]);

  assert.equal(strongest?.category, "engineering");
  assert.equal(strongestSignal([]), null);
});

test("activity days and last activity are aggregated across skills", () => {
  const signals = [
    signal({ category: "engineering", days_30d: 5, last_attempt_at: daysAgo(9) }),
    signal({ category: "writing", days_30d: 2, last_attempt_at: daysAgo(1) }),
  ];

  assert.equal(totalDays30(signals), 7);
  assert.equal(lastActivityAt(signals), daysAgo(1));
  assert.equal(lastActivityAt([signal({ category: "writing", last_attempt_at: null })]), null);
});

test("a candidate with no signals is described honestly", () => {
  const summary = summariseCandidate(candidate({ signals: [] }), NOW);

  assert.equal(summary.consistency.tone, "none");
  assert.equal(summary.strongestCategory, null);
  assert.equal(summary.activity, "No recorded practice");
});

test("an unnamed candidate falls back to a neutral label, never a blank", () => {
  assert.equal(summariseCandidate(candidate({ display_name: null }), NOW).name, "Forge practitioner");
});

test("ranking puts current practice above an old long streak", () => {
  const active = candidate({
    id: "active",
    current_streak: 2,
    total_practice_days: 6,
    signals: [signal({ category: "engineering", days_30d: 9, last_attempt_at: daysAgo(1) })],
  });
  const stale = candidate({
    id: "stale",
    current_streak: 60,
    total_practice_days: 120,
    signals: [signal({ category: "engineering", days_30d: 0, last_attempt_at: daysAgo(90) })],
  });

  assert.deepEqual(
    sortCandidates([stale, active], NOW).map((entry) => entry.id),
    ["active", "stale"]
  );
});

test("ranking does not mutate its input", () => {
  const list = [candidate({ id: "a" }), candidate({ id: "b", current_streak: 99 })];
  const before = list.map((entry) => entry.id);
  sortCandidates(list, NOW);
  assert.deepEqual(list.map((entry) => entry.id), before);
});

test("a badge is only claimed when a human review exists", () => {
  assert.equal(hasHumanReview(0), false);
  assert.equal(hasHumanReview(null), false);
  assert.equal(hasHumanReview(undefined), false);
  assert.equal(hasHumanReview(1), true);
});
