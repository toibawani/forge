-- =====================================================================
-- Practice-day trigger tests
-- =====================================================================
-- Run with:
--   psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f supabase/tests/timezone.sql
-- (or: ./scripts/db-apply.sh --seed --timezone)
--
-- Asserts that the calendar day of an attempt is the person's local day, that a
-- client cannot choose it, that an unknown zone degrades to UTC, and that a
-- retry does not extend a streak. Requires the seeded catalogue.
--
-- Runs in one transaction and rolls back, so it can run against a staging
-- project without leaving rows behind.
-- =====================================================================

begin;

do $$
declare
  u uuid := '00000000-0000-4000-8000-0000000000aa';
  v uuid := '00000000-0000-4000-8000-0000000000bb';
  ch uuid;
  first_attempt uuid;
  d date;
  streak_before integer;
  streak_after integer;
  days_before integer;
  days_after integer;
begin
  select id into ch from public.challenges order by slug limit 1;

  if ch is null then
    raise exception 'TIMEZONE: no challenges found; run this with --seed';
  end if;

  -- Two practitioners are created through auth.users so the signup trigger
  -- builds their profiles, as it does in production.
  insert into auth.users (id, email, raw_user_meta_data, created_at, updated_at)
  values
    (u, 'timezone-a@example.test', '{"role":"practitioner","policy_version":"test"}'::jsonb, now(), now()),
    (v, 'timezone-b@example.test', '{"role":"practitioner","policy_version":"test"}'::jsonb, now(), now())
  on conflict (id) do nothing;

  -- 1. Kolkata: 20:30 UTC is 02:00 the next morning, so the attempt belongs to
  --    the local day rather than the UTC day.
  update public.profiles set timezone = 'Asia/Kolkata' where id = u;

  insert into public.challenge_attempts (user_id, challenge_id, submission, score, time_spent_seconds, created_at)
  values (u, ch, '{"answer":"a"}'::jsonb, 70, 300, '2026-03-14T20:30:00Z')
  returning id, practice_date into first_attempt, d;

  if d <> '2026-03-15' then
    raise exception 'TIMEZONE: Kolkata late-night attempt landed on % not 2026-03-15', d;
  end if;

  -- 2. The same instant is the previous day in Los Angeles.
  update public.profiles set timezone = 'America/Los_Angeles' where id = v;

  insert into public.challenge_attempts (user_id, challenge_id, submission, score, time_spent_seconds, created_at)
  values (v, ch, '{"answer":"b"}'::jsonb, 60, 300, '2026-07-01T02:00:00Z')
  returning practice_date into d;

  if d <> '2026-06-30' then
    raise exception 'TIMEZONE: Los Angeles attempt landed on % not 2026-06-30', d;
  end if;

  -- 3. A client cannot claim a day: a supplied practice_date is overwritten.
  update public.profiles set timezone = 'Asia/Kolkata' where id = u;

  insert into public.challenge_attempts (user_id, challenge_id, submission, score, time_spent_seconds, practice_date)
  values (u, ch, '{"answer":"c"}'::jsonb, 65, 300, '1999-01-01')
  returning practice_date into d;

  if d = '1999-01-01' then
    raise exception 'TIMEZONE: a client-supplied practice_date was accepted';
  end if;

  -- 4. A retry extends neither the streak nor the day count.
  select current_streak, total_practice_days into streak_before, days_before
  from public.streaks where user_id = u;

  insert into public.challenge_attempts (user_id, challenge_id, submission, score, time_spent_seconds, retry_of)
  values (u, ch, '{"answer":"d"}'::jsonb, 90, 300, first_attempt);

  select current_streak, total_practice_days into streak_after, days_after
  from public.streaks where user_id = u;

  if streak_after <> streak_before or days_after <> days_before then
    raise exception 'RETRY: streak moved % -> % and days % -> %', streak_before, streak_after, days_before, days_after;
  end if;

  -- 5. An unresolvable stored zone falls back to UTC instead of failing the
  --    insert: the attempt matters more than the calendar arithmetic.
  update public.profiles set timezone = 'Mars/Olympus_Mons' where id = v;

  insert into public.challenge_attempts (user_id, challenge_id, submission, score, time_spent_seconds, created_at)
  values (v, ch, '{"answer":"e"}'::jsonb, 55, 300, '2026-05-01T23:30:00Z')
  returning practice_date into d;

  if d <> '2026-05-01' then
    raise exception 'TIMEZONE: unknown zone did not fall back to UTC (got %)', d;
  end if;
end
$$;

rollback;

select 'timezone tests passed' as result;
