import type { TestCase } from "./challenge-model.ts";

/**
 * The parts of sandbox grading that can be reasoned about without a sandbox:
 * payload shape, status mapping and the score arithmetic. `judge0.ts` adds the
 * network, and this split is what lets the arithmetic be tested on a machine
 * with no Judge0 instance.
 */

/** Judge0 CE language ids. Anything not here is refused rather than guessed. */
export const LANGUAGE_IDS: Record<string, number> = {
  javascript: 63,
  typescript: 74,
  python: 71,
  sql: 82,
};

export type SandboxStatus =
  | "accepted"
  | "wrong_answer"
  | "time_limit"
  | "compile_error"
  | "runtime_error"
  | "sandbox_error";

export type TestOutcome = {
  name: string;
  category: string;
  passed: boolean;
  hidden: boolean;
  expected?: string;
  actual?: string;
  timeMs?: number;
};

export type SandboxGrade = {
  passedAll: boolean;
  correctness: number;
  efficiencyTier: 1 | 2 | 3 | 4;
  score: number;
  failures: Array<{ name: string; category: string }>;
  outcomes: TestOutcome[];
  totalTimeMs: number;
};

export function buildSubmissions(
  language: string,
  source: string,
  tests: TestCase[]
): Array<{ language_id: number; source_code: string; stdin: string; expected_output: string }> {
  const languageId = LANGUAGE_IDS[language];
  if (!languageId) throw new Error(`unsupported_language:${language}`);

  return tests.map((test) => ({
    language_id: languageId,
    source_code: source,
    stdin: test.stdin,
    expected_output: test.expectedStdout,
  }));
}

export function mapJudge0Status(id: number): SandboxStatus {
  switch (id) {
    case 3:
      return "accepted";
    case 4:
      return "wrong_answer";
    case 5:
      return "time_limit";
    case 6:
      return "compile_error";
    case 7:
    case 8:
    case 9:
    case 10:
    case 11:
    case 12:
      return "runtime_error";
    default:
      return "sandbox_error";
  }
}

/**
 * 75% correctness, 15% efficiency, 10% time. Not more granular on purpose: a
 * tenth of a point for a millisecond would imply precision the sandbox lacks.
 */
export function scoreOutcomes(
  outcomes: TestOutcome[],
  totalTimeMs: number,
  timeLimitSeconds: number
): SandboxGrade {
  const total = outcomes.length;

  // No tests is not a fast pass. Without this the time component below would
  // hand out 25 points for submitting nothing.
  if (total === 0) {
    return {
      passedAll: false,
      correctness: 0,
      efficiencyTier: 1,
      score: 0,
      failures: [],
      outcomes: [],
      totalTimeMs,
    };
  }

  const passed = outcomes.filter((outcome) => outcome.passed).length;
  const correctness = passed / total;

  const seconds = totalTimeMs / 1000;
  const ratio = timeLimitSeconds > 0 ? seconds / timeLimitSeconds : 1;
  const efficiencyTier: 1 | 2 | 3 | 4 = ratio <= 0.25 ? 4 : ratio <= 0.5 ? 3 : ratio <= 0.75 ? 2 : 1;

  const efficiency = efficiencyTier / 4;
  const timeScore = Math.max(0, Math.min(1, 1 - ratio));
  const score = Math.round(correctness * 75 + efficiency * 15 + timeScore * 10);

  return {
    passedAll: total > 0 && passed === total,
    correctness,
    efficiencyTier,
    score,
    failures: outcomes
      .filter((outcome) => !outcome.passed)
      .map((outcome) => ({ name: outcome.name, category: outcome.category })),
    outcomes,
    totalTimeMs,
  };
}

/** Feedback names categories, never hidden inputs or expected output. */
export function sandboxFeedback(grade: SandboxGrade): string[] {
  if (grade.passedAll) return ["Every test passed, including the hidden ones."];

  const categories = Array.from(new Set(grade.failures.map((failure) => failure.category)));
  return [
    `${grade.outcomes.filter((outcome) => outcome.passed).length} of ${grade.outcomes.length} tests passed.`,
    ...categories.map((category) => `Failing category: ${category}.`),
  ];
}
