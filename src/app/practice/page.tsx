import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerUser } from "@/lib/supabase/server";
import { buttonStyles, eyebrowStyles } from "@/components/ui/styles";
import {
  DIFFICULTY_ORDER,
  parseContent,
  parseRubric,
  recommendNext,
  skillLabel,
  type Challenge,
} from "@/lib/challenges";
import { levelsByCategory, progressFor, type ScoredAttempt } from "@/lib/progression";
import { benchmarkFor, type ChallengeStats } from "@/lib/benchmark";

export const metadata: Metadata = {
  title: "Practice — Forge",
  description: "Choose today's challenge. Five to fifteen minutes, scored on substance.",
};

export const dynamic = "force-dynamic";

export default async function PracticePage() {
  const session = await getServerUser();
  if (!session) redirect("/login?next=/practice");

  const { supabase, user } = session;

  const [challengesResult, attemptsResult, profileResult, statsResult] = await Promise.all([
    supabase
      .from("challenges")
      .select(
        "id, slug, title, description, difficulty, category, estimated_minutes, time_limit_seconds, content, rubric"
      )
      .eq("is_active", true),
    supabase
      .from("challenge_attempts")
      .select("challenge_id, score, practice_date, created_at, challenges(category)")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(200),
    supabase.from("profiles").select("consent_at, display_name").eq("id", user.id).maybeSingle(),
    supabase.from("challenge_stats").select("challenge_id, attempts, median_score"),
  ]);

  const statsByChallenge = new Map(
    (statsResult.data ?? []).map((row) => [row.challenge_id as string, row as ChallengeStats])
  );

  const challenges: Challenge[] = (challengesResult.data ?? [])
    .map((row) => ({
      id: row.id as string,
      slug: row.slug as string,
      title: row.title as string,
      description: row.description as string,
      difficulty: row.difficulty as Challenge["difficulty"],
      category: row.category as string,
      estimated_minutes: row.estimated_minutes as number,
      time_limit_seconds: (row.time_limit_seconds as number | null) ?? null,
      content: parseContent(row.content),
      rubric: parseRubric(row.rubric),
    }))
    .sort((a, b) =>
      a.category === b.category
        ? DIFFICULTY_ORDER[a.difficulty] - DIFFICULTY_ORDER[b.difficulty]
        : a.category.localeCompare(b.category)
    );

  const attempts = (attemptsResult.data ?? []).map((row) => {
    const relation = Array.isArray(row.challenges) ? row.challenges[0] : row.challenges;
    return {
      challenge_id: row.challenge_id as string,
      practice_date: row.practice_date as string,
      created_at: row.created_at as string,
      category: relation?.category ?? null,
      score: (row.score as number | null) ?? null,
    };
  });

  const scoredAttempts: ScoredAttempt[] = attempts.map((attempt) => ({
    score: attempt.score,
    practice_date: attempt.practice_date,
    created_at: attempt.created_at,
    category: attempt.category,
  }));

  const consentMissing = !profileResult.data?.consent_at;
  const recommendation = recommendNext({ challenges, attempts });
  const levels = levelsByCategory(scoredAttempts);

  const categories = Array.from(new Set(challenges.map((challenge) => challenge.category)))
    .map((category) => {
      const inCategory = challenges.filter((challenge) => challenge.category === category);
      const practiced = attempts.filter((attempt) => attempt.category === category).length;
      const level = levels.get(category) ?? progressFor([]);
      const next = recommendNext({ challenges: inCategory, attempts });

      return { category, total: inCategory.length, practiced, level, next };
    })
    .sort((a, b) => b.practiced - a.practiced);

  return (
    <div className="min-h-screen">
      <header className="border-b border-card-border">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between px-6 py-4">
          <Link href="/dashboard" className="flex items-baseline gap-2.5">
            <span className="text-[17px] font-semibold tracking-tight text-primary">Forge</span>
            <span className="hidden font-mono text-[10px] uppercase tracking-[0.16em] text-muted sm:inline">
              daily skill proof
            </span>
          </Link>
          <nav className="flex items-center gap-4 text-[13px]" aria-label="Account">
            <Link href="/dashboard" className="text-muted-foreground hover:text-foreground">
              Dashboard
            </Link>
            <Link href="/profile" className="text-muted-foreground hover:text-foreground">
              Record
            </Link>
            <Link href="/settings" className="text-muted-foreground hover:text-foreground">
              Settings
            </Link>
          </nav>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl px-6 py-12">
        <p className={eyebrowStyles}>Practice</p>
        <h1 className="mt-2 text-[30px] font-semibold leading-tight tracking-tight text-foreground">
          Choose today&apos;s work.
        </h1>
        <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted-foreground">
          One challenge, five to fifteen minutes. The clock is server-measured and the score is computed from
          the rubric. Nothing here is editable afterwards.
        </p>

        {consentMissing ? (
          <div className="mt-8 rounded border border-accent/40 bg-accent/[0.06] px-4 py-3 text-sm">
            Consent to store your practice record is missing, so submissions are blocked.{" "}
            <Link href="/settings" className="underline underline-offset-4">
              Record consent in Settings
            </Link>
            .
          </div>
        ) : null}

        {challenges.length === 0 ? (
          <div className="mt-10 rounded border border-card-border bg-card px-6 py-12 text-center">
            <p className="text-sm font-medium text-foreground">No challenges are published yet.</p>
            <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">
              Run <code className="font-mono text-xs">supabase/seed.sql</code> in your Supabase project to add
              the starter catalogue.
            </p>
          </div>
        ) : (
          <>
            {recommendation ? (
              <section className="mt-10 rounded border border-card-border bg-card">
                <div className="flex flex-col gap-1 border-b border-card-border px-6 py-4 sm:flex-row sm:items-baseline sm:justify-between">
                  <h2 className="text-sm font-medium text-foreground">
                    {attempts.length === 0 ? "Start here" : "Recommended next"}
                  </h2>
                  <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted">
                    {skillLabel(recommendation.challenge.category)} · {recommendation.challenge.difficulty} ·{" "}
                    {recommendation.challenge.estimated_minutes} min
                  </p>
                </div>

                <div className="px-6 py-6">
                  <h3 className="text-xl font-semibold tracking-tight text-foreground">
                    {recommendation.challenge.title}
                  </h3>
                  <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
                    {recommendation.challenge.description}
                  </p>

                  {/* The reason is shown, so the recommendation can be judged. */}
                  <p className="mt-4 border-l-2 border-accent/50 pl-3 text-sm leading-relaxed text-foreground">
                    {recommendation.reason}
                  </p>

                  {benchmarkFor(null, statsByChallenge.get(recommendation.challenge.id)).available ? (
                    <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.1em] text-muted">
                      {benchmarkFor(null, statsByChallenge.get(recommendation.challenge.id)).text}
                    </p>
                  ) : null}

                  {recommendation.challenge.rubric.signals &&
                  recommendation.challenge.rubric.signals.length > 0 ? (
                    <ul className="mt-4 flex flex-wrap gap-2" aria-label="What the rubric looks for">
                      {recommendation.challenge.rubric.signals.map((signal) => (
                        <li
                          key={signal}
                          className="rounded border border-card-border px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.1em] text-muted"
                        >
                          {signal}
                        </li>
                      ))}
                    </ul>
                  ) : null}

                  <div className="mt-6 flex flex-wrap items-center gap-3">
                    <Link
                      href={`/practice/${recommendation.challenge.slug}`}
                      className={buttonStyles("primary", "md")}
                    >
                      Start session
                    </Link>
                    <span className="text-xs text-muted">
                      {attempts.length === 0
                        ? "First session sets your baseline."
                        : `${attempts.length} attempts on record`}
                    </span>
                  </div>
                </div>
              </section>
            ) : null}

            <section className="mt-10">
              <h2 className="text-sm font-medium text-foreground">Your skills</h2>
              <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {categories.map((entry) => (
                  <div
                    key={entry.category}
                    className="flex flex-col justify-between rounded border border-card-border bg-card p-5"
                  >
                    <div>
                      <div className="flex items-baseline justify-between gap-3">
                        <p className="text-sm font-medium text-foreground">{skillLabel(entry.category)}</p>
                        <p className="font-mono text-[10px] uppercase tracking-[0.1em] text-muted">
                          {entry.level.level.name}
                        </p>
                      </div>

                      <div className="mt-3 h-1 overflow-hidden rounded-full bg-foreground/10">
                        <div
                          className="h-full rounded-full bg-primary"
                          style={{ width: `${entry.level.percent}%` }}
                        />
                      </div>

                      <p className="mt-2 text-xs leading-relaxed text-muted">{entry.level.requirement}</p>
                      <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.1em] text-muted">
                        {entry.practiced} logged · avg {entry.level.average ?? "—"} · {entry.total} available
                      </p>
                    </div>

                    {entry.next ? (
                      <Link
                        href={`/practice/${entry.next.challenge.slug}`}
                        className={buttonStyles("secondary", "sm", "mt-4 self-start")}
                      >
                        {entry.practiced > 0 ? "Continue" : "Begin"}
                      </Link>
                    ) : null}
                  </div>
                ))}
              </div>
            </section>

            <section className="mt-12">
              <div className="flex items-baseline justify-between">
                <h2 className="text-sm font-medium text-foreground">Catalogue</h2>
                <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted">
                  {challenges.length} challenges
                </p>
              </div>

              <ul className="mt-4 divide-y divide-card-border border-y border-card-border">
                {challenges.map((challenge) => {
                  const practised = attempts.filter(
                    (attempt) => attempt.challenge_id === challenge.id
                  ).length;

                  return (
                    <li key={challenge.id}>
                      <Link
                        href={`/practice/${challenge.slug}`}
                        className="flex items-center justify-between gap-4 py-4 transition-colors hover:bg-foreground/[0.02]"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm text-foreground">{challenge.title}</p>
                          <p className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.1em] text-muted">
                            {skillLabel(challenge.category)} · {challenge.difficulty} ·{" "}
                            {challenge.estimated_minutes} min
                            {practised > 0 ? ` · attempted ${practised}×` : ""}
                            {(() => {
                              const stats = statsByChallenge.get(challenge.id);
                              const benchmark = benchmarkFor(null, stats);
                              return benchmark.available
                                ? ` · median ${benchmark.median} across ${benchmark.attempts}`
                                : "";
                            })()}
                          </p>
                        </div>
                        <span className="shrink-0 font-mono text-[11px] text-muted">→</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </section>
          </>
        )}
      </main>
    </div>
  );
}
