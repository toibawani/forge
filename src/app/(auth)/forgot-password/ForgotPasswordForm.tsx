"use client";

import { useState } from "react";
import { Alert } from "@/components/ui/Alert";
import { Field, TextInput } from "@/components/ui/Field";
import { buttonStyles } from "@/components/ui/styles";

export function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [pending, setPending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);

    try {
      const response = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        setError(payload?.error?.message ?? "We could not send that link. Try again.");
        return;
      }

      setSent(true);
    } catch {
      setError("Network error. Check your connection and try again.");
    } finally {
      setPending(false);
    }
  }

  if (sent) {
    return (
      <div className="mt-8">
        <Alert tone="info" title="Check your email">
          If that address has a Forge account, a reset link is on its way. It can be used once. Check spam
          before requesting another.
        </Alert>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="mt-8 rounded border border-card-border bg-card p-6">
      <div className="space-y-5">
        <Field id="email" label="Email" hint="The address on your Forge account.">
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
      </div>

      {error ? (
        <div className="mt-5">
          <Alert tone="error">{error}</Alert>
        </div>
      ) : null}

      <button type="submit" disabled={pending} className={buttonStyles("primary", "lg", "mt-6 w-full")}>
        {pending ? "Sending…" : "Send reset link"}
      </button>

      <p className="mt-4 text-xs leading-relaxed text-muted">
        We do not say whether an address is registered — that would let anyone test which emails have
        accounts here.
      </p>
    </form>
  );
}
