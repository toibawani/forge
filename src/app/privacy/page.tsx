import type { Metadata } from "next";
import Link from "next/link";
import { GRIEVANCE_OFFICER, POLICY_VERSION } from "@/lib/consent";

export const metadata: Metadata = {
  title: "Privacy Policy — Forge",
  description:
    "What Forge collects, why, how long we keep it, and how to export or delete it. Written in plain English.",
};

const COLLECTED = [
  {
    what: "Email address",
    why: "Sign-in, account recovery, and legally required notices",
    basis: "Contract",
    kept: "Until you delete the account",
  },
  {
    what: "Name and profile details you enter",
    why: "Identify you on your skill record",
    basis: "Contract",
    kept: "Until you delete the account",
  },
  {
    what: "Practice submissions, scores, time spent, practice date",
    why: "Build the time-stamped record recruiters can verify",
    basis: "Consent (core processing)",
    kept: "Until you delete the account",
  },
  {
    what: "Streak and consistency statistics",
    why: "Show progress over time; derived from your attempts",
    basis: "Consent (core processing)",
    kept: "Until you delete the account",
  },
  {
    what: "Consent records (purpose, policy version, timestamp)",
    why: "Prove what you agreed to and when, as DPDP requires",
    basis: "Legal obligation",
    kept: "Account lifetime + 6 months",
  },
  {
    what: "Audit events (action, time, salted IP hash)",
    why: "Security, fraud prevention, accountability",
    basis: "Legitimate use / legal obligation",
    kept: "24 months",
  },
  {
    what: "Recruiter notes about you, if you opt in",
    why: "Shared hiring workflow you consented to",
    basis: "Consent (recruiter discovery)",
    kept: "Removed when you delete your account",
  },
];

export default function PrivacyPage() {
  return (
    <div className="min-h-screen">
      <header className="border-b border-card-border">
        <div className="mx-auto flex w-full max-w-3xl items-center justify-between px-6 py-4">
          <Link href="/" className="text-[17px] font-semibold tracking-tight text-primary">
            Forge
          </Link>
          <nav className="flex items-center gap-4 text-[13px]">
            <Link href="/privacy/hindi" className="text-muted-foreground hover:text-foreground">
              हिंदी
            </Link>
            <Link href="/terms" className="text-muted-foreground hover:text-foreground">
              Terms
            </Link>
          </nav>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl px-6 py-14">
        <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted">
          Policy version {POLICY_VERSION}
        </p>
        <h1 className="mt-3 text-[32px] font-semibold leading-tight tracking-tight text-foreground">
          Privacy Policy
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          Plain English, no dark patterns. This policy explains what Forge collects, why, how long we keep
          it, and how you get it back or get it deleted. It is written to meet the Digital Personal Data
          Protection Act, 2023 (India).
        </p>

        <div className="mt-10 space-y-10 text-[15px] leading-relaxed text-muted-foreground">
          <section>
            <h2 className="text-lg font-semibold tracking-tight text-foreground">1. Who we are</h2>
            <p className="mt-3">
              Forge is a daily skill-practice product. For the purposes of the DPDP Act, Forge is the Data
              Fiduciary: we decide why and how your personal data is processed. Our Grievance Officer is
              listed at the end of this page.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold tracking-tight text-foreground">
              2. What we collect and why
            </h2>
            <p className="mt-3">
              We collect the minimum needed to run the product. Nothing here is sold, and there is no
              third-party advertising.
            </p>

            <div className="mt-5 overflow-x-auto">
              <table className="w-full border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-card-border font-mono text-[10px] uppercase tracking-[0.1em] text-muted">
                    <th className="py-2 pr-4 font-normal">Data</th>
                    <th className="py-2 pr-4 font-normal">Why</th>
                    <th className="py-2 pr-4 font-normal">Basis</th>
                    <th className="py-2 font-normal">Retention</th>
                  </tr>
                </thead>
                <tbody>
                  {COLLECTED.map((row) => (
                    <tr key={row.what} className="border-b border-card-border align-top">
                      <td className="py-3 pr-4 font-medium text-foreground">{row.what}</td>
                      <td className="py-3 pr-4">{row.why}</td>
                      <td className="py-3 pr-4">{row.basis}</td>
                      <td className="py-3">{row.kept}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <p className="mt-4">
              We do not store your raw IP address. Security logs keep a salted one-way hash instead. We do
              not collect your phone number, address, government ID, or payment details.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold tracking-tight text-foreground">
              3. Consent, and what it is not
            </h2>
            <p className="mt-3">
              Creating an account requires consent to store your practice record — without it the product
              cannot exist. Recruiter discovery and product email are optional, off by default, and can be
              switched off at any time in Settings without losing access to your record.
            </p>
            <p className="mt-3">
              We record each purpose separately, with the policy version and a timestamp. If you withdraw an
              optional consent, we stop that processing; it does not retroactively invalidate what happened
              while consent was live.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold tracking-tight text-foreground">
              4. Who can see your data
            </h2>
            <ul className="mt-3 list-disc space-y-2 pl-5">
              <li>
                <span className="font-medium text-foreground">You</span> — always, including a full export.
              </li>
              <li>
                <span className="font-medium text-foreground">Recruiters</span> — only if you turn on recruiter
                discovery. They see your name, headline, skills, scores, streak and consistency. They never
                see your email address.
              </li>
              <li>
                <span className="font-medium text-foreground">Our processor</span> — Supabase hosts the
                database and authentication. Data is encrypted in transit and at rest. No other third party
                receives personal data.
              </li>
              <li>
                <span className="font-medium text-foreground">Authorities</span> — only where legally
                required, and we will tell you unless prohibited.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold tracking-tight text-foreground">5. Security</h2>
            <p className="mt-3">
              Access is enforced in the database with row-level security, not just in the interface: every
              query is scoped to your own account. Sessions live in httpOnly cookies. Servers validate every
              mutation, and attempts cannot be edited after submission.
            </p>
            <p className="mt-3">
              If a personal data breach affects you, we will notify the Data Protection Board of India and
              you, describing what happened, what data was involved, what we have done, and what you can do.
              We do not wait for a perfect picture before telling you.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold tracking-tight text-foreground">
              6. Your rights under the DPDP Act
            </h2>
            <ul className="mt-3 list-disc space-y-2 pl-5">
              <li>
                <span className="font-medium text-foreground">Access</span> — export everything as JSON or CSV
                from Settings, at any time.
              </li>
              <li>
                <span className="font-medium text-foreground">Correction</span> — edit your profile directly,
                or raise a correction request for anything you cannot edit.
              </li>
              <li>
                <span className="font-medium text-foreground">Erasure</span> — delete your account from
                Settings. Data is removed from the live database immediately (or after a 30-day grace period
                if you choose that), from caches, and from backups on the backup rotation cycle.
              </li>
              <li>
                <span className="font-medium text-foreground">Withdraw consent</span> — optional purposes can
                be switched off in Settings.
              </li>
              <li>
                <span className="font-medium text-foreground">Grievance</span> — raise a request in Settings or
                email the Grievance Officer. We respond within 30 days.
              </li>
              <li>
                <span className="font-medium text-foreground">Nomination</span> — you may nominate someone to
                exercise your rights in the event of death or incapacity, via a request in Settings.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold tracking-tight text-foreground">
              7. Deletion, backups and what survives
            </h2>
            <p className="mt-3">
              Deleting your account removes your profile, attempts, scores, streaks, consent register and any
              recruiter notes about you. One thing is deliberately kept: an accountability record showing that
              an erasure took place, using a one-way hash instead of your identity. It contains no name, email
              or practice data, and exists so we can prove we honoured the request.
            </p>
            <p className="mt-3">
              Encrypted backups roll off on a fixed schedule (maximum 30 days). Data in a backup is not used
              for any purpose and is not restored into the live product.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold tracking-tight text-foreground">8. Children</h2>
            <p className="mt-3">
              Forge is for people aged 18 and over. We do not knowingly process data of children. If we learn
              that an account belongs to a child, we delete it.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold tracking-tight text-foreground">9. Cookies</h2>
            <p className="mt-3">
              Only essential cookies: a session cookie that keeps you signed in, and a security cookie that
              protects forms. No advertising or cross-site tracking cookies. Because of that, there is no
              cookie banner to dismiss.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold tracking-tight text-foreground">
              10. Grievance Officer and contact
            </h2>
            <p className="mt-3">
              {GRIEVANCE_OFFICER.role}, {GRIEVANCE_OFFICER.region}. Email{" "}
              <a
                href={`mailto:${GRIEVANCE_OFFICER.email}`}
                className="text-foreground underline underline-offset-4"
              >
                {GRIEVANCE_OFFICER.email}
              </a>
              . We acknowledge within 7 days and resolve within {GRIEVANCE_OFFICER.responseWindowDays} days.
              If you are unsatisfied, you may complain to the Data Protection Board of India.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold tracking-tight text-foreground">11. Changes</h2>
            <p className="mt-3">
              If we change how we handle personal data, we publish a new policy version and ask for consent
              again where the change requires it. The version you accepted is stored with your account, so
              there is never ambiguity about which terms applied.
            </p>
          </section>
        </div>

        <div className="mt-12 flex flex-wrap gap-5 border-t border-card-border pt-6 text-sm">
          <Link href="/privacy/hindi" className="text-foreground underline underline-offset-4">
            हिंदी में पढ़ें
          </Link>
          <Link href="/terms" className="text-muted-foreground hover:text-foreground">
            Terms of Service
          </Link>
          <Link href="/settings" className="text-muted-foreground hover:text-foreground">
            Manage your data
          </Link>
        </div>
      </main>
    </div>
  );
}
