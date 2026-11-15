import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerUser } from "@/lib/supabase/server";
import { eyebrowStyles } from "@/components/ui/styles";
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

  const { data, error } = await supabase.rpc("review_queue", { p_limit: 10 });
  const items = (data ?? []) as QueueItem[];

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

        <p className="mt-10 border-t border-card-border pt-6 text-xs leading-relaxed text-muted">
          Your verdict is stored next to the attempt, never inside it. Attempts stay immutable, a second
          verdict on the same attempt is refused, and the rubric score at review time is kept so agreement
          between the rubric and human judgement can be measured.
        </p>
      </main>
    </div>
  );
}
