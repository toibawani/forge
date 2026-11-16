/**
 * Glicko-2, per user per track and per sub-skill.
 *
 * Chosen over Elo because a rating nobody has played enough to earn should say
 * so. Glicko carries a rating deviation, which is the honest answer to "how much
 * do we know": 1420 ± 300 is a guess, 1420 ± 60 is a measurement. The UI shows
 * the interval, not a bare number, and every rating is rebuildable from the
 * immutable attempt log.
 *
 * A challenge is treated as an opponent whose rating is its difficulty and whose
 * deviation reflects how well that difficulty is established. An attempt's
 * outcome is the normalised score (0-100 → 0-1), not a win or loss, so a 72 on a
 * hard challenge and a 72 on an easy one are not the same event.
 */

export type RatingState = {
  rating: number;
  /** Rating deviation on the Glicko-2 display scale (350 is "new"). */
  deviation: number;
  volatility: number;
};

export const INITIAL_RATING: RatingState = { rating: 1500, deviation: 350, volatility: 0.06 };

const SCALE = 173.7178;
const TAU = 0.5;
const EPSILON = 0.000001;
const MIN_DEVIATION = 30;
const MAX_DEVIATION = 350;

function toGlicko(state: RatingState): { mu: number; phi: number } {
  return { mu: (state.rating - 1500) / SCALE, phi: state.deviation / SCALE };
}

function fromGlicko(mu: number, phi: number, volatility: number): RatingState {
  return {
    rating: mu * SCALE + 1500,
    deviation: Math.min(MAX_DEVIATION, Math.max(MIN_DEVIATION, phi * SCALE)),
    volatility,
  };
}

/** Probability the player scores above the challenge, 0-1. */
export function expectedScore(player: RatingState, opponent: { rating: number; deviation: number }): number {
  const { mu } = toGlicko(player);
  const opponentMu = (opponent.rating - 1500) / SCALE;
  const opponentPhi = opponent.deviation / SCALE;
  const g = 1 / Math.sqrt(1 + (3 * opponentPhi * opponentPhi) / (Math.PI * Math.PI));
  return 1 / (1 + Math.exp(-g * (mu - opponentMu)));
}

/** `1420 ± 80` — the interval is part of the rating, not a footnote. */
export function formatRating(state: RatingState): string {
  return `${Math.round(state.rating)} ± ${Math.round(state.deviation)}`;
}

/**
 * One rated result. `outcome` is the normalised score, so 0.72 means the answer
 * covered 72% of the rubric rather than "won".
 */
export function rateAttempt(
  player: RatingState,
  challenge: { rating: number; deviation: number },
  outcome: number
): RatingState {
  const score = Math.min(1, Math.max(0, outcome));
  const { mu, phi } = toGlicko(player);
  const opponentMu = (challenge.rating - 1500) / SCALE;
  const opponentPhi = Math.min(MAX_DEVIATION, Math.max(MIN_DEVIATION, challenge.deviation)) / SCALE;

  const g = 1 / Math.sqrt(1 + (3 * opponentPhi * opponentPhi) / (Math.PI * Math.PI));
  const e = 1 / (1 + Math.exp(-g * (mu - opponentMu)));

  const variance = 1 / (g * g * e * (1 - e));
  const improvement = g * (score - e);

  // Volatility iteration (Illinois algorithm), exactly as specified by Glickman.
  const a = Math.log(player.volatility * player.volatility);
  const f = (x: number) => {
    const ex = Math.exp(x);
    const numerator = ex * (improvement * improvement - phi * phi - variance - ex);
    const denominator = 2 * (phi * phi + variance + ex) ** 2;
    return numerator / denominator - (x - a) / (TAU * TAU);
  };

  let A = a;
  let B: number;
  if (improvement * improvement > phi * phi + variance) {
    B = Math.log(improvement * improvement - phi * phi - variance);
  } else {
    let k = 1;
    while (f(a - k * TAU) < 0 && k < 100) k += 1;
    B = a - k * TAU;
  }

  let fA = f(A);
  let fB = f(B);
  for (let iteration = 0; iteration < 100 && Math.abs(B - A) > EPSILON; iteration += 1) {
    const C = A + ((A - B) * fA) / (fB - fA);
    const fC = f(C);

    if (fC * fB <= 0) {
      A = B;
      fA = fB;
    } else {
      fA /= 2;
    }

    B = C;
    fB = fC;
  }

  const volatility = Math.exp(A / 2);

  const phiStar = Math.sqrt(phi * phi + volatility * volatility);
  const newPhi = 1 / Math.sqrt(1 / (phiStar * phiStar) + 1 / variance);
  const newMu = mu + newPhi * newPhi * improvement;

  return fromGlicko(newMu, newPhi, volatility);
}

/** Plain words for what the number means, used next to the interval. */
export function describeRating(state: RatingState): string {
  if (state.deviation > 200) {
    return "Too few attempts to place this yet.";
  }
  if (state.deviation > 110) {
    return "Provisional — a few more attempts will narrow it.";
  }
  return "Established from a consistent record.";
}

/**
 * Rebuilds a track rating from the full attempt history. Ratings are never a
 * second source of truth: this function is the source, and the stored number is
 * a cache of it.
 */
export function rebuildRating(
  attempts: Array<{ score: number | null; challengeRating: number; challengeDeviation: number; at: string }>,
  initial: RatingState = INITIAL_RATING
): RatingState {
  return attempts
    .filter((attempt) => typeof attempt.score === "number")
    .sort((left, right) => left.at.localeCompare(right.at))
    .reduce(
      (state, attempt) =>
        rateAttempt(
          state,
          { rating: attempt.challengeRating, deviation: attempt.challengeDeviation },
          (attempt.score as number) / 100
        ),
      initial
    );
}
