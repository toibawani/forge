import type { Metadata } from "next";
import Link from "next/link";
import { GRIEVANCE_OFFICER, POLICY_VERSION } from "@/lib/consent";

export const metadata: Metadata = {
  title: "Terms of Service — Forge",
  description:
    "The rules of using Forge: honest practice, one account per person, what the scores mean, and how to leave.",
};

export default function TermsPage() {
  return (
    <div className="min-h-screen">
      <header className="border-b border-card-border">
        <div className="mx-auto flex w-full max-w-3xl items-center justify-between px-6 py-4">
          <Link href="/" className="text-[17px] font-semibold tracking-tight text-primary">
            Forge
          </Link>
          <nav className="flex items-center gap-4 text-[13px]">
            <Link href="/privacy" className="text-muted-foreground hover:text-foreground">
              Privacy
            </Link>
            <Link href="/privacy/hindi" className="text-muted-foreground hover:text-foreground">
              हिंदी
            </Link>
          </nav>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl px-6 py-14">
        <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted">
          Terms version {POLICY_VERSION}
        </p>
        <h1 className="mt-3 text-[32px] font-semibold leading-tight tracking-tight text-foreground">
          Terms of Service
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          The short version: practise honestly, keep one account, and know exactly what a Forge score does and
          does not prove. This is a contract between you and Forge, governed by Indian law.
        </p>

        <div className="mt-10 space-y-10 text-[15px] leading-relaxed text-muted-foreground">
          <section>
            <h2 className="text-lg font-semibold tracking-tight text-foreground">1. Eligibility</h2>
            <p className="mt-3">
              You must be 18 or older and able to enter a contract. One account per person. Accounts are not
              transferable, and sharing credentials defeats the purpose of the record.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold tracking-tight text-foreground">2. Honest practice</h2>
            <p className="mt-3">
              Submissions must be your own work. Do not automate attempts, paste model output without
              understanding it, use another person&apos;s account, or attempt to manipulate scores, streaks or
              timestamps. Attempts are immutable and recorded with a salted hash of the network address.
            </p>
            <p className="mt-3">
              We may suspend or remove accounts that fabricate activity. Evidence that cannot be trusted is
              worse than no evidence.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold tracking-tight text-foreground">
              3. What a Forge score means
            </h2>
            <p className="mt-3">
              Scores come from a published rubric applied on the server: completeness, structure and
              specificity of the answer. They are a signal of consistent practice, not a certification, a
              guarantee of job performance, or a substitute for an interview.
            </p>
            <p className="mt-3">
              A streak proves you showed up on those days. It does not prove mastery. We would rather say that
              plainly than oversell it.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold tracking-tight text-foreground">4. Recruiter use</h2>
            <p className="mt-3">
              If you use Forge to hire, you may only see practitioners who opted into recruiter discovery, and
              you may only use their data to evaluate them for a role. Do not scrape, export in bulk, resell,
              or contact people outside the product. Recruiter searches are audited.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold tracking-tight text-foreground">
              5. Your data and your rights
            </h2>
            <p className="mt-3">
              Our{" "}
              <Link href="/privacy" className="text-foreground underline underline-offset-4">
                Privacy Policy
              </Link>{" "}
              sets out what we collect and why, and is incorporated into these terms. You can export your data
              at any time, withdraw optional consent, or delete your account from Settings. Deletion removes
              your practice record permanently.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold tracking-tight text-foreground">6. Prohibited conduct</h2>
            <ul className="mt-3 list-disc space-y-2 pl-5">
              <li>Attempting to access another person&apos;s account or data.</li>
              <li>Probing, scanning or load-testing the service without permission.</li>
              <li>Uploading malware, or content that is unlawful or infringes someone else&apos;s rights.</li>
              <li>Circumventing rate limits, authentication or database access rules.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold tracking-tight text-foreground">
              7. Availability and changes
            </h2>
            <p className="mt-3">
              Forge is an early product. Features may change, and the service may be unavailable while we work
              on it. If we make a material change to these terms or to how personal data is handled, we publish
              a new version and, where required, ask for consent again.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold tracking-tight text-foreground">8. Liability</h2>
            <p className="mt-3">
              To the extent permitted by law, Forge is provided &ldquo;as is&rdquo;. We are not liable for
              hiring decisions made using the product, or for indirect losses. Nothing here limits rights you
              have under Indian consumer or data protection law.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold tracking-tight text-foreground">9. Governing law</h2>
            <p className="mt-3">
              These terms are governed by the laws of India. Disputes are subject to the courts at Bengaluru,
              Karnataka. Data protection questions go to the Grievance Officer first:{" "}
              <a
                href={`mailto:${GRIEVANCE_OFFICER.email}`}
                className="text-foreground underline underline-offset-4"
              >
                {GRIEVANCE_OFFICER.email}
              </a>
              .
            </p>
          </section>
        </div>

        <div className="mt-12 flex flex-wrap gap-5 border-t border-card-border pt-6 text-sm">
          <Link href="/privacy" className="text-foreground underline underline-offset-4">
            Privacy Policy
          </Link>
          <Link href="/privacy/hindi" className="text-muted-foreground hover:text-foreground">
            गोपनीयता नीति
          </Link>
          <Link href="/signup" className="text-muted-foreground hover:text-foreground">
            Create an account
          </Link>
        </div>
      </main>
    </div>
  );
}
