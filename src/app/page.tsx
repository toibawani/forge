import type { Metadata } from "next";
import Link from "next/link";

import { buttonStyles, eyebrowStyles } from "@/components/ui/styles";

export const metadata: Metadata = {
  title: "Forge — daily skill proof",
  description:
    "Five to fifteen minutes of real work a day, scored against a published rubric. A time-stamped record of what you can actually do, instead of a resume that anyone can polish.",
  alternates: { canonical: "/" },
  openGraph: {
    title: "Forge — daily skill proof",
    description:
      "Short daily challenges, scored against a published rubric, building a record recruiters can verify.",
    type: "website",
    siteName: "Forge",
  },
  twitter: {
    card: "summary",
    title: "Forge — daily skill proof",
    description: "Short daily challenges, scored against a published rubric.",
  },
};

const STEPS = [
  {
    step: "01",
    title: "Answer one brief",
    body: "A realistic task in your field: explain a slow query, critique a layout, handle an objection. Five to fifteen minutes, written in the browser.",
  },
  {
    step: "02",
    title: "Get scored on substance",
    body: "The rubric names what good looks like — cause, evidence, next step. Scoring is deterministic and runs on the server, so the same answer always gets the same score.",
  },
  {
    step: "03",
    title: "Let the record speak",
    body: "Attempts are immutable and timestamped. Consistency, level and improvement become visible over weeks, not in a single staged interview.",
  },
];

const LIMITS = [
  {
    title: "A score is not a judgement of you",
    body: "It measures how well one answer covers a published rubric. It cannot see context you did not write down, and a low score usually means a thin answer, not a weak person.",
  },
  {
    title: "This is practice, not certification",
    body: "Forge does not verify employers, degrees or identity. It stores what you wrote and when. Treat it as evidence to discuss, not a credential to claim.",
  },
  {
    title: "Benchmarks need a crowd",
    body: "Comparison against other attempts stays hidden until enough people have tried the same challenge. Before that, the only honest comparison is your own previous attempt.",
  },
  {
    title: "Integrity signals are signals",
    body: "Pasting, or typing faster than a person can write, is recorded for a human to look at. Nothing is rejected automatically — a false accusation costs more than a missed one.",
  },
];

const SIGNALS = ["names the cause", "cites evidence", "states the trade-off", "ends with a next step"];

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ deleted?: string }>;
}) {
  const { deleted } = await searchParams;

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-30 border-b border-card-border bg-background/95 backdrop-blur">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between px-6 py-4">
          <Link href="/" className="flex items-baseline gap-2.5">
            <span className="text-[17px] font-semibold tracking-tight text-primary">Forge</span>
            <span className="hidden font-mono text-[10px] uppercase tracking-[0.16em] text-muted sm:inline">
              daily skill proof
            </span>
          </Link>
          <nav className="flex items-center gap-5 text-sm" aria-label="Main">
            <Link href="#how" className="hidden text-muted-foreground transition-colors hover:text-foreground sm:inline">
              How it works
            </Link>
            <Link href="#limits" className="hidden text-muted-foreground transition-colors hover:text-foreground sm:inline">
              Limits
            </Link>
            <Link href="/login" className={buttonStyles("ghost", "sm")}>
              Log in
            </Link>
            <Link href="/signup" className={buttonStyles("primary", "sm")}>
              Start practising
            </Link>
          </nav>
        </div>
      </header>

      <main className="flex-1">
        {deleted === "1" ? (
          <div className="border-b border-success/30 bg-success/[0.06]" role="status">
            <div className="mx-auto max-w-5xl px-6 py-3 text-sm text-foreground">
              Your account and practice record have been erased. Only an anonymous record that the
              deletion happened remains.
            </div>
          </div>
        ) : null}

        <section className="mx-auto grid w-full max-w-5xl gap-14 px-6 pb-20 pt-16 lg:grid-cols-[1.1fr_0.9fr] lg:items-start lg:pt-24">
          <div>
            <p className={eyebrowStyles}>Evidence, not adjectives</p>
            <h1 className="mt-3 text-[40px] font-semibold leading-[1.08] tracking-tight text-foreground sm:text-[52px]">
              Anyone can claim the skill.
              <br />
              Forge records the work.
            </h1>
            <p className="mt-6 max-w-xl text-[17px] leading-relaxed text-muted-foreground">
              One short brief a day, answered in your own words and scored against a rubric you can
              read in advance. What accumulates is not a badge — it is a dated sequence of attempts
              someone else can examine.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/signup" className={buttonStyles("primary", "lg")}>
                Start your first challenge
              </Link>
              <Link href="#how" className={buttonStyles("secondary", "lg")}>
                See how scoring works
              </Link>
            </div>

            <dl className="mt-12 grid grid-cols-3 gap-6 border-t border-card-border pt-6">
              {[
                ["5–15", "minutes per brief"],
                ["Server-side", "scoring and timing"],
                ["Immutable", "attempt history"],
              ].map(([term, detail]) => (
                <div key={term}>
                  <dt className="font-mono text-[11px] uppercase tracking-[0.1em] text-foreground">
                    {term}
                  </dt>
                  <dd className="mt-1 text-xs leading-relaxed text-muted">{detail}</dd>
                </div>
              ))}
            </dl>
          </div>

          {/* What a scored attempt actually looks like. Marked illustrative on
              the card itself: a fabricated record presented as real would be the
              exact dishonesty the product exists to argue against. */}
          <figure className="rounded border border-card-border bg-card p-5">
            <div className="flex items-baseline justify-between gap-4">
              <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted">
                Practice record
              </p>
              <span className="rounded border border-card-border px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.1em] text-muted">
                example
              </span>
            </div>

            <p className="mt-4 text-sm font-medium leading-snug text-foreground">
              The dashboard takes nine seconds to load. Find the cause.
            </p>

            <div className="mt-4 flex items-baseline gap-3">
              <span className="text-[34px] font-semibold tabular-nums leading-none text-foreground">
                82
              </span>
              <span className="text-sm text-muted-foreground">solid · engineering · 11 min</span>
            </div>

            <ul className="mt-5 space-y-2 border-t border-card-border pt-4">
              {SIGNALS.map((signal, position) => (
                <li key={signal} className="flex items-baseline justify-between gap-4 text-sm">
                  <span className="text-muted-foreground">{signal}</span>
                  <span
                    className={`font-mono text-[10px] uppercase tracking-[0.1em] ${
                      position < 3 ? "text-success" : "text-muted"
                    }`}
                  >
                    {position < 3 ? "present" : "missing"}
                  </span>
                </li>
              ))}
            </ul>

            <figcaption className="mt-4 border-t border-card-border pt-3 text-xs leading-relaxed text-muted">
              Illustrative, built from the published rubric — not a real person&rsquo;s record. Your
              first scored attempt replaces it with something true.
            </figcaption>
          </figure>
        </section>

        <section className="border-t border-card-border bg-card" aria-labelledby="problem-heading">
          <div className="mx-auto w-full max-w-5xl px-6 py-16">
            <h2 id="problem-heading" className="max-w-2xl text-2xl font-semibold tracking-tight">
              Portfolios are polished. Interviews are rehearsed. Neither shows the twelfth week.
            </h2>
            <p className="mt-4 max-w-2xl leading-relaxed text-muted-foreground">
              A tool can make any profile read well, and a candidate can prepare for one conversation.
              What is still hard to fake is doing competent work, repeatedly, on unfamiliar problems,
              in writing, with the dates attached. That is the only thing Forge measures.
            </p>
          </div>
        </section>

        <section id="how" className="border-t border-card-border" aria-labelledby="how-heading">
          <div className="mx-auto w-full max-w-5xl px-6 py-16">
            <p className={eyebrowStyles}>The loop</p>
            <h2 id="how-heading" className="mt-2 text-2xl font-semibold tracking-tight">
              Three steps, repeated daily
            </h2>

            <div className="mt-10 grid gap-10 sm:grid-cols-3">
              {STEPS.map((item) => (
                <div key={item.step}>
                  <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-accent">
                    {item.step}
                  </p>
                  <h3 className="mt-2 text-base font-medium text-foreground">{item.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{item.body}</p>
                </div>
              ))}
            </div>

            <div className="mt-12 rounded border border-card-border bg-card p-5">
              <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted">
                Scoring transparency
              </p>
              <p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted-foreground">
                Every challenge publishes its rubric before you write: the signals it looks for and
                the word floor below which an answer cannot cover them. The score is computed from the
                answer text on the server — no model in the loop, no hidden criteria, and the same
                answer always produces the same score. Correctness is separate: a blind human review
                can add a verdict that the author never sees attributed.
              </p>
            </div>
          </div>
        </section>

        <section
          id="limits"
          className="border-t border-card-border bg-card"
          aria-labelledby="limits-heading"
        >
          <div className="mx-auto w-full max-w-5xl px-6 py-16">
            <p className={eyebrowStyles}>What this is not</p>
            <h2 id="limits-heading" className="mt-2 text-2xl font-semibold tracking-tight">
              The limits, stated up front
            </h2>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground">
              A product that only advertises strengths is asking to be trusted on faith. These are the
              things Forge cannot do, and says so on the page rather than in a footnote.
            </p>

            <div className="mt-8 grid gap-x-10 gap-y-6 sm:grid-cols-2">
              {LIMITS.map((limit) => (
                <div key={limit.title} className="border-t border-card-border pt-4">
                  <h3 className="text-sm font-medium text-foreground">{limit.title}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{limit.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="recruiters" className="border-t border-card-border" aria-labelledby="recruiters-heading">
          <div className="mx-auto grid w-full max-w-5xl gap-10 px-6 py-16 lg:grid-cols-[1fr_0.8fr]">
            <div>
              <p className={eyebrowStyles}>For hiring teams</p>
              <h2 id="recruiters-heading" className="mt-2 text-2xl font-semibold tracking-tight">
                Search the record, not the resume
              </h2>
              <p className="mt-4 max-w-xl leading-relaxed text-muted-foreground">
                Recruiters see only people who opted into discovery, and only the signals the product
                actually measures: demonstrated level per skill, consistency over time, and recent
                activity. Email addresses are never exposed through search.
              </p>
            </div>

            <ul className="space-y-3 text-sm text-muted-foreground">
              {[
                "Filter by skill, level and recent activity",
                "Compare two records side by side, with sample sizes shown",
                "Read the practice record behind every claim",
                "Contact through the platform, not a scraped address",
              ].map((line) => (
                <li key={line} className="flex gap-3 border-b border-card-border pb-3 last:border-0">
                  <span aria-hidden="true" className="text-accent">
                    →
                  </span>
                  <span className="leading-relaxed">{line}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="border-t border-card-border bg-card" aria-labelledby="cta-heading">
          <div className="mx-auto w-full max-w-5xl px-6 py-16">
            <h2 id="cta-heading" className="text-2xl font-semibold tracking-tight">
              Start with today&rsquo;s brief
            </h2>
            <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted-foreground">
              Free to start, one attempt a day is enough to build a streak. Your record is yours:
              export it as JSON or CSV, or erase it entirely from Settings.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link href="/signup" className={buttonStyles("primary", "lg")}>
                Create an account
              </Link>
              <Link href="/status" className={buttonStyles("secondary", "lg")}>
                Check deployment status
              </Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-card-border">
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-6 py-10 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-primary">Forge</p>
            <p className="mt-1 max-w-sm text-sm leading-relaxed text-muted">
              Daily skill proof for people who want to be hired for what they can do.
            </p>
          </div>
          <nav className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted-foreground" aria-label="Footer">
            <Link href="/privacy" className="transition-colors hover:text-foreground">
              Privacy
            </Link>
            <Link href="/privacy/hindi" className="transition-colors hover:text-foreground">
              गोपनीयता नीति
            </Link>
            <Link href="/terms" className="transition-colors hover:text-foreground">
              Terms
            </Link>
            <Link href="/status" className="transition-colors hover:text-foreground">
              Status
            </Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
