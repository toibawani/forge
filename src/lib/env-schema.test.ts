import test from "node:test";
import assert from "node:assert/strict";

import { formatEnvReport, parseEnv } from "./env-schema.ts";

const VALID = {
  NEXT_PUBLIC_SUPABASE_URL: "https://project.supabase.co",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "a".repeat(40),
};

test("a minimal environment is enough to run the app", () => {
  const report = parseEnv(VALID);
  assert.equal(report.ok, true);
  assert.equal(report.config?.NEXT_PUBLIC_APP_URL, "http://localhost:3000");
  assert.equal(report.config?.GRADER_MODEL, "claude-sonnet-5-5");
});

test("missing required keys fail with a readable message", () => {
  const report = parseEnv({});
  assert.equal(report.ok, false);

  const message = formatEnvReport(report);
  assert.match(message, /NEXT_PUBLIC_SUPABASE_URL - is required/);
  assert.match(message, /\.env\.example/);
});

test("messages never contain values", () => {
  const secret = "super-secret-value-that-should-never-be-logged";
  const report = parseEnv({
    ...VALID,
    NEXT_PUBLIC_SUPABASE_URL: "not-a-url",
    SUPABASE_SERVICE_ROLE_KEY: secret,
    CRON_SECRET: "short",
  });

  const message = formatEnvReport(report);
  assert.ok(!message.includes(secret));
  assert.match(message, /NEXT_PUBLIC_SUPABASE_URL - must be an absolute/);
  assert.match(message, /CRON_SECRET - must be at least 24/);
});

test("a key too short for its purpose is reported, not silently accepted", () => {
  const report = parseEnv({ ...VALID, CRON_SECRET: "abc" });
  assert.ok(report.issues.some((issue) => issue.key === "CRON_SECRET" && !issue.fatal));
  assert.equal(report.ok, true, "a short optional key must not stop the app");
});

test("public-prefixed secrets are flagged before they reach the browser", () => {
  const report = parseEnv({ ...VALID, NEXT_PUBLIC_STRIPE_SECRET_KEY: "sk_live_123" });
  assert.ok(
    report.issues.some(
      (issue) =>
        issue.key === "NEXT_PUBLIC_STRIPE_SECRET_KEY" &&
        /ship to the browser/.test(issue.problem)
    )
  );
});

test("missing integrations are warnings, not failures", () => {
  const report = parseEnv(VALID);
  const keys = report.issues.map((issue) => issue.key).sort();
  assert.deepEqual(keys, [
    "ANTHROPIC_API_KEY",
    "CRON_SECRET",
    "DATABASE_URL",
    "IP_HASH_PEPPER",
    "JUDGE0_URL",
    "SUPABASE_SERVICE_ROLE_KEY",
  ]);
  assert.ok(report.issues.every((issue) => !issue.fatal));
  assert.equal(report.ok, true);
});

test("a complete environment reports no gaps", () => {
  const report = parseEnv({
    ...VALID,
    NEXT_PUBLIC_APP_URL: "https://forge.example",
    SUPABASE_SERVICE_ROLE_KEY: "b".repeat(40),
    DATABASE_URL: "postgres://user:pass@localhost:5432/forge",
    IP_HASH_PEPPER: "c".repeat(32),
    CRON_SECRET: "d".repeat(32),
    ANTHROPIC_API_KEY: "e".repeat(24),
    JUDGE0_URL: "https://judge0.example",
    GRADER_MODEL: "claude-sonnet-5-5",
  });

  assert.equal(report.ok, true);
  assert.deepEqual(report.issues, []);
  assert.match(formatEnvReport(report), /looks complete/);
});

test("a malformed optional URL is reported against its own key", () => {
  const report = parseEnv({ ...VALID, JUDGE0_URL: "judge0" });
  assert.ok(
    report.issues.some((issue) => issue.key === "JUDGE0_URL" && issue.problem.includes("URL"))
  );
});
