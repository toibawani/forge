import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerUser } from "@/lib/supabase/server";
import { eyebrowStyles } from "@/components/ui/styles";
import { calibration, calibrationNote, type CalibrationPair, type Verdict } from "@/lib/review";
import { ReviewCard } from "./ReviewCard";

export const metadata: Metadata = {
  title: "Review queue — Forge",
  description: "Judge submitted answers on correctness, blind to the author.",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

type QueueItem = {
  attempt_id: string;
  category: string;
  challenge_title: string;
  difficulty: string;
  answer: string;
  rubric_score: number | null;
  submitted_at: string;
};

export default async function ReviewQueuePage() {
  const session = await getServerUser();
  if (!session) redirect("/login?next=/dashboard/review");

  const { supabase, user } = session;

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (profile?.role !== "reviewer" && profile?.role !== "admin") {
    redirect("/dashboard");
  }

  const [{ data, error }, { data: reviewedRows }] = await Promise.all([
    supabase.rpc("review_queue", { p_limit: 10 }),
    // Reviewers can read every verdict; practitioners can only read their own,
    // which is why this panel is behind the reviewer role.
    supabase
      .from("attempt_reviews")
      .select("verdict, rubric_score")
      .not("rubric_score", "is", null)
      .order("created_at", { ascending: false })
      .limit(500),
  ]);

  const items = (data ?? []) as QueueItem[];
  const pairs: CalibrationPair[] = (reviewedRows ?? [])
    .filter((row) => typeof row.rubric_score === "number")
    .map((row) => ({ rubricScore: row.rubric_score as number, verdict: row.verdict as Verdict }));
  const agreement = calibration(pairs);
  const note = calibrationNote(agreement.total);

  return (
    <div className="min-h-screen">
      <header className="border-b border-card-border">
        <div className="mx-auto flex w-full max-w-3xl items-center justify-between px-6 py-4">
          <Link href="/" className="flex items-baseline gap-2.5">
            <span className="text-[17px] font-semibold tracking-tight text-primary">Forge</span>
            <span className="hidden font-mono text-[10px] uppercase tracking-[0.16em] text-muted sm:inline">
              review
            </span>
          </Link>
          <Link href="/dashboard" className="text-[13px] text-muted-foreground hover:text-foreground">
            Dashboard
          </Link>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl px-6 py-12">
        <p className={eyebrowStyles}>Review queue</p>
        <h1 className="mt-2 text-[30px] font-semibold leading-tight tracking-tight text-foreground">
          Is the answer right?
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
          The rubric can only judge structure and specificity, so a confident wrong answer scores well. Your
          verdict is the part that checks the work itself. Reviews are blind: you see the answer and the
          challenge, not who wrote it, and the rubric score is hidden so it cannot anchor your judgement.
        </p>

        {error ? (
          <div className="mt-8 rounded border border-destructive/30 bg-destructive/[0.06] px-4 py-3 text-sm">
            The review queue could not be loaded. This usually means the review schema has not been applied
            to the database yet.
          </div>
        ) : items.length === 0 ? (
          <div className="mt-8 rounded border border-card-border bg-card px-6 py-12 text-center">
            <p className="text-sm text-foreground">Nothing waiting for review.</p>
            <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">
              Every submitted attempt has a human verdict. New attempts appear here as practitioners submit
              them.
            </p>
          </div>
        ) : (
          <ul className="mt-8 space-y-6">
            {items.map((item) => (
              <li key={item.attempt_id}>
                <ReviewCard
                  attemptId={item.attempt_id}
                  answer={item.answer}
                  challengeTitle={item.challenge_title}
                  category={item.category}
                  difficulty={item.difficulty}
                  submittedAt={item.submitted_at}
                />
              </li>
            ))}
          </ul>
        )}

        <section className="mt-10 rounded border border-card-border bg-card p-6">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-sm font-medium text-foreground">How often does the rubric agree?</h2>
            <p className="font-mono text-[10px] uppercase tracking-[0.1em] text-muted">
              {agreement.agreement === null ? "no data" : `${agreement.agreement}%`}
            </p>
          </div>

          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            Human verdicts compared with the band the rubric implies (75+ correct, 50–74 partly correct,
            below 50 incorrect).
          </p>

          <div className="mt-4 grid gap-px overflow-hidden rounded border border-card-border bg-card-border sm:grid-cols-3">
            <div className="bg-card p-4">
              <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted">Reviewed</p>
              <p className="mt-1 text-xl font-semibold tabular-nums text-foreground">{agreement.total}</p>
            </div>
            <div className="bg-card p-4">
              <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted">Rubric overrated</p>
              <p className="mt-1 text-xl font-semibold tabular-nums text-foreground">{agreement.overrated}</p>
              <p className="mt-0.5 text-xs text-muted">worse than the score suggested</p>
            </div>
            <div className="bg-card p-4">
              <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted">Rubric underrated</p>
              <p className="mt-1 text-xl font-semibold tabular-nums text-foreground">{agreement.underrated}</p>
              <p className="mt-0.5 text-xs text-muted">better than the score suggested</p>
            </div>
          </div>

          <p className={`mt-3 text-xs leading-relaxed ${note.confident ? "text-muted" : "text-accent"}`}>
            {note.text}
            {note.confident ? "" : " Do not quote this number as a guarantee yet."}
          </p>
        </section>

        <p className="mt-6 text-xs leading-relaxed text-muted">
          Your verdict is stored next to the attempt, never inside it. Attempts stay immutable, a second
          verdict on the same attempt is refused, and the rubric score at review time is kept so this
          agreement figure can be measured rather than asserted.
        </p>
      </main>
    </div>
  );
}
