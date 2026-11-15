import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerUser } from "@/lib/supabase/server";
import { buttonStyles, eyebrowStyles } from "@/components/ui/styles";
import { minutesLabel, scoreBand, skillLabel } from "@/lib/challenges";

export const metadata: Metadata = {
  title: "Attempt result — Forge",
  description: "Your score, the rubric signals behind it, and the streak it holds.",
};

export const dynamic = "force-dynamic";

type StoredScoring = {
  version?: string;
  signals?: { completeness?: number; structure?: number; specificity?: number };
  notes?: string[];
};

const SIGNAL_LABELS: Array<{ key: keyof NonNullable<StoredScoring["signals"]>; label: string }> = [
  { key: "completeness", label: "Completeness" },
  { key: "structure", label: "Structure" },
  { key: "specificity", label: "Specificity" },
];

export default async function AttemptResultPage({
  params,
}: {
  params: Promise<{ slug: string; attemptId: string }>;
}) {
  const { slug, attemptId } = await params;

  const session = await getServerUser();
  if (!session) redirect(`/login?next=/practice/${slug}/result/${attemptId}`);

  const { supabase, user } = session;

  const { data: attempt } = await supabase
    .from("challenge_attempts")
    .select(
      "id, score, practice_date, created_at, time_spent_seconds, submission, challenges(title, slug, category, difficulty)"
    )
    .eq("id", attemptId)
    .eq("user_id", user.id)
    .maybeSingle();

  // A foreign or expired id looks like nothing at all, not an error.
  if (!attempt) redirect("/practice");

  const challengeRow = Array.isArray(attempt.challenges) ? attempt.challenges[0] : attempt.challenges;

  const [previousResult, streakResult] = await Promise.all([
    supabase
      .from("challenge_attempts")
      .select("score")
      .eq("user_id", user.id)
      .neq("id", attemptId)
      .not("score", "is", null)
      .order("created_at", { ascending: false })
      .limit(5),
    supabase
      .from("streaks")
      .select("current_streak, longest_streak, total_practice_days, last_practice_date")
      .eq("user_id", user.id)
      .maybeSingle(),
  ]);

  const submission = (attempt.submission ?? {}) as { answer?: string; scoring?: StoredScoring };
  const scoring = submission.scoring;
  const score = attempt.score as number | null;
  const band = scoreBand(score);
  const streak = streakResult.data;

  const previousScores = (previousResult.data ?? [])
    .map((row) => row.score as number | null)
    .filter((value): value is number => typeof value === "number");
  const previousAverage = previousScores.length
    ? Math.round(previousScores.reduce((total, value) => total + value, 0) / previousScores.length)
    : null;
  const delta = score !== null && previousAverage !== null ? score - previousAverage : null;
  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="min-h-screen">
      <header className="border-b border-card-border">
        <div className="mx-auto flex w-full max-w-3xl items-center justify-between px-6 py-4">
          <Link href="/dashboard" className="text-[17px] font-semibold tracking-tight text-primary">
            Forge
          </Link>
          <nav className="flex items-center gap-4 text-[13px]">
            <Link href="/practice" className="text-muted-foreground hover:text-foreground">
              Practise
            </Link>
            <Link href="/profile" className="text-muted-foreground hover:text-foreground">
              Record
            </Link>
          </nav>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl px-6 py-12">
        <p className={eyebrowStyles}>Attempt recorded</p>
        <h1 className="mt-2 text-[28px] font-semibold leading-tight tracking-tight text-foreground">
          {challengeRow?.title ?? "Practice session"}
        </h1>
        <p className="mt-2 font-mono text-[11px] uppercase tracking-[0.1em] text-muted">
          {challengeRow ? `${skillLabel(challengeRow.category)} · ${challengeRow.difficulty} · ` : ""}
          {new Date(`${attempt.practice_date}T00:00:00Z`).toLocaleDateString("en-IN", {
            day: "numeric",
            month: "short",
            year: "numeric",
            timeZone: "UTC",
          })}{" "}
          · {minutesLabel(attempt.time_spent_seconds as number)}
        </p>

        <section className="mt-8 rounded border border-card-border bg-card">
          <div className="flex flex-wrap items-end justify-between gap-4 border-b border-card-border px-6 py-6">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted">Score</p>
              <div className="mt-2 flex items-baseline gap-3">
                <span className="text-5xl font-semibold tabular-nums tracking-tight text-foreground">
                  {score ?? "—"}
                </span>
                <span className={`font-mono text-[11px] uppercase tracking-[0.12em] ${band.className}`}>
                  {band.label}
                </span>
              </div>
              <p className="mt-2 max-w-sm text-sm leading-relaxed text-muted-foreground">{band.summary}</p>
            </div>

            <div className="text-right">
              <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted">vs recent average</p>
              <p className="mt-2 text-lg font-semibold tabular-nums text-foreground">
                {delta === null
                  ? "—"
                  : `${delta > 0 ? "+" : ""}${delta}`}
              </p>
              <p className="mt-1 text-xs text-muted">
                {previousAverage === null
                  ? "first scored attempt"
                  : `last ${previousScores.length} scored · avg ${previousAverage}`}
              </p>
            </div>
          </div>

          <div className="px-6 py-6">
            <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted">
              What the rubric saw{scoring?.version ? ` · ${scoring.version}` : ""}
            </p>

            {scoring?.signals ? (
              <div className="mt-4 space-y-4">
                {SIGNAL_LABELS.map((signal) => {
                  const value = scoring.signals?.[signal.key] ?? 0;
                  return (
                    <div key={signal.key} className="grid grid-cols-[110px_1fr_40px] items-center gap-3">
                      <span className="text-xs text-muted-foreground">{signal.label}</span>
                      <div className="h-1.5 overflow-hidden rounded-full bg-foreground/10">
                        <div className="h-full rounded-full bg-primary" style={{ width: `${value}%` }} />
                      </div>
                      <span className="text-right font-mono text-[11px] tabular-nums text-foreground">
                        {value}
                      </span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="mt-3 text-sm text-muted-foreground">
                This attempt predates the current rubric, so only the total score was recorded.
              </p>
            )}

            {scoring?.notes && scoring.notes.length > 0 ? (
              <div className="mt-6 border-t border-card-border pt-4">
                <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted">Rubric notes</p>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                  {scoring.notes.map((note) => (
                    <li key={note}>{note}</li>
                  ))}
                </ul>
              </div>
            ) : null}

            <p className="mt-6 border-t border-card-border pt-4 text-xs leading-relaxed text-muted">
              The score is a rubric signal, not a certification. It rewards a complete answer, readable
              structure and concrete specifics — and it is computed on the server, so it cannot be edited here.
            </p>
          </div>
        </section>

        <section className="mt-6 grid gap-px overflow-hidden rounded border border-card-border bg-card-border sm:grid-cols-3">
          <div className="bg-card p-5">
            <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted">Current streak</p>
            <p className="mt-2 text-2xl font-semibold tabular-nums text-foreground">
              {streak?.current_streak ?? 0}
            </p>
            <p className="mt-1 text-xs text-muted">
              {streak?.last_practice_date === today ? "today is logged" : "days in a row"}
            </p>
          </div>
          <div className="bg-card p-5">
            <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted">Longest</p>
            <p className="mt-2 text-2xl font-semibold tabular-nums text-foreground">
              {streak?.longest_streak ?? 0}
            </p>
            <p className="mt-1 text-xs text-muted">personal best</p>
          </div>
          <div className="bg-card p-5">
            <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted">Days practised</p>
            <p className="mt-2 text-2xl font-semibold tabular-nums text-foreground">
              {streak?.total_practice_days ?? 0}
            </p>
            <p className="mt-1 text-xs text-muted">on record</p>
          </div>
        </section>

        {submission.answer ? (
          <details className="mt-8 rounded border border-card-border bg-card px-6 py-4">
            <summary className="cursor-pointer text-sm font-medium text-foreground">
              Your submitted answer
            </summary>
            <pre className="mt-4 whitespace-pre-wrap font-mono text-[12px] leading-6 text-muted-foreground">
              {submission.answer}
            </pre>
          </details>
        ) : null}

        <div className="mt-8 flex flex-wrap items-center gap-3">
          <Link href={`/practice/${challengeRow?.slug ?? slug}`} className={buttonStyles("primary", "md")}>
            Practise again
          </Link>
          <Link href="/practice" className={buttonStyles("secondary", "md")}>
            All challenges
          </Link>
          <Link href="/dashboard" className={buttonStyles("ghost", "md")}>
            Dashboard
          </Link>
        </div>

        <p className="mt-8 text-xs leading-relaxed text-muted">
          Attempts cannot be edited or deleted — that permanence is what makes the record worth reading. You
          can still export or erase everything from{" "}
          <Link href="/settings" className="underline underline-offset-4">
            Settings
          </Link>
          .
        </p>
      </main>
    </div>
  );
}
