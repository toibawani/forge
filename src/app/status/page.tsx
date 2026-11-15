import type { Metadata } from "next";
import Link from "next/link";
import { eyebrowStyles } from "@/components/ui/styles";
import { checkHealth, type HealthStatus } from "@/lib/health";

export const metadata: Metadata = {
  title: "Status — Forge",
  description: "Deployment health for Forge.",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

const STATUS_COPY: Record<HealthStatus, { label: string; tone: string; summary: string }> = {
  ok: {
    label: "Operational",
    tone: "border-success/40 bg-success/[0.06]",
    summary: "Configuration, database and schema all responded.",
  },
  degraded: {
    label: "Degraded",
    tone: "border-accent/40 bg-accent/[0.06]",
    summary: "The database answers, but the schema is incomplete. Some features will fail.",
  },
  down: {
    label: "Unavailable",
    tone: "border-destructive/40 bg-destructive/[0.06]",
    summary: "The database could not be reached. Nothing that needs stored data will work.",
  },
  unconfigured: {
    label: "Not configured",
    tone: "border-accent/40 bg-accent/[0.06]",
    summary: "This deployment has no database credentials yet. The marketing pages still render.",
  },
};

const CHECKS = [
  {
    key: "config" as const,
    label: "Configuration",
    pass: "Environment variables are present",
    fail: "NEXT_PUBLIC_SUPABASE_URL / ANON_KEY are missing",
  },
  {
    key: "database" as const,
    label: "Database",
    pass: "Queries answered",
    fail: "No response from the database",
  },
  {
    key: "schema" as const,
    label: "Schema",
    pass: "Review tables are present",
    fail: "Run the latest supabase/schema.sql",
  },
];

export default async function StatusPage() {
  const health = await checkHealth();
  const status = STATUS_COPY[health.status];

  return (
    <div className="mx-auto w-full max-w-2xl px-6 py-16">
      <p className={eyebrowStyles}>Status</p>
      <h1 className="mt-2 text-[28px] font-semibold leading-tight tracking-tight text-foreground">
        Deployment health
      </h1>

      <div className={`mt-6 rounded border px-5 py-4 ${status.tone}`}>
        <div className="flex items-baseline justify-between gap-4">
          <p className="text-sm font-medium text-foreground">{status.label}</p>
          <p className="font-mono text-[10px] uppercase tracking-[0.1em] text-muted">
            checked {new Date(health.time).toISOString().slice(0, 19).replace("T", " ")} UTC
          </p>
        </div>
        <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{status.summary}</p>
      </div>

      <ul className="mt-6 divide-y divide-card-border rounded border border-card-border bg-card">
        {CHECKS.map((check) => {
          const passed = health.checks[check.key];
          return (
            <li key={check.key} className="flex items-start justify-between gap-4 px-5 py-4">
              <div>
                <p className="text-sm text-foreground">{check.label}</p>
                <p className="mt-0.5 text-xs leading-relaxed text-muted">
                  {passed ? check.pass : check.fail}
                </p>
              </div>
              <span
                className={`shrink-0 rounded border px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.1em] ${
                  passed
                    ? "border-success/40 text-foreground"
                    : "border-destructive/40 text-foreground"
                }`}
              >
                {passed ? "pass" : "fail"}
              </span>
            </li>
          );
        })}
      </ul>

      {health.hint ? (
        <p className="mt-4 rounded border border-card-border bg-card px-5 py-4 text-sm leading-relaxed text-muted-foreground">
          {health.hint}
        </p>
      ) : null}

      <p className="mt-8 text-xs leading-relaxed text-muted">
        This page reports booleans only — no keys, row counts, versions or user data. It is the same
        check served to monitors at{" "}
        <Link href="/api/health" className="underline underline-offset-4">
          /api/health
        </Link>
        , which returns 503 when the deployment cannot store data.
      </p>

      <p className="mt-6 text-sm text-muted-foreground">
        <Link href="/" className="underline underline-offset-4 hover:text-foreground">
          ← Back to Forge
        </Link>
      </p>
    </div>
  );
}
