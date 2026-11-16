import { z } from "zod";

/**
 * Environment validation.
 *
 * The rules this file follows:
 *
 *   * Readable before clever. Every message names the variable, never its value.
 *   * Secrets are never echoed, even truncated, because error text ends up in
 *     logs, CI output and screenshots.
 *   * Optional integrations are reported as warnings, not failures: a missing
 *     email key must not stop people practising.
 *   * Anything with a `NEXT_PUBLIC_` prefix is asserted to hold no secret
 *     material, because those values are inlined into the browser bundle.
 */

const isUrl = (value: string): boolean => {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
};

const isEmail = (value: string): boolean => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

const required = {
  NEXT_PUBLIC_SUPABASE_URL: z.string().trim().refine(isUrl, "must be an absolute http(s) URL"),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().trim().min(20, "must be at least 20 characters"),
};

const optional = {
  NEXT_PUBLIC_APP_URL: z
    .string()
    .trim()
    .refine(isUrl, "must be an absolute http(s) URL")
    .default("http://localhost:3000"),
  NEXT_PUBLIC_GRIEVANCE_EMAIL: z
    .string()
    .trim()
    .refine(isEmail, "must be an email address")
    .optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().trim().min(20, "must be at least 20 characters").optional(),
  DATABASE_URL: z.string().trim().min(10, "must be a Postgres connection string").optional(),
  IP_HASH_PEPPER: z.string().trim().min(16, "must be at least 16 characters").optional(),
  CRON_SECRET: z.string().trim().min(24, "must be at least 24 characters").optional(),
  RESEND_API_KEY: z.string().trim().min(8, "must be at least 8 characters").optional(),
  EMAIL_FROM: z.string().trim().min(3, "must be a sender address").optional(),
  KNOCK_API_KEY: z.string().trim().min(8, "must be at least 8 characters").optional(),
  KNOCK_SIGNING_KEY: z.string().trim().min(8, "must be at least 8 characters").optional(),
  JUDGE0_URL: z.string().trim().refine(isUrl, "must be an absolute http(s) URL").optional(),
  JUDGE0_API_KEY: z.string().trim().min(8, "must be at least 8 characters").optional(),
  ANTHROPIC_API_KEY: z.string().trim().min(8, "must be at least 8 characters").optional(),
  GRADER_MODEL: z.string().trim().min(1).default("claude-sonnet-5-5"),
  E2E_BASE_URL: z.string().trim().refine(isUrl, "must be an absolute http(s) URL").optional(),
};

const schema = z.object({ ...required, ...optional });

export type EnvConfig = z.infer<typeof schema>;

export type EnvIssue = { key: string; problem: string; fatal: boolean };

export type EnvReport = {
  ok: boolean;
  config: EnvConfig | null;
  issues: EnvIssue[];
};

const OPTIONAL_KEYS = Object.keys(optional) as Array<keyof typeof optional>;

/**
 * Parses an environment without touching `process.env` directly, so the rules
 * can be tested with an object literal.
 */
export function parseEnv(source: Record<string, string | undefined>): EnvReport {
  const issues: EnvIssue[] = [];

  for (const [key, field] of Object.entries(required)) {
    if (!source[key]?.trim()) issues.push({ key, problem: "is required", fatal: true });
    else {
      const result = field.safeParse(source[key]);
      if (!result.success) {
        issues.push({ key, problem: result.error.issues[0]?.message ?? "is invalid", fatal: true });
      }
    }
  }

  const present: Record<string, string> = {};
  for (const key of OPTIONAL_KEYS) {
    const value = source[key]?.trim();
    if (!value) continue;
    const result = optional[key].safeParse(value);
    if (result.success) present[key] = value;
    else issues.push({ key, problem: result.error.issues[0]?.message ?? "is invalid", fatal: false });
  }

  // A public-prefixed key holding something secret is the classic leak. These
  // two are expected to be public; anything else public is suspicious.
  for (const key of Object.keys(source)) {
    if (!key.startsWith("NEXT_PUBLIC_")) continue;
    if (key === "NEXT_PUBLIC_SUPABASE_URL" || key === "NEXT_PUBLIC_SUPABASE_ANON_KEY") continue;
    if (key === "NEXT_PUBLIC_APP_URL" || key === "NEXT_PUBLIC_GRIEVANCE_EMAIL") continue;
    if (source[key]) {
      issues.push({
        key,
        problem: "is public and will ship to the browser; prefix secrets differently",
        fatal: false,
      });
    }
  }

  if (!issues.some((issue) => issue.fatal)) {
    // Warnings that only make sense once the required values parse.
    const warnings: Array<[string, string]> = [
      ["SUPABASE_SERVICE_ROLE_KEY", "missing: scheduled erasure, breach log and shared rate limiting are unavailable"],
      ["IP_HASH_PEPPER", "missing: abuse hashes fall back to the development pepper"],
      ["CRON_SECRET", "missing: /api/cron/* is unreachable"],
      ["DATABASE_URL", "missing: db:apply / test:rls cannot run from the CLI"],
    ];

    for (const [key, problem] of warnings) {
      if (!source[key]?.trim()) issues.push({ key, problem, fatal: false });
    }

    if (!source.ANTHROPIC_API_KEY) {
      issues.push({
        key: "ANTHROPIC_API_KEY",
        problem: "missing: LLM-graded formats cannot be scored",
        fatal: false,
      });
    }
    if (!source.JUDGE0_URL) {
      issues.push({
        key: "JUDGE0_URL",
        problem: "missing: code and SQL attempts cannot be graded",
        fatal: false,
      });
    }
  }

  // Only values that already passed are handed to the schema. Otherwise one
  // short optional key would fail the whole parse and report the app as
  // unstartable, which is exactly backwards for an optional integration.
  const sanitized: Record<string, string> = {};
  for (const key of Object.keys(required)) {
    const value = source[key]?.trim();
    if (value) sanitized[key] = value;
  }
  Object.assign(sanitized, present);

  const parsed = schema.safeParse(sanitized);
  return {
    ok: !issues.some((issue) => issue.fatal) && parsed.success,
    config: parsed.success ? parsed.data : null,
    issues,
  };
}

export function formatEnvReport(report: EnvReport): string {
  if (report.ok && report.issues.length === 0) return "Environment looks complete.";

  const lines = report.issues.map(
    (issue) => `  ${issue.fatal ? "x" : "!"} ${issue.key} - ${issue.problem}`
  );

  return [
    report.ok ? "Environment is usable, with gaps:" : "Environment is incomplete:",
    ...lines,
    "",
    "Copy .env.example to .env.local and fill in the values. Nothing here prints a",
    "secret, so this output is safe to paste into an issue.",
  ].join("\n");
}

/**
 * Called once at server start. In development it warns and keeps the marketing
 * pages usable; in production a deployment that cannot reach its database should
 * fail where an operator is watching, not 503 on every request.
 */
export function reportEnv(source: Record<string, string | undefined> = process.env): EnvReport {
  const report = parseEnv(source);

  if (!report.ok && process.env.NODE_ENV === "production") {
    throw new Error(`Forge cannot start.\n\n${formatEnvReport(report)}`);
  }

  if (report.issues.length > 0) {
    // One line per issue, no values: this is a log, not a dump.
    for (const issue of report.issues) {
      console.warn(`[env] ${issue.key} ${issue.problem}`);
    }
  }

  return report;
}
