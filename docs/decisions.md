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

## Tracks are a checked-in JSON file, not a database table

**Decision.** `content/tracks.json` holds the three launch tracks and their
sub-skill tags; `src/lib/tracks.ts` validates it with Zod, and challenges refer
to a track by id. Adding a track is a JSON edit plus content, not a migration and
a code change.

**Rejected.** A `tracks` table edited from an admin UI: it would need a second
source of truth, a caching strategy and an editing surface before there is
anyone to edit it. Copy changes are still code review, which is what a launch
surface should be.

**Tradeoff.** Track edits ship with a deploy. When tracks genuinely need product
management, the JSON loader is replaced by a table read and the file becomes the
seed — the schema and IDs are already stable enough for that.

## Ratings are Glicko-2 and always rebuildable from the attempt log

**Decision.** A rating per user per track and per sub-skill, updated with
Glicko-2. The outcome of an attempt is its normalised score, not a win, so a 72
on a hard challenge and a 72 on an easy one are different events. The stored
number is a cache of `rebuildRating(attempts)`, which is the source.

**Rejected.** (a) Elo: one number with no interval, so a rating from three
attempts looks as certain as one from thirty. (b) A stored XP or level table: a
second source of truth that drifts the first time a rule changes. (c) Hiding the
uncertainty and showing "1420": the interval is the part that stops a rating from
being read as a grade.

**Tradeoff.** Glicko-2 is more code than Elo and its volatility step is easy to
get wrong, so the update is unit-tested for direction, for the deviation floor
and ceiling, and for order-independent rebuilding. Ratings at 350 deviation are
shown as "too few attempts to place this yet" rather than as a number.

## The daily pick is deterministic, not random

**Decision.** `pickChallenge` is a pure function of the candidate set, the
sub-skill ratings, the last attempt per tag and the date. Same day, same inputs,
same challenge; a refresh never reshuffles the day.

**Order.** Never repeat inside 14 days; on a scheduled day, prefer a tag last
practised 3–10 days ago (the window where re-testing helps); otherwise the
challenge whose expected score is closest to 0.7, nudged toward the weakest tag
so a gap gets practice rather than avoidance.

**Tradeoff.** There is no exploration randomness, so a cohort sees a similar
sequence. That is the right trade for a trust product: a user should be able to
ask why they got this challenge and receive an answer, not a coin flip.

## The attempt route picks its grader from the challenge format

**Decision.** `resolveGradingPlan` chooses sandbox, rubric or rubric-v1 purely
from the format and what is configured. A row's `model` document decides whether
the new path applies at all: rows without one keep rubric-v1, because inventing
tests for them would mean scoring against a rubric nobody wrote.

**Fallbacks.** A missing `JUDGE0_URL` or `ANTHROPIC_API_KEY` drops to rubric-v1
and says so in the stored flags (`fallback:sandbox_not_configured`,
`fallback:grader_not_configured`). A grader that *is* configured but fails does
not fall back: the attempt is stored with `status: "pending"` and no score. A
score that silently changed meaning is worse than a score that is late.

**Tradeoff.** Two shapes now exist in `submission`: the rubric-v1 breakdown the
result page renders, and the new grader's detail beside it under `grading`. That
duplication goes away when the result page is rebuilt in Phase 2; keeping it for
now means the page cannot break for rows the new grader scored.

## Hidden tests are removed by construction, not by convention

**Decision.** `publicChallenge()` is the only projection a client may receive;
its return type has no `tests` and no `reference` field. Test categories are
exposed so feedback can name what failed without naming the input.

**Rejected.** Returning the full document and asking callers to strip fields:
that is a leak waiting for the next contributor who forgets.

**Tradeoff.** The projection is a second shape to keep in sync with the model.
The compiler catches a missing field; a forgotten filter in a route would not.

## Environment validation warns in development, fails in production

**Decision.** `src/lib/env-schema.ts` parses the environment with Zod and is
called from `instrumentation.ts` once per server start. Missing required values
throw in production at boot; in development they print one warning line per key
and the marketing, status and legal pages keep working.

**Rejected.** (a) Validating at first request: the failure surfaces in front of
whoever tried to practise, with no operator watching. (b) Validating during
`next build`: a machine without secrets cannot build, which makes CI and preview
deployments worse. (c) Validating in every module that reads `process.env`: nine
copies of the rules, guaranteed to drift.

**Tradeoff.** Development can run with an incomplete environment, so a missing
key is a console line rather than a crash. That is the right trade for a
repository people clone before they have a database, and the production path
still refuses to start.

## One SQL file, applied twice safely

**Decision.** `supabase/schema.sql` stays the single source of truth and is
written to be idempotent; `scripts/db-apply.sh` applies it plus `seed.sql`.

**Rejected.** Introducing a `migrations/` directory by copying the 1,300-line
schema into `0001_init.sql`. Two copies of the same DDL drift the first time
someone edits one of them, and this project has no migration history to
preserve.

**Tradeoff.** No ordered migrations means no way to express a destructive
change as a step. When the first one is needed, the file becomes
`migrations/0001_baseline.sql` copied verbatim, and subsequent changes get their
own numbered files. That is a five-minute change, not a design decision worth
paying for today.

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

## Reviews are blind, append-only, and never inside the attempt

**Decision.** `attempt_reviews` is a separate table with one row per attempt, no
update/delete policies, and writes only through `submit_attempt_review()`. The
`review_queue()` function deliberately omits the author's id.

**Why.** A score that can be edited is not evidence, so the verdict cannot live
in `challenge_attempts`. Blind review stops a verdict becoming a judgement about
a person, and omitting the reviewer id from the queue stops the queue being used
to look up who wrote what.

**Rejected.** Storing the verdict on the attempt (mutability), letting reviewers
SELECT attempts directly (exposes author and full history), and showing the
rubric score in the queue (anchoring: reviewers would agree with the number).

**Tradeoff.** One verdict per attempt, so a disputed review cannot be
overridden — it needs a second attempt or an explicit admin process later. The
rubric score is recorded at review time, which makes agreement measurable
(`src/lib/review.ts` → `calibration`).

## Tests run on the Node test runner, not a framework

**Decision.** `npm test` runs `node --test` with `--experimental-strip-types`
over the pure modules.

**Rejected.** Adding Jest/Vitest: a large dependency tree to test four
dependency-free modules. Playwright is still the right tool for the end-to-end
flow and is not yet installed (it needs a running database).

**Tradeoff.** Requires Node ≥ 22.6 (recorded in `engines`). Tests cover logic,
not the HTTP layer; the acceptance flow in the brief is still unproven without a
Supabase project.

## Retries are labelled, and do not count

A weak attempt offers a variant: same track and shared sub-skill, a different prompt, chosen deterministically from the catalogue (`src/lib/variant.ts`). The new attempt stores `retry_of`, the streak trigger returns early when it is set, and ratings and the daily picker drop retries before rebuilding. Repeating a prompt you have already read measures memory, not the skill, so it must not extend a streak, move a rating, or count as a day's practice — while staying in the record, because hiding practice would make the record dishonest.
