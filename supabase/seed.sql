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
