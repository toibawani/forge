"use client";

/**
 * Last resort: the root layout itself failed, so this file renders its own
 * <html> and <body> and cannot rely on the app's stylesheet classes resolving.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#f7f6f3",
          color: "#1a1a1a",
          fontFamily: "system-ui, -apple-system, sans-serif",
          padding: "24px",
        }}
      >
        <main style={{ maxWidth: "420px" }}>
          <p
            style={{
              margin: 0,
              fontFamily: "ui-monospace, monospace",
              fontSize: "10px",
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              color: "#6b6b6b",
            }}
          >
            Forge
          </p>
          <h1 style={{ margin: "12px 0 0", fontSize: "26px", letterSpacing: "-0.01em" }}>
            The app could not start.
          </h1>
          <p style={{ margin: "10px 0 0", fontSize: "14px", lineHeight: 1.6, color: "#4a4a4a" }}>
            Your record is untouched. Reload the page; if it keeps happening, the deployment is
            misconfigured rather than your account.
          </p>
          <button
            type="button"
            onClick={reset}
            style={{
              marginTop: "20px",
              padding: "10px 18px",
              borderRadius: "6px",
              border: "none",
              background: "#1c3d5a",
              color: "#f7f6f3",
              fontSize: "14px",
              fontWeight: 500,
              cursor: "pointer",
            }}
          >
            Reload Forge
          </button>
          {error.digest ? (
            <p style={{ marginTop: "24px", fontFamily: "ui-monospace, monospace", fontSize: "10px", color: "#6b6b6b" }}>
              reference {error.digest}
            </p>
          ) : null}
        </main>
      </body>
    </html>
  );
}
