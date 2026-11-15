import test from "node:test";
import assert from "node:assert/strict";

import { levelIndexFor, recommendNext, type Challenge, type SelectionAttempt } from "./challenges.ts";
import { progressFor, type ScoredAttempt } from "./progression.ts";

const DAY = 24 * 60 * 60 * 1000;

function make(id: string, category: string, difficulty: Challenge["difficulty"]): Challenge {
  return {
    id,
    slug: id,
    title: `Challenge ${id}`,
    description: "",
    difficulty,
    category,
    estimated_minutes: 10,
    time_limit_seconds: null,
    content: {} as Challenge["content"],
    rubric: {} as Challenge["rubric"],
  } as Challenge;
}

function attempt(
  challengeId: string,
  category: string,
  score: number | null,
  daysAgo: number
): SelectionAttempt & ScoredAttempt {
  const at = new Date(Date.now() - daysAgo * DAY).toISOString();
  return {
    challenge_id: challengeId,
    category,
    score,
    practice_date: at.slice(0, 10),
    created_at: at,
  };
}

test("no catalogue means no recommendation", () => {
  assert.equal(recommendNext({ challenges: [], attempts: [] }), null);
});

test("first session explains that it sets a baseline", () => {
  const result = recommendNext({
    challenges: [make("eng-1", "engineering", "beginner")],
    attempts: [],
  });

  assert.ok(result);
  assert.match(result.reason, /Begin with/i);
  assert.match(result.reason, /baseline/i);
});

test("two sessions in one skill rotate to another skill", () => {
  const challenges = [
    make("eng-1", "engineering", "beginner"),
    make("wri-1", "writing", "beginner"),
  ];
  const attempts = [attempt("eng-1", "engineering", 80, 1), attempt("eng-1", "engineering", 82, 2)];

  const result = recommendNext({ challenges, attempts });
  assert.ok(result);
  assert.equal(result.challenge.category, "writing");
  assert.match(result.reason, /last two sessions/i);
});

test("a weak area outranks the preferred skill", () => {
  const challenges = [
    make("eng-1", "engineering", "beginner"),
    make("wri-1", "writing", "beginner"),
  ];
  // Alternating skills, so the rotation rule does not fire and the weak-area
  // rule is the one under test.
  const attempts = [
    attempt("eng-1", "engineering", 90, 1),
    attempt("wri-1", "writing", 40, 2),
    attempt("eng-1", "engineering", 90, 3),
    attempt("wri-1", "writing", 45, 4),
  ];

  const result = recommendNext({ challenges, attempts });
  assert.ok(result);
  assert.equal(result.challenge.category, "writing");
  assert.match(result.reason, /weakest area/i);
});

test("difficulty follows the level earned in that skill", () => {
  const challenges = [
    make("eng-easy", "engineering", "beginner"),
    make("eng-hard", "engineering", "advanced"),
  ];
  const attempts = [
    attempt("eng-easy", "engineering", 60, 1),
    attempt("eng-easy", "engineering", 60, 2),
    attempt("eng-easy", "engineering", 60, 3),
  ];

  const result = recommendNext({ challenges, attempts });
  assert.ok(result);
  assert.equal(result.challenge.id, "eng-easy");
});

test("a challenge attempted in the last week is skipped when there is an alternative", () => {
  const challenges = [
    make("eng-a", "engineering", "beginner"),
    make("eng-b", "engineering", "beginner"),
  ];
  const attempts = [attempt("eng-a", "engineering", 70, 1)];

  const result = recommendNext({ challenges, attempts, now: Date.now() });
  assert.ok(result);
  assert.equal(result.challenge.id, "eng-b");
});

test("recommendation is deterministic for a fixed clock", () => {
  const challenges = [
    make("eng-a", "engineering", "beginner"),
    make("wri-a", "writing", "beginner"),
  ];
  const attempts = [attempt("eng-a", "engineering", 70, 1)];
  const now = Date.now();

  assert.deepEqual(
    recommendNext({ challenges, attempts, now }),
    recommendNext({ challenges, attempts, now })
  );
});

test("selection and progression agree on what level a record earns", () => {
  for (const days of [0, 3, 8, 16, 30]) {
    for (const score of [0, 40, 55, 65, 75, 82, 95]) {
      const attempts = Array.from({ length: days }, (_, index) =>
        attempt("c-1", "engineering", score, index)
      );

      assert.equal(
        levelIndexFor(attempts),
        progressFor(attempts).level.index,
        `disagreement at ${days} days / average ${score}`
      );
    }
  }
});
