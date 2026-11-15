"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Alert } from "@/components/ui/Alert";
import { Field, TextInput } from "@/components/ui/Field";
import { buttonStyles } from "@/components/ui/styles";

const ERROR_MESSAGES: Record<string, string> = {
  link_expired: "That confirmation link has expired. Sign in again or request a new one.",
  missing_code: "That link was incomplete. Try signing in.",
  not_configured: "Forge is not connected to its database yet.",
};

export function LoginForm({
  next,
  error,
  checkEmail,
}: {
  next: string;
  error?: string;
  checkEmail?: boolean;
}) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(error ? ERROR_MESSAGES[error] ?? null : null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setMessage(null);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        setMessage(payload?.error?.message ?? "We could not sign you in. Try again.");
        setPending(false);
        return;
      }

      router.replace(next);
      router.refresh();
    } catch {
      setMessage("Network error. Check your connection and try again.");
      setPending(false);
    }
  }

  return (
    <div className="mt-8">
      {checkEmail ? (
        <div className="mb-5">
          <Alert tone="info" title="Check your email">
            We sent a confirmation link. Open it, then sign in here. The link expires in 24 hours.
          </Alert>
        </div>
      ) : null}

      <form onSubmit={handleSubmit} className="rounded border border-card-border bg-card p-6">
        {/* Policy links are visible before the submit control, as required. */}
        <p className="mb-6 border-b border-card-border pb-4 text-xs leading-relaxed text-muted">
          By signing in you agree to Forge&apos;s{" "}
          <Link href="/terms" className="text-foreground underline underline-offset-2">
            Terms of Service
          </Link>{" "}
          and{" "}
          <Link href="/privacy" className="text-foreground underline underline-offset-2">
            Privacy Policy
          </Link>
          , including how we store your practice record. Read the policy in{" "}
          <Link href="/privacy/hindi" className="text-foreground underline underline-offset-2">
            Hindi
          </Link>
          .
        </p>

        <div className="space-y-5">
          <Field id="email" label="Email">
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

          <Field id="password" label="Password">
            <TextInput
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Your password"
            />
          </Field>
        </div>

        {message ? (
          <div className="mt-5">
            <Alert tone="error">{message}</Alert>
          </div>
        ) : null}

        <button type="submit" disabled={pending} className={buttonStyles("primary", "lg", "mt-6 w-full")}>
          {pending ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </div>
  );
}
