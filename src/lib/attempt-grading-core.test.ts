import test from "node:test";
import assert from "node:assert/strict";

import type { Challenge } from "./challenge-model.ts";
import { gradeAttempt, resolveGradingPlan, type GradingDeps } from "./attempt-grading-core.ts";
import type { SandboxGrade } from "./sandbox-core.ts";

const ANSWER = "The slice end drops the last item, so the page loses one record. Slice to start + size instead.";

const CODING: Challenge = {
  slug: "coding-chunk-array",
  track: "coding",
  format: "code",
  title: "Chunk a list",
  prompt: "Read two lines and print the chunks.",
  constraints: [],
  timeLimitSeconds: 900,
  estimatedMinutes: 8,
  subSkills: ["arrays"],
  initialRating: 1400,
  version: 1,
  status: "draft",
  language: "javascript",
  reference: { kind: "solution", body: "console.log('[]')" },
  tests: [
    { category: "example", name: "example", stdin: "", expectedStdout: "[]", hidden: false },
    { category: "edge", name: "edge", stdin: "", expectedStdout: "[]", hidden: true },
  ],
  rubric: { minWords: 20, dimensions: [] },
};

const WRITING: Challenge = {
  ...CODING,
  slug: "writing-status-update",
  track: "writing",
  format: "rewrite",
  language: undefined,
  tests: [],
  reference: { kind: "answer", body: "A reference answer that is long enough." },
  rubric: {
    minWords: 30,
    dimensions: [
      { id: "concision", label: "Concision", description: "Every word carries information here.", weight: 1, maxScore: 4 },
      { id: "fidelity", label: "Fidelity", description: "Every original fact survives intact.", weight: 2, maxScore: 4 },
      { id: "next-step", label: "Next step", description: "A specific action follows the update.", weight: 1, maxScore: 4 },
    ],
  },
};

const SANDBOX_GRADE: SandboxGrade = {
  passedAll: false,
  correctness: 0.5,
  efficiencyTier: 3,
  score: 62,
  failures: [{ name: "edge", category: "edge" }],
  outcomes: [
    { name: "example", category: "example", passed: true, hidden: false },
    { name: "edge", category: "edge", passed: false, hidden: true },
  ],
  totalTimeMs: 1_200,
};

test("a configured sandbox grades a code challenge", async () => {
  const plan = resolveGradingPlan({ format: "code", sandboxConfigured: true, llmConfigured: false });
  assert.deepEqual(plan, { grader: "sandbox", reason: "format_sandbox" });

  let called = false;
  const deps: GradingDeps = {
    sandboxConfigured: true,
    llmConfigured: false,
    sandbox: async () => {
      called = true;
      return SANDBOX_GRADE;
    },
  };

  const result = await gradeAttempt({ challenge: CODING, answer: "console.log([])", elapsedSeconds: 120, deps });

  assert.equal(called, true);
  assert.equal(result.grader, "sandbox");
  assert.equal(result.status, "graded");
  assert.equal(result.score, 62);
  assert.deepEqual(result.flags, ["tests_failed"]);
  assert.ok(result.feedback.some((line) => line.includes("Failing category: edge")));
});

test("a code challenge without a sandbox falls back to rubric-v1 and says why", async () => {
  const plan = resolveGradingPlan({ format: "code", sandboxConfigured: false, llmConfigured: true });
  assert.deepEqual(plan, { grader: "rubric-v1", reason: "sandbox_not_configured" });

  const result = await gradeAttempt({
    challenge: CODING,
    answer: ANSWER,
    elapsedSeconds: 120,
    deps: { sandboxConfigured: false, llmConfigured: true },
  });

  assert.equal(result.grader, "rubric-v1");
  assert.equal(result.status, "graded");
  assert.equal(typeof result.score, "number");
  assert.ok(result.flags.includes("fallback:sandbox_not_configured"));
});

test("a configured rubric grader handles a writing challenge", async () => {
  const plan = resolveGradingPlan({ format: "rewrite", sandboxConfigured: false, llmConfigured: true });
  assert.deepEqual(plan, { grader: "llm", reason: "format_rubric" });

  const deps: GradingDeps = {
    sandboxConfigured: false,
    llmConfigured: true,
    rubric: async () => ({
      score: 78,
      samples: 2,
      model: "test",
      graderVersion: "grader-v1",
      rubricVersion: "rubric-v1",
      flags: [],
      dimensions: [
        { id: "concision", label: "Concision", score: 3, maxScore: 4, evidence: "the slice end", evidenceVerified: true },
      ],
    }),
  };

  const result = await gradeAttempt({ challenge: WRITING, answer: ANSWER, elapsedSeconds: 300, deps });

  assert.equal(result.grader, "llm");
  assert.equal(result.status, "graded");
  assert.equal(result.score, 78);
  assert.equal(result.dimensions[0].evidence, "the slice end");
});

test("a writing challenge without the model key falls back, carrying the reason", async () => {
  const result = await gradeAttempt({
    challenge: WRITING,
    answer: ANSWER,
    elapsedSeconds: 300,
    deps: { sandboxConfigured: true, llmConfigured: false },
  });

  assert.equal(result.grader, "rubric-v1");
  assert.ok(result.flags.includes("fallback:grader_not_configured"));
});

test("a sandbox failure leaves the attempt pending rather than scoring it twice", async () => {
  const result = await gradeAttempt({
    challenge: CODING,
    answer: "console.log([])",
    elapsedSeconds: 60,
    deps: {
      sandboxConfigured: true,
      llmConfigured: false,
      sandbox: async () => {
        throw new Error("judge0_timeout");
      },
    },
  });

  assert.equal(result.status, "pending");
  assert.equal(result.score, null);
  assert.ok(result.flags.includes("grading_pending:sandbox_unavailable"));
  assert.equal(result.raw, null);
});

test("a grader that cannot parse its own output leaves the attempt pending", async () => {
  const result = await gradeAttempt({
    challenge: WRITING,
    answer: ANSWER,
    elapsedSeconds: 60,
    deps: {
      sandboxConfigured: false,
      llmConfigured: true,
      rubric: async () => ({ error: "grader_unavailable" }),
    },
  });

  assert.equal(result.status, "pending");
  assert.equal(result.score, null);
});

test("a sandbox format with no tests falls back rather than calling the sandbox", async () => {
  let called = false;
  const result = await gradeAttempt({
    challenge: { ...CODING, tests: [] },
    answer: ANSWER,
    elapsedSeconds: 60,
    deps: {
      sandboxConfigured: true,
      llmConfigured: false,
      sandbox: async () => {
        called = true;
        return SANDBOX_GRADE;
      },
    },
  });

  assert.equal(called, false);
  assert.equal(result.grader, "rubric-v1");
  assert.ok(result.flags.includes("fallback:challenge_incomplete"));
});

test("an unknown format never reaches a grader it cannot use", () => {
  assert.deepEqual(
    resolveGradingPlan({ format: null, sandboxConfigured: true, llmConfigured: true }),
    { grader: "rubric-v1", reason: "unknown_format" }
  );
  assert.deepEqual(
    resolveGradingPlan({ format: "essay", sandboxConfigured: true, llmConfigured: true }),
    { grader: "rubric-v1", reason: "unknown_format" }
  );
});

test("the plan prefers the grader that matches the format, not the one configured", () => {
  const both = { sandboxConfigured: true, llmConfigured: true };
  assert.equal(resolveGradingPlan({ format: "predict-the-output", ...both }).grader, "sandbox");
  assert.equal(resolveGradingPlan({ format: "short-answer", ...both }).grader, "llm");
});
