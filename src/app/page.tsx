import Link from "next/link";

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ deleted?: string }>;
}) {
  const { deleted } = await searchParams;

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
        <div className="mx-auto max-w-5xl px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xl font-semibold tracking-tight text-primary">
              Forge
            </span>
          </div>
          <nav className="flex items-center gap-6 text-sm" aria-label="Main navigation">
            <Link
              href="#how"
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              How it works
            </Link>
            <Link
              href="#recruiters"
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              For recruiters
            </Link>
            <Link
              href="/login"
              className="rounded-lg border border-gray-200 dark:border-gray-700 px-4 py-1.5 text-foreground hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              Log in
            </Link>
            <Link
              href="/signup"
              className="rounded-lg bg-primary px-4 py-1.5 text-primary-foreground hover:opacity-90 transition-opacity"
            >
              Start practicing
            </Link>
          </nav>
        </div>
      </header>

      {/* Hero */}
      <main className="flex-1">
        {deleted === "1" ? (
          <div className="border-b border-success/30 bg-success/[0.06]" role="status">
            <div className="mx-auto max-w-5xl px-6 py-3 text-sm text-foreground">
              Your account and practice record have been erased. Only an anonymous record that the
              deletion happened remains.
            </div>
          </div>
        ) : null}
        <section className="mx-auto max-w-5xl px-6 pt-20 pb-24" aria-labelledby="hero-heading">
          <div className="max-w-2xl">
            <h1 id="hero-heading" className="text-4xl sm:text-5xl font-semibold tracking-tight leading-tight text-foreground">
              Prove what you can do.
              <br />
              Every day.
            </h1>
            <p className="mt-6 text-lg text-muted-foreground leading-relaxed max-w-xl">
              Short daily skill challenges that build a living record of real ability.
              Recruiters stop guessing from resumes and start looking at consistent,
              verified practice.
            </p>
            <div className="mt-10 flex flex-wrap gap-4">
              <Link
                href="/signup"
                className="inline-flex items-center justify-center rounded-lg bg-primary px-6 py-3 text-sm font-medium text-primary-foreground hover:opacity-90 transition-opacity"
              >
                Start your first challenge
              </Link>
              <Link
                href="#how"
                className="inline-flex items-center justify-center rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-6 py-3 text-sm font-medium text-foreground hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                See how it works
              </Link>
            </div>
          </div>
        </section>

        {/* Problem */}
        <section className="border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800" aria-labelledby="problem-heading">
          <div className="mx-auto max-w-5xl px-6 py-20">
            <h2 id="problem-heading" className="text-2xl font-semibold tracking-tight">
              Resumes are no longer trustworthy
            </h2>
            <p className="mt-4 max-w-2xl text-muted-foreground leading-relaxed">
              AI can polish any profile in seconds. Portfolios can be staged.
              One-off tests are easy to game. Recruiters are drowning in applications
              that look perfect on paper and fail in practice.
            </p>
            <p className="mt-4 max-w-2xl text-muted-foreground leading-relaxed">
              Forge creates a different signal: consistent, short, daily demonstrations
              of skill that are hard to fake and easy to compare.
            </p>
          </div>
        </section>

        {/* How it works */}
        <section id="how" className="border-t border-gray-200 dark:border-gray-700" aria-labelledby="how-heading">
          <div className="mx-auto max-w-5xl px-6 py-20">
            <h2 id="how-heading" className="text-2xl font-semibold tracking-tight">
              How daily practice becomes a hiring signal
            </h2>
            <div className="mt-12 grid gap-10 sm:grid-cols-3">
              <div>
                <div className="text-sm font-medium text-accent">01</div>
                <h3 className="mt-2 text-lg font-medium">Practice daily</h3>
                <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                  5–15 minute challenges matched to your field. Coding, design,
                  analysis, writing, sales scenarios, and more.
                </p>
              </div>
              <div>
                <div className="text-sm font-medium text-accent">02</div>
                <h3 className="mt-2 text-lg font-medium">Build a record</h3>
                <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                  Every attempt is time-stamped and scored. Streaks, consistency,
                  and improvement over months become visible.
                </p>
              </div>
              <div>
                <div className="text-sm font-medium text-accent">03</div>
                <h3 className="mt-2 text-lg font-medium">Get discovered</h3>
                <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                  Recruiters search for people who actually demonstrate the skills
                  they need, not people who claim them.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Recruiters */}
        <section id="recruiters" className="border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800" aria-labelledby="recruiters-heading">
          <div className="mx-auto max-w-5xl px-6 py-20">
            <h2 id="recruiters-heading" className="text-2xl font-semibold tracking-tight">
              Built for the people who hire
            </h2>
            <p className="mt-4 max-w-2xl text-muted-foreground leading-relaxed">
              Stop sorting through AI-polished noise. Search by demonstrated skill,
              consistency, and recent activity. See people who keep practicing even
              when they are not actively looking for a job.
            </p>
            <ul className="mt-8 space-y-3 text-muted-foreground" role="list">
              <li className="flex gap-3">
                <span className="text-accent" aria-hidden="true">→</span>
                Filter by skill, difficulty, and consistency over time
              </li>
              <li className="flex gap-3">
                <span className="text-accent" aria-hidden="true">→</span>
                See real attempts instead of claimed years of experience
              </li>
              <li className="flex gap-3">
                <span className="text-accent" aria-hidden="true">→</span>
                Reach people who are quietly improving, not just applying
              </li>
            </ul>
          </div>
        </section>

        {/* CTA */}
        <section className="border-t border-gray-200 dark:border-gray-700" aria-labelledby="cta-heading">
          <div className="mx-auto max-w-5xl px-6 py-20 text-center">
            <h2 id="cta-heading" className="text-2xl font-semibold tracking-tight">
              Start building your proof today
            </h2>
            <p className="mt-4 text-muted-foreground">
              One short challenge a day. No resume required.
            </p>
            <Link
              href="/signup"
              className="mt-8 inline-flex items-center justify-center rounded-lg bg-primary px-8 py-3 text-sm font-medium text-primary-foreground hover:opacity-90 transition-opacity"
            >
              Create free account
            </Link>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
        <div className="mx-auto max-w-5xl px-6 py-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
          <div>
            <div className="font-semibold text-primary">Forge</div>
            <p className="mt-1 text-sm text-muted">
              Daily skill proof for people who want to be hired for what they can do.
            </p>
          </div>
          <nav className="flex flex-wrap gap-6 text-sm text-muted-foreground" aria-label="Footer navigation">
            <Link href="/privacy" className="hover:text-foreground">
              Privacy
            </Link>
            <Link href="/privacy/hindi" className="hover:text-foreground">
              गोपनीयता नीति
            </Link>
            <Link href="/terms" className="hover:text-foreground">
              Terms
            </Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}

