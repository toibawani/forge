# Decisions

Short records of choices that are easy to reverse in code and expensive to
reverse in production. Each entry states the decision, what was rejected, and
the tradeoff accepted.

## Rate limiting lives in Postgres, not Redis

**Decision.** `consume_rate_limit(key, limit, window_seconds)` increments a
counter in `public.rate_limits` inside one `insert ... on conflict` statement.
Every app instance calls the same function.

**Rejected.** (a) The previous in-memory `Map`: correct on one instance, useless
on N instances — an attacker spreads requests and gets N times the allowance.
(b) Upstash/Redis: another stateful service to provision, secure, monitor and
pay for, in order to store integers. (c) Platform WAF limits: coarse, cannot key
on user id, and not portable.

**Tradeoff.** Every rate-limit check is a database round trip (~1–3 ms in the
same region). Acceptable because the endpoints that need limiting also touch the
database anyway. Free plan direct connections are capped (~60), so the limiter
must not open its own pool: it reuses the service-role client, which is HTTP.

**Fallback.** Without a service-role key or the SQL function, limiting degrades
to per-instance counters and warns once. It never silently claims to be
distributed: `RateLimitResult.mode` reports `"shared"` or `"instance"`.

## Rate-limit identifiers are server-derived

Keys are built from a verified user id or a hashed IP (`login:<hash>`), never
from a request field. The function is executable by `service_role` only;
`anon` and `authenticated` are revoked, which `supabase/tests/rls.sql` asserts.

## Proxy instead of middleware

**Decision.** `src/proxy.ts` exporting `proxy()`.

**Why.** Next.js 16 renamed the convention; `middleware.ts` still works but is
deprecated. The file is a redirect convenience only — every route and page
re-verifies the session, so removing it would not open a hole.

## Feedback is measured, not generated

**Decision.** `src/lib/feedback.ts` derives every line from a measurement of the
answer (words, paragraphs, figures, code spans, hedges, vague quantifiers).

**Rejected.** An LLM writing encouragement: unauditable, non-deterministic, and
it would put invented praise next to a score people may be judged on.

**Tradeoff.** The feedback cannot say "your diagnosis is wrong" — only that the
answer is thin on evidence. That limitation is stated in the README rather than
papered over, and it is the reason human review is the next phase.

## Levels are computed, never stored

**Decision.** Level is derived at read time from attempts.

**Rejected.** A `user_levels` table: a second source of truth that drifts the
first time a rule changes or a backfill is skipped.

**Tradeoff.** Every read recomputes over a bounded window (last 120 attempts),
which is trivial at this scale. If it ever matters, cache it — do not store it
as authority.

## Selection keeps a dependency-free copy of the level thresholds

`src/lib/challenges.ts` must run in client components, so it does not import
`progression.ts`. That means two implementations of "what level is this
record". The risk is drift, so `challenges.test.ts` asserts
`levelIndexFor(...) === progressFor(...).level.index` across a grid of days and
averages. If those disagree, the test fails before a user sees it.

## Empty answers score zero

The rubric's structural floors meant a blank submission scored 19/100. A score
that can be earned by writing nothing undermines every other number, so scoring
short-circuits to zero. Covered by a test.

## Tests run on the Node test runner, not a framework

**Decision.** `npm test` runs `node --test` with `--experimental-strip-types`
over the pure modules.

**Rejected.** Adding Jest/Vitest: a large dependency tree to test four
dependency-free modules. Playwright is still the right tool for the end-to-end
flow and is not yet installed (it needs a running database).

**Tradeoff.** Requires Node ≥ 22.6 (recorded in `engines`). Tests cover logic,
not the HTTP layer; the acceptance flow in the brief is still unproven without a
Supabase project.
