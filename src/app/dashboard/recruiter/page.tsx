import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerUser } from "@/lib/supabase/server";
import { buttonStyles, eyebrowStyles } from "@/components/ui/styles";
import { RecruiterSearch } from "./RecruiterSearch";

export const metadata: Metadata = {
  title: "Hiring — Forge",
  description: "Find practitioners with a dated, scored record of daily practice.",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function RecruiterDashboardPage() {
  const session = await getServerUser();
  if (!session) redirect("/login?next=/dashboard/recruiter");

  const { supabase, user } = session;

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, display_name, company_name")
    .eq("id", user.id)
    .maybeSingle();

  // The role decides access, and it is checked here rather than trusted from a
  // previous page render.
  if (profile?.role !== "recruiter" && profile?.role !== "admin") {
    redirect("/dashboard");
  }

  const { data: pipelines } = await supabase
    .from("recruiter_pipelines")
    .select("id, name, created_at")
    .eq("recruiter_id", user.id)
    .order("created_at", { ascending: false });

  const pipelineIds = (pipelines ?? []).map((pipeline) => pipeline.id as string);

  const savedResult = pipelineIds.length
    ? await supabase
        .from("pipeline_candidates")
        .select("id", { count: "exact", head: true })
        .in("pipeline_id", pipelineIds)
    : { count: 0 };

  const savedCount = savedResult.count ?? 0;

  return (
    <div className="min-h-screen">
      <header className="border-b border-card-border">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-4">
          <Link href="/" className="flex items-baseline gap-2.5">
            <span className="text-[17px] font-semibold tracking-tight text-primary">Forge</span>
            <span className="hidden font-mono text-[10px] uppercase tracking-[0.16em] text-muted sm:inline">
              hiring
            </span>
          </Link>
          <nav className="flex items-center gap-4 text-[13px]" aria-label="Account">
            <Link href="/dashboard" className="text-muted-foreground hover:text-foreground">
              My dashboard
            </Link>
            <Link href="/settings" className="text-muted-foreground hover:text-foreground">
              Settings
            </Link>
          </nav>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl px-6 py-12">
        <p className={eyebrowStyles}>Hiring</p>
        <h1 className="mt-2 text-[30px] font-semibold leading-tight tracking-tight text-foreground">
          People who practise, with receipts.
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
          Every candidate here opted in to recruiter discovery. You see practice frequency, rubric scores
          and recency — never an email address, a raw answer, or a guess about personality.
        </p>

        <div className="mt-8 grid gap-6 lg:grid-cols-[1.7fr_1fr]">
          <RecruiterSearch />

          <aside className="space-y-6">
            <section className="rounded border border-card-border bg-card p-6">
              <div className="flex items-baseline justify-between">
                <h2 className="text-sm font-medium text-foreground">Your pipelines</h2>
                <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted">
                  {savedCount} saved
                </p>
              </div>

              {pipelineIds.length === 0 ? (
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                  No pipelines yet. Pipelines are created through the API and will appear here with their
                  candidates.
                </p>
              ) : (
                <ul className="mt-4 divide-y divide-card-border">
                  {(pipelines ?? []).map((pipeline) => (
                    <li key={pipeline.id} className="py-2.5 text-sm text-foreground">
                      {pipeline.name}
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="rounded border border-card-border bg-card p-6">
              <h2 className="text-sm font-medium text-foreground">What the score means</h2>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                Forge scores structure, coverage and specificity against each challenge&apos;s rubric. It
                does not verify that an answer is technically correct, and no record is marked
                &ldquo;verified&rdquo; until a human has reviewed it.
              </p>
              <p className="mt-3 text-xs leading-relaxed text-muted">
                Treat these numbers as evidence of practice quality and consistency, not as a skills test.
              </p>
            </section>

            <Link href="/dashboard" className={buttonStyles("ghost", "sm")}>
              Back to my dashboard
            </Link>
          </aside>
        </div>
      </main>
    </div>
  );
}
