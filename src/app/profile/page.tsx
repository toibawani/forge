import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerUser } from "@/lib/supabase/server";
import { buttonStyles, eyebrowStyles } from "@/components/ui/styles";

export const metadata: Metadata = {
  title: "Skill record — Forge",
  description: "Every attempt you have logged, in order, with the score it earned.",
};

export const dynamic = "force-dynamic";

type AttemptRow = {
  id: string;
  score: number | null;
  practice_date: string;
  time_spent_seconds: number;
  status: string;
  challenges:
    | { title: string; category: string; difficulty: string }
    | { title: string; category: string; difficulty: string }[]
    | null;
};

function monthLabel(value: string): string {
  return new Date(`${value}T00:00:00Z`).toLocaleDateString("en-IN", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

export default async function ProfilePage() {
  const session = await getServerUser();
  if (!session) redirect("/login?next=/profile");

  const { supabase, user } = session;

  const [profileResult, streakResult, attemptsResult] = await Promise.all([
    supabase
      .from("profiles")
      .select("display_name, headline, bio, skills, visibility, created_at")
      .eq("id", user.id)
      .maybeSingle(),
    supabase
      .from("streaks")
      .select("current_streak, longest_streak, total_practice_days, last_practice_date")
      .eq("user_id", user.id)
      .maybeSingle(),
    supabase
      .from("challenge_attempts")
      .select("id, score, practice_date, time_spent_seconds, status, challenges(title, category, difficulty)")
      .eq("user_id", user.id)
      .order("practice_date", { ascending: false })
      .limit(120),
  ]);

  const profile = profileResult.data;
  const streak = streakResult.data;
  const attempts = (attemptsResult.data ?? []) as AttemptRow[];

  const grouped = new Map<string, AttemptRow[]>();
  for (const attempt of attempts) {
    const key = monthLabel(attempt.practice_date);
    grouped.set(key, [...(grouped.get(key) ?? []), attempt]);
  }

  const scored = attempts.filter((attempt) => typeof attempt.score === "number");
  const average = scored.length
    ? Math.round(scored.reduce((total, attempt) => total + (attempt.score ?? 0), 0) / scored.length)
    : null;

  return (
    <div className="min-h-screen">
      <header className="border-b border-card-border">
        <div className="mx-auto flex w-full max-w-4xl items-center justify-between px-6 py-4">
          <Link href="/" className="text-[17px] font-semibold tracking-tight text-primary">
            Forge
          </Link>
          <nav className="flex items-center gap-4 text-[13px]">
            <Link href="/dashboard" className="text-muted-foreground hover:text-foreground">
              Dashboard
            </Link>
            <Link href="/settings" className="text-muted-foreground hover:text-foreground">
              Settings
            </Link>
          </nav>
        </div>
      </header>

      <main className="mx-auto w-full max-w-4xl px-6 py-12">
        <p className={eyebrowStyles}>Skill record</p>
        <h1 className="mt-2 text-[30px] font-semibold leading-tight tracking-tight text-foreground">
          {profile?.display_name ?? "Your record"}
        </h1>
        {profile?.headline ? (
          <p className="mt-1 text-sm text-muted-foreground">{profile.headline}</p>
        ) : null}

        <div className="mt-8 flex flex-wrap gap-x-10 gap-y-4 border-y border-card-border py-5">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted">Streak</p>
            <p className="mt-1 text-xl font-semibold tabular-nums">{streak?.current_streak ?? 0}</p>
          </div>
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted">Longest</p>
            <p className="mt-1 text-xl font-semibold tabular-nums">{streak?.longest_streak ?? 0}</p>
          </div>
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted">Days practised</p>
            <p className="mt-1 text-xl font-semibold tabular-nums">{streak?.total_practice_days ?? 0}</p>
          </div>
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted">Average score</p>
            <p className="mt-1 text-xl font-semibold tabular-nums">{average ?? "—"}</p>
          </div>
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted">Attempts</p>
            <p className="mt-1 text-xl font-semibold tabular-nums">{attempts.length}</p>
          </div>
        </div>

        {profile?.skills && profile.skills.length > 0 ? (
          <ul className="mt-6 flex flex-wrap gap-2" aria-label="Declared skills">
            {profile.skills.map((skill: string) => (
              <li
                key={skill}
                className="rounded border border-card-border bg-card px-2.5 py-1 font-mono text-[11px] text-muted-foreground"
              >
                {skill}
              </li>
            ))}
          </ul>
        ) : null}

        {attempts.length === 0 ? (
          <div className="mt-12 rounded border border-card-border bg-card px-6 py-12 text-center">
            <p className="text-sm font-medium text-foreground">This record is empty — for now.</p>
            <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-muted-foreground">
              One logged session creates the first data point. Consistency after that is what recruiters read.
            </p>
            <Link href="/dashboard" className={buttonStyles("primary", "md", "mt-5")}>
              Back to dashboard
            </Link>
          </div>
        ) : (
          <div className="mt-12 space-y-10">
            {Array.from(grouped.entries()).map(([month, rows]) => (
              <section key={month}>
                <div className="flex items-baseline justify-between">
                  <h2 className="text-sm font-medium text-foreground">{month}</h2>
                  <p className="font-mono text-[10px] uppercase tracking-[0.1em] text-muted">
                    {rows.length} {rows.length === 1 ? "session" : "sessions"}
                  </p>
                </div>

                <ul className="mt-4 divide-y divide-card-border border-y border-card-border">
                  {rows.map((attempt) => {
                    const challenge = Array.isArray(attempt.challenges)
                      ? attempt.challenges[0]
                      : attempt.challenges;

                    return (
                      <li key={attempt.id} className="grid grid-cols-[auto_1fr_auto] items-center gap-4 py-3">
                        <span className="w-12 font-mono text-[11px] text-muted">
                          {new Date(`${attempt.practice_date}T00:00:00Z`).toLocaleDateString("en-IN", {
                            day: "2-digit",
                            month: "short",
                            timeZone: "UTC",
                          })}
                        </span>

                        <div className="min-w-0">
                          <p className="truncate text-sm text-foreground">
                            {challenge?.title ?? "Practice session"}
                          </p>
                          <p className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.1em] text-muted">
                            {challenge?.category ?? "general"} · {challenge?.difficulty ?? "unrated"} ·{" "}
                            {Math.max(1, Math.round(attempt.time_spent_seconds / 60))} min
                          </p>
                        </div>

                        <div className="flex items-center gap-3">
                          <div className="h-1.5 w-24 overflow-hidden rounded-full bg-foreground/10">
                            <div
                              className="h-full rounded-full bg-primary"
                              style={{ width: `${attempt.score ?? 0}%` }}
                            />
                          </div>
                          <span className="w-7 text-right text-sm font-semibold tabular-nums">
                            {attempt.score ?? "—"}
                          </span>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </section>
            ))}
          </div>
        )}

        <div className="mt-12 flex flex-wrap items-center gap-3 border-t border-card-border pt-6">
          <a href="/api/export?format=csv" className={buttonStyles("secondary", "sm")}>
            Export this record (CSV)
          </a>
          <a href="/api/export?format=json" className={buttonStyles("ghost", "sm")}>
            Export everything (JSON)
          </a>
          <span className="text-xs text-muted">Times are recorded in UTC. Attempts cannot be edited.</span>
        </div>
      </main>
    </div>
  );
}
