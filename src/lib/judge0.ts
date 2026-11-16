import "server-only";

/**
 * App-facing sandbox module. The implementation lives in `judge0-client.ts` so
 * CLI scripts can share it; this file exists to make an accidental client-side
 * import fail loudly at build time rather than shipping a Judge0 token path to
 * the browser.
 */
export {
  gradeInSandbox,
  type SandboxGrade,
  type SandboxStatus,
  type TestOutcome,
} from "@/lib/judge0-client";

export { sandboxFeedback } from "@/lib/sandbox-core";
