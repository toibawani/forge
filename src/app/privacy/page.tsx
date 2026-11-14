import Link from "next/link";

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-[var(--background)]">
      <div className="mx-auto max-w-3xl px-6 py-16" aria-labelledby="privacy-heading">
        <Link
          href="/"
          className="text-sm text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
        >
          ← Back to Forge
        </Link>
        <h1 id="privacy-heading" className="mt-8 text-3xl font-semibold tracking-tight">Privacy Policy</h1>
        <p className="mt-2 text-sm text-[var(--muted)]">Last updated: November 2026</p>

        <div className="mt-10 space-y-6 text-[var(--muted-foreground)] leading-relaxed">
          <p>
            Forge is designed to help people demonstrate real skill through daily practice.
            We collect only what is necessary to operate the product and protect the integrity
            of the skill signals.
          </p>
          <h2 className="text-lg font-medium text-[var(--foreground)]">What we collect</h2>
          <p>
            Account information (email), practice attempts and scores, streak data, and basic
            profile details you choose to share. We do not sell personal data.
          </p>
          <h2 className="text-lg font-medium text-[var(--foreground)]">How we use it</h2>
          <p>
            To power your practice history, generate skill signals for recruiters (with your
            control), improve challenge quality, and keep the platform secure.
          </p>
          <h2 className="text-lg font-medium text-[var(--foreground)]">Your control</h2>
          <p>
            You can export or delete your data. Skill visibility to recruiters can be controlled
            from your settings. Full details will be published before public launch.
          </p>
          <p className="text-sm">
            This is a placeholder policy for the early development stage. A complete legal
            version will be added before any production data is collected.
          </p>
        </div>
      </div>
    </div>
  );
}
