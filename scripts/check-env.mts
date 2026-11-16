/**
 * `npm run env:check` — validates the environment in the current shell plus
 * `.env.local`, and prints a report that is safe to paste into an issue.
 *
 * Deliberately a script rather than a build step: Next inlines NEXT_PUBLIC_*
 * values at build time, so a missing key would otherwise fail late and vaguely.
 */

import { readFileSync } from "node:fs";
import { existsSync } from "node:fs";

import { formatEnvReport, parseEnv } from "../src/lib/env-schema.ts";

function loadEnvFile(path: string): Record<string, string> {
  if (!existsSync(path)) return {};

  const values: Record<string, string> = {};
  for (const rawLine of readFileSync(path, "utf8").split("\n")) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;

    const equals = line.indexOf("=");
    if (equals === -1) continue;

    const key = line.slice(0, equals).trim();
    let value = line.slice(equals + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    values[key] = value;
  }

  return values;
}

const fileValues = loadEnvFile(".env.local");
const merged = { ...fileValues, ...process.env } as Record<string, string | undefined>;
const report = parseEnv(merged);

console.log(formatEnvReport(report));

if (!report.ok) {
  process.exitCode = 1;
} else if (!process.env.CI) {
  const fatal = report.issues.filter((issue) => issue.fatal);
  if (fatal.length > 0) process.exitCode = 1;
}
