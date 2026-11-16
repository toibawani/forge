"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Alert } from "@/components/ui/Alert";
import { buttonStyles, fieldStyles } from "@/components/ui/styles";
import { clockLabel, type Challenge } from "@/lib/challenges";

type SessionState = {
  id: string;
  /** Local reference point, so a wrong client clock cannot distort the timer. */
  baseElapsed: number;
  allowedSeconds: number;
};

function BriefBlock({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted">{label}</p>
      <div className="mt-2 text-sm leading-relaxed text-foreground">{children}</div>
    </div>
  );
}

export function PracticeRunner({
  challenge,
  consentMissing,
  retryOf,
}: {
  challenge: Challenge;
  consentMissing: boolean;
  /** Set when this attempt is a labelled retry of an earlier one. */
  retryOf?: string;
}) {
  const router = useRouter();
  const [session, setSession] = useState<SessionState | null>(null);
  const [sessionError, setSessionError] = useState<string | null>(null);
  const [starting, setStarting] = useState(!consentMissing);
  const [answer, setAnswer] = useState("");
  const [elapsed, setElapsed] = useState(0);
  const [expired, setExpired] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [idempotencyKey] = useState(() => crypto.randomUUID());

  const startedRef = useRef(false);
  const submittedRef = useRef(false);
  const answerRef = useRef("");
  const storageKey = `forge:draft:${challenge.id}`;

  // State settles in the promise callback, never synchronously, so opening the
  // session on mount cannot cascade renders.
  const startSession = useCallback(() => {
    fetch("/api/practice/sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ challengeId: challenge.id }),
    })
      .then(async (response) => ({ response, payload: await response.json().catch(() => null) }))
      .then(({ response, payload }) => {
        if (!response.ok) {
          setSessionError(
            payload?.error?.message ?? "We could not start a session. Reload to try again."
          );
          setStarting(false);
          return;
        }

        const created = payload.session as { id: string; started_at: string; expires_at: string };
        const startedAtMs = new Date(created.started_at).getTime();
        const expiresAtMs = new Date(created.expires_at).getTime();

        setSession({
          id: created.id,
          baseElapsed: Math.max(0, Math.round((Date.now() - startedAtMs) / 1000)),
          allowedSeconds: Math.max(60, Math.round((expiresAtMs - startedAtMs) / 1000)),
        });
        setStarting(false);
      })
      .catch(() => {
        setSessionError("Network error while starting the session.");
        setStarting(false);
      });
  }, [challenge.id]);

  // Restoring a draft is a read from an external store (localStorage), so it
  // belongs at mount, before the user can type over it. localStorage rather
  // than sessionStorage: a closed tab or a crashed browser should not lose work
  // the user has already done.
  const restoreDraft = useCallback(() => {
    try {
      const draft = window.localStorage.getItem(storageKey);
      if (draft) setAnswer(draft);
    } catch {
      // Private mode without storage: the runner still works.
    }
  }, [storageKey]);

  useEffect(() => {
    // React runs effects twice in development; the session must be opened once.
    if (startedRef.current) return;
    startedRef.current = true;

    restoreDraft();
    if (!consentMissing) startSession();
  }, [consentMissing, restoreDraft, startSession]);

  // Local tick from the received baseline; the server timestamp is the truth.
  useEffect(() => {
    if (!session) return;
    const baseline = Date.now();

    const tick = () => {
      const next = session.baseElapsed + Math.round((Date.now() - baseline) / 1000);
      setElapsed(next);
      if (next >= session.allowedSeconds) setExpired(true);
    };

    tick();
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, [session]);

  // Debounced local autosave. The draft never leaves the browser.
  useEffect(() => {
    answerRef.current = answer;
    const handle = window.setTimeout(() => {
      try {
        if (answer.trim()) window.localStorage.setItem(storageKey, answer);
        else window.localStorage.removeItem(storageKey);
      } catch {
        // ignore quota / private mode
      }
    }, 300);
    return () => window.clearTimeout(handle);
  }, [answer, storageKey]);

  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (answerRef.current.trim() && !submittedRef.current) {
        event.preventDefault();
        event.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, []);

  const restartSession = useCallback(() => {
    setSessionError(null);
    setError(null);
    setExpired(false);
    setStarting(true);
    startSession();
  }, [startSession]);

  const submit = useCallback(async () => {
    if (!session || submitting || expired) return;
    if (answer.trim().length === 0) {
      setError("Write your answer before submitting.");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const response = await fetch("/api/challenges", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          challengeId: challenge.id,
          sessionId: session.id,
          answer: answer.trim(),
          idempotencyKey,
          retryOf,
        }),
      });
      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        const code = payload?.error?.code;
        setError(payload?.error?.message ?? "We could not record that attempt.");
        if (code === "session_expired" || code === "session_not_found") setExpired(true);
        if (code === "already_submitted") {
          setError("This session is already submitted. Open your record to see the result.");
        }
        setSubmitting(false);
        return;
      }

      submittedRef.current = true;
      try {
        window.localStorage.removeItem(storageKey);
      } catch {
        // ignore
      }

      router.replace(`/practice/${challenge.slug}/result/${payload.attempt.id}`);
      router.refresh();
    } catch {
      setError("Network error. Your answer is saved on this device — try submitting again.");
      setSubmitting(false);
    }
  }, [answer, challenge.id, challenge.slug, expired, idempotencyKey, retryOf, router, session, storageKey, submitting]);

  const wordCount = answer.trim() ? answer.trim().split(/\s+/).filter(Boolean).length : 0;
  const minWords = challenge.rubric.min_words ?? 25;
  const overEstimate = elapsed > challenge.estimated_minutes * 60;
  const timeLimitReached =
    challenge.time_limit_seconds !== null && elapsed > challenge.time_limit_seconds;

  if (consentMissing) {
    return (
      <div className="mt-8 rounded border border-card-border bg-card p-6">
        <Alert tone="warning" title="Consent required">
          Forge can only store a practice record with your consent. Record it in{" "}
          <Link href="/settings" className="underline underline-offset-4">
            Settings
          </Link>{" "}
          first — it takes one click and you can withdraw optional parts any time.
        </Alert>
      </div>
    );
  }

  return (
    <>
      <section className="mt-8 rounded border border-card-border bg-card p-6">
        <div className="space-y-6">
          {challenge.content.prompt ? (
            <BriefBlock label="The brief">{challenge.content.prompt}</BriefBlock>
          ) : null}

          {challenge.content.given ? (
            <BriefBlock label="Given">
              <pre className="overflow-x-auto rounded border border-card-border bg-background px-4 py-3 font-mono text-xs leading-relaxed text-foreground">
                {challenge.content.given}
              </pre>
            </BriefBlock>
          ) : null}

          {challenge.content.input ? (
            <BriefBlock label="Input">
              <blockquote className="border-l-2 border-accent/50 pl-4 text-muted-foreground">
                {challenge.content.input}
              </blockquote>
            </BriefBlock>
          ) : null}

          {challenge.content.deliverable ? (
            <BriefBlock label="Deliverable">{challenge.content.deliverable}</BriefBlock>
          ) : null}

          {challenge.content.format ? (
            <BriefBlock label="Format">{challenge.content.format}</BriefBlock>
          ) : null}

          {challenge.content.period ? (
            <BriefBlock label="Scope">{challenge.content.period}</BriefBlock>
          ) : null}

          {challenge.content.constraints && challenge.content.constraints.length > 0 ? (
            <BriefBlock label="Constraints">
              <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
                {challenge.content.constraints.map((constraint) => (
                  <li key={constraint}>{constraint}</li>
                ))}
              </ul>
            </BriefBlock>
          ) : null}
        </div>
      </section>

      <section className="mt-8">
        <div className="flex items-baseline justify-between">
          <label htmlFor="answer" className="text-sm font-medium text-foreground">
            Your answer
          </label>
          <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted">
            {wordCount} words · aim for {minWords}+
          </p>
        </div>

        <textarea
          id="answer"
          value={answer}
          onChange={(event) => setAnswer(event.target.value)}
          onKeyDown={(event) => {
            if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
              event.preventDefault();
              void submit();
            }
          }}
          rows={14}
          spellCheck
          autoFocus
          disabled={!session || expired}
          placeholder={
            challenge.category === "engineering"
              ? "Explain the cause, then show the change. Concrete identifiers beat adjectives."
              : "Answer directly. State the finding, the reasoning, and what you would do next."
          }
          className={`${fieldStyles} mt-3 font-mono text-[13px] leading-6`}
        />

        <p className="mt-2 text-xs text-muted">
          Your draft is kept on this device and cleared once the attempt is submitted. The rubric rewards
          substance and structure, not length.
        </p>
      </section>

      {challenge.rubric.signals && challenge.rubric.signals.length > 0 ? (
        <section className="mt-8 rounded border border-card-border bg-card p-5">
          <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted">
            What is scored
          </p>
          <ul className="mt-3 flex flex-wrap gap-2">
            {challenge.rubric.signals.map((signal) => (
              <li
                key={signal}
                className="rounded border border-card-border px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground"
              >
                {signal}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {sessionError ? (
        <div className="mt-6">
          <Alert tone="error" title="Session not started">
            {sessionError}{" "}
            <button type="button" onClick={restartSession} className="underline underline-offset-4">
              Try again
            </button>
          </Alert>
        </div>
      ) : null}

      {expired ? (
        <div className="mt-6">
          <Alert tone="warning" title="Session expired">
            This session can no longer be submitted. Start a fresh one — the clock restarts, and your draft
            stays in this browser.{" "}
            <button type="button" onClick={restartSession} className="underline underline-offset-4">
              Start a new session
            </button>
          </Alert>
        </div>
      ) : null}

      {error ? (
        <div className="mt-6">
          <Alert tone="error">{error}</Alert>
        </div>
      ) : null}

      {/* Fixed action bar: the only two things that matter while practising. */}
      <div className="fixed inset-x-0 bottom-0 z-10 border-t border-card-border bg-background">
        <div className="mx-auto flex w-full max-w-3xl items-center justify-between gap-4 px-6 py-3">
          <div className="flex items-baseline gap-4">
            <span
              className={`font-mono text-sm tabular-nums ${
                overEstimate ? "text-accent" : "text-foreground"
              }`}
              aria-live="off"
            >
              {clockLabel(elapsed)}
            </span>
            {challenge.time_limit_seconds !== null ? (
              <span
                className={`font-mono text-[10px] uppercase tracking-[0.12em] ${
                  timeLimitReached ? "text-destructive" : "text-muted"
                }`}
              >
                {timeLimitReached
                  ? "over the limit — submit now"
                  : `${clockLabel(Math.max(0, challenge.time_limit_seconds - elapsed))} left`}
              </span>
            ) : (
              <span className="hidden font-mono text-[10px] uppercase tracking-[0.12em] text-muted sm:inline">
                {overEstimate
                  ? "past the estimate — finish the thought"
                  : `est. ${challenge.estimated_minutes} min`}
              </span>
            )}
          </div>

          <button
            type="button"
            onClick={() => void submit()}
            disabled={!session || submitting || answer.trim().length === 0 || expired}
            className={buttonStyles("primary", "md")}
          >
            {starting ? "Starting…" : submitting ? "Scoring…" : "Submit attempt"}
          </button>
        </div>
      </div>
    </>
  );
}
