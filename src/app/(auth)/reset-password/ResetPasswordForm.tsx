"use client";

import { useState } from "react";
import Link from "next/link";
import { Alert } from "@/components/ui/Alert";
import { Field, TextInput } from "@/components/ui/Field";
import { buttonStyles } from "@/components/ui/styles";

export function ResetPasswordForm() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [updated, setUpdated] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);

    try {
      const response = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password, confirmPassword }),
      });

      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        setError(payload?.error?.message ?? "We could not update that password. Try again.");
        return;
      }

      setUpdated(true);
      setPassword("");
      setConfirmPassword("");
    } catch {
      setError("Network error. Check your connection and try again.");
    } finally {
      setPending(false);
    }
  }

  if (updated) {
    return (
      <div className="mt-8 space-y-5">
        <Alert tone="success" title="Password updated">
          Your record is unchanged and your streak is intact. Sign in with the new password next time.
        </Alert>
        <Link href="/dashboard" className={buttonStyles("primary", "md")}>
          Go to your dashboard
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="mt-8 rounded border border-card-border bg-card p-6">
      <div className="space-y-5">
        <Field
          id="password"
          label="New password"
          hint="At least 10 characters, with upper and lower case and a number."
        >
          <TextInput
            id="password"
            name="password"
            type="password"
            autoComplete="new-password"
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="New password"
          />
        </Field>

        <Field id="confirmPassword" label="Confirm new password">
          <TextInput
            id="confirmPassword"
            name="confirmPassword"
            type="password"
            autoComplete="new-password"
            required
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            placeholder="Repeat it"
          />
        </Field>
      </div>

      {error ? (
        <div className="mt-5">
          <Alert tone="error">{error}</Alert>
        </div>
      ) : null}

      <button type="submit" disabled={pending} className={buttonStyles("primary", "lg", "mt-6 w-full")}>
        {pending ? "Updating…" : "Set new password"}
      </button>
    </form>
  );
}
