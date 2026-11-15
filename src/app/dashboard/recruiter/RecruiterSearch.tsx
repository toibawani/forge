"use client";

import { useState } from "react";
import Link from "next/link";
import { buttonStyles } from "@/components/ui/styles";
import { skillLabel } from "@/lib/challenges";
import { summariseCandidate, type Candidate, type CandidateSummary } from "@/lib/recruiter";
import { reviewSummary, type ReviewCounts } from "@/lib/review";

type Row = Candidate & { summary: CandidateSummary; review?: ReviewCounts | null };

const CATEGORIES = ["engineering", "design", "analysis", "writing"] as const;

export function RecruiterSearch() {
  const [skills, setSkills] = useState("");
  const [category, setCategory] = useState("");
  const [minScore, setMinScore] = useState("");
  const [minActiveDays, setMinActiveDays] = useState("");

  const [rows, setRows] = useState<Row[] | null>(null);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);

  async function search() {
    setPending(true);
    setError(null);

    const params = new URLSearchParams();
    const skillList = skills
      .split(",")
      .map((value) => value.trim().toLowerCase())
      .filter(Boolean);
    if (skillList.length > 0) params.set("skills", skillList.join(","));
    if (minScore) params.set("minAvgScore", minScore);
    if (category) params.set("category", category);
    params.set("limit", "24");

    try {
      const response = await fetch(`/api/recruiters/search?${params.toString()}`, {
        headers: { accept: "application/json" },
        cache: "no-store",
      });

      if (response.status === 429) {
        setRows([]);
        setError("That is a lot of searches in a minute. Wait a moment and try again.");
        return;
      }

      if (!response.ok) {
        setRows([]);
        setError("Search is unavailable right now. Try again shortly.");
        return;
      }

      const payload = (await response.json()) as { results?: Candidate[]; count?: number };
      const results = (payload.results ?? []).map((candidate) => ({
        ...candidate,
        summary: summariseCandidate(candidate),
      }));

      // Skill, score and category filtering happen server-side. Only the
      // activity threshold is applied here, and it can only remove rows from
      // the page that was returned.
      const filtered = results.filter((candidate) => {
        if (minActiveDays && candidate.summary.days30 < Number(minActiveDays)) return false;
        return true;
      });

      setRows(filtered);
      setTotal(payload.count ?? filtered.length);
      setSelected([]);
    } catch {
      setRows([]);
      setError("Could not reach Forge. Check your connection and try again.");
    } finally {
      setPending(false);
    }
  }

  function toggle(id: string) {
    setSelected((current) =>
      current.includes(id) ? current.filter((entry) => entry !== id) : [...current, id].slice(0, 4)
    );
  }

  return (
    <div className="space-y-6">
      <form
        className="rounded border border-card-border bg-card p-6"
        onSubmit={(event) => {
          event.preventDefault();
          void search();
        }}
      >
        <div className="flex items-baseline justify-between">
          <h2 className="text-sm font-medium text-foreground">Search the record</h2>
          <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted">
            {rows === null ? "not run yet" : `${rows.length} of ${total}`}
          </p>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="block text-xs text-muted">
            Skills (comma separated)
            <input
              value={skills}
              onChange={(event) => setSkills(event.target.value)}
              placeholder="typescript, sql"
              className="mt-1.5 w-full rounded border border-card-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted/70"
            />
          </label>

          <label className="block text-xs text-muted">
            Practising in
            <select
              value={category}
              onChange={(event) => setCategory(event.target.value)}
              className="mt-1.5 w-full rounded border border-card-border bg-background px-3 py-2 text-sm text-foreground"
            >
              <option value="">Any skill</option>
              {CATEGORIES.map((value) => (
                <option key={value} value={value}>
                  {skillLabel(value)}
                </option>
              ))}
            </select>
          </label>

          <label className="block text-xs text-muted">
            Minimum 30-day score
            <input
              value={minScore}
              onChange={(event) => setMinScore(event.target.value.replace(/[^0-9]/g, ""))}
              inputMode="numeric"
              placeholder="70"
              className="mt-1.5 w-full rounded border border-card-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted/70"
            />
          </label>

          <label className="block text-xs text-muted">
            Minimum active days (30d)
            <input
              value={minActiveDays}
              onChange={(event) => setMinActiveDays(event.target.value.replace(/[^0-9]/g, ""))}
              inputMode="numeric"
              placeholder="4"
              className="mt-1.5 w-full rounded border border-card-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted/70"
            />
          </label>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button type="submit" className={buttonStyles("primary", "md")} disabled={pending}>
            {pending ? "Searching…" : "Search candidates"}
          </button>

          {selected.length >= 2 ? (
            <Link
              href={`/dashboard/recruiter/compare?ids=${selected.join(",")}`}
              className={buttonStyles("secondary", "md")}
            >
              Compare {selected.length}
            </Link>
          ) : (
            <span className="text-xs text-muted">Select two or more to compare.</span>
          )}
        </div>

        {error ? (
          <p role="status" className="mt-4 rounded border border-accent/40 bg-accent/[0.06] px-3 py-2 text-sm">
            {error}
          </p>
        ) : null}
      </form>

      {rows === null ? (
        <div className="rounded border border-card-border bg-card px-6 py-12 text-center">
          <p className="text-sm text-muted-foreground">
            Search to see practitioners who opted in to recruiter discovery.
          </p>
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded border border-card-border bg-card px-6 py-12 text-center">
          <p className="text-sm text-foreground">No one matched those filters.</p>
          <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">
            Forge only shows people who chose recruiter visibility, so an empty result often means nobody
            currently practising matches — not that the filter is broken.
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {rows.map((row) => (
            <li key={row.id} className="rounded border border-card-border bg-card p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex items-baseline gap-2.5">
                    <Link
                      href={`/p/${row.id}`}
                      className="truncate text-sm font-medium text-foreground hover:text-primary"
                    >
                      {row.summary.name}
                    </Link>
                    <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-muted">
                      {row.summary.strongestCategory ? skillLabel(row.summary.strongestCategory) : "no record"}
                    </span>
                  </div>

                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                    {row.summary.activity} · {row.summary.consistency.label} · {row.current_streak} day streak
                    {row.summary.strongestScore !== null ? ` · avg ${row.summary.strongestScore}` : ""}
                  </p>

                  {reviewSummary(row.review).verified ? (
                    <p className="mt-1.5 font-mono text-[10px] uppercase tracking-[0.1em] text-foreground">
                      human-reviewed · {reviewSummary(row.review).text}
                    </p>
                  ) : null}

                  {row.headline ? (
                    <p className="mt-2 text-sm leading-relaxed text-foreground/90">{row.headline}</p>
                  ) : null}

                  {row.skills && row.skills.length > 0 ? (
                    <ul className="mt-3 flex flex-wrap gap-1.5">
                      {row.skills.slice(0, 6).map((skill) => (
                        <li
                          key={skill}
                          className="rounded border border-card-border px-2 py-0.5 font-mono text-[10px] text-muted"
                        >
                          {skill}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </div>

                <div className="flex shrink-0 flex-col items-end gap-2">
                  <label className="flex items-center gap-2 text-xs text-muted">
                    <input
                      type="checkbox"
                      checked={selected.includes(row.id)}
                      onChange={() => toggle(row.id)}
                      className="h-3.5 w-3.5 rounded border-card-border"
                    />
                    compare
                  </label>
                  <Link
                    href={`/p/${row.id}`}
                    className="font-mono text-[11px] text-muted hover:text-foreground"
                  >
                    open record →
                  </Link>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
