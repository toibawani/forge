import type { Challenge } from "./challenge-model.ts";
import type { RubricGrade } from "./grader/grade-core.ts";
import { scoreSubmission, type Rubric, type ScoreBreakdown } from "./scoring.ts";
import type { SandboxGrade } from "./sandbox-core.ts";
import { RUBRIC_FORMATS } from "./tracks.ts";

/**
 * Which grader runs for an attempt, and what happens when it cannot.
 *
 * The rule is entirely about the challenge format and what is configured:
 *
 *   * a test-graded format needs a sandbox; without one the attempt falls back
 *     to the deterministic rubric, which is weak on code but never invents a
 *     pass;
 *   * a rubric format needs the model; without a key it falls back the same way;
 *   * a grader that is configured but fails mid-run records the attempt as
 *     `pending` with no score. It does not quietly substitute a different
 *     grader, because a score that silently changed meaning is worse than a
 *     score that is late.
 *
 * This module is pure and dependency-injected so the whole matrix can be tested
 * without Judge0, an API key or a database.
 */

export type GraderKind = "sandbox" | "llm" | "rubric-v1";

export type GradingPlan = {
  grader: GraderKind;
  /** Shown in logs and stored with the attempt, so a score's origin is legible. */
  reason: "format_sandbox" | "format_rubric" | "sandbox_not_configured" | "grader_not_configured" | "unknown_format";
};

export function resolveGradingPlan(input: {
  format: string | null | undefined;
  sandboxConfigured: boolean;
  llmConfigured: boolean;
}): GradingPlan {
  const format = input.format ?? "";

  if (!format) return { grader: "rubric-v1", reason: "unknown_format" };

  if (RUBRIC_FORMATS.includes(format as never)) {
    return input.llmConfigured
      ? { grader: "llm", reason: "format_rubric" }
      : { grader: "rubric-v1", reason: "grader_not_configured" };
  }

  const sandboxFormat = ["code", "spot-the-bug", "predict-the-output", "fix-the-query"].includes(format);
  if (!sandboxFormat) return { grader: "rubric-v1", reason: "unknown_format" };

  return input.sandboxConfigured
    ? { grader: "sandbox", reason: "format_sandbox" }
    : { grader: "rubric-v1", reason: "sandbox_not_configured" };
}

export type DimensionResult = {
  id: string;
  label?: string;
  score: number;
  maxScore?: number;
  evidence?: string;
};

export type AttemptGrading = {
  grader: GraderKind;
  status: "graded" | "pending";
  /** Null when the grader was configured but unavailable: no invented zero. */
  score: number | null;
  feedback: string[];
  flags: string[];
  dimensions: DimensionResult[];
  plan: GradingPlan;
  /** Raw grader output, stored with the attempt for later re-grading. */
  raw: ScoreBreakdown | SandboxGrade | RubricGrade | null;
};

export type GradingDeps = {
  sandboxConfigured: boolean;
  llmConfigured: boolean;
  sandbox?: (input: {
    language: string;
    source: string;
    tests: Challenge["tests"];
    timeLimitSeconds: number;
    elapsedSeconds: number;
  }) => Promise<SandboxGrade>;
  rubric?: (input: { challenge: Challenge; answer: string }) => Promise<RubricGrade | { error: string }>;
};

function fromSandbox(grade: SandboxGrade): Omit<AttemptGrading, "plan" | "grader" | "status"> {
  // Category-level results: the client already knows which categories exist.
  const byCategory = new Map<string, { passed: number; total: number }>();
  for (const outcome of grade.outcomes) {
    const entry = byCategory.get(outcome.category) ?? { passed: 0, total: 0 };
    byCategory.set(outcome.category, {
      passed: entry.passed + (outcome.passed ? 1 : 0),
      total: entry.total + 1,
    });
  }

  return {
    score: grade.score,
    feedback: [
      grade.passedAll
        ? "Every test passed, including the hidden ones."
        : `${grade.outcomes.filter((outcome) => outcome.passed).length} of ${grade.outcomes.length} tests passed.`,
      ...Array.from(new Set(grade.failures.map((failure) => failure.category))).map(
        (category) => `Failing category: ${category}.`
      ),
    ],
    flags: grade.passedAll ? [] : ["tests_failed"],
    dimensions: [...byCategory].map(([category, counts]) => ({
      id: category,
      label: category,
      score: counts.passed,
      maxScore: counts.total,
    })),
    raw: grade,
  };
}

function fromRubric(grade: RubricGrade): Omit<AttemptGrading, "plan" | "grader" | "status"> {
  return {
    score: grade.score,
    feedback: grade.dimensions.map(
      (dimension) =>
        `${dimension.label}: ${dimension.score}/${dimension.maxScore}${dimension.evidence ? ` — "${dimension.evidence}"` : ""}`
    ),
    flags: grade.flags,
    dimensions: grade.dimensions.map((dimension) => ({
      id: dimension.id,
      label: dimension.label,
      score: dimension.score,
      maxScore: dimension.maxScore,
      evidence: dimension.evidence,
    })),
    raw: grade,
  };
}

function pending(plan: GradingPlan, reason: string): AttemptGrading {
  return {
    grader: plan.grader,
    status: "pending",
    score: null,
    feedback: [
      "Your answer was saved, but it could not be scored yet. No score is shown rather than a guess.",
    ],
    flags: [`grading_pending:${reason}`],
    dimensions: [],
    plan,
    raw: null,
  };
}

function fallback(
  challenge: Challenge,
  answer: string,
  plan: GradingPlan,
  reason: string
): AttemptGrading {
  const rubric = (challenge.rubric ?? null) as Rubric | null;
  const breakdown = scoreSubmission(answer, rubric, challenge.track || "general");

  return {
    grader: "rubric-v1",
    status: "graded",
    score: breakdown.score,
    feedback: breakdown.notes.length > 0 ? breakdown.notes : ["Recorded and scored against the published rubric."],
    flags: [`fallback:${reason}`],
    dimensions: [
      { id: "completeness", label: "Completeness", score: breakdown.signals.completeness, maxScore: 100 },
      { id: "structure", label: "Structure", score: breakdown.signals.structure, maxScore: 100 },
      { id: "specificity", label: "Specificity", score: breakdown.signals.specificity, maxScore: 100 },
    ],
    plan,
    raw: breakdown,
  };
}

export async function gradeAttempt(input: {
  challenge: Challenge;
  answer: string;
  elapsedSeconds: number;
  deps: GradingDeps;
}): Promise<AttemptGrading> {
  const { challenge, answer, elapsedSeconds, deps } = input;
  const legacyRubric = (challenge.rubric ?? null) as Rubric | null;

  const plan = resolveGradingPlan({
    format: challenge.format,
    sandboxConfigured: deps.sandboxConfigured,
    llmConfigured: deps.llmConfigured,
  });

  if (plan.grader === "rubric-v1") {
    return fallback(challenge, answer, plan, plan.reason);
  }

  if (plan.grader === "sandbox") {
    if (!deps.sandbox || !challenge.language || challenge.tests.length === 0) {
      return fallback(challenge, answer, plan, "challenge_incomplete");
    }

    try {
      const grade = await deps.sandbox({
        language: challenge.language,
        source: answer,
        tests: challenge.tests,
        timeLimitSeconds: challenge.timeLimitSeconds,
        elapsedSeconds,
      });
      return { ...fromSandbox(grade), grader: "sandbox", status: "graded", plan };
    } catch {
      return pending(plan, "sandbox_unavailable");
    }
  }

  if (!deps.rubric || !legacyRubric) {
    return fallback(challenge, answer, plan, "challenge_incomplete");
  }

  try {
    const grade = await deps.rubric({ challenge, answer });
    if ("error" in grade) return pending(plan, grade.error);
    return { ...fromRubric(grade), grader: "llm", status: "graded", plan };
  } catch {
    return pending(plan, "grader_unavailable");
  }
}
