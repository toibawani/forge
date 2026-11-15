"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Alert } from "@/components/ui/Alert";
import { buttonStyles } from "@/components/ui/styles";
import { skillLabel } from "@/lib/challenges";
import { VERDICTS, type Verdict } from "@/lib/review";

export function ReviewCard({
  attemptId,
  answer,
  challengeTitle,
  category,
  difficulty,
  submittedAt,
}: {
  attemptId: string;
  answer: string;
  challengeTitle: string;
  category: string;
  difficulty: string;
  submittedAt: string;
}) {
  const router = useRouter();
  const [verdict, setVerdict] = useState<Verdict | null>(null);
  const [note, setNote] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (!verdict) {
      setError("Choose a verdict first.");
      return;
    }

    if (note.trim().length < 10) {
      setError("Add a short note explaining the verdict (at least 10 characters).");
      return;
    }

    setPending(true);
    setError(null);

    try {
      const response = await fetch("/api/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ attemptId, verdict, note }),
      });

      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        setError(payload?.error?.message ?? "We could not save that review. Try again.");
        return;
      }

      router.refresh();
    } catch {
      setError("Network error. Check your connection and try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <article className="rounded border border-card-border bg-card">
      <header className="flex flex-wrap items-baseline justify-between gap-2 border-b border-card-border px-6 py-4">
        <h2 className="text-sm font-medium text-foreground">{challengeTitle}</h2>
        <p className="font-mono text-[10px] uppercase tracking-[0.1em] text-muted">
          {skillLabel(category)} · {difficulty} ·{" "}
          {new Date(submittedAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
        </p>
      </header>

      <div className="px-6 py-5">
        <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted">Submitted answer</p>
        <pre className="mt-2 max-h-80 overflow-auto whitespace-pre-wrap break-words font-sans text-sm leading-relaxed text-foreground">
          {answer}
        </pre>
      </div>

      <div className="border-t border-card-border px-6 py-5">
        <fieldset>
          <legend className="text-sm font-medium text-foreground">Your verdict</legend>
          <div className="mt-3 space-y-2">
            {VERDICTS.map((option) => (
              <label
                key={option.value}
                className={`flex cursor-pointer items-start gap-3 rounded border px-3 py-2.5 text-sm transition-colors ${
                  verdict === option.value
                    ? "border-primary/40 bg-primary/[0.04]"
                    : "border-card-border hover:bg-foreground/[0.02]"
                }`}
              >
                <input
                  type="radio"
                  name={`verdict-${attemptId}`}
                  value={option.value}
                  checked={verdict === option.value}
                  onChange={() => setVerdict(option.value)}
                  className="mt-1"
                />
                <span>
                  <span className="block text-foreground">{option.label}</span>
                  <span className="mt-0.5 block text-xs leading-relaxed text-muted">{option.hint}</span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        <label className="mt-4 block text-sm font-medium text-foreground" htmlFor={`note-${attemptId}`}>
          Why
          <textarea
            id={`note-${attemptId}`}
            value={note}
            onChange={(event) => setNote(event.target.value)}
            rows={3}
            maxLength={1000}
            placeholder="What decides it: the approach, the numbers, the missing step."
            className="mt-2 w-full rounded border border-card-border bg-background px-3 py-2 text-sm font-normal text-foreground placeholder:text-muted/70"
          />
        </label>

        {error ? (
          <div className="mt-3">
            <Alert tone="error">{error}</Alert>
          </div>
        ) : null}

        <div className="mt-4 flex items-center gap-3">
          <button
            type="button"
            onClick={() => void submit()}
            disabled={pending}
            className={buttonStyles("primary", "md")}
          >
            {pending ? "Saving…" : "Record verdict"}
          </button>
          <span className="text-xs text-muted">{note.trim().length}/1000</span>
        </div>
      </div>
    </article>
  );
}
