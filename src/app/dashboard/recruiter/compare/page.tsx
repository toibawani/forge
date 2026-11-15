import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerUser } from "@/lib/supabase/server";
import { buttonStyles, eyebrowStyles } from "@/components/ui/styles";
import { skillLabel } from "@/lib/challenges";
import { summariseCandidate, type Candidate } from "@/lib/recruiter";
import { reviewSummary, type ReviewCounts } from "@/lib/review";

export const metadata: Metadata = {
  title: "Compare candidates — Forge",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function ComparePage({
  searchParams,
}: {
  searchParams: Promise<{ ids?: string | string[] }>;
}) {
  const session = await getServerUser();
  if (!session) redirect("/login?next=/dashboard/recruiter");

  const { supabase, user } = session;

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (profile?.role !== "recruiter" && profile?.role !== "admin") {
    redirect("/dashboard");
  }

  const raw = (await searchParams).ids;
  const ids = Array.from(
    new Set(
      (Array.isArray(raw) ? raw.join(",") : (raw ?? ""))
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean)
    )
  ).slice(0, 4);

  if (ids.length < 2) {
    return (
      <div className="min-h-screen">
        <main className="mx-auto w-full max-w-3xl px-6 py-20">
          <p className={eyebrowStyles}>Compare</p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-foreground">
            Pick two candidates first.
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            Comparison works from real records only. Go back to search, select two to four practitioners,
            then compare.
          </p>
          <Link href="/dashboard/recruiter" className={buttonStyles("primary", "md", "mt-6")}>
            Back to search
          </Link>
        </main>
      </div>
    );
  }

  const [cardsResult, signalsResult, reviewsResult] = await Promise.all([
    supabase
      .from("profile_cards")
      .select(
        "id, display_name, headline, bio, skills, visibility, current_streak, longest_streak, total_practice_days, last_practice_date"
      )
      .in("id", ids),
    supabase
      .from("skill_signals")
      .select(
        "user_id, category, total_attempts, attempts_30d, days_30d, avg_score_30d, avg_score_90d, best_score, strong_days_90d, last_attempt_at"
      )
      .in("user_id", ids),
    supabase
      .from("review_signals")
      .select("user_id, reviewed_attempts, correct, partially_correct, incorrect")
      .in("user_id", ids),
  ]);

  const cards = (cardsResult.data ?? []) as Array<Candidate>;
  const signals = signalsResult.data ?? [];
  const reviewsByUser = new Map(
    (reviewsResult.data ?? []).map((review) => [String(review.user_id), review as ReviewCounts])
  );

  const candidates: Array<Candidate & { summary: ReturnType<typeof summariseCandidate> }> = cards
    .map((card) => ({
      ...card,
      signals: signals
        .filter((signal) => signal.user_id === card.id)
        .map((signal) => ({
          category: signal.category as string,
          total_attempts: signal.total_attempts as number | null,
          attempts_30d: signal.attempts_30d as number | null,
          days_30d: signal.days_30d as number | null,
          avg_score_30d: signal.avg_score_30d as number | null,
          avg_score_90d: signal.avg_score_90d as number | null,
          best_score: signal.best_score as number | null,
          strong_days_90d: signal.strong_days_90d as number | null,
          last_attempt_at: signal.last_attempt_at as string | null,
        })),
    }))
    .map((candidate) => ({ ...candidate, summary: summariseCandidate(candidate) }))
    .sort((a, b) => b.summary.days30 - a.summary.days30);

  const missing = ids.filter((id) => !cards.some((card) => card.id === id));

  return (
    <div className="min-h-screen">
      <main className="mx-auto w-full max-w-5xl px-6 py-12">
        <div className="flex items-baseline justify-between gap-4">
          <div>
            <p className={eyebrowStyles}>Compare</p>
            <h1 className="mt-2 text-[30px] font-semibold leading-tight tracking-tight text-foreground">
              Side by side, on the record.
            </h1>
          </div>
          <Link href="/dashboard/recruiter" className={buttonStyles("secondary", "sm")}>
            Back to search
          </Link>
        </div>

        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
          Every number below comes from logged attempts. Nothing is inferred, scored for &ldquo;fit&rdquo;,
          or weighted into a single ranking.
        </p>

        {missing.length > 0 ? (
          <p className="mt-6 rounded border border-card-border bg-card px-4 py-3 text-sm text-muted-foreground">
            {missing.length === 1 ? "One record is" : `${missing.length} records are`} no longer
            discoverable — that practitioner may have changed their visibility.
          </p>
        ) : null}

        <div className="mt-8 overflow-x-auto rounded border border-card-border bg-card">
          <table className="w-full min-w-[640px] text-sm">
            <caption className="sr-only">Candidate practice records compared</caption>
            <thead>
              <tr className="border-b border-card-border">
                <th scope="col" className="px-5 py-3 text-left font-mono text-[10px] uppercase tracking-[0.12em] text-muted">
                  Candidate
                </th>
                <th scope="col" className="px-5 py-3 text-left font-mono text-[10px] uppercase tracking-[0.12em] text-muted">
                  Strongest skill
                </th>
                <th scope="col" className="px-5 py-3 text-right font-mono text-[10px] uppercase tracking-[0.12em] text-muted">
                  90-day avg
                </th>
                <th scope="col" className="px-5 py-3 text-right font-mono text-[10px] uppercase tracking-[0.12em] text-muted">
                  Active days (30)
                </th>
                <th scope="col" className="px-5 py-3 text-right font-mono text-[10px] uppercase tracking-[0.12em] text-muted">
                  Strong days (90)
                </th>
                <th scope="col" className="px-5 py-3 text-right font-mono text-[10px] uppercase tracking-[0.12em] text-muted">
                  Streak
                </th>
                <th scope="col" className="px-5 py-3 text-left font-mono text-[10px] uppercase tracking-[0.12em] text-muted">
                  Human-reviewed
                </th>
                <th scope="col" className="px-5 py-3 text-left font-mono text-[10px] uppercase tracking-[0.12em] text-muted">
                  Last practice
                </th>
              </tr>
            </thead>
            <tbody>
              {candidates.map((candidate) => {
                const strongDays = candidate.signals.reduce(
                  (total, signal) => total + Number(signal.strong_days_90d ?? 0),
                  0
                );

                return (
                  <tr key={candidate.id} className="border-b border-card-border last:border-b-0">
                    <td className="px-5 py-4">
                      <Link
                        href={`/p/${candidate.id}`}
                        className="text-foreground hover:text-primary"
                      >
                        {candidate.summary.name}
                      </Link>
                      {candidate.headline ? (
                        <p className="mt-0.5 max-w-xs truncate text-xs text-muted">{candidate.headline}</p>
                      ) : null}
                    </td>
                    <td className="px-5 py-4 text-muted-foreground">
                      {candidate.summary.strongestCategory
                        ? skillLabel(candidate.summary.strongestCategory)
                        : "—"}
                    </td>
                    <td className="px-5 py-4 text-right tabular-nums text-foreground">
                      {candidate.summary.strongestScore ?? "—"}
                    </td>
                    <td className="px-5 py-4 text-right tabular-nums text-foreground">
                      {candidate.summary.days30}
                    </td>
                    <td className="px-5 py-4 text-right tabular-nums text-foreground">{strongDays}</td>
                    <td className="px-5 py-4 text-right tabular-nums text-foreground">
                      {candidate.current_streak}
                    </td>
                    <td className="px-5 py-4 text-muted-foreground">
                      {reviewSummary(reviewsByUser.get(candidate.id)).verified
                        ? `${reviewSummary(reviewsByUser.get(candidate.id)).reviewed} reviewed`
                        : "—"}
                    </td>
                    <td className="px-5 py-4 text-muted-foreground">{candidate.summary.activity}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <p className="mt-6 text-xs leading-relaxed text-muted">
          Scores come from each challenge&apos;s rubric (structure, coverage, specificity). The
          human-reviewed column counts verdicts from reviewers who never see whose attempt it is — a dash
          means no attempt has been reviewed, not that the record is unverified in principle.
        </p>
      </main>
    </div>
  );
}
