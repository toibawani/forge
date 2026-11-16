import { z } from "zod";

import type { TestCase } from "./challenge-model.ts";
import {
  buildSubmissions,
  mapJudge0Status,
  scoreOutcomes,
  type SandboxGrade,
  type TestOutcome,
} from "./sandbox-core.ts";

/**
 * The network half of sandbox grading, without the `server-only` guard so CLI
 * scripts can run the same code path as the app. `judge0.ts` is the app-facing
 * wrapper and is the module that must never be imported by a client component.
 */

export type { SandboxGrade, SandboxStatus, TestOutcome } from "./sandbox-core.ts";

const POLL_ATTEMPTS = 20;
const POLL_INTERVAL_MS = 750;

const judge0SubmissionSchema = z.object({
  token: z.string(),
  status: z.object({ id: z.number(), description: z.string().optional() }),
  stdout: z.string().nullable().optional(),
  stderr: z.string().nullable().optional(),
  compile_output: z.string().nullable().optional(),
  time: z.string().nullable().optional(),
});

type Judge0Submission = z.infer<typeof judge0SubmissionSchema>;

async function postBatch(
  baseUrl: string,
  apiKey: string | undefined,
  submissions: ReturnType<typeof buildSubmissions>
): Promise<string[]> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (apiKey) headers["X-Auth-Token"] = apiKey;

  const response = await fetch(`${baseUrl.replace(/\/$/, "")}/submissions/batch?base64_encoded=false`, {
    method: "POST",
    headers,
    body: JSON.stringify({ submissions }),
    signal: AbortSignal.timeout(15_000),
  });

  if (!response.ok) throw new Error(`judge0_submit_${response.status}`);

  const payload = (await response.json()) as { token?: unknown };
  const tokens = z.array(z.string()).safeParse(payload.token);
  if (!tokens.success) throw new Error("judge0_bad_token_response");
  return tokens.data;
}

async function pollBatch(
  baseUrl: string,
  apiKey: string | undefined,
  tokens: string[]
): Promise<Judge0Submission[]> {
  const headers: Record<string, string> = {};
  if (apiKey) headers["X-Auth-Token"] = apiKey;

  const url = `${baseUrl.replace(/\/$/, "")}/submissions/batch?tokens=${tokens.join(",")}&base64_encoded=false`;

  for (let attempt = 0; attempt < POLL_ATTEMPTS; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));

    const response = await fetch(url, { headers, signal: AbortSignal.timeout(10_000) });
    if (!response.ok) continue;

    const payload = (await response.json()) as { submissions?: unknown };
    const parsed = z.array(judge0SubmissionSchema).safeParse(payload.submissions);
    if (!parsed.success) continue;

    const settled = parsed.data.every(
      (submission) => submission.status.id !== 1 && submission.status.id !== 2
    );
    if (settled) return parsed.data;
  }

  throw new Error("judge0_timeout");
}

/** Runs every test for one submission. A failing test is data, not an error. */
export async function gradeInSandbox(input: {
  language: string;
  source: string;
  tests: TestCase[];
  timeLimitSeconds: number;
  elapsedSeconds: number;
}): Promise<SandboxGrade> {
  const baseUrl = process.env.JUDGE0_URL;
  if (!baseUrl) throw new Error("judge0_not_configured");

  const submissions = buildSubmissions(input.language, input.source, input.tests);
  const tokens = await postBatch(baseUrl, process.env.JUDGE0_API_KEY, submissions);
  const results = await pollBatch(baseUrl, process.env.JUDGE0_API_KEY, tokens);

  const outcomes: TestOutcome[] = input.tests.map((test, index) => {
    const result = results[index];
    const status = result ? mapJudge0Status(result.status.id) : "sandbox_error";

    return {
      name: test.name,
      category: test.category,
      passed: status === "accepted",
      hidden: test.hidden,
      // Output only for tests the author chose to reveal. A hidden test's
      // expected value is the answer key.
      ...(test.hidden ? {} : { expected: test.expectedStdout, actual: (result?.stdout ?? "").trim() }),
      timeMs: result?.time ? Math.round(Number(result.time) * 1000) : undefined,
    };
  });

  const totalTimeMs = outcomes.reduce((sum, outcome) => sum + (outcome.timeMs ?? 0), 0);
  const grade = scoreOutcomes(outcomes, totalTimeMs, input.timeLimitSeconds);

  // The clock is the server's number, not the sandbox's.
  if (input.elapsedSeconds > input.timeLimitSeconds) {
    return { ...grade, efficiencyTier: 1, score: Math.round(grade.correctness * 75) };
  }

  return grade;
}
