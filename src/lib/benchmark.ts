/**
 * Challenge benchmarks.
 *
 * "How hard is this challenge really" is answerable from the attempts already
 * in the database, and it is more honest than a difficulty label someone typed.
 * Two rules keep it trustworthy:
 *
 *   1. Suppress small samples. Five attempts is enough to describe a
 *      distribution; three is a coincidence, and it can identify people.
 *   2. Compare, do not rank. The sentence says where a score sits relative to
 *      the median, not whether the person is good.
 */

export type ChallengeStats = {
  challenge_id?: string;
  attempts: number | null;
  practitioners?: number | null;
  mean_score?: number | null;
  median_score: number | null;
  p25?: number | null;
  p75?: number | null;
  mean_seconds?: number | null;
};

export const BENCHMARK_MIN_ATTEMPTS = 5;

export type Benchmark = {
  available: boolean;
  attempts: number;
  median: number | null;
  text: string;
};

export function benchmarkFor(
  score: number | null | undefined,
  stats: ChallengeStats | null | undefined
): Benchmark {
  const attempts = Number(stats?.attempts ?? 0);
  const median = typeof stats?.median_score === "number" ? stats.median_score : null;

  if (!stats || median === null || attempts < BENCHMARK_MIN_ATTEMPTS) {
    return {
      available: false,
      attempts,
      median,
      text: "No benchmark yet — too few attempts to compare fairly.",
    };
  }

  if (typeof score !== "number") {
    return {
      available: true,
      attempts,
      median,
      text: `${attempts} attempts so far · median ${median}`,
    };
  }

  const delta = score - median;
  const points = Math.abs(delta);
  const position =
    delta === 0
      ? "level with the median"
      : `${points} point${points === 1 ? "" : "s"} ${delta > 0 ? "above" : "below"} the median`;

  return {
    available: true,
    attempts,
    median,
    text: `${attempts} attempts · median ${median} · you are ${position}`,
  };
}
