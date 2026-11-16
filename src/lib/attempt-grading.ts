import "server-only";

import { gradeRubric } from "@/lib/grader/grade-core";
import { callAnthropic, graderModel } from "@/lib/grader/anthropic";
import { gradeInSandbox } from "@/lib/judge0";
import { gradeAttempt, type AttemptGrading, type GradingDeps } from "@/lib/attempt-grading-core";
import type { Challenge } from "@/lib/challenge-model";

/**
 * Production binding for the grading plan: real Judge0, real model, real env.
 * Kept separate from `attempt-grading-core.ts` so the decision logic stays
 * importable by tests and scripts.
 */
export function gradingDeps(): GradingDeps {
  return {
    sandboxConfigured: Boolean(process.env.JUDGE0_URL),
    llmConfigured: Boolean(process.env.ANTHROPIC_API_KEY),
    sandbox: (input) => gradeInSandbox(input),
    rubric: (input) =>
      gradeRubric({
        challenge: input.challenge,
        answer: input.answer,
        model: graderModel(),
        callModel: callAnthropic,
      }),
  };
}

export async function gradeAttemptWithDeps(input: {
  challenge: Challenge;
  answer: string;
  elapsedSeconds: number;
  deps?: GradingDeps;
}): Promise<AttemptGrading> {
  return gradeAttempt({
    challenge: input.challenge,
    answer: input.answer,
    elapsedSeconds: input.elapsedSeconds,
    deps: input.deps ?? gradingDeps(),
  });
}

export { resolveGradingPlan } from "@/lib/attempt-grading-core";
export type { AttemptGrading, GradingDeps, GradingPlan, GraderKind } from "@/lib/attempt-grading-core";
