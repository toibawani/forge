import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerUser } from "@/lib/supabase/server";
import { buttonStyles, eyebrowStyles } from "@/components/ui/styles";
import { recommendNext, scoreBand, skillLabel, type Challenge } from "@/lib/challenges";
import {
  consistencyTrend,
  levelsByCategory,
  nextMilestone,
  progressFor,
  scoreTrend,
  type ScoredAttempt,
} from "@/lib/progression";
import { TRACK_NAMES } from "@/lib/track-registry";
import { UNRATED_CHALLENGE_DEVIATION, ratingViews, type RatingAttempt } from "@/lib/ratings";
import { dailyPick } from "@/lib/daily-pick";
import { localDay, previousDay } from "@/lib/timezone";

export const metadata: Metadata = {
  title: "Dashboard — Forge",
  description: "Your daily practice record: streak, consistency and demonstrated skill.",
};

export const dynamic = "force-dynamic";

type AttemptRow = {
  id: string;
  challenge_id: string;
  score: number | null;
  created_at: string;
  practice_date: string;
  time_spent_seconds: number;
  /** Set on retries, which are excluded from ratings and the picker. */
  retry_of: string | null;
  challenges:
    | {
        title: string;
        category: string;
        difficulty: string;
        slug: string;
        track: string | null;
        initial_rating: number | null;
        sub_skills: string[] | null;
      }
    | {
        title: string;
        category: string;
        difficulty: string;
        slug: string;
        track: string | null;
        initial_rating: number | null;
        sub_skills: string[] | null;
      }[]
    | null;
};

/**
 * The last `count` local days, newest last. Stepping the calendar rather than
 * subtracting 86 400 seconds keeps the window aligned with the days the attempts
 * are stamped with, including across a DST change.
 */
function lastDays(count: number, timeZone: string): string[] {
  const days: string[] = [];
  let day = localDay(new Date(), timeZone);

  for (let index = 0; index < count; index += 1) {
    days.unshift(day);
    day = previousDay(day);
  }

  return days;
}

function attemptChallenge(attempt: AttemptRow) {
  return Array.isArray(attempt.challenges) ? attempt.challenges[0] : attempt.challenges;
}

function formatDay(value: string): string {
  return new Date(`${value}T00:00:00Z`).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
}

function deltaLabel(delta: number | null, unit = ""): string {
  if (delta === null) return "no earlier window";
  if (delta === 0) return `flat${unit ? ` ${unit}` : ""}`;
  return `${delta > 0 ? "+" : ""}${delta}${unit}`;
}

export default async function DashboardPage() {
  const session = await getServerUser();
  if (!session) redirect("/login?next=/dashboard");

  const { supabase, user } = session;

  const [profileResult, streakResult, attemptsResult, catalogueResult] = await Promise.all([
    supabase
      .from("profiles")
      .select(
        "display_name, role, visibility, consent_at, consent_policy_version, deletion_scheduled_for, created_at, timezone"
      )
      .eq("id", user.id)
      .maybeSingle(),
    supabase
      .from("streaks")
      .select("current_streak, longest_streak, total_practice_days, last_practice_date")
      .eq("user_id", user.id)
      .maybeSingle(),
    supabase
      .from("challenge_attempts")
      .select(
        "id, challenge_id, score, created_at, practice_date, time_spent_seconds, retry_of, challenges(title, category, difficulty, slug, track, initial_rating, sub_skills)"
      )
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(120),
    supabase
      .from("challenges")
      .select(
        "id, slug, title, description, difficulty, category, estimated_minutes, time_limit_seconds, track, sub_skills, initial_rating"
      )
      .eq("is_active", true),
  ]);

  const profile = profileResult.data;
  const streak = streakResult.data;
  const attempts = (attemptsResult.data ?? []) as AttemptRow[];

  const scoredAttempts: ScoredAttempt[] = attempts.map((attempt) => ({
    score: attempt.score,
    practice_date: attempt.practice_date,
    created_at: attempt.created_at,
    category: attemptChallenge(attempt)?.category ?? null,
  }));

  const days = lastDays(14, (profileResult.data?.timezone as string | null) ?? "UTC");
  const practicedDays = new Set(attempts.map((attempt) => attempt.practice_date));
  const weekly = consistencyTrend(scoredAttempts, 7);
  const scores = scoreTrend(scoredAttempts, 5);
  const overall = progressFor(scoredAttempts);
  const levels = levelsByCategory(scoredAttempts);

  // A practice day is the person's local calendar day, not the server's UTC day.
  const timeZone = (profileResult.data?.timezone as string | null) ?? "UTC";
  const today = localDay(new Date(), timeZone);
  const practicedToday = practicedDays.has(today);
  const todayAttempt = practicedToday
    ? attempts.find((attempt) => attempt.practice_date === today) ?? null
    : null;
  const currentStreak = streak?.current_streak ?? 0;
  const streakAtRisk = !practicedToday && streak?.last_practice_date === previousDay(today);
  const milestone = nextMilestone(currentStreak);

  const recommendation = recommendNext({
    challenges: (catalogueResult.data ?? []).map((row) => ({
      id: row.id as string,
      slug: row.slug as string,
      title: row.title as string,
      description: row.description as string,
      difficulty: row.difficulty as Challenge["difficulty"],
      category: row.category as string,
      estimated_minutes: row.estimated_minutes as number,
      time_limit_seconds: (row.time_limit_seconds as number | null) ?? null,
      content: {},
      rubric: {},
    })),
    attempts: attempts.map((attempt) => ({
      challenge_id: attempt.challenge_id,
      category: attemptChallenge(attempt)?.category ?? null,
      score: attempt.score,
      practice_date: attempt.practice_date,
      created_at: attempt.created_at,
    })),
  });

  // Ratings run over the same immutable log the rest of this page reads, minus
  // retries: repeating a prompt must not move a rating.
  const rankedAttempts = attempts.filter((attempt) => !attempt.retry_of);
  const ratingAttempts: RatingAttempt[] = rankedAttempts.map((attempt) => {
    const relation = attemptChallenge(attempt);
    return {
      track: relation?.track ?? relation?.category ?? "general",
      subSkills: relation?.sub_skills ?? (relation?.category ? [relation.category] : []),
      score: attempt.score,
      challengeRating: relation?.initial_rating ?? 1500,
      challengeDeviation: UNRATED_CHALLENGE_DEVIATION,
      at: attempt.created_at,
    };
  });
  const trackRatings = ratingViews(
    ratingAttempts,
    TRACK_NAMES
  );

  const pick = dailyPick({
    challenges: (catalogueResult.data ?? []).map((row) => ({
      slug: row.slug as string,
      track: (row.track as string | null) ?? (row.category as string),
      subSkills: ((row.sub_skills as string[] | null) ?? [row.category as string]).filter(Boolean),
      difficultyRating: (row.initial_rating as number | null) ?? 1500,
    })),
    attempts: ratingAttempts,
    attemptedSlugs: rankedAttempts.map((attempt) => ({
      slug: attemptChallenge(attempt)?.slug ?? "",
      at: attempt.created_at,
    })).filter((entry) => entry.slug.length > 0),
    today: new Date().toISOString().slice(0, 10),
  });

  const todayReason = pick?.reason ?? recommendation?.reason ?? null;

  const skills = Array.from(levels.entries())
    .sort((a, b) => b[1].days - a[1].days)
    .slice(0, 3);

  const recent = attempts.slice(0, 6);
  const needsConsent = !profile?.consent_at;

  return (
    <div className="min-h-screen">
      <header className="border-b border-card-border">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between px-6 py-4">
          <Link href="/" className="flex items-baseline gap-2.5">
            <span className="text-[17px] font-semibold tracking-tight text-primary">Forge</span>
            <span className="hidden font-mono text-[10px] uppercase tracking-[0.16em] text-muted sm:inline">
              daily skill proof
            </span>
          </Link>
          <nav className="flex items-center gap-4 text-[13px]" aria-label="Account">
            <Link href="/practice" className="text-foreground hover:text-primary">
              Practise
            </Link>
            <Link href="/profile" className="text-muted-foreground hover:text-foreground">
              Record
            </Link>
            <Link href="/settings" className="text-muted-foreground hover:text-foreground">
              Settings
            </Link>
            {profile?.role === "recruiter" || profile?.role === "admin" ? (
              <Link href="/dashboard/recruiter" className="text-muted-foreground hover:text-foreground">
                Hiring
              </Link>
            ) : null}
            {profile?.role === "reviewer" || profile?.role === "admin" ? (
              <Link href="/dashboard/review" className="text-muted-foreground hover:text-foreground">
                Review
              </Link>
            ) : null}
          </nav>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl px-6 py-12">
        {profile?.deletion_scheduled_for ? (
          <div className="mb-8 rounded border border-accent/40 bg-accent/[0.06] px-4 py-3 text-sm">
            This account is scheduled for deletion on{" "}
            <strong className="font-medium">
              {new Date(profile.deletion_scheduled_for).toLocaleDateString("en-IN", {
                day: "numeric",
                month: "long",
                year: "numeric",
              })}
            </strong>
            .{" "}
            <Link href="/settings" className="underline underline-offset-4">
              Cancel deletion
            </Link>
          </div>
        ) : null}

        {needsConsent ? (
          <div className="mb-8 rounded border border-accent/40 bg-accent/[0.06] px-4 py-3 text-sm">
            Your consent record is missing — the account was created outside the Forge signup flow.{" "}
            <Link href="/settings" className="underline underline-offset-4">
              Review and record consent
            </Link>
            .
          </div>
        ) : null}

        <p className={eyebrowStyles}>Your record</p>
        <h1 className="mt-2 text-[30px] font-semibold leading-tight tracking-tight text-foreground">
          {profile?.display_name ?? "You"}
        </h1>
        <p className="mt-1 font-mono text-[11px] uppercase tracking-[0.1em] text-muted">
          {overall.level.name} · {overall.days} days practised · {attempts.length} attempts
        </p>

        {/* The single most important block: what to do next, and why. */}
        <section className="mt-8 rounded border border-card-border bg-card p-6">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
            <div className="max-w-lg">
              <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted">
                {practicedToday ? "Today is logged" : "Today"}
              </p>
              <p className="mt-2 text-sm leading-relaxed text-foreground">
                {practicedToday
                  ? todayAttempt?.score !== null && todayAttempt?.score !== undefined
                    ? `Score ${todayAttempt.score}. ${
                        streakAtRisk
                          ? "Tomorrow is what keeps this going."
                          : "The streak holds — one session a day is the whole trick."
                      }`
                    : "Logged. The streak holds."
                  : streakAtRisk
                    ? "Nothing logged today and the streak is from yesterday — one short session keeps it."
                    : currentStreak === 0
                      ? "No session logged today. Start with something small; the record begins at one day."
                      : "Today is still open. One short session is enough to keep the day."}
              </p>

              {recommendation ? (
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                  Next: <span className="text-foreground">{recommendation.challenge.title}</span> —{" "}
                  {todayReason}
                </p>
              ) : null}
            </div>

            <div className="flex shrink-0 flex-wrap gap-3">
              <Link
                href={recommendation ? `/practice/${recommendation.challenge.slug}` : "/practice"}
                className={buttonStyles("primary", "md")}
              >
                {practicedToday ? "Practise again" : "Start today's challenge"}
              </Link>
              {practicedToday && todayAttempt ? (
                <Link
                  href={`/practice/${attemptChallenge(todayAttempt)?.slug ?? ""}/result/${todayAttempt.id}`}
                  className={buttonStyles("secondary", "md")}
                >
                  Review today
                </Link>
              ) : (
                <Link href="/practice" className={buttonStyles("secondary", "md")}>
                  Browse
                </Link>
              )}
            </div>
          </div>
        </section>

        {trackRatings.length > 0 ? (
          <section className="mt-6 rounded border border-card-border bg-card" aria-labelledby="ratings-heading">
            <div className="flex flex-col gap-1 border-b border-card-border px-5 py-3 sm:flex-row sm:items-baseline sm:justify-between">
              <h2 id="ratings-heading" className="text-sm font-medium text-foreground">
                Rating by skill
              </h2>
              <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted">
                Glicko-2 · rebuilt from attempts
              </p>
            </div>

            <ul className="divide-y divide-card-border">
              {trackRatings.map((rating) => (
                <li
                  key={rating.track}
                  className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 px-5 py-4"
                >
                  <div className="min-w-0">
                    <p className="text-sm text-foreground">{rating.trackName}</p>
                    <p className="mt-0.5 text-xs leading-relaxed text-muted">{rating.description}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-mono text-sm tabular-nums text-foreground">{rating.label}</p>
                    <p className="mt-0.5 text-xs text-muted">
                      {rating.attempts} scored attempt{rating.attempts === 1 ? "" : "s"}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <div className="mt-6 grid gap-px overflow-hidden rounded border border-card-border bg-card-border sm:grid-cols-2 lg:grid-cols-4">
          <div className="bg-card p-5">
            <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-muted">Streak</p>
            <p className="mt-2 text-3xl font-semibold tabular-nums tracking-tight text-foreground">
              {currentStreak}
            </p>
            <p className={`mt-1 text-xs ${streakAtRisk ? "text-accent" : "text-muted"}`}>
              {practicedToday
                ? milestone
                  ? `${milestone - currentStreak} to ${milestone}`
                  : "logged today"
                : streakAtRisk
                  ? "at risk — log today"
                  : "days in a row"}
            </p>
          </div>

          <div className="bg-card p-5">
            <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-muted">This week</p>
            <p className="mt-2 text-3xl font-semibold tabular-nums tracking-tight text-foreground">
              {weekly.thisWindow}
              <span className="text-base font-normal text-muted">/7</span>
            </p>
            <p className="mt-1 text-xs text-muted">
              days practised · {deltaLabel(weekly.delta)} vs last week
            </p>
          </div>

          <div className="bg-card p-5">
            <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-muted">Recent average</p>
            <p className="mt-2 text-3xl font-semibold tabular-nums tracking-tight text-foreground">
              {scores.recent ?? "—"}
            </p>
            <p className="mt-1 text-xs text-muted">
              {scores.previous === null
                ? `last ${Math.min(5, attempts.length)} attempts`
                : `${deltaLabel(scores.delta)} vs previous five`}
            </p>
          </div>

          <div className="bg-card p-5">
            <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-muted">Level</p>
            <p className="mt-2 text-lg font-semibold tracking-tight text-foreground">{overall.level.name}</p>
            <div className="mt-2 h-1 overflow-hidden rounded-full bg-foreground/10">
              <div className="h-full rounded-full bg-accent" style={{ width: `${overall.percent}%` }} />
            </div>
            <p className="mt-1.5 text-xs leading-relaxed text-muted">{overall.requirement}</p>
          </div>
        </div>

        <section className="mt-6 rounded border border-card-border bg-card p-6">
          <div className="flex items-baseline justify-between">
            <h2 className="text-sm font-medium text-foreground">Last 14 days</h2>
            <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted">
              {days.filter((day) => practicedDays.has(day)).length} days logged
            </p>
          </div>
          <div className="mt-5 flex items-end gap-1.5" aria-hidden="true">
            {days.map((day) => {
              const active = practicedDays.has(day);
              return (
                <div key={day} className="flex-1">
                  <div
                    className={`h-14 rounded-sm border ${
                      active ? "border-primary/30 bg-primary" : "border-card-border bg-foreground/[0.03]"
                    }`}
                    title={formatDay(day)}
                  />
                  <p className="mt-2 text-center font-mono text-[9px] text-muted">{day.slice(8)}</p>
                </div>
              );
            })}
          </div>
          <p className="sr-only">
            {days.filter((day) => practicedDays.has(day)).length} of the last 14 days have a logged session.
          </p>
        </section>

        {skills.length > 0 ? (
          <section className="mt-6 rounded border border-card-border bg-card p-6">
            <div className="flex items-baseline justify-between">
              <h2 className="text-sm font-medium text-foreground">Skill levels</h2>
              <Link href="/practice" className="text-xs text-muted-foreground hover:text-foreground">
                All skills
              </Link>
            </div>

            <div className="mt-5 space-y-5">
              {skills.map(([category, level]) => (
                <div key={category}>
                  <div className="flex items-baseline justify-between gap-3">
                    <p className="text-sm text-foreground">{skillLabel(category)}</p>
                    <p className="font-mono text-[10px] uppercase tracking-[0.1em] text-muted">
                      {level.level.name} · {level.days} days · avg {level.average ?? "—"}
                    </p>
                  </div>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-foreground/10">
                    <div className="h-full rounded-full bg-primary" style={{ width: `${level.percent}%` }} />
                  </div>
                  <p className="mt-1.5 text-xs leading-relaxed text-muted">{level.requirement}</p>
                </div>
              ))}
            </div>
          </section>
        ) : null}

        <div className="mt-6 grid gap-6 lg:grid-cols-[1.6fr_1fr]">
          <section className="rounded border border-card-border bg-card">
            <div className="flex items-baseline justify-between border-b border-card-border px-6 py-4">
              <h2 className="text-sm font-medium text-foreground">Recent sessions</h2>
              <Link href="/profile" className="text-xs text-muted-foreground hover:text-foreground">
                Full record
              </Link>
            </div>

            {recent.length === 0 ? (
              <div className="px-6 py-10 text-center">
                <p className="text-sm text-muted-foreground">
                  No sessions yet. Your first attempt starts the record.
                </p>
                <Link href="/practice" className={buttonStyles("primary", "sm", "mt-4")}>
                  Start your first challenge
                </Link>
              </div>
            ) : (
              <ul className="divide-y divide-card-border">
                {recent.map((attempt) => {
                  const challenge = attemptChallenge(attempt);
                  const band = scoreBand(attempt.score);

                  return (
                    <li key={attempt.id}>
                      <Link
                        href={`/practice/${challenge?.slug ?? ""}/result/${attempt.id}`}
                        className="flex items-center justify-between gap-4 px-6 py-3.5 transition-colors hover:bg-foreground/[0.02]"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm text-foreground">
                            {challenge?.title ?? "Practice session"}
                          </p>
                          <p className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.1em] text-muted">
                            {formatDay(attempt.practice_date)} · {challenge?.category ?? "general"} ·{" "}
                            {Math.max(1, Math.round(attempt.time_spent_seconds / 60))} min
                          </p>
                        </div>
                        <div className="flex shrink-0 items-baseline gap-2">
                          <span className="text-lg font-semibold tabular-nums text-foreground">
                            {attempt.score ?? "—"}
                          </span>
                          <span
                            className={`font-mono text-[10px] uppercase tracking-[0.1em] ${band.className}`}
                          >
                            {band.label}
                          </span>
                        </div>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          <aside className="space-y-6">
            <div className="rounded border border-card-border bg-card p-6">
              <p className={eyebrowStyles}>Visibility</p>
              <p className="mt-3 text-sm capitalize text-foreground">
                {profile?.visibility === "recruiters_only"
                  ? "Verified recruiters"
                  : profile?.visibility === "public"
                    ? "Public"
                    : "Private"}
              </p>
              <p className="mt-1 text-xs leading-relaxed text-muted">
                Recruiters see skill levels, consistency and recent activity — never your email.
              </p>
              <Link href="/settings" className={buttonStyles("secondary", "sm", "mt-4")}>
                Change visibility
              </Link>
            </div>

            <div className="rounded border border-card-border bg-card p-6">
              <p className={eyebrowStyles}>Record</p>
              <dl className="mt-3 space-y-2 text-sm">
                <div className="flex items-baseline justify-between">
                  <dt className="text-muted-foreground">Longest streak</dt>
                  <dd className="tabular-nums text-foreground">{streak?.longest_streak ?? 0}</dd>
                </div>
                <div className="flex items-baseline justify-between">
                  <dt className="text-muted-foreground">Days practised</dt>
                  <dd className="tabular-nums text-foreground">{streak?.total_practice_days ?? 0}</dd>
                </div>
                <div className="flex items-baseline justify-between">
                  <dt className="text-muted-foreground">Scored attempts</dt>
                  <dd className="tabular-nums text-foreground">
                    {attempts.filter((attempt) => typeof attempt.score === "number").length}
                  </dd>
                </div>
              </dl>
              <Link href="/profile" className={buttonStyles("ghost", "sm", "mt-4")}>
                Open skill record
              </Link>
            </div>
          </aside>
        </div>

        <p className="mt-10 border-t border-card-border pt-6 text-xs leading-relaxed text-muted">
          Scores come from the challenge rubric; duration comes from a server-written session. Levels are
          earned from days practised and the quality of your recent attempts — there is no XP to farm and no
          way to buy a level. Attempts are immutable.
        </p>
      </main>
    </div>
  );
}
