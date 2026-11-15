import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getServerUser } from "@/lib/supabase/server";
import { buttonStyles, eyebrowStyles } from "@/components/ui/styles";
import { skillLabel } from "@/lib/challenges";
import { recencyLabel, summariseCandidate, type SkillSignal } from "@/lib/recruiter";
import { reviewSummary } from "@/lib/review";

export const metadata: Metadata = {
  title: "Practice record — Forge",
  description: "A dated record of daily practice, scored against each challenge's rubric.",
  // A personal record should not be indexed by search engines.
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

function formatDay(value: string | null): string {
  if (!value) return "—";
  return new Date(`${value.slice(0, 10)}T00:00:00Z`).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

export default async function PublicRecordPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  // The record is for signed-in practitioners and recruiters. Recruiter-only
  // records stay invisible to other practitioners because the view asks
  // is_recruiter() before returning the row.
  const session = await getServerUser();
  if (!session) redirect(`/login?next=/p/${id}`);

  const { supabase } = session;

  const [cardResult, signalsResult, reviewsResult] = await Promise.all([
    supabase
      .from("profile_cards")
      .select(
        "id, display_name, headline, bio, skills, visibility, current_streak, longest_streak, total_practice_days, last_practice_date"
      )
      .eq("id", id)
      .maybeSingle(),
    supabase
      .from("skill_signals")
      .select(
        "category, total_attempts, attempts_30d, days_30d, avg_score_30d, avg_score_90d, best_score, strong_days_90d, last_attempt_at"
      )
      .eq("user_id", id),
    supabase
      .from("review_signals")
      .select("reviewed_attempts, correct, partially_correct, incorrect, last_reviewed_at")
      .eq("user_id", id)
      .maybeSingle(),
  ]);

  const card = cardResult.data;
  if (!card) notFound();

  const signals = (signalsResult.data ?? []) as SkillSignal[];
  const summary = summariseCandidate({ ...card, signals });
  const reviews = reviewSummary(reviewsResult.data);
  const strongest = [...signals].sort(
    (a, b) => Number(b.avg_score_90d ?? 0) - Number(a.avg_score_90d ?? 0)
  );

  return (
    <div className="min-h-screen">
      <header className="border-b border-card-border">
        <div className="mx-auto flex w-full max-w-4xl items-center justify-between px-6 py-4">
          <Link href="/" className="flex items-baseline gap-2.5">
            <span className="text-[17px] font-semibold tracking-tight text-primary">Forge</span>
            <span className="hidden font-mono text-[10px] uppercase tracking-[0.16em] text-muted sm:inline">
              practice record
            </span>
          </Link>
          <Link href="/dashboard" className="text-[13px] text-muted-foreground hover:text-foreground">
            Dashboard
          </Link>
        </div>
      </header>

      <main className="mx-auto w-full max-w-4xl px-6 py-12">
        <div className="flex flex-wrap items-center gap-2">
          <p className={eyebrowStyles}>
            {card.visibility === "public" ? "Public record" : "Shared with verified recruiters"}
          </p>
          {reviews.verified ? (
            <span className="rounded border border-success/40 bg-success/[0.06] px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.1em] text-foreground">
              human-reviewed · {reviews.reviewed}
            </span>
          ) : null}
        </div>

        <h1 className="mt-2 text-[32px] font-semibold leading-tight tracking-tight text-foreground">
          {summary.name}
        </h1>

        {card.headline ? (
          <p className="mt-1 text-sm text-muted-foreground">{card.headline}</p>
        ) : null}

        <p className="mt-3 font-mono text-[11px] uppercase tracking-[0.1em] text-muted">
          {summary.activity} · {summary.consistency.label}
        </p>

        {card.bio ? (
          <p className="mt-5 max-w-2xl text-sm leading-relaxed text-foreground/90">{card.bio}</p>
        ) : null}

        {card.skills && card.skills.length > 0 ? (
          <ul className="mt-5 flex flex-wrap gap-2" aria-label="Self-declared skills">
            {(card.skills as string[]).map((skill) => (
              <li
                key={skill}
                className="rounded border border-card-border px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.1em] text-muted"
              >
                {skill}
              </li>
            ))}
          </ul>
        ) : null}

        <div className="mt-8 grid gap-px overflow-hidden rounded border border-card-border bg-card-border sm:grid-cols-4">
          <div className="bg-card p-5">
            <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted">Streak</p>
            <p className="mt-1.5 text-2xl font-semibold tabular-nums text-foreground">
              {card.current_streak}
            </p>
            <p className="mt-0.5 text-xs text-muted">longest {card.longest_streak}</p>
          </div>
          <div className="bg-card p-5">
            <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted">Days practised</p>
            <p className="mt-1.5 text-2xl font-semibold tabular-nums text-foreground">
              {card.total_practice_days}
            </p>
            <p className="mt-0.5 text-xs text-muted">distinct days</p>
          </div>
          <div className="bg-card p-5">
            <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted">Last practice</p>
            <p className="mt-1.5 text-sm font-medium text-foreground">
              {formatDay(card.last_practice_date)}
            </p>
            <p className="mt-0.5 text-xs text-muted">last logged session</p>
          </div>
          <div className="bg-card p-5">
            <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted">Active days (30)</p>
            <p className="mt-1.5 text-2xl font-semibold tabular-nums text-foreground">{summary.days30}</p>
            <p className="mt-0.5 text-xs text-muted">logged sessions</p>
          </div>
        </div>

        <section className="mt-8 rounded border border-card-border bg-card">
          <div className="flex items-baseline justify-between border-b border-card-border px-6 py-4">
            <h2 className="text-sm font-medium text-foreground">Where the practice is</h2>
            <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted">
              {signals.length} skill{signals.length === 1 ? "" : "s"}
            </p>
          </div>

          {strongest.length === 0 ? (
            <div className="px-6 py-10 text-center">
              <p className="text-sm text-muted-foreground">
                No scored attempts yet, so there is nothing to claim here.
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-card-border">
              {strongest.map((signal) => (
                <li key={signal.category} className="px-6 py-4">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <p className="text-sm text-foreground">{skillLabel(signal.category)}</p>
                    <p className="font-mono text-[10px] uppercase tracking-[0.1em] text-muted">
                      {signal.avg_score_90d ?? "—"} avg (90d) · best {signal.best_score ?? "—"} ·{" "}
                      {signal.days_30d ?? 0} days (30d)
                    </p>
                  </div>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-foreground/10">
                    <div
                      className="h-full rounded-full bg-primary"
                      style={{ width: `${Math.min(100, Number(signal.avg_score_90d ?? 0))}%` }}
                    />
                  </div>
                  <p className="mt-1.5 text-xs text-muted">
                    {signal.total_attempts ?? 0} attempts · {signal.strong_days_90d ?? 0} strong days (90d) ·{" "}
                    {recencyLabel(signal.last_attempt_at)}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>

        {reviews.verified ? (
          <section className="mt-6 rounded border border-card-border bg-card p-6">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="text-sm font-medium text-foreground">Human review</h2>
              <p className="font-mono text-[10px] uppercase tracking-[0.1em] text-muted">
                {reviews.verified ? reviews.text : "none yet"}
              </p>
            </div>
            <div className="mt-4 grid gap-px overflow-hidden rounded border border-card-border bg-card-border sm:grid-cols-4">
              <div className="bg-card p-4">
                <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted">Reviewed</p>
                <p className="mt-1 text-xl font-semibold tabular-nums text-foreground">{reviews.reviewed}</p>
              </div>
              <div className="bg-card p-4">
                <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted">Correct</p>
                <p className="mt-1 text-xl font-semibold tabular-nums text-foreground">{reviews.correct}</p>
              </div>
              <div className="bg-card p-4">
                <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted">Partly</p>
                <p className="mt-1 text-xl font-semibold tabular-nums text-foreground">
                  {reviews.partiallyCorrect}
                </p>
              </div>
              <div className="bg-card p-4">
                <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted">Incorrect</p>
                <p className="mt-1 text-xl font-semibold tabular-nums text-foreground">
                  {reviews.incorrect}
                </p>
              </div>
            </div>
            <p className="mt-3 text-xs leading-relaxed text-muted">
              Verdicts are recorded by a reviewer who never sees whose attempt it is. They are counted
              exactly, not averaged into a score.
            </p>
          </section>
        ) : null}

        <section className="mt-6 rounded border border-card-border bg-card p-6">
          <h2 className="text-sm font-medium text-foreground">How to read this</h2>
          <ul className="mt-3 space-y-2 text-sm leading-relaxed text-muted-foreground">
            <li>
              Every attempt is timestamped by the server and cannot be edited or deleted after it is
              recorded.
            </li>
            <li>
              Scores come from each challenge&apos;s rubric — coverage of the brief, structure, and
              specificity. They measure how the answer is written, not whether it is right.
            </li>
            <li>
              {reviews.verified
                ? "Correctness is covered only by the human review counts above. Unreviewed attempts carry no such claim."
                : "No record here has been human-reviewed, so nothing is labelled verified practice."}
            </li>
            <li>
              Self-declared skills above are the practitioner&apos;s own words; the evidence is the practice
              record, not the tag list.
            </li>
          </ul>

          <div className="mt-5 flex flex-wrap gap-3">
            <Link href="/dashboard/recruiter" className={buttonStyles("secondary", "sm")}>
              Back to search
            </Link>
            <Link href="/practice" className={buttonStyles("ghost", "sm")}>
              See how practice works
            </Link>
          </div>
        </section>
      </main>
    </div>
  );
}
