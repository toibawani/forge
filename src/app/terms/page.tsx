import Link from "next/link";

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-3xl px-6 py-16" aria-labelledby="terms-heading">
        <Link
          href="/"
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          ← Back to Forge
        </Link>
        <h1 id="terms-heading" className="mt-8 text-3xl font-semibold tracking-tight">Terms of Service</h1>
        <p className="mt-2 text-sm text-muted">Last updated: November 2026</p>

        <div className="mt-10 space-y-6 text-muted-foreground leading-relaxed">
          <p>
            By using Forge you agree to practice honestly and treat the skill records as a
            shared signal of real ability.
          </p>
          <h2 className="text-lg font-medium text-foreground">Acceptable use</h2>
          <p>
            Do not attempt to game, automate, or falsify challenge attempts. The value of the
            platform depends on genuine practice.
          </p>
          <h2 className="text-lg font-medium text-foreground">Accounts</h2>
          <p>
            You are responsible for the security of your account. We may suspend accounts that
            abuse the system or violate these terms.
          </p>
          <h2 className="text-lg font-medium text-foreground">Service</h2>
          <p>
            Forge is currently in early development. Features, availability, and data retention
            may change. We will provide notice of material changes.
          </p>
          <p className="text-sm">
            This is a development placeholder. Full terms will be reviewed by counsel before
            public launch.
          </p>
        </div>
      </div>
    </div>
  );
}
