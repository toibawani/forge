# Forge

**Daily skill proof.**

Short practice challenges that create a living, verifiable record of what you can actually do.

Recruiters get a signal they can trust. People who practise get a habit that improves their craft.

---

## Run it locally

Under ten minutes from a clean clone, assuming Node 22.6+.

```bash
npm install
cp .env.example .env.local      # then fill in the Supabase values
npm run env:check               # says what is missing, prints no secrets
npm run db:apply -- --seed      # schema.sql + demo data (needs DATABASE_URL)
npm run dev
```

Create the Supabase project first and paste three values from Project settings → API:
`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and the service-role key.
Add the database connection string from Project settings → Database if you want to run
the CLI commands. `npm run db:apply` uses `psql`; without it, paste `supabase/schema.sql`
into the Supabase SQL editor.

Checks:

```bash
npm test          # unit tests (pure logic, no database)
npm run typecheck # tsc --noEmit (add this script if absent)
npm run build
npm run test:rls  # RLS assertions; needs DATABASE_URL
npm run e2e       # Playwright smoke test; needs a seeded database
```

The app runs without a database on purpose: marketing, legal and `/status` pages work, and
every data route answers 503 with a clear code rather than a stack trace. In production a
missing required variable fails at boot instead — see `instrumentation.ts`.

## The problem

AI-polished resumes and staged portfolios have broken traditional hiring signals. One-off skill
tests are easy to game. Application volume is high, but real competence is hard to see.

Forge builds continuous evidence through short, daily demonstrations of skill. These signals are
hard to fake and easy to compare over time.

## How it works

1. **Practise daily** — 5–15 minute challenges matched to your field.
2. **Build a record** — every attempt is time-stamped, rubric-scored on the server, and immutable.
3. **Control who sees it** — private by default; opt in to verified recruiters when you want to.

A streak is evidence that you showed up. A score is rubric-scored substance, not a hidden model's
guess. The product says that plainly rather than overselling it.

### Feedback, levels and what comes next

- **Feedback is measured, not generated.** After an attempt the server derives specific observations
  from the answer itself — paragraph count, concrete figures, code references, hedging, vague
  quantifiers — and turns them into "what worked" and "what to change" with one focus instruction.
  Stored with the attempt, so an export still explains itself later.
- **Levels are earned.** Foundations → Practising → Consistent → Proficient → Proven, requiring both
  days practised *and* the average of your most recent scored attempts. There is no XP to farm and
  repeating easy challenges lowers your average rather than inflating a number.
- **Recommendations state their reason.** The next challenge is chosen by rotation (two sessions in
  one skill is a rut), weakest area, then the difficulty your level actually earned. The reason is
  shown, so the recommendation can be argued with.
- **Difficulty is measured, not declared.** `challenge_stats` reports how a challenge actually
  scores (median, quartiles, mean time) from the attempts already recorded. It is shown only once five
  attempts exist, because a median from three attempts is a coincidence — and in a small cohort it can
  identify people. An attempt's result page compares your score to that median, as a distance rather
  than a grade.
- **Recruiter signals favour the present.** `skill_signals` exposes recency and consistency
  (`days_30d`, `strong_days_90d`, `avg_score_90d`, `last_attempt_at`), and search ranks by recent
  activity rather than a lifetime streak.

### Interface and API behaviour

- **The landing page states the limits.** The four things Forge cannot do — score a person rather
  than an answer, certify identity, benchmark a crowd of three, auto-reject on integrity signals —
  are on the page, not in a footnote. The example scorecard is labelled *illustrative* on the card
  itself, because a fabricated record presented as real would contradict the product's argument.
- **⌘K searches the catalogue.** The palette fetches the public challenge list once per session and
  matches titles, skills, slugs and difficulty, so a specific brief is two keystrokes away. If the
  fetch fails, navigation still works.
- **429s carry `Retry-After`.** Derived from the limiter's own reset time, so an hourly window is not
  reported as sixty seconds and a client can back off instead of retrying into the same wall.
- **The crawl surface is deliberate.** `sitemap.xml` lists public pages; `robots.txt` closes every
  session area, API route and practice record. Personal records also carry `noindex` themselves.

## Challenge system and grading (Phase 1)

Tracks are data: `content/tracks.json` defines Coding, SQL and Writing with their
sub-skill tags, formats and grading mode. Challenges live in
`content/challenges/*.json` and validate against a versioned model
(`src/lib/challenge-model.ts`) where an attempt pins `(slug, version)` and a
published challenge is superseded, never edited.

Two grading paths, both tested without external services:

| Path | Code | What it does |
|---|---|---|
| Sandbox | `src/lib/sandbox-core.ts`, `judge0-client.ts` | Batches hidden tests to Judge0, maps statuses, scores 75% correctness / 15% efficiency / 10% time. Hidden inputs and expected outputs never reach the client. |
| Rubric | `src/lib/grader/*` | Grades writing on 0–4 dimensions, two samples, a third on disagreement, median per dimension, and every score must quote the submission. Model output is Zod-validated; injection attempts are flagged, not silently scored. |

```bash
npm run challenge:validate            # schema, track rules, slugs, draft status
npm run challenge:validate -- --run   # also executes reference solutions (needs JUDGE0_URL)
npm run challenge:calibrate           # anchor answers must land in range (needs ANTHROPIC_API_KEY)
```

Grades are immutable rows in `attempt_grades`, written only through a
security-definer function that checks the caller owns the attempt; a trigger
refuses updates and deletes.

The attempt endpoint chooses by format: sandbox for test-graded formats, rubric
for writing, and rubric-v1 when a key is missing (`fallback:*` is stored in the
flags). Rows with no `model` document stay on rubric-v1. A configured grader that
fails mid-run stores the attempt as `pending` with no score rather than
substituting another grader — see `docs/decisions.md`.

## Tech stack

| Layer | Choice |
|---|---|
| Framework | Next.js 16 (App Router) + TypeScript |
| Styling | Tailwind CSS with custom design tokens |
| Database & Auth | Supabase (Postgres + Auth + Row Level Security) |
| Validation | Zod (server-side, every mutation) |
| Fonts | DM Sans + JetBrains Mono |

## Design system

- Warm off-white base `#f7f6f3`, white cards, 1px `#e5e3de` rules
- Deep slate primary `#1c3d5a`, restrained terracotta accent `#c45c26`
- DM Sans for text, JetBrains Mono for figures, labels and timestamps
- No gradients, glassmorphism, glowing borders, or generic AI visual tropes

## Getting started

```bash
npm install
cp .env.example .env.local   # fill in Supabase values
```

### 1. Create the database

In the Supabase SQL editor, run, in order:

1. `supabase/schema.sql` — tables, RLS policies, triggers, views, DPDP functions
2. `supabase/seed.sql` — the starter challenge catalogue

`schema.sql` is the single source of truth. It creates:

- `profiles` — **no email column**; email stays in `auth.users` and is never exposed to other users
- `challenges`, `challenge_attempts` (immutable), `streaks` (written only by a trigger)
- `recruiter_pipelines`, `pipeline_candidates`
- DPDP: `user_consents`, `account_deletions`, `deletion_audit`, `data_requests`, `breach_events`
- `audit_logs`, `profile_views`
- Views `profile_cards` and `skill_signals` — the only window recruiters get

### 2. Run it

```bash
npm run dev
npm test        # rubric, feedback, levels, selection, recruiter helpers (no database needed)
```

### 3. Verify the security model (required before trusting it)

```bash
psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f supabase/tests/rls.sql
```

The script creates three throwaway users, then asserts that cross-user reads, forged inserts,
score tampering, streak minting, role escalation and required-consent withdrawal all **fail**. It
rolls back everything and prints `rls tests passed` only if every assertion held.

## Security model

| Rule | How it is enforced |
|---|---|
| Session is read on the server | `@supabase/ssr` cookie client in every route and page; the browser client is never used to authenticate a request |
| No IDOR | RLS on every table + `.eq("id", user.id)` from the verified session, never from a request body |
| No role escalation | `protect_profile_write` trigger blocks role changes; `admin` cannot be self-assigned |
| Attempts are evidence | No UPDATE/DELETE policies; `update`/`delete` revoked from `authenticated` |
| Streaks cannot be minted | No write policies; maintained by a `security definer` trigger on attempts |
| Recruiters see little | `profile_cards` / `skill_signals` views only, opted-in practitioners, no email |
| CSRF | Same-origin check on every mutation + `SameSite=Lax` httpOnly cookies |
| Input validation | Zod schema on every request body; explicit field allow-lists in updates |
| No PII in caches | `Cache-Control: no-store` on all account routes, middleware-level `no-store` for `/api/*` |
| No PII in logs | Structured logs carry user **id** and request **id**, never email, tokens or IPs |
| Duration cannot be faked | `practice_sessions.started_at` is written by the server before the prompt is shown; the attempt route derives `time_spent_seconds` from it |
| Sessions are private and sealed | RLS on `practice_sessions`, `update`/`delete` revoked, closed by a `security definer` trigger on attempt insert |
| Secrets | `SUPABASE_SERVICE_ROLE_KEY` is imported only by `src/lib/supabase/admin.ts` (`server-only`) |

## DPDP Act 2023 compliance

The maximum penalty is ₹250 crore, so these are product features, not paperwork.

| Requirement | Implementation |
|---|---|
| **Consent** | Per-purpose, versioned, itemised on the signup form above the submit button; required and optional separated; recorded in `user_consents` with policy version and timestamps |
| **Consent withdrawal** | Optional purposes toggled in Settings; mandatory purposes cannot be silently withdrawn (database raises) |
| **Notice** | Privacy Policy in plain English and Hindi, plus Terms, linked before any auth control |
| **Right to access** | `/api/export?format=json` and CSV from Settings |
| **Right to correction** | Profile editing + `data_requests` (kind `correction`) |
| **Right to erasure** | Settings → Delete account: typed confirmation, 30-day grace or immediate; `eraseUserData()` hard-deletes profile, attempts, streaks, pipelines, storage objects, then the auth user |
| **Grace period + audit** | `account_deletions` tracks scheduling/cancellation; `deletion_audit` keeps a peppered hash, mode, and categories erased — no PII |
| **Cache safety** | `no-store` everywhere personal; `purgeUserCaches()` on profile update and erasure (framework revalidation + optional CDN purge hook) |
| **Breach response** | `breach_events` register, admin-only API to open/stamp incidents, `docs/incident-runbook.md` with Board and user notification steps |
| **Retention** | Documented per data category; `purge_expired_data()` runs from the erasure cron (audit 24 months, views 12 months) |
| **Grievance** | Settings request form + Grievance Officer contact, 30-day response commitment |
| **Children** | 18+ only, stated in Terms and Privacy |

### Scheduled erasure

Point a scheduler (Vercel Cron, GitHub Actions, cron) at the erasure worker hourly:

```bash
curl -H "Authorization: Bearer $CRON_SECRET" https://your-app/api/cron/erasure
```

It processes due deletions, records accountability rows, runs retention cleanup, and returns
`{ processed, erased, failed, retention }`. Failures stay in `account_deletions` as `failed` with a
`failure_code` for retry.

### Product email

Optional, and off unless a provider is configured. With neither key set, the app returns
`email_not_configured` and sends nothing — it never logs a message as delivered when it was not.

```bash
# Weekly record, Monday morning
curl -H "Authorization: Bearer $CRON_SECRET" https://your-app/api/cron/weekly-summary

# Streak warnings, late in the day (POST so a link check cannot fire it)
curl -X POST -H "Authorization: Bearer $CRON_SECRET" https://your-app/api/cron/weekly-summary
```

Two transports, chosen by whichever key is present:

| Transport | Env | What it owns |
|---|---|---|
| Knock (orchestration) | `KNOCK_API_KEY`, `KNOCK_SIGNING_KEY` | Templates, recipient preferences, unsubscribe — Forge triggers `weekly-summary` / `streak-warning` workflows |
| Resend (direct) | `RESEND_API_KEY`, `EMAIL_FROM` | Forge renders the HTML itself and posts it |

Consent is the gate: only a person whose latest `product_emails` consent is granted receives mail,
and every message links to the consent toggles at `/settings#emails`. A week with no attempts
produces no email rather than a zero.

## Environment variables

| Name | Scope | Purpose |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | public | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | public | Anon key, constrained by RLS |
| `SUPABASE_SERVICE_ROLE_KEY` | **server only** | Erasure, breach register, cron |
| `NEXT_PUBLIC_APP_URL` | public | Origin for redirects and same-origin checks |
| `IP_HASH_PEPPER` | **server only** | Salt for IP and user-reference hashes |
| `CRON_SECRET` | **server only** | Bearer token for `/api/cron/*` |
| `KNOCK_API_KEY` / `KNOCK_SIGNING_KEY` | **server only** | Optional: email via Knock workflows |
| `RESEND_API_KEY` / `EMAIL_FROM` | **server only** | Optional: direct email send |
| `NEXT_PUBLIC_GRIEVANCE_EMAIL` | public | Grievance Officer contact |
| `CACHE_PURGE_URL` / `CACHE_PURGE_TOKEN` | **server only** | Optional CDN purge on update/delete |

## Routes

```
/                        landing
/login, /signup          auth + itemised consent
/forgot-password        request a one-time recovery link (no account enumeration)
/reset-password         set a new password inside the recovery session
/auth/callback           email confirmation / recovery exchange
/dashboard               streak, consistency, 14-day activity, recent sessions
/dashboard/recruiter     candidate search over opted-in records (recruiter/admin)
/dashboard/recruiter/compare   side-by-side comparison of selected records
/dashboard/review        blind review queue: verdict on correctness (reviewer/admin)
/p/[id]                  shareable practice record: signals, recency, no contact details
/practice                skill picker, recommendation, catalogue
/practice/[slug]         focused runner: brief, timer, answer, submit
/practice/[slug]/result/[attemptId]   score, rubric signals, streak, delta
/profile                 full skill record timeline
/settings                profile, consent register, export, data requests, delete account
/privacy, /privacy/hindi policy in English and Hindi
/terms                   terms of service
/status                  human-readable deployment health (same checks as /api/health)
/sitemap.xml             public pages only
/robots.txt              crawlers allowed on marketing/legal, closed everywhere else

POST   /api/auth/signup | login | logout | forgot-password | reset-password
GET    /api/auth/…       (session cookie based, httpOnly)
GET    /api/challenges   public catalogue
GET    /api/health       unauthenticated health: config, database, schema presence (booleans only)
POST   /api/challenges   record an attempt (rubric v1, server-scored, server-timed, idempotent)
POST   /api/practice/sessions   open a timed session before the prompt renders
GET    /api/profile      own profile
PATCH  /api/profile      update allowed fields, purges caches
GET    /api/export       full data export (json | csv)
GET    /api/account/consent        consent register
POST   /api/account/consent        grant / withdraw optional purpose
GET    /api/account/delete         current deletion state
POST   /api/account/delete         schedule or immediately erase
POST   /api/account/delete/cancel  cancel within grace period
GET    /api/account/requests       data principal requests
POST   /api/account/requests       raise access / correction / grievance / nomination
GET    /api/recruiters/search      opted-in practitioners + skill signals + review counts (recruiter only)
GET    /api/reviews/queue          unreviewed attempts, blind to the author (reviewer/admin)
POST   /api/reviews                record a verdict; refuses self-review and second verdicts
GET    /api/pipelines              own pipelines (recruiter only)
POST   /api/pipelines              create pipeline
POST   /api/pipelines/:id/candidates   add candidate (must be discoverable)
PATCH  /api/pipelines/:id/candidates   move stage
GET    /api/admin/breaches         breach register (admin only)
POST   /api/admin/breaches         log a breach (admin only)
PATCH  /api/admin/breaches         stamp containment / notifications (admin only)
GET    /api/cron/erasure           scheduled erasure + retention (bearer token)
GET    /api/cron/weekly-summary    weekly record email for consenting users (bearer token)
POST   /api/cron/weekly-summary    streak warnings, still-open streaks only (bearer token)
```

## Project structure

```
src/
├── app/
│   ├── (auth)/login, (auth)/signup     auth pages + forms
│   ├── api/…                           route handlers, all wrapped by lib/api.ts
│   ├── auth/callback/route.ts          email link exchange
│   ├── dashboard, profile, settings    authenticated surfaces
│   ├── privacy, privacy/hindi, terms   policy pages
│   └── layout.tsx, globals.css         fonts + design tokens
├── components/ui/                      Button styles, Field, Alert primitives
├── lib/
│   ├── api.ts                          auth/origin/validation/error wrapper
│   ├── consent.ts                      shared consent copy + policy version
│   ├── dpdp.ts                         erasure, cache purge, accountability (server-only)
│   ├── env.ts                          public/server env separation
│   ├── request-meta.ts                 salted IP hashing, breach references
│   ├── scoring.ts                      rubric v1 (deterministic, explainable)
│   ├── feedback.ts                      mentor feedback derived from the answer
│   ├── progression.ts                   earned levels, trends, milestones
│   ├── challenges.ts                    catalogue helpers + reasoned recommendation
│   ├── recruiter.ts                     recency / consistency presentation helpers
│   ├── review.ts                        verdict labels, review summaries, calibration
│   └── *.test.ts                       node:test suites for the pure modules
│   ├── supabase/{server,client,admin}.ts
│   ├── validations.ts                  Zod schemas
│   ├── rate-limit.ts, logger.ts, audit-logger.ts
└── proxy.ts                            session refresh + route redirects (Next 16)
supabase/
├── schema.sql                          canonical schema + RLS
├── seed.sql                            challenge catalogue
└── tests/rls.sql                       cross-user access regression tests
docs/incident-runbook.md                DPDP breach response
docs/decisions.md                       why limits live in Postgres, levels are computed, etc.
```

## Known limitations

- **Rate limiting is shared through Postgres** (`consume_rate_limit`), so it survives multiple
  instances. It needs `SUPABASE_SERVICE_ROLE_KEY`; without it the app falls back to per-instance
  counters and logs a warning. The free plan's direct-connection cap is why the limiter reuses the
  service-role client instead of opening its own pool.
- **Immediate deletion needs the service role.** Without `SUPABASE_SERVICE_ROLE_KEY` the flow
  returns 503 and offers the 30-day path rather than pretending to delete.
- **Scoring is rule-based, not semantic.** Rubric v1 measures completeness, structure and
  specificity. It cannot judge whether an argument is *correct*, so a confident wrong answer can
  score well. Peer or expert review is the next layer, not a model pretending to grade.
- **Human review exists but has no reviewers yet.** The queue, verdicts and recruiter-facing counts
  are implemented; reviewer accounts must be provisioned (`update profiles set role = 'reviewer'`),
  and the queue shows rubric-vs-human agreement with an explicit small-sample warning until 20 verdicts
  exist. Until reviews land, records show no verified badge — that is the intended behaviour, not a gap.
- **Pipelines have an API but no full UI.** Pipelines and their candidate counts are listed; creating
  a pipeline, moving stages and adding candidates is API-only today.
- **No email delivery.** Confirmation and recovery links are sent by Supabase; weekly summaries and
  streak warnings are not implemented.
- **Profile-view counting is not wired.** `profile_views` and `profile_views_count` exist; opening
  `/p/[id]` does not increment them yet.
- **Backups are only as good as the provider setting.** Supabase's PITR/backup window must be
  configured; erasure from backups follows that rotation.

## Licence

Private. All rights reserved for now.
