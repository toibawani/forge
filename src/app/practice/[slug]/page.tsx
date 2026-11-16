import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getServerUser } from "@/lib/supabase/server";
import { PracticeRunner } from "./PracticeRunner";
import { parseContent, parseRubric, skillLabel, type Challenge } from "@/lib/challenges";
import { eyebrowStyles } from "@/components/ui/styles";

export const metadata: Metadata = {
  title: "Practice session — Forge",
  description: "A short, focused challenge scored on the substance of your answer.",
};

export const dynamic = "force-dynamic";

export default async function ChallengePage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ retryOf?: string | string[] }>;
}) {
  const { slug } = await params;
  const { retryOf: retryParam } = await searchParams;
  // Only a shape-valid id is forwarded; ownership is checked server-side when
  // the attempt is written, so a guessed id resolves to nothing.
  const retryOf =
    typeof retryParam === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(retryParam)
      ? retryParam
      : undefined;

  const session = await getServerUser();
  if (!session) redirect(`/login?next=/practice/${slug}`);

  const { supabase, user } = session;

  const [challengeResult, profileResult] = await Promise.all([
    supabase
      .from("challenges")
      .select(
        "id, slug, title, description, difficulty, category, estimated_minutes, time_limit_seconds, content, rubric"
      )
      .eq("slug", slug)
      .eq("is_active", true)
      .maybeSingle(),
    supabase.from("profiles").select("consent_at").eq("id", user.id).maybeSingle(),
  ]);

  if (!challengeResult.data) notFound();

  const row = challengeResult.data;
  const challenge: Challenge = {
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
  };

  return (
    <div className="min-h-screen">
      <header className="border-b border-card-border">
        <div className="mx-auto flex w-full max-w-3xl items-center justify-between px-6 py-4">
          <Link href="/practice" className="text-[13px] text-muted-foreground hover:text-foreground">
            ← All challenges
          </Link>
          <Link href="/dashboard" className="text-[17px] font-semibold tracking-tight text-primary">
            Forge
          </Link>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl px-6 pb-32 pt-10">
        <p className={eyebrowStyles}>
          {skillLabel(challenge.category)} · {challenge.difficulty} · {challenge.estimated_minutes} min
        </p>
        <h1 className="mt-3 text-[30px] font-semibold leading-tight tracking-tight text-foreground">
          {challenge.title}
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{challenge.description}</p>

        {retryOf ? (
          <p className="mt-4 rounded border border-card-border bg-card px-4 py-3 text-xs leading-relaxed text-muted-foreground">
            This is a retry: a different prompt on the same skill. It is labelled in your record and does
            not extend your streak.
          </p>
        ) : null}

        <PracticeRunner
          challenge={challenge}
          consentMissing={!profileResult.data?.consent_at}
          retryOf={retryOf}
        />
      </main>
    </div>
  );
}
