/**
 * Runs once per server start. Validation has to happen at boot: a deployment
 * missing its database URL should fail where a deploy log is read, not on the
 * first person who tries to practise.
 *
 * Development is intentionally forgiving — the marketing pages, status page and
 * legal pages are useful without a database, and a contributor should not need
 * keys to read the code.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (process.env.NEXT_PHASE === "phase-production-build") return;

  const { reportEnv } = await import("./lib/env-schema");
  reportEnv();
}
