-- Seed challenges — a small, honest catalogue across four disciplines.
-- Content is data only; nothing here is personal data.

insert into public.challenges (slug, title, description, difficulty, category, estimated_minutes, content, rubric, time_limit_seconds)
values
  (
    'code-fix-off-by-one',
    'Fix the off-by-one',
    'A pagination helper drops the final record of every page. Find the bug, explain it in one sentence, and return the corrected function.',
    'beginner',
    'engineering',
    8,
    '{"language":"typescript","given":"function page(items, size, index) { const start = index * size; return items.slice(start, start + size - 1); }","prompt":"Return the corrected function plus a one-sentence explanation."}'::jsonb,
    '{"signals":["correctness","clarity"],"min_words":15}'::jsonb,
    900
  ),
  (
    'code-n-plus-one',
    'Diagnose the N+1 query',
    'Given a request log and an ORM snippet, identify the N+1 query pattern and rewrite the data access so the request issues two queries instead of N+1.',
    'intermediate',
    'engineering',
    12,
    '{"language":"typescript","prompt":"Explain the root cause, then show the rewritten query."}'::jsonb,
    '{"signals":["diagnosis","performance"],"min_words":30}'::jsonb,
    1200
  ),
  (
    'design-empty-state',
    'Design a trustworthy empty state',
    'A hiring dashboard has no candidates yet. Specify the layout, copy, and primary action for the empty state. Keep it serious, not cheerful filler.',
    'beginner',
    'design',
    10,
    '{"deliverable":"annotated description or structured spec","constraints":["no illustration clichés","one primary action"]}'::jsonb,
    '{"signals":["hierarchy","copy","restraint"],"min_words":40}'::jsonb,
    900
  ),
  (
    'data-cohort-read',
    'Read the cohort table',
    'A 30-day retention table is shown. State what actually happened, what you cannot conclude from the data, and the one metric you would ask for next.',
    'intermediate',
    'analysis',
    12,
    '{"format":"table","period":"30 days","prompt":"Three short answers: finding, limitation, next metric."}'::jsonb,
    '{"signals":["statistical honesty","prioritisation"],"min_words":45}'::jsonb,
    1200
  ),
  (
    'writing-tighten-update',
    'Tighten a vague status update',
    'Rewrite a 120-word project update so a busy executive can act on it in ten seconds. Preserve every fact, cut every hedge.',
    'beginner',
    'writing',
    7,
    '{"input":"We are generally making good progress on the migration and have been working closely with stakeholders to align on the approach, with some remaining items still being discussed.","constraints":["<= 45 words","no hedging"]}'::jsonb,
    '{"signals":["concision","specificity"],"min_words":20}'::jsonb,
    600
  )
on conflict (slug) do nothing;

-- Additional catalogue: each discipline now has a beginner → advanced path.
insert into public.challenges (slug, title, description, difficulty, category, estimated_minutes, content, rubric, time_limit_seconds)
values
  (
    'code-race-condition',
    'Find the race condition',
    'A booking endpoint checks availability and then inserts, in two separate statements. Explain the window, name the failure mode under concurrent requests, and describe the smallest correct fix.',
    'advanced',
    'engineering',
    14,
    '{"language":"typescript","given":"const open = await seats.available(slotId);\nif (open > 0) {\n  await seats.book(slotId, userId);\n}","prompt":"Identify the race, then give the smallest change that makes it correct under concurrency.","constraints":["name the isolation or locking mechanism","<= 200 words"]}'::jsonb,
    '{"signals":["correctness","concurrency reasoning","specificity"],"min_words":60}'::jsonb,
    1500
  ),
  (
    'code-api-contract',
    'Design the error contract',
    'Given a REST endpoint that currently returns 200 with { error: "..." } on failure, specify a consistent error shape and the status codes for validation, auth, not-found and rate limiting.',
    'intermediate',
    'engineering',
    10,
    '{"prompt":"Write the JSON error contract and map four failure cases to status codes.","constraints":["no stack traces in responses","stable machine-readable codes"]}'::jsonb,
    '{"signals":["consistency","clarity","specificity"],"min_words":50}'::jsonb,
    1200
  ),
  (
    'design-form-error-states',
    'Design the error states',
    'A settings form has six fields and a save button. Specify what the user sees for a single-field validation error, a server failure, and a partial save. Include placement and copy.',
    'intermediate',
    'design',
    12,
    '{"deliverable":"annotated spec","constraints":["no modals","one primary action","errors adjacent to the field they belong to"]}'::jsonb,
    '{"signals":["hierarchy","copy","restraint"],"min_words":50}'::jsonb,
    1200
  ),
  (
    'design-density-review',
    'Cut the dashboard density',
    'A dashboard shows 14 metrics. Choose the four that belong above the fold, justify each cut, and say where the removed metrics should live instead.',
    'advanced',
    'design',
    15,
    '{"deliverable":"four kept metrics + rationale + placement for the rest","constraints":["justify by decision usefulness, not by aesthetics"]}'::jsonb,
    '{"signals":["prioritisation","rationale","clarity"],"min_words":60}'::jsonb,
    1500
  ),
  (
    'data-ab-test-read',
    'Read the A/B result',
    'Control converts at 4.1% on 9,800 users, variant at 4.6% on 9,700. State the observed lift, whether it is distinguishable from noise, and the decision you would actually make.',
    'intermediate',
    'analysis',
    12,
    '{"prompt":"Give lift, noise assessment, and a recommendation with one caveat.","constraints":["show the arithmetic","no p-values without a method"]}'::jsonb,
    '{"signals":["statistical honesty","decisiveness"],"min_words":55}'::jsonb,
    1200
  ),
  (
    'data-metric-definition',
    'Define the metric',
    'Define "weekly active practitioner" precisely enough that two engineers would compute the same number, including edge cases for deleted accounts and duplicate attempts in a day.',
    'beginner',
    'analysis',
    8,
    '{"prompt":"Write the definition, the SQL-shaped logic in words, and two edge cases.","constraints":["no vague adjectives"]}'::jsonb,
    '{"signals":["precision","edge cases"],"min_words":45}'::jsonb,
    900
  ),
  (
    'writing-decision-memo',
    'Write the decision memo',
    'Your team must choose between fixing the legacy importer and rewriting it. Write a one-page memo recommending one path, with the cost of being wrong.',
    'intermediate',
    'writing',
    10,
    '{"input":"Legacy importer: 3 years old, 40% of support tickets, two engineers understand it. Rewrite: 6 weeks, no tickets from the new path expected, but risky before the audit.","prompt":"Recommend one option and state the cost of being wrong.","constraints":["<= 220 words","no hedging"]}'::jsonb,
    '{"signals":["decisiveness","structure","specificity"],"min_words":60}'::jsonb,
    1200
  ),
  (
    'writing-incident-update',
    'Write the incident update',
    'At 30 minutes into an outage you know: the cause is a bad migration, rollback is in progress, 12% of requests are failing, and no data was lost. Write the customer-facing update.',
    'advanced',
    'writing',
    12,
    '{"prompt":"Write the update as it would be sent now, not after resolution.","constraints":["state what is known and unknown","no blame","give the next update time"]}'::jsonb,
    '{"signals":["clarity","honesty","completeness"],"min_words":60}'::jsonb,
    1500
  )
on conflict (slug) do nothing;
