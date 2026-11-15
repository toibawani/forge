import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerUser } from "@/lib/supabase/server";
import { buttonStyles, eyebrowStyles } from "@/components/ui/styles";

export const metadata: Metadata = {
  title: "Dashboard — Forge",
  description: "Your daily practice record: streak, consistency and demonstrated skill.",
};

export const dynamic = "force-dynamic";

type AttemptRow = {
  id: string;
  score: number | null;
  created_at: string;
  practice_date: string;
  time_spent_seconds: number;
  challenges: { title: string; category: string; difficulty: string } | { title: string; category: string; difficulty: string }[] | null;
};

const DAY_MS = 24 * 60 * 60 * 1000;

function isoDay(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function lastDays(count: number): string[] {
  const today = new Date();
  return Array.from({ length: count }, (_, index) => {
    const date = new Date(today.getTime() - (count - 1 - index) * DAY_MS);
    return isoDay(date);
  });
}

/** Distinct practice days inside the trailing window, used for consistency. */
function recentPracticeDays(attempts: AttemptRow[], days: number): Set<string> {
  const cutoff = Date.now() - days * DAY_MS;
  return new Set(
    attempts
      .filter((attempt) => new Date(attempt.created_at).getTime() >= cutoff)
      .map((attempt) => attempt.practice_date)
  );
}

function scoreBand(score: number | null): { label: string; className: string } {
  if (score === null) return { label: "unscored", className: "text-muted" };
  if (score >= 85) return { label: "strong", className: "text-success" };
  if (score >= 70) return { label: "solid", className: "text-foreground" };
  if (score >= 50) return { label: "developing", className: "text-accent" };
  return { label: "needs work", className: "text-destructive" };
}

function formatDay(value: string): string {
  return new Date(`${value}T00:00:00Z`).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
}

export default async function DashboardPage() {
  const session = await getServerUser();
  if (!session) redirect("/login?next=/dashboard");

  const { supabase, user } = session;

  const [profileResult, streakResult, attemptsResult] = await Promise.all([
    supabase
      .from("profiles")
      .select("display_name, role, visibility, consent_at, consent_policy_version, deletion_scheduled_for, created_at")
      .eq("id", user.id)
      .maybeSingle(),
    supabase
      .from("streaks")
      .select("current_streak, longest_streak, total_practice_days, last_practice_date")
      .eq("user_id", user.id)
      .maybeSingle(),
    supabase
      .from("challenge_attempts")
      .select("id, score, created_at, practice_date, time_spent_seconds, challenges(title, category, difficulty)")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(40),
  ]);

  const profile = profileResult.data;
  const streak = streakResult.data;
  const attempts = (attemptsResult.data ?? []) as AttemptRow[];

  const days = lastDays(14);
  const practicedDays = new Set(attempts.map((attempt) => attempt.practice_date));
  const consistency = Math.round((recentPracticeDays(attempts, 30).size / 30) * 100);
  const scored = attempts.filter((attempt) => typeof attempt.score === "number");
  const averageScore = scored.length
    ? Math.round(scored.reduce((total, attempt) => total + (attempt.score ?? 0), 0) / scored.length)
    : null;

  const today = isoDay(new Date());
  const practicedToday = practicedDays.has(today);
  const currentStreak = streak?.current_streak ?? 0;

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
          {profile?.display_name ?? "You"} {currentStreak > 0 ? `· day ${currentStreak}` : ""}
        </h1>
        <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted-foreground">
          {practicedToday
            ? "Today is logged. The streak holds."
            : currentStreak > 0
              ? "Today is still open. One short session keeps the streak alive."
              : "No session logged today. Start with something small — the record begins at one day."}
        </p>

        <div className="mt-10 grid gap-px overflow-hidden rounded border border-card-border bg-card-border sm:grid-cols-2 lg:grid-cols-4">
          <div className="bg-card p-5">
            <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-muted">Current streak</p>
            <p className="mt-3 text-3xl font-semibold tracking-tight text-foreground">{currentStreak}</p>
            <p className="mt-1 text-xs text-muted">days in a row</p>
          </div>
          <div className="bg-card p-5">
            <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-muted">Longest streak</p>
            <p className="mt-3 text-3xl font-semibold tracking-tight text-foreground">
              {streak?.longest_streak ?? 0}
            </p>
            <p className="mt-1 text-xs text-muted">personal best</p>
          </div>
          <div className="bg-card p-5">
            <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-muted">Consistency</p>
            <p className="mt-3 text-3xl font-semibold tracking-tight text-foreground">{consistency}%</p>
            <p className="mt-1 text-xs text-muted">of the last 30 days</p>
          </div>
          <div className="bg-card p-5">
            <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-muted">Average score</p>
            <p className="mt-3 text-3xl font-semibold tracking-tight text-foreground">
              {averageScore ?? "—"}
            </p>
            <p className="mt-1 text-xs text-muted">
              {scored.length} scored {scored.length === 1 ? "attempt" : "attempts"}
            </p>
          </div>
        </div>

        <section className="mt-10 rounded border border-card-border bg-card p-6">
          <div className="flex items-baseline justify-between">
            <h2 className="text-sm font-medium text-foreground">Last 14 days</h2>
            <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted">
              {practicedDays.size > 0 ? "logged days highlighted" : "nothing logged yet"}
            </p>
          </div>
          <div className="mt-5 flex items-end gap-1.5" aria-hidden="true">
            {days.map((day) => {
              const active = practicedDays.has(day);
              return (
                <div key={day} className="flex-1">
                  <div
                    className={`h-14 rounded-sm border ${
                      active
                        ? "border-primary/30 bg-primary"
                        : "border-card-border bg-foreground/[0.03]"
                    }`}
                    title={formatDay(day)}
                  />
                  <p className="mt-2 text-center font-mono text-[9px] text-muted">
                    {day.slice(8)}
                  </p>
                </div>
              );
            })}
          </div>
          <p className="sr-only">
            {days.filter((day) => practicedDays.has(day)).length} of the last 14 days have a logged session.
          </p>
        </section>

        <div className="mt-10 grid gap-6 lg:grid-cols-[1.6fr_1fr]">
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
              </div>
            ) : (
              <ul className="divide-y divide-card-border">
                {recent.map((attempt) => {
                  const challenge = Array.isArray(attempt.challenges)
                    ? attempt.challenges[0]
                    : attempt.challenges;
                  const band = scoreBand(attempt.score);

                  return (
                    <li key={attempt.id} className="flex items-center justify-between gap-4 px-6 py-3.5">
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
                        <span className={`font-mono text-[10px] uppercase tracking-[0.1em] ${band.className}`}>
                          {band.label}
                        </span>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          <aside className="space-y-6">
            <div className="rounded border border-card-border bg-card p-6">
              <p className={eyebrowStyles}>Today</p>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                {practicedToday
                  ? "Logged. Consistency is the signal recruiters trust most — do not break the chain."
                  : "A 5–15 minute session is enough to keep the day. Quality beats duration."}
              </p>
              <Link href="/profile" className={buttonStyles("primary", "md", "mt-5 w-full")}>
                {practicedToday ? "Review today's work" : "See your record"}
              </Link>
            </div>

            <div className="rounded border border-card-border bg-card p-6">
              <p className={eyebrowStyles}>Visibility</p>
              <p className="mt-3 text-sm text-foreground capitalize">
                {profile?.visibility === "recruiters_only"
                  ? "Verified recruiters"
                  : profile?.visibility === "public"
                    ? "Public"
                    : "Private"}
              </p>
              <p className="mt-1 text-xs leading-relaxed text-muted">
                Your email is never shown to recruiters. Scores and consistency are what they see.
              </p>
              <Link href="/settings" className={buttonStyles("secondary", "sm", "mt-4")}>
                Change visibility
              </Link>
            </div>
          </aside>
        </div>

        <p className="mt-10 border-t border-card-border pt-6 text-xs leading-relaxed text-muted">
          Scores are computed from the challenge rubric on the server, not guessed. Attempts are immutable:
          editing history would destroy the only thing that makes this record worth trusting.
        </p>
      </main>
    </div>
  );
}
