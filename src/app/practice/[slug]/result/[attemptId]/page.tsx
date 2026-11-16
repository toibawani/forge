import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerUser } from "@/lib/supabase/server";
import { buttonStyles, eyebrowStyles } from "@/components/ui/styles";
import { minutesLabel, parseRubric, recommendNext, scoreBand, skillLabel } from "@/lib/challenges";
import { benchmarkFor } from "@/lib/benchmark";
import { challengeFromRow } from "@/lib/challenge-row";
import { variantPick } from "@/lib/variant";
import { localDay } from "@/lib/timezone";
import { compareAnswer, highestLeverageFix } from "@/lib/answer-diff";
import { buildFeedback, type AttemptFeedback, type FeedbackDimension } from "@/lib/feedback";
import {
  nextMilestone,
  progressFor,
  recentAverage,
  scoreTrend,
  type ScoredAttempt,
} from "@/lib/progression";

export const metadata: Metadata = {
  title: "Attempt result — Forge",
  description: "Your score, what the rubric measured, and exactly what to change next time.",
};

export const dynamic = "force-dynamic";

type StoredScoring = {
  version?: string;
  signals?: { completeness?: number; structure?: number; specificity?: number };
  notes?: string[];
};

/**
 * The grader's own output, stored alongside the attempt. `pending` means the
 * grader was configured but unavailable, and the page must say so rather than
 * render a substituted score.
 */
type StoredGrading = {
  grader?: "sandbox" | "llm" | "rubric-v1";
  status?: "graded" | "pending";
  plan?: { reason?: string };
  dimensions?: Array<{
    id: string;
    label?: string;
    score: number;
    maxScore?: number;
    evidence?: string;
  }>;
  flags?: string[];
};

type AttemptRowWithCategory = {
  id: string;
  challenge_id: string;
  score: number | null;
  practice_date: string;
  created_at: string;
  challenges: { category: string; slug?: string } | { category: string; slug?: string }[] | null;
};

const DIMENSION_ORDER: FeedbackDimension[] = ["completeness", "structure", "specificity"];


function parseFeedback(value: unknown): AttemptFeedback | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as Partial<AttemptFeedback>;
  if (candidate.version !== "mentor-v1" || !Array.isArray(candidate.dimensions)) return null;
  return candidate as AttemptFeedback;
}

function ScoreHistory({
  rows,
  attemptId,
}: {
  rows: Array<{ id: string; score: number | null }>;
  attemptId: string;
}) {
  if (rows.length < 2) {
    return (
      <p className="mt-3 text-sm text-muted-foreground">
        One attempt is a data point, not a trend. The next session in this skill starts the line.
      </p>
    );
  }

  return (
    <div className="mt-4 flex items-end gap-1.5" aria-hidden="true">
      {rows.map((row) => {
        const current = row.id === attemptId;
        const height = Math.max(6, Math.round(((row.score ?? 0) / 100) * 56));
        return (
          <div key={row.id} className="flex-1">
            <div
              className={`w-full rounded-sm ${current ? "bg-primary" : "bg-primary/25"}`}
              style={{ height: `${height}px` }}
            />
          </div>
        );
      })}
    </div>
  );
}

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
      "id, challenge_id, score, practice_date, created_at, time_spent_seconds, submission, challenges(title, slug, category, difficulty, rubric, model)"
    )
    .eq("id", attemptId)
    .eq("user_id", user.id)
    .maybeSingle();

  // A foreign or expired id looks like nothing at all, not an error.
  if (!attempt) redirect("/practice");

  const challengeRow = Array.isArray(attempt.challenges) ? attempt.challenges[0] : attempt.challenges;
  const category = challengeRow?.category ?? null;
  const rubric = parseRubric(challengeRow?.rubric);

  const [attemptsResult, streakResult, catalogueResult, profileResult] = await Promise.all([
    supabase
      .from("challenge_attempts")
      .select("id, challenge_id, score, practice_date, created_at, challenges(category, slug)")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(120),
    supabase
      .from("streaks")
      .select("current_streak, longest_streak, total_practice_days, last_practice_date")
      .eq("user_id", user.id)
      .maybeSingle(),
    supabase
      .from("challenges")
      .select(
        "id, slug, title, description, difficulty, category, estimated_minutes, time_limit_seconds, content, rubric, track, sub_skills, initial_rating"
      )
      .eq("is_active", true),
    supabase.from("profiles").select("timezone").eq("id", user.id).maybeSingle(),
  ]);

  const { data: statsRow } = await supabase
    .from("challenge_stats")
    .select("challenge_id, attempts, median_score")
    .eq("challenge_id", attempt.challenge_id as string)
    .maybeSingle();

  const submission = (attempt.submission ?? {}) as {
    answer?: string;
    scoring?: StoredScoring;
    feedback?: unknown;
    grading?: StoredGrading | null;
  };
  const scoring = submission.scoring;
  const signals = {
    completeness: scoring?.signals?.completeness ?? 0,
    structure: scoring?.signals?.structure ?? 0,
    specificity: scoring?.signals?.specificity ?? 0,
  };

  const grading = submission.grading ?? null;

  // The reference answer only exists for rows carrying a Phase 1 model document.
  const challengeDoc = challengeFromRow(challengeRow as Record<string, unknown> | null);
  const referenceAnswer =
    challengeDoc?.reference?.kind === "answer" ? challengeDoc.reference.body : null;
  const comparison =
    submission.answer && referenceAnswer ? compareAnswer(submission.answer, referenceAnswer) : null;

  const storedFeedback = parseFeedback(submission.feedback);
  const feedback =
    storedFeedback ??
    (submission.answer
      ? buildFeedback({
          answer: submission.answer,
          signals,
          minWords: rubric.min_words ?? 25,
          category: category ?? "general",
        })
      : null);

  const score = attempt.score as number | null;
  const benchmark = benchmarkFor(score, statsRow);
  const band = scoreBand(score);
  const leverageFix = highestLeverageFix({
    dimensions: grading?.dimensions,
    focus: feedback?.focus ?? null,
  });

  const allRows = (attemptsResult.data ?? []) as AttemptRowWithCategory[];

  // Previous attempts inside this skill only: comparing a writing score to an
  // engineering score would produce a meaningless trend.
  const skillAttempts: ScoredAttempt[] = allRows
    .filter((row) => {
      const relation = Array.isArray(row.challenges) ? row.challenges[0] : row.challenges;
      return category === null || relation?.category === category;
    })
    .map((row) => ({
      score: row.score,
      practice_date: row.practice_date,
      created_at: row.created_at,
      category,
    }));

  const previousSkillScores = allRows
    .filter((row) => row.id !== attemptId)
    .filter((row) => {
      const relation = Array.isArray(row.challenges) ? row.challenges[0] : row.challenges;
      return category === null || relation?.category === category;
    })
    .map((row) => row.score)
    .filter((value): value is number => typeof value === "number");

  const skillAverage = previousSkillScores.length
    ? Math.round(previousSkillScores.reduce((total, value) => total + value, 0) / previousSkillScores.length)
    : null;
  const skillBest = previousSkillScores.length ? Math.max(...previousSkillScores) : null;
  const deltaVsSkill = score !== null && skillAverage !== null ? score - skillAverage : null;

  const trend = scoreTrend(skillAttempts);
  const level = progressFor(skillAttempts);
  const skillRows = allRows.filter((row) => {
    const relation = Array.isArray(row.challenges) ? row.challenges[0] : row.challenges;
    return category === null || relation?.category === category;
  });
  const history = [...skillRows]
    .reverse()
    .slice(-12)
    .map((row) => ({ id: row.id, score: row.score }));

  const allAttempts = allRows.map((row) => {
    const relation = Array.isArray(row.challenges) ? row.challenges[0] : row.challenges;
    return {
      challenge_id: row.challenge_id,
      category: relation?.category ?? null,
      score: row.score,
      practice_date: row.practice_date,
      created_at: row.created_at,
    };
  });

  const next = recommendNext({
    challenges: (catalogueResult.data ?? []).map((row) => ({
      id: row.id as string,
      slug: row.slug as string,
      title: row.title as string,
      description: row.description as string,
      difficulty: row.difficulty as "beginner" | "intermediate" | "advanced",
      category: row.category as string,
      estimated_minutes: row.estimated_minutes as number,
      time_limit_seconds: (row.time_limit_seconds as number | null) ?? null,
      content: {},
      rubric: parseRubric(row.rubric),
    })),
    attempts: allAttempts,
  });

  const variant = variantPick({
    challenges: (catalogueResult.data ?? []).map((row) => ({
      slug: row.slug as string,
      track: (row.track as string | null) ?? (row.category as string),
      subSkills: ((row.sub_skills as string[] | null) ?? [row.category as string]).filter(Boolean),
      difficultyRating: (row.initial_rating as number | null) ?? 1500,
    })),
    currentSlug: (challengeRow?.slug as string) ?? slug,
    attemptedSlugs: allRows
      .map((row) => {
        const relation = Array.isArray(row.challenges) ? row.challenges[0] : row.challenges;
        return relation?.slug ?? "";
      })
      .filter((value) => value.length > 0),
  });

  const streak = streakResult.data;
  const milestone = nextMilestone(streak?.current_streak ?? 0);
  const loggedToday =
    streak?.last_practice_date ===
    localDay(new Date(), (profileResult.data?.timezone as string | null) ?? "UTC");

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
          {category ? `${skillLabel(category)} · ${challengeRow?.difficulty} · ` : ""}
          {new Date(`${attempt.practice_date}T00:00:00Z`).toLocaleDateString("en-IN", {
            day: "numeric",
            month: "short",
            year: "numeric",
            timeZone: "UTC",
          })}{" "}
          · {minutesLabel(attempt.time_spent_seconds as number)}
        </p>

        {/* Score and the one-sentence read on it. */}
        <section className="mt-8 rounded border border-card-border bg-card px-6 py-6">
          <div className="flex flex-wrap items-start justify-between gap-6">
            <div>
              <div className="flex items-baseline gap-3">
                <span className="text-6xl font-semibold tabular-nums leading-none tracking-tight text-foreground">
                  {score ?? "—"}
                </span>
                <span className={`font-mono text-[11px] uppercase tracking-[0.12em] ${band.className}`}>
                  {band.label}
                </span>
              </div>
              <p className="mt-3 max-w-md text-sm leading-relaxed text-foreground">
                {feedback?.headline ?? band.summary}
              </p>
              {benchmark.available ? (
                <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.1em] text-muted">
                  {benchmark.text}
                </p>
              ) : null}

              {grading?.status === "pending" ? (
                <p className="mt-3 max-w-md rounded border border-accent/40 bg-accent/[0.06] px-3 py-2 text-xs leading-relaxed text-foreground">
                  The answer is saved, but it was not scored:{" "}
                  {grading.grader === "sandbox" ? "the code sandbox" : "the rubric grader"} was
                  unavailable. No score is shown rather than a substituted one.
                </p>
              ) : null}

              {grading?.dimensions && grading.dimensions.length > 0 ? (
                <div className="mt-4 max-w-md border-t border-card-border pt-3">
                  <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted">
                    {grading.grader === "sandbox" ? "Tests by category" : "Rubric dimensions"}
                  </p>
                  <dl className="mt-2 space-y-1.5">
                    {grading.dimensions.map((dimension) => (
                      <div key={dimension.id} className="flex items-baseline justify-between gap-4">
                        <dt className="text-xs text-muted-foreground">
                          {dimension.label ?? dimension.id}
                        </dt>
                        <dd className="shrink-0 font-mono text-[11px] tabular-nums text-foreground">
                          {dimension.score}
                          {typeof dimension.maxScore === "number" ? `/${dimension.maxScore}` : ""}
                        </dd>
                      </div>
                    ))}
                  </dl>
                </div>
              ) : null}
            </div>

            <dl className="grid grid-cols-2 gap-x-8 gap-y-4 text-right sm:grid-cols-1">
              <div>
                <dt className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted">
                  vs your {category ? skillLabel(category) : "skill"} average
                </dt>
                <dd className="mt-1 text-lg font-semibold tabular-nums text-foreground">
                  {deltaVsSkill === null ? "—" : `${deltaVsSkill > 0 ? "+" : ""}${deltaVsSkill}`}
                </dd>
                <dd className="text-xs text-muted">
                  {skillAverage === null ? "first scored attempt here" : `average ${skillAverage}`}
                </dd>
              </div>
              <div>
                <dt className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted">
                  personal best
                </dt>
                <dd className="mt-1 text-lg font-semibold tabular-nums text-foreground">
                  {skillBest ?? score ?? "—"}
                </dd>
                <dd className="text-xs text-muted">
                  {trend.delta === null
                    ? "no earlier window to compare"
                    : `${trend.delta > 0 ? "+" : ""}${trend.delta} across your last five`}
                </dd>
              </div>
            </dl>
          </div>
        </section>

        {/* What worked, and what to change. The reason this page exists. */}
        <div className="mt-6 grid gap-6 md:grid-cols-2">
          <section className="rounded border border-card-border bg-card p-6">
            <h2 className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted">What worked</h2>
            {feedback && feedback.strengths.length > 0 ? (
              <ul className="mt-4 space-y-4">
                {feedback.strengths.map((item) => (
                  <li key={item.title}>
                    <p className="text-sm font-medium text-foreground">{item.title}</p>
                    <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{item.detail}</p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
                Nothing cleared the bar this time. The section on the right is where the next attempt starts.
              </p>
            )}
          </section>

          <section className="rounded border border-card-border bg-card p-6">
            <h2 className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted">What to change</h2>
            {feedback && feedback.improvements.length > 0 ? (
              <ul className="mt-4 space-y-4">
                {feedback.improvements.map((item) => (
                  <li key={item.title}>
                    <p className="text-sm font-medium text-foreground">{item.title}</p>
                    <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{item.detail}</p>
                    {item.example ? (
                      <p className="mt-2 border-l-2 border-accent/50 pl-3 font-mono text-[11px] leading-relaxed text-muted">
                        {item.example}
                      </p>
                    ) : null}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
                No structural weaknesses detected. Raise the difficulty rather than repeating this level.
              </p>
            )}
          </section>
        </div>

        {leverageFix ? (
          <section className="mt-6 rounded border border-primary/25 bg-primary/[0.04] p-6">
            <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted">
              Focus for next time
            </p>
            <p className="mt-2 text-sm font-medium text-foreground">{leverageFix.title}</p>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{leverageFix.detail}</p>
            {feedback?.focus && leverageFix.title !== "The one thing to change" ? (
              <p className="mt-3 border-t border-primary/20 pt-3 text-xs leading-relaxed text-muted">
                {feedback.focus}
              </p>
            ) : null}

            {variant ? (
              <div className="mt-4 border-t border-primary/20 pt-3">
                <p className="text-xs leading-relaxed text-muted">{variant.reason}</p>
                <Link
                  href={`/practice/${variant.slug}?retryOf=${attemptId}`}
                  className={`${buttonStyles("secondary", "md")} mt-3`}
                >
                  Try a variant of this skill
                </Link>
              </div>
            ) : null}
          </section>
        ) : null}

        {/* Only after submit, and only when a reference answer exists. */}
        {comparison && referenceAnswer && submission.answer ? (
          <section className="mt-6 rounded border border-card-border bg-card p-6">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted">
                Your answer next to the reference
              </h2>
              <p className="font-mono text-[10px] uppercase tracking-[0.1em] text-muted">
                {comparison.overlapPercent}% of reference points covered
              </p>
            </div>

            <div className="mt-4 grid gap-5 md:grid-cols-2">
              <div>
                <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted">Yours</p>
                <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-foreground">
                  {submission.answer}
                </p>
              </div>
              <div>
                <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted">Reference</p>
                <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
                  {referenceAnswer}
                </p>
              </div>
            </div>

            {comparison.missingSpecifics.length > 0 ? (
              <div className="mt-5 border-t border-card-border pt-4">
                <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted">
                  In the reference, not in yours
                </p>
                <ul className="mt-2 flex flex-wrap gap-2">
                  {comparison.missingSpecifics.map((specific) => (
                    <li
                      key={specific}
                      className="rounded border border-card-border px-2 py-1 font-mono text-[11px] text-foreground"
                    >
                      {specific}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {comparison.unmatchedReference.length > 0 ? (
              <div className="mt-4">
                <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted">
                  Reference points with no counterpart
                </p>
                <ul className="mt-2 space-y-2">
                  {comparison.unmatchedReference.map((sentence) => (
                    <li
                      key={sentence}
                      className="border-l-2 border-accent/40 pl-3 text-sm leading-relaxed text-muted-foreground"
                    >
                      {sentence}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            <p className="mt-5 border-t border-card-border pt-3 text-xs leading-relaxed text-muted">
              The reference is one good answer, not the only one. A missing point is a difference of
              approach, not proof the answer is wrong.
            </p>
          </section>
        ) : null}

        {/* Dimension detail with the verdict, not just a bar. */}
        <section className="mt-6 rounded border border-card-border bg-card p-6">
          <h2 className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted">
            How the rubric scored it
            {scoring?.version ? ` · ${scoring.version}` : ""}
          </h2>

          <div className="mt-5 space-y-5">
            {DIMENSION_ORDER.map((key) => {
              const dimension = feedback?.dimensions.find((entry) => entry.key === key);
              const value = dimension?.score ?? signals[key] ?? 0;
              const label = dimension?.label ?? key;

              return (
                <div key={key}>
                  <div className="flex items-baseline justify-between gap-4">
                    <p className="text-sm font-medium text-foreground">{label}</p>
                    <p className="font-mono text-[11px] tabular-nums text-muted">{value}</p>
                  </div>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-foreground/10">
                    <div className="h-full rounded-full bg-primary" style={{ width: `${value}%` }} />
                  </div>
                  {dimension ? (
                    <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
                      {dimension.verdict}
                    </p>
                  ) : null}
                </div>
              );
            })}
          </div>

          <p className="mt-6 border-t border-card-border pt-4 text-xs leading-relaxed text-muted">
            Measured on the server from your answer: coverage of the brief, readable structure, and concrete
            specifics. Duration is taken from the session, not from your device.
          </p>
        </section>

        <div className="mt-6 grid gap-6 md:grid-cols-2">
          {/* Improvement over time, same skill only. */}
          <section className="rounded border border-card-border bg-card p-6">
            <div className="flex items-baseline justify-between">
              <h2 className="text-sm font-medium text-foreground">
                {category ? skillLabel(category) : "Skill"} trend
              </h2>
              <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted">
                last {history.length}
              </p>
            </div>
            <ScoreHistory rows={history} attemptId={attempt.id as string} />
            <p className="mt-4 text-xs leading-relaxed text-muted">
              Recent average:{" "}
              <span className="font-medium text-foreground">{recentAverage(skillAttempts) ?? "—"}</span> ·
              Best:{" "}
              <span className="font-medium text-foreground">
                {skillAttempts.reduce((best, row) => Math.max(best, row.score ?? 0), 0) || "—"}
              </span>
            </p>
          </section>

          {/* Earned level, with the exact remaining requirement. */}
          <section className="rounded border border-card-border bg-card p-6">
            <div className="flex items-baseline justify-between">
              <h2 className="text-sm font-medium text-foreground">Level</h2>
              <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted">
                {category ? skillLabel(category) : "Overall"}
              </p>
            </div>

            <p className="mt-3 text-lg font-semibold tracking-tight text-foreground">{level.level.name}</p>
            <p className="mt-1 text-xs leading-relaxed text-muted">{level.level.description}</p>

            <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-foreground/10">
              <div className="h-full rounded-full bg-accent" style={{ width: `${level.percent}%` }} />
            </div>
            <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
              {level.next ? (
                <>
                  <span className="text-foreground">{level.requirement}</span> to reach {level.next.name}.
                </>
              ) : (
                level.requirement
              )}
            </p>

            <p className="mt-3 font-mono text-[10px] uppercase tracking-[0.1em] text-muted">
              {level.days} days · avg {level.average ?? "—"}
            </p>
          </section>
        </div>

        {/* Streak, stated as a fact rather than a fire emoji. */}
        <section className="mt-6 rounded border border-card-border bg-card px-6 py-5">
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <p className="text-sm text-foreground">
              {loggedToday
                ? `Day ${streak?.current_streak ?? 0} is logged.`
                : `Current streak: ${streak?.current_streak ?? 0}.`}{" "}
              <span className="text-muted-foreground">
                {milestone
                  ? `${milestone - (streak?.current_streak ?? 0)} more ${milestone - (streak?.current_streak ?? 0) === 1 ? "day" : "days"} to ${milestone}.`
                  : "You have passed every milestone we track."}
              </span>
            </p>
            <p className="font-mono text-[10px] uppercase tracking-[0.1em] text-muted">
              longest {(streak?.longest_streak ?? 0)} · {streak?.total_practice_days ?? 0} days total
            </p>
          </div>
        </section>

        {/* The next step, with its reason. */}
        {next ? (
          <section className="mt-6 rounded border border-card-border bg-card p-6">
            <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted">Next session</p>
            <h2 className="mt-2 text-lg font-semibold tracking-tight text-foreground">
              {next.challenge.title}
            </h2>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{next.reason}</p>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <Link href={`/practice/${next.challenge.slug}`} className={buttonStyles("primary", "md")}>
                Start {next.challenge.estimated_minutes} min session
              </Link>
              <Link href="/practice" className={buttonStyles("secondary", "md")}>
                Choose something else
              </Link>
              <Link
                href={`/practice/${challengeRow?.slug ?? slug}`}
                className={buttonStyles("ghost", "md")}
              >
                Practise this one again
              </Link>
            </div>
          </section>
        ) : null}

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
          <Link href={`/practice/${challengeRow?.slug ?? slug}`} className={buttonStyles("secondary", "md")}>
            Retry this challenge
          </Link>
          <Link href="/dashboard" className={buttonStyles("ghost", "md")}>
            Dashboard
          </Link>
        </div>

        <p className="mt-8 text-xs leading-relaxed text-muted">
          Attempts cannot be edited — that permanence is what makes the record worth reading. You can still
          export or erase everything from{" "}
          <Link href="/settings" className="underline underline-offset-4">
            Settings
          </Link>
          .
        </p>
      </main>
    </div>
  );
}
