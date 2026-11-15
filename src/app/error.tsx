"use client";

import { useEffect } from "react";
import Link from "next/link";
import { buttonStyles, eyebrowStyles } from "@/components/ui/styles";

/**
 * Route-level error recovery.
 *
 * Server components can throw during data access; without this file Next shows
 * its own error screen, which looks like the product broke. This offers the two
 * things a user actually needs: try again, and get somewhere safe.
 */
export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // The digest is the only safe thing to log: it correlates with server logs
    // without carrying any personal data into the browser console.
    console.error("Forge route error", { digest: error.digest });
  }, [error]);

  return (
    <div className="mx-auto flex min-h-[70vh] w-full max-w-md flex-col justify-center px-6 py-16">
      <p className={eyebrowStyles}>Something failed</p>
      <h1 className="mt-3 text-[28px] font-semibold leading-tight tracking-tight text-foreground">
        That did not load.
      </h1>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
        Nothing was saved or lost — this page could not be read. Trying again usually fixes it; if it keeps
        failing, the database connection is the likely cause.
      </p>

      <div className="mt-6 flex flex-wrap gap-3">
        <button type="button" onClick={reset} className={buttonStyles("primary", "md")}>
          Try again
        </button>
        <Link href="/dashboard" className={buttonStyles("secondary", "md")}>
          Go to dashboard
        </Link>
      </div>

      {error.digest ? (
        <p className="mt-8 font-mono text-[10px] uppercase tracking-[0.1em] text-muted">
          reference {error.digest}
        </p>
      ) : null}
    </div>
  );
}
