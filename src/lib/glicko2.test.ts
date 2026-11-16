import test from "node:test";
import assert from "node:assert/strict";

import {
  INITIAL_RATING,
  describeRating,
  expectedScore,
  formatRating,
  rateAttempt,
  rebuildRating,
} from "./glicko2.ts";

const NEW = INITIAL_RATING;
const CHALLENGE = { rating: 1500, deviation: 100 };

test("a new player and an even challenge score 50%", () => {
  assert.ok(Math.abs(expectedScore(NEW, CHALLENGE) - 0.5) < 0.01);
});

test("a higher-rated player is expected to score more", () => {
  const strong = { ...NEW, rating: 1800 };
  assert.ok(expectedScore(strong, CHALLENGE) > 0.7);
  assert.ok(expectedScore({ ...NEW, rating: 1200 }, CHALLENGE) < 0.3);
});

test("a win raises the rating and narrows the deviation", () => {
  const next = rateAttempt(NEW, CHALLENGE, 0.9);

  assert.ok(next.rating > NEW.rating);
  assert.ok(next.deviation < NEW.deviation);
  assert.ok(Number.isFinite(next.volatility));
});

test("a poor result lowers the rating but still reduces uncertainty", () => {
  const next = rateAttempt(NEW, CHALLENGE, 0.2);

  assert.ok(next.rating < NEW.rating);
  assert.ok(next.deviation < NEW.deviation);
});

test("deviation never collapses past the floor or inflates past the ceiling", () => {
  let state = NEW;
  for (let index = 0; index < 40; index += 1) {
    state = rateAttempt(state, CHALLENGE, 0.8);
  }
  assert.ok(state.deviation >= 30);
  assert.ok(state.deviation <= 350);
});

test("the interval is part of the rating string", () => {
  assert.equal(formatRating({ rating: 1420.4, deviation: 80.2, volatility: 0.06 }), "1420 ± 80");
});

test("plain words match how much is actually known", () => {
  assert.match(describeRating({ ...NEW, deviation: 300 }), /Too few attempts/);
  assert.match(describeRating({ ...NEW, deviation: 150 }), /Provisional/);
  assert.match(describeRating({ ...NEW, deviation: 60 }), /Established/);
});

test("rebuilding from history is order-independent after sorting", () => {
  const attempts = [
    { score: 80, challengeRating: 1500, challengeDeviation: 100, at: "2026-11-03" },
    { score: 70, challengeRating: 1520, challengeDeviation: 100, at: "2026-11-01" },
    { score: null, challengeRating: 1500, challengeDeviation: 100, at: "2026-11-02" },
  ];

  const forward = rebuildRating(attempts);
  const shuffled = rebuildRating([attempts[2], attempts[0], attempts[1]]);

  assert.equal(Math.round(forward.rating), Math.round(shuffled.rating));
  assert.equal(Math.round(forward.deviation), Math.round(shuffled.deviation));
});

test("an unscored attempt does not move a rating", () => {
  const rebuilt = rebuildRating([
    { score: null, challengeRating: 1900, challengeDeviation: 100, at: "2026-11-01" },
  ]);

  assert.equal(rebuilt.rating, INITIAL_RATING.rating);
  assert.equal(rebuilt.deviation, INITIAL_RATING.deviation);
});
