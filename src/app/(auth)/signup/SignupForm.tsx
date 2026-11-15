"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Alert } from "@/components/ui/Alert";
import { Field, TextInput } from "@/components/ui/Field";
import { buttonStyles, labelStyles } from "@/components/ui/styles";
import { POLICY_VERSION } from "@/lib/consent";

type Role = "practitioner" | "recruiter";

const ROLES: Array<{ value: Role; title: string; description: string }> = [
  {
    value: "practitioner",
    title: "I practise",
    description: "Build a daily record of demonstrated skill.",
  },
  {
    value: "recruiter",
    title: "I hire",
    description: "Search by demonstrated ability and consistency.",
  },
];

export function SignupForm() {
  const router = useRouter();
  const [role, setRole] = useState<Role>("practitioner");
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [acceptedProcessing, setAcceptedProcessing] = useState(false);
  const [recruiterDiscovery, setRecruiterDiscovery] = useState(false);
  const [productEmails, setProductEmails] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const canSubmit = acceptedTerms && acceptedProcessing && !pending;

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSubmit) return;

    setPending(true);
    setError(null);
    setFieldErrors({});

    try {
      const response = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          password,
          role,
          displayName: displayName.trim() || undefined,
          acceptedRequiredConsent: true,
          recruiterDiscovery,
          productEmails,
          policyVersion: POLICY_VERSION,
        }),
      });

      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        const details = payload?.error?.details;
        if (Array.isArray(details)) {
          const mapped: Record<string, string> = {};
          for (const issue of details) {
            if (issue?.field) mapped[issue.field] = issue.message;
          }
          setFieldErrors(mapped);
        }
        setError(payload?.error?.message ?? "We could not create that account.");
        setPending(false);
        return;
      }

      if (payload?.status === "signed_in") {
        router.replace("/dashboard");
        router.refresh();
        return;
      }

      router.replace("/login?checkEmail=1");
    } catch {
      setError("Network error. Check your connection and try again.");
      setPending(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-8 space-y-6" noValidate>
      <fieldset>
        <legend className={labelStyles}>How will you use Forge?</legend>
        <div className="mt-2 grid gap-3 sm:grid-cols-2">
          {ROLES.map((option) => {
            const active = role === option.value;
            return (
              <button
                key={option.value}
                type="button"
                aria-pressed={active}
                onClick={() => setRole(option.value)}
                className={`rounded border px-4 py-3 text-left transition-colors ${
                  active
                    ? "border-primary bg-primary/[0.04]"
                    : "border-card-border bg-card hover:border-foreground/25"
                }`}
              >
                <span className="block text-sm font-medium text-foreground">{option.title}</span>
                <span className="mt-1 block text-xs leading-relaxed text-muted-foreground">
                  {option.description}
                </span>
              </button>
            );
          })}
        </div>
      </fieldset>

      <div className="rounded border border-card-border bg-card p-6">
        <div className="space-y-5">
          <Field id="displayName" label="Name shown on your record" optional hint="Two words is plenty.">
            <TextInput
              id="displayName"
              name="displayName"
              autoComplete="name"
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
                                placeholder="Ananya Rao"
                />
          </Field>

          <Field id="email" label="Email" error={fieldErrors.email}>
            <TextInput
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@work.com"
            />
          </Field>

          <Field
            id="password"
            label="Password"
            error={fieldErrors.password}
            hint="At least 10 characters, with an uppercase letter, a lowercase letter and a number."
          >
            <TextInput
              id="password"
              name="password"
              type="password"
              autoComplete="new-password"
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Choose a strong password"
            />
          </Field>
        </div>
      </div>

      {/* Itemised consent, above the submit control. Nothing is pre-selected
          except the contractual items the account cannot exist without. */}
      <div className="rounded border border-card-border bg-card p-6">
        <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted">
          What you are agreeing to
        </p>

        <div className="mt-4 space-y-4">
          <label className="flex cursor-pointer items-start gap-3">
            <input
              type="checkbox"
              checked={acceptedTerms}
              onChange={(event) => setAcceptedTerms(event.target.checked)}
              className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--primary)]"
            />
            <span className="text-sm leading-relaxed text-muted-foreground">
              <span className="font-medium text-foreground">I accept the Terms of Service</span> and the{" "}
              <Link href="/privacy" className="text-foreground underline underline-offset-2">
                Privacy Policy
              </Link>{" "}
              (
              <Link href="/privacy/hindi" className="text-foreground underline underline-offset-2">
                हिंदी
              </Link>
              ), which describe what Forge collects, why, and how to delete it.
            </span>
          </label>

          <label className="flex cursor-pointer items-start gap-3">
            <input
              type="checkbox"
              checked={acceptedProcessing}
              onChange={(event) => setAcceptedProcessing(event.target.checked)}
              className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--primary)]"
            />
            <span className="text-sm leading-relaxed text-muted-foreground">
              <span className="font-medium text-foreground">Store my practice record.</span> Attempts,
              scores and streaks are saved so your record is time-stamped and verifiable. This is required
              for the product to work.
            </span>
          </label>

          <div className="border-t border-card-border pt-4">
            <p className="text-xs font-medium uppercase tracking-wide text-muted">
              Optional — off unless you choose them
            </p>

            <label className="mt-3 flex cursor-pointer items-start gap-3">
              <input
                type="checkbox"
                checked={recruiterDiscovery}
                onChange={(event) => setRecruiterDiscovery(event.target.checked)}
                className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--primary)]"
              />
              <span className="text-sm leading-relaxed text-muted-foreground">
                Let verified recruiters find me and contact me. Your email is never shown.
              </span>
            </label>

            <label className="mt-3 flex cursor-pointer items-start gap-3">
              <input
                type="checkbox"
                checked={productEmails}
                onChange={(event) => setProductEmails(event.target.checked)}
                className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--primary)]"
              />
              <span className="text-sm leading-relaxed text-muted-foreground">
                Send me occasional product email. No third-party marketing.
              </span>
            </label>
          </div>
        </div>

        <p className="mt-5 border-t border-card-border pt-4 text-xs leading-relaxed text-muted">
          You can withdraw optional consent, export your data or delete your account from Settings at any
          time. Deleting your account removes your practice record permanently.
        </p>
      </div>

      {error ? <Alert tone="error">{error}</Alert> : null}

      <div>
        <button
          type="submit"
          disabled={!canSubmit}
          aria-disabled={!canSubmit}
          className={buttonStyles("primary", "lg", "w-full")}
        >
          {pending ? "Creating account…" : "Create account"}
        </button>
        {!canSubmit ? (
          <p className="mt-2 text-center text-xs text-muted">
            Accept the terms and the practice-record consent to continue.
          </p>
        ) : null}
      </div>

    </form>
  );
}
