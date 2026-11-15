# Personal Data Breach — Incident Runbook

**Applies to:** Forge (Data Fiduciary) and everyone with production access.
**Legal frame:** Digital Personal Data Protection Act, 2023 — breach notification to the
Data Protection Board of India and to affected Data Principals, without delay.
**Register of record:** `breach_events` (written through `POST /api/admin/breaches`).
**Severity of getting this wrong:** DPDP penalties reach ₹250 crore. Treat every suspected
breach as real until proven otherwise.

---

## 0. The one rule that matters

**Write down time-stamped facts as you go, and never put personal data in the register.**
`breach_events.summary` must describe categories and systems, not people. No emails, names,
user IDs or submission text in that table, in Slack, or in the post-mortem.

Bad: `leaked rows for priya@example.com and 12 others`
Good: `profiles.visibility policy allowed recruiters_only rows to authenticated non-recruiters; 13 practitioner profiles exposed`

---

## 1. Roles

| Role | Responsibility | Who |
|---|---|---|
| Incident Lead | Declares severity, owns the timeline, speaks for Forge | On-call engineer |
| Privacy Lead | Board + Data Principal notification, legal wording | Grievance Officer |
| Scribe | Keeps the timeline, updates the register | Second engineer |
| Comms | User-facing notice, status communication | Product |

Out of hours: the on-call engineer is Incident Lead until handover is explicit.

---

## 2. Detect and classify (first 60 minutes)

Sources that must be checked on any signal: application logs (`logger` JSON lines),
Supabase database and auth logs, `audit_logs` volume anomalies, alerts on 5xx rate,
unexpected `service_role` usage, and reports from users or researchers.

Classify severity immediately — it drives every deadline:

| Severity | Definition | Examples |
|---|---|---|
| Critical | Confidential data widely exposed, or auth/session compromise | `service_role` key leaked, RLS disabled on `profiles` |
| High | Confirmed personal data accessed by an unauthorised party | IDOR exposing another user's attempts, mis-scoped recruiter query |
| Medium | Limited exposure, contained quickly, low sensitivity | Cache serving one user's dashboard to another for minutes |
| Low | No confirmed personal data exposure | Misconfiguration blocked by RLS |

**Log the incident now**, before containment is finished:

```bash
curl -X POST https://<app>/api/admin/breaches \
  -H "Content-Type: application/json" \
  -H "Cookie: <admin session>" \
  -d '{
    "severity": "high",
    "category": "misconfiguration",
    "summary": "profiles visibility policy exposed recruiters_only rows to authenticated non-recruiters",
    "dataCategories": ["profile", "skills", "practice_scores"],
    "affectedUsersEstimate": 13,
    "containmentNotes": "policy replaced, cache purged"
  }'
```

Response contains a reference like `FRG-20261115-A1B2C3`. Use it in every update.

---

## 3. Contain (before you investigate deeply)

1. **Stop the leak, not the product.** Revoke the specific access path first:
   - rotate `SUPABASE_SERVICE_ROLE_KEY` in Supabase → Project settings → API, then redeploy;
   - rotate `CRON_SECRET` and `IP_HASH_PEPPER` (pepper rotation invalidates stored hashes — acceptable);
   - tighten or drop the offending RLS policy with a new migration, never by editing rows by hand.
2. **Freeze evidence.** Export the relevant logs and `audit_logs` window to a restricted bucket.
   Do not delete anything until the Privacy Lead confirms.
3. **Preserve the ability to prove scope.** Count affected rows with SQL, and record the count
   and query in the timeline. The number will be needed for the Board notification.
4. **Require re-authentication if sessions may be compromised:** revoke refresh tokens
   (Supabase → Authentication → Sessions) so users must sign in again.

---

## 4. Assess impact (within 24 hours)

Answer these in writing, in the incident channel:

- What data categories were involved? (email is only in `auth.users`; profile/practice data in `public`)
- How many Data Principals, and can they be identified? If yes, produce a list *outside* the register.
- Was the data encrypted at rest and in transit? (Supabase: yes for both — say so plainly if true.)
- Is there risk of harm: discrimination, financial loss, reputational harm, identity fraud?
- Who else is a processor in the path? (Currently Supabase only.)

If the answer to "was personal data involved" is yes, notification is required. Uncertainty is
not a reason to wait; describe the uncertainty in the notice.

---

## 5. Notify the Data Protection Board of India

- **Timing:** without delay. Forge's internal target is **72 hours from detection**. If it will
  be missed, notify anyway with what is known and follow up.
- **Channel:** the Board's prescribed form/portal (and email to the Board as recorded in the
  compliance file). Legal counsel sends it; the Privacy Lead owns the wording.
- **Contents:** nature and extent of the breach; data categories and approximate number of
  Data Principals; likely consequences; measures taken or proposed; contact point.
- **Record it:** after sending, stamp the register:

```bash
curl -X PATCH https://<app>/api/admin/breaches \
  -H "Content-Type: application/json" \
  -H "Cookie: <admin session>" \
  -d '{"reference":"FRG-20261115-A1B2C3","boardNotified":true,"status":"contained"}'
```

---

## 6. Notify affected Data Principals

Do this even if the Board notification is still being prepared. A clear early notice is better
than a perfect late one.

**Required content, in plain language:**

1. What happened, and when it was detected.
2. Which of their data was involved — and which was not.
3. What Forge has done to contain and fix it.
4. What they should do (e.g. change password, watch for phishing).
5. Who to contact: the Grievance Officer, with a direct email.
6. That they can complain to the Data Protection Board of India.

**Template:**

> **Subject: Security incident affecting your Forge account**
>
> We are writing because a security issue at Forge may have exposed part of your practice record.
> On [date] we discovered [plain description]. The data involved was [categories]. Your password and
> payment details were not involved, because Forge does not store payment details.
>
> We contained the issue on [date] by [action]. We have notified the Data Protection Board of India
> under the DPDP Act, 2023.
>
> What you can do: [specific actions]. You can review what Forge holds about you and export or delete
> it at any time from Settings.
>
> Questions: [Grievance Officer email]. You also have the right to complain to the Data Protection
> Board of India.

After sending, stamp `usersNotified: true` in the register, and record the delivery counts
(sent / bounced) in the incident channel — not in the register.

---

## 7. Close out (within 14 days)

- [ ] Root cause identified and fixed at the cause, not the symptom
- [ ] Regression test added that fails if the issue returns (see `supabase/tests/rls.sql`)
- [ ] `breach_events` row has `status = 'closed'`, `board_notified_at`, `users_notified_at`
- [ ] Post-mortem written: timeline, impact, what worked, what did not, owners and dates
- [ ] Privacy policy updated if data handling changed
- [ ] No personal data left in the incident channel, ticket or register

---

## 8. Standing checks (weekly, 15 minutes)

- `select count(*) from breach_events where status <> 'closed';` — anything open needs a reason.
- Confirm every table in `public` has RLS enabled:
  `select relname from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity;`
  **Any row returned is an incident waiting to happen.**
- Re-run `supabase/tests/rls.sql` against staging; it must pass.
- Confirm `SUPABASE_SERVICE_ROLE_KEY` is only referenced in `src/lib/supabase/admin.ts`.
- Confirm the erasure cron ran in the last 24 hours and its failures are zero.
